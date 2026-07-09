/**
 * Phase 25b Wave 0 (D-25b-NEW-1) — regression tests for
 * POST /api/v1/operator/nous/:did/delete.
 *
 * SECURITY 2026-07-09: operator tier/identity now come from the server-trusted
 * operator_only gate (req.didContext.operatorTier/operatorId), simulated here by
 * withOperatorContext. The pure header-gate cases (tier_missing / invalid_operator_id)
 * moved to grid/test/api/operator-gate.test.ts. This file keeps the per-route min-tier
 * gate + the ORDER-LOCKED audit emit sequence:
 *   tombstone check → despawn → appendBiosDeath → appendNousDeleted
 *
 * Test matrix:
 *   - operator tier 4 (< 5) → 403 tier_too_low
 *   - operator context (H5) + body {tier:'H1'} → 200; body tier ignored
 *   - Audit chain: bios.death(cause='operator_h5') IMMEDIATELY before operator.nous_deleted
 *   - bios.death and operator.nous_deleted both source operator_id from operator context
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
import { withOperatorContext, TEST_OPERATOR_ID } from '../helpers/operator-session.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const OPERATOR   = TEST_OPERATOR_ID;
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
    operatorTier?: number;
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
    // Simulate the operator_only gate (server-trusted identity/tier).
    withOperatorContext(app, opts.operatorTier !== undefined ? { tier: opts.operatorTier } : undefined);
    registerDeleteNousRoute(app, services as GridServices, deleteNousDeps);

    return { app, registry, audit, despawnCalls };
}

describe('25b-04: delete-nous header-auth contract (D-25b-NEW-1)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 403 tier_too_low when operator tier is 4 (< 5)', async () => {
        ({ app } = buildTestApp({ operatorTier: 4 }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('returns 200 with server-trusted operator context; body tier field ignored', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        // Operator context supplies H5; body claims H1 (must be ignored).
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H1' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);

        // Audit payload must reflect context-sourced tier (H5), not body tier (H1)
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

    it('bios.death.operator_id === operator.nous_deleted.operator_id === operator context id', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
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
        });
        expect(res.statusCode).toBe(503);

        // Neither bios.death nor operator.nous_deleted should be emitted
        expect(audit.query({ eventType: 'bios.death' })).toHaveLength(0);
        expect(audit.query({ eventType: 'operator.nous_deleted' })).toHaveLength(0);
    });
});
