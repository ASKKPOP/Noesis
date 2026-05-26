/**
 * Phase 36 Wave 0 — visitor public routes test.
 *
 * Asserts unauthenticated GET requests to the 5 public visitor routes return
 * 200 with correct body shape (no Authorization header, no cookie).
 *
 * VIS-01: All public routes accessible without any DID.
 *
 * Tests fail RED until Plan 02 registers the visitor routes under
 * /api/v1/civic-map/state, /api/v1/library/entries, /api/v1/market/listings,
 * /api/v1/polis/bills, /api/v1/nous/:did/public.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';
const NOUS_DID_HASH = 'did:civic:noesis:gen-001';

function buildTestServer(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    return buildServer({ clock, space, logos, audit, gridName: GRID_NAME });
}

describe('visitor public routes — unauthenticated access returns 200', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestServer();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /api/v1/civic-map/state returns 200 with {zones: Array, nous: Array}', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic-map/state' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(Array.isArray(body.zones)).toBe(true);
        expect(Array.isArray(body.nous)).toBe(true);
    });

    it('GET /api/v1/library/entries returns 200 with {entries: Array}', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/library/entries' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(Array.isArray(body.entries)).toBe(true);
    });

    it('GET /api/v1/market/listings returns 200 with {listings: Array}', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/market/listings' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(Array.isArray(body.listings)).toBe(true);
    });

    it('GET /api/v1/polis/bills returns 200 with {bills: Array}', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/polis/bills' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(Array.isArray(body.bills)).toBe(true);
    });

    it('GET /api/v1/nous/:did/public returns 200 with public-only fields', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${NOUS_DID_HASH}/public`,
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);

        // Required public fields (D-36-11)
        expect(body).toHaveProperty('display_name');
        expect(body).toHaveProperty('zone');
        expect(body).toHaveProperty('civic_standing_tier');
        expect(body).toHaveProperty('public_bio');
        expect(body).toHaveProperty('status');

        // Forbidden private fields (D-36-11)
        expect(body).not.toHaveProperty('memory');
        expect(body).not.toHaveProperty('karpathy');
        expect(body).not.toHaveProperty('hypnos');
        expect(body).not.toHaveProperty('pneuma');
        expect(body).not.toHaveProperty('treasury_balance');
    });
});
