/**
 * Phase 8 AGENCY-05 — POST /api/v1/operator/nous/:did/delete route tests.
 *
 * SECURITY 2026-07-09: operator identity/tier now come from the server-trusted
 * operator_only gate (req.didContext.operatorTier/operatorId), simulated here by
 * withOperatorContext — not from client headers or the request body. The pure
 * header-gate cases (401 tier_missing / 400 invalid_operator_id) moved to
 * grid/test/api/operator-gate.test.ts; this file keeps the per-route min-tier
 * gate + the delete business logic.
 *
 * Covers the error ladder:
 *   403  — tier_too_low (operator tier < 5)
 *   400  — malformed DID
 *   410  — tombstoned DID (tombstoneCheck gate)
 *   404  — unknown DID (registry has no record)
 *   503  — Brain RPC failure (no tombstone, no audit)
 *   200  — happy path (tombstone + despawn + audit)
 *
 * D-30 ordering invariant: tombstone BEFORE audit emit.
 * SC#3 invariant: 503 Brain failure → Nous stays active.
 *
 * Uses lightweight Fastify + route registration (mirrors cognitive-snapshot test pattern).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerDeleteNousRoute } from '../../src/api/operator/delete-nous.js';
import { withOperatorContext } from '../helpers/operator-session.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const OPERATOR   = 'op:11111111-1111-4111-8111-111111111111';
const ALPHA_DID  = 'did:noesis:alpha';

const BRAIN_HASHES = {
    psyche_hash:        'a'.repeat(64),
    thymos_hash:        'b'.repeat(64),
    telos_hash:         'c'.repeat(64),
    memory_stream_hash: 'd'.repeat(64),
};

/** Minimal SpawnRequest for NousRegistry.spawn */
function spawnAlpha(registry: NousRegistry): void {
    registry.spawn(
        { did: ALPHA_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
        'test.grid',
        0,
        100,
    );
}

function buildTestApp(opts: {
    brainFetch?: typeof fetch;
    spawnAlpha?: boolean;
    operatorTier?: number;
}): { app: FastifyInstance; registry: NousRegistry; audit: AuditChain; space: SpatialMap; despawnCalls: string[] } {
    const space    = new SpatialMap();
    const registry = new NousRegistry();
    const audit    = new AuditChain();
    const despawnCalls: string[] = [];

    if (opts.spawnAlpha !== false) spawnAlpha(registry);

    const deleteNousDeps = {
        brainFetch: opts.brainFetch ?? (() => Promise.reject(new Error('no fetch'))),
        space,
        coordinator: {
            despawnNous: (did: string) => { despawnCalls.push(did); },
        },
    };

    const services: Partial<GridServices> = {
        clock:    new WorldClock({ tickRateMs: 1_000_000 }),
        space,
        logos:    new LogosEngine(),
        audit,
        gridName: 'test-grid',
        registry,
    };

    const app = Fastify({ logger: false });
    // Simulate the operator_only gate (server-trusted identity/tier).
    withOperatorContext(app, opts.operatorTier !== undefined ? { tier: opts.operatorTier } : undefined);
    registerDeleteNousRoute(app, services as GridServices, deleteNousDeps);

    return { app, registry, audit, space, despawnCalls };
}

describe('AGENCY-05 POST /api/v1/operator/nous/:did/delete — error ladder (D-33)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('403 — operator tier 4 (< 5) → tier_too_low', async () => {
        ({ app } = buildTestApp({ operatorTier: 4 }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('400 — malformed DID (not-a-did)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-did/delete',
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_did');
    });

    it('410 — already tombstoned DID returns 410 Gone', async () => {
        const { app: a, registry, space } = buildTestApp({});
        app = a;
        registry.tombstone(ALPHA_DID, 5, space);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
        expect(res.json().deleted_at_tick).toBe(5);
    });

    it('404 — DID not in registry', async () => {
        ({ app } = buildTestApp({ spawnAlpha: false }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_did');
    });

    it('503 — Brain timeout → no tombstone, no audit event', async () => {
        const brainFetch = vi.fn().mockRejectedValue(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
        );
        const { app: a, registry, audit } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(503);
        // Nous must remain active — tombstone must NOT have fired
        expect(registry.get(ALPHA_DID)?.status).toBe('active');
        // No audit event
        expect(audit.query({ eventType: 'operator.nous_deleted' })).toHaveLength(0);
    });

    it('503 — Brain returns malformed body (missing psyche_hash)', async () => {
        const bad = { ...BRAIN_HASHES, psyche_hash: undefined };
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(bad), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { app: a, registry } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(503);
        expect(registry.get(ALPHA_DID)?.status).toBe('active');
    });

    it('503 — Brain returns extra key (D-03 guard: no 5th hash from Brain)', async () => {
        const leaky = { ...BRAIN_HASHES, state_hash: 'e'.repeat(64) };
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(leaky), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { app: a, registry } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(503);
        expect(registry.get(ALPHA_DID)?.status).toBe('active');
    });

    it('200 happy path — tombstones, despawns, emits audit event (operator_id from header)', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { app: a, registry, audit, despawnCalls } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.ok).toBe(true);
        expect(body.target_did).toBe(ALPHA_DID);
        expect(body.pre_deletion_state_hash).toMatch(/^[0-9a-f]{64}$/);

        // Registry tombstoned
        expect(registry.get(ALPHA_DID)?.status).toBe('deleted');

        // Despawn called
        expect(despawnCalls).toContain(ALPHA_DID);

        // One audit event, correct shape
        const entries = audit.query({ eventType: 'operator.nous_deleted' });
        expect(entries).toHaveLength(1);
        expect(Object.keys(entries[0].payload).sort()).toEqual(
            ['action', 'operator_id', 'pre_deletion_state_hash', 'target_did', 'tier'],
        );
        expect(entries[0].payload).toMatchObject({
            tier: 'H5',
            action: 'delete',
            operator_id: OPERATOR,
            target_did: ALPHA_DID,
        });
        expect((entries[0].payload as { pre_deletion_state_hash: string }).pre_deletion_state_hash)
            .toMatch(/^[0-9a-f]{64}$/);
    });

    it('200 happy path — body tier field ignored (server-trusted context wins)', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { app: a, audit } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        // Send H1 in body — the server-trusted context (H5) must win
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H1' },
        });
        expect(res.statusCode).toBe(200);

        // Audit payload must reflect context-sourced tier (H5), not body tier (H1)
        const entries = audit.query({ eventType: 'operator.nous_deleted' });
        expect((entries[0].payload as { tier: string }).tier).toBe('H5');
    });

    it('D-30 order: tombstone happens BEFORE audit append', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { app: a, registry, audit } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });

        // Both must have happened (tombstone AND audit)
        expect(registry.get(ALPHA_DID)?.status).toBe('deleted');
        expect(audit.query({ eventType: 'operator.nous_deleted' }).at(-1)?.eventType)
            .toBe('operator.nous_deleted');
    });

    it('idempotent second delete → 410 Gone', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        ({ app } = buildTestApp({ brainFetch }));
        await app.ready();

        // First delete
        const r1 = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(r1.statusCode).toBe(200);

        // Second delete
        const r2 = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(r2.statusCode).toBe(410);
    });
});
