import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

describe('Grid API — CORS allowlist', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const audit = new AuditChain();

        space.addRegion({
            id: 'agora', name: 'Agora Central', description: 'Main plaza',
            regionType: 'public', capacity: 100, properties: {},
        });

        app = buildServer({ clock, space, logos, audit, gridName: 'genesis' });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('accepts preflight from http://localhost:3001', async () => {
        const res = await app.inject({
            method: 'OPTIONS',
            url: '/api/v1/grid/regions',
            headers: {
                origin: 'http://localhost:3001',
                'access-control-request-method': 'GET',
            },
        });
        expect(res.statusCode).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
        const methods = String(res.headers['access-control-allow-methods'] ?? '');
        expect(methods.toUpperCase()).toContain('GET');
    });

    it('accepts preflight from http://localhost:3000 (next dev fallback port)', async () => {
        const res = await app.inject({
            method: 'OPTIONS',
            url: '/api/v1/grid/regions',
            headers: {
                origin: 'http://localhost:3000',
                'access-control-request-method': 'GET',
            },
        });
        expect(res.statusCode).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('rejects disallowed origins (omits Access-Control-Allow-Origin)', async () => {
        const res = await app.inject({
            method: 'OPTIONS',
            url: '/api/v1/grid/regions',
            headers: {
                origin: 'https://evil.example.com',
                'access-control-request-method': 'GET',
            },
        });
        // @fastify/cors returns the preflight but omits the allow-origin header
        // for non-allowlisted origins. Browsers will then fail the CORS check.
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('does not affect same-origin requests (no Origin header)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/regions',
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.regions)).toBe(true);
    });
});
