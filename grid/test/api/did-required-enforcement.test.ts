/**
 * Phase 36 Wave 0 — DID required enforcement test.
 *
 * Asserts that POST to any civic write route WITHOUT Authorization header
 * returns 401 {error: 'did_required', accepted_methods: [...]}.
 *
 * VIS-02: Write routes require a Civic-DID; unauthenticated POST returns 401.
 *
 * Tests fail RED until Plan 02 registers the ROUTE_DID_POLICY preHandler
 * that enforces civic_did_required on write routes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';

function buildTestServer(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    return buildServer({ clock, space, logos, audit, gridName: GRID_NAME });
}

const WRITE_ROUTES: [string, string][] = [
    ['POST', '/api/v1/trade'],
    ['POST', '/api/v1/governance/propose'],
    ['POST', '/api/v1/governance/commit'],
    ['POST', '/api/v1/governance/reveal'],
    ['POST', '/api/v1/spawn'],
];

describe('DID required enforcement — unauthenticated POST returns 401 did_required', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestServer();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it.each(WRITE_ROUTES)(
        '%s %s without Authorization returns 401 {error: did_required}',
        async (method, path) => {
            const res = await app.inject({
                method: method as 'POST',
                url: path,
                // No Authorization header — unauthenticated
            });
            expect(res.statusCode).toBe(401);
            const body = JSON.parse(res.payload);
            expect(body.error).toBe('did_required');
            expect(Array.isArray(body.accepted_methods)).toBe(true);
        },
    );

    it('POST /portal/auth/oauth/google returns 501 (stub, public route — no 401)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/portal/auth/oauth/google',
        });
        expect(res.statusCode).toBe(501);
    });
});
