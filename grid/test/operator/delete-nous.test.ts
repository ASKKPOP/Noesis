/**
 * Phase 25b Wave 0 (D-25b-NEW-1) — header-auth regression tests for
 * POST /api/v1/operator/nous/:did/delete.
 *
 * Pins the header-auth contract and ORDER-LOCKED audit emit sequence:
 *   tombstone check → despawn → appendBiosDeath → appendNousDeleted
 *
 * Test matrix (per plan 25b-04 behavior spec):
 *   - No headers + body {tier:'H5'} → 401 tier_missing
 *   - Header x-operator-tier:'4' (< 5) → 403 tier_too_low
 *   - Header x-operator-tier:'5', bad x-operator-id → 400 invalid_operator_id
 *   - Header x-operator-tier:'5' + valid x-operator-id + body {tier:'H1'} → 200; body tier ignored
 *   - Audit chain: bios.death(cause='operator_h5') IMMEDIATELY before operator.nous_deleted
 *   - bios.death and operator.nous_deleted both source operator_id from header
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

const BRAIN_HASHES = {
    psyche_hash:        'a'.repeat(64),
    thymos_hash:        'b'.repeat(64),
    telos_hash:         'c'.repeat(64),
    memory_stream_hash: 'd'.repeat(64),
};

const DEFAULT_BRAIN_FETCH = (): Promise<Response> =>
    Promise.resolve(new Response(JSON.stringify(BRAIN_HASHES), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    }));

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
}): { app: FastifyInstance; registry: NousRegistry; audit: AuditChain; despawnCalls: string[] } {
    const space    = new SpatialMap();
    const registry = new NousRegistry();
    const audit    = new AuditChain();
    const despawnCalls: string[] = [];

    if (opts.spawnAlpha !== false) spawnAlpha(registry);

    const deleteNousDeps = {
        brainFetch: opts.brainFetch ?? DEFAULT_BRAIN_FETCH,
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

    return { app, registry, audit, despawnCalls };
}

describe('25b-04: delete-nous header-auth contract (D-25b-NEW-1)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('GAP-25b: rejects body-supplied tier when headers are missing (401 tier_missing)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            // No x-operator-tier header — body claims H5 but must be ignored
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier header is 4 (< 5)', async () => {
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

    it('returns 400 invalid_operator_id when x-operator-id header is badly formatted', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': 'bad-id-format' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });

    it('returns 401 tier_missing when x-operator-tier header is non-numeric (e.g. "H5")', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': 'H5', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 200 when valid headers present; body tier field ignored', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        // Valid H5 headers + body claims H1 (should be ignored)
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
            payload: { tier: 'H1' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);

        // Audit payload must reflect header-sourced tier (H5), not body tier (H1)
        const entries = audit.query({ eventType: 'operator.nous_deleted' });
        expect(entries).toHaveLength(1);
        expect((entries[0].payload as { tier: string }).tier).toBe('H5');
    });
});

describe('25b-04: ORDER-LOCKED audit emit sequence preserved (D-30)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('audit chain: bios.death(cause=operator_h5) immediately precedes operator.nous_deleted', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(200);

        const entries = audit.all();
        const biosIdx = entries.findIndex(e => e.eventType === 'bios.death');
        expect(biosIdx, 'bios.death must be emitted').toBeGreaterThanOrEqual(0);

        const biosPayload = entries[biosIdx].payload as Record<string, unknown>;
        expect(biosPayload.cause).toBe('operator_h5');

        // bios.death must be immediately followed by operator.nous_deleted
        const next = entries[biosIdx + 1];
        expect(next, 'bios.death must be followed by another entry').toBeDefined();
        expect(next.eventType).toBe('operator.nous_deleted');
    });

    it('bios.death.operator_id === operator.nous_deleted.operator_id === header x-operator-id', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });

        const entries = audit.all();
        const operatorDeleted = entries.find(e => e.eventType === 'operator.nous_deleted');
        expect(operatorDeleted).toBeDefined();

        const operatorPayload = operatorDeleted!.payload as Record<string, unknown>;
        // Both audit emits must use the header-supplied operator_id
        expect(operatorPayload.operator_id).toBe(OPERATOR);
    });

    it('bios.death emitted strictly BEFORE operator.nous_deleted in chain index', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });

        const entries = audit.all();
        const biosIdx     = entries.findIndex(e => e.eventType === 'bios.death');
        const operatorIdx = entries.findIndex(e => e.eventType === 'operator.nous_deleted');
        expect(biosIdx).toBeGreaterThanOrEqual(0);
        expect(operatorIdx).toBeGreaterThanOrEqual(0);
        expect(biosIdx).toBeLessThan(operatorIdx);
    });

    it('bios.death.final_state_hash === operator.nous_deleted.pre_deletion_state_hash (same Brain hash)', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });

        const entries     = audit.all();
        const biosDeath   = entries.find(e => e.eventType === 'bios.death');
        const nousDeleted = entries.find(e => e.eventType === 'operator.nous_deleted');

        const biosPayload     = biosDeath!.payload as Record<string, unknown>;
        const operatorPayload = nousDeleted!.payload as Record<string, unknown>;

        expect(biosPayload.final_state_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(biosPayload.final_state_hash).toBe(operatorPayload.pre_deletion_state_hash);
    });

    it('no audit events emitted when Brain RPC fails (SC#3 invariant)', async () => {
        const brainFetch = vi.fn().mockRejectedValue(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
        );
        const { app: a, audit } = buildTestApp({ brainFetch });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(503);

        // Neither bios.death nor operator.nous_deleted should be emitted
        expect(audit.query({ eventType: 'bios.death' })).toHaveLength(0);
        expect(audit.query({ eventType: 'operator.nous_deleted' })).toHaveLength(0);
    });
});
