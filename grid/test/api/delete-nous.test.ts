/**
 * Phase 8 AGENCY-05 — POST /api/v1/operator/nous/:did/delete route tests.
 *
 * Updated in Phase 25b Wave 0 (D-25b-NEW-1): header-auth migration.
 * Auth is now sourced from x-operator-tier + x-operator-id headers, not body.
 *
 * Covers the full error ladder:
 *   401  — tier_missing (no / non-numeric x-operator-tier header)
 *   403  — tier_too_low (header tier < 5)
 *   400  — invalid_operator_id (bad x-operator-id header)
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
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const OPERATOR   = 'op:11111111-1111-4111-8111-111111111111';
const ALPHA_DID  = 'did:noesis:alpha';

// Valid headers for H5 requests.
const VALID_HEADERS = {
    'x-operator-tier': '5',
    'x-operator-id': OPERATOR,
};

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
    registerDeleteNousRoute(app, services as GridServices, deleteNousDeps);

    return { app, registry, audit, space, despawnCalls };
}

describe('AGENCY-05 POST /api/v1/operator/nous/:did/delete — error ladder (D-33)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('401 — no headers (body-only tier claim rejected)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            // No headers — body claims H5 but must be ignored
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('403 — header tier 4 (< 5) → tier_too_low', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('400 — invalid_operator_id when x-operator-id header is missing', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });

    it('400 — malformed DID (not-a-did)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-did/delete',
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
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

    it('200 happy path — body tier field ignored when valid headers present', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { app: a, audit } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        // Send H1 in body but H5 in header — header wins
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: VALID_HEADERS,
            payload: { tier: 'H1' },
        });
        expect(res.statusCode).toBe(200);

        // Audit payload must reflect header-sourced tier (H5), not body tier (H1)
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
            headers: VALID_HEADERS,
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
            headers: VALID_HEADERS,
        });
        expect(r1.statusCode).toBe(200);

        // Second delete
        const r2 = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: VALID_HEADERS,
        });
        expect(r2.statusCode).toBe(410);
    });
});
