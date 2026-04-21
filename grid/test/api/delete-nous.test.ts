/**
 * Phase 8 AGENCY-05 — POST /api/v1/operator/nous/:did/delete route tests.
 *
 * Covers the full error ladder (D-33):
 *   400  — malformed DID
 *   410  — tombstoned DID (tombstoneCheck gate)
 *   404  — unknown DID (registry has no record)
 *   503  — Brain RPC failure (no tombstone, no audit)
 *   200  — happy path (tombstone + despawn + audit)
 *
 * D-30 ordering invariant: tombstone BEFORE audit emit.
 * SC#3 invariant: 503 Brain failure → Nous stays active.
 *
 * Uses Fastify app.inject so we exercise the full route stack.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const OPERATOR   = 'op:11111111-1111-4111-8111-111111111111';
const ALPHA_DID  = 'did:noesis:alpha';
const HASH64     = 'a'.repeat(64);

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

function buildServices(opts: {
    brainFetch?: typeof fetch;
    spawnAlpha?: boolean;
}): { services: GridServices; registry: NousRegistry; audit: AuditChain; space: SpatialMap; despawnCalls: string[] } {
    const space    = new SpatialMap();
    const registry = new NousRegistry();
    const audit    = new AuditChain();
    const despawnCalls: string[] = [];

    if (opts.spawnAlpha !== false) spawnAlpha(registry);

    const services: GridServices = {
        clock:    new WorldClock({ tickRateMs: 1_000_000 }),
        space,
        logos:    new LogosEngine(),
        audit,
        gridName: 'test-grid',
        registry,
        // Inject coordinator + space + brainFetch via the deleteNous deps hook
        _deleteNousDeps: {
            brainFetch: opts.brainFetch ?? (() => Promise.reject(new Error('no fetch'))),
            space,
            coordinator: {
                despawnNous: (did: string) => { despawnCalls.push(did); },
            },
        },
    } as unknown as GridServices;

    return { services, registry, audit, space, despawnCalls };
}

describe('AGENCY-05 POST /api/v1/operator/nous/:did/delete — error ladder (D-33)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('400 — malformed DID (not-a-did)', async () => {
        const { services } = buildServices({});
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-did/delete',
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_did');
    });

    it('410 — already tombstoned DID returns 410 Gone', async () => {
        const { services, registry, space } = buildServices({});
        registry.tombstone(ALPHA_DID, 5, space);
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
        expect(res.json().deleted_at_tick).toBe(5);
    });

    it('404 — DID not in registry', async () => {
        const { services } = buildServices({ spawnAlpha: false });
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_did');
    });

    it('503 — Brain timeout → no tombstone, no audit event', async () => {
        const brainFetch = vi.fn().mockRejectedValue(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
        );
        const { services, registry, audit } = buildServices({ brainFetch });
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
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
        const { services, registry } = buildServices({ brainFetch });
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(503);
        expect(registry.get(ALPHA_DID)?.status).toBe('active');
    });

    it('503 — Brain returns extra key (D-03 guard: no 5th hash from Brain)', async () => {
        const leaky = { ...BRAIN_HASHES, state_hash: 'e'.repeat(64) };
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(leaky), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { services, registry } = buildServices({ brainFetch });
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(503);
        expect(registry.get(ALPHA_DID)?.status).toBe('active');
    });

    it('400 — wrong tier (H4 instead of H5)', async () => {
        const { services } = buildServices({});
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H4', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_tier');
    });

    it('200 happy path — tombstones, despawns, emits audit event', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { services, registry, audit, despawnCalls } = buildServices({ brainFetch });
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
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

    it('D-30 order: tombstone happens BEFORE audit append', async () => {
        const brainFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BRAIN_HASHES), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const { services, registry, audit } = buildServices({ brainFetch });
        app = buildServer(services);
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
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
        const { services } = buildServices({ brainFetch });
        app = buildServer(services);
        await app.ready();

        // First delete
        const r1 = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(r1.statusCode).toBe(200);

        // Second delete
        const r2 = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(r2.statusCode).toBe(410);
    });
});
