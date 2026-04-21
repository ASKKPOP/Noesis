/**
 * Phase 8 AGENCY-05 — tombstoned DID returns HTTP 410 Gone on every
 * authenticated operator route that accepts a Nous DID parameter (D-28).
 *
 * Routes covered (all have :did param):
 *   GET  /api/v1/nous/:did/state            (inspect)
 *   POST /api/v1/operator/nous/:did/memory/query   (H2 memory query)
 *   POST /api/v1/operator/nous/:did/telos/force    (H4 telos force)
 *   POST /api/v1/operator/nous/:did/delete         (H5 delete — idempotent second call)
 *
 * Invariant: once a Nous is tombstoned, every DID-scoped route must return
 * 410 with { error: 'gone', deleted_at_tick: <n> } rather than 404 or 200.
 * This is checked BEFORE runner/Brain lookup so the registry record's status
 * is the authoritative source of truth.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const OPERATOR_H2 = 'op:22222222-2222-4222-8222-222222222222';
const OPERATOR_H4 = 'op:44444444-4444-4444-8444-444444444444';
const OPERATOR_H5 = 'op:55555555-5555-4555-8555-555555555555';
const ALPHA_DID   = 'did:noesis:alpha';
const TOMBSTONE_TICK = 7;

function buildTombstonedServices(): { services: GridServices; registry: NousRegistry } {
    const space    = new SpatialMap();
    const registry = new NousRegistry();

    // Spawn alpha, then tombstone it
    registry.spawn(
        { did: ALPHA_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
        'test.grid', 0, 100,
    );
    registry.tombstone(ALPHA_DID, TOMBSTONE_TICK, space);

    const services: GridServices = {
        clock:    new WorldClock({ tickRateMs: 1_000_000 }),
        space,
        logos:    new LogosEngine(),
        audit:    new AuditChain(),
        gridName: 'test-grid',
        registry,
        getRunner: () => undefined, // no runners needed — tombstone check fires first
    };

    return { services, registry };
}

describe('AGENCY-05 tombstoned DID → HTTP 410 Gone on all DID-scoped routes (D-28)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('GET /api/v1/nous/:did/state — 410 Gone', async () => {
        const { services } = buildTombstonedServices();
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${ALPHA_DID}/state`,
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
        expect(res.json().deleted_at_tick).toBe(TOMBSTONE_TICK);
    });

    it('POST /api/v1/operator/nous/:did/memory/query — 410 Gone', async () => {
        const { services } = buildTombstonedServices();
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/memory/query`,
            payload: { tier: 'H2', operator_id: OPERATOR_H2, query: 'test' },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
        expect(res.json().deleted_at_tick).toBe(TOMBSTONE_TICK);
    });

    it('POST /api/v1/operator/nous/:did/telos/force — 410 Gone', async () => {
        const { services } = buildTombstonedServices();
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/telos/force`,
            payload: { tier: 'H4', operator_id: OPERATOR_H4, new_telos: { goals: [] } },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
        expect(res.json().deleted_at_tick).toBe(TOMBSTONE_TICK);
    });

    it('POST /api/v1/operator/nous/:did/delete — idempotent second call returns 410 Gone', async () => {
        const { services } = buildTombstonedServices();
        // Already tombstoned — second delete attempt hits tombstoneCheck first
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR_H5 },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
        expect(res.json().deleted_at_tick).toBe(TOMBSTONE_TICK);
    });
});
