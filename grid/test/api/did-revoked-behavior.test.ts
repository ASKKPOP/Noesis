/**
 * Phase 36 Wave 0 — revoked DID behavior test.
 *
 * D-36-09 contract: a revoked Civic-DID reverts to visitor tier.
 * - GET requests (read) with revoked DID bearer → 200 (still accessible as visitor).
 * - POST requests (write) with revoked DID bearer → 401 did_required (falls through to visitor tier).
 * - The 401 body MUST include {error: 'did_required'}, NOT a hard-block 403.
 *
 * Tests fail RED until Plan 02 implements revoked-DID fallthrough in the
 * preHandler — the DID status check that degrades revoked-DID to visitor tier.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';
const REVOKED_DID = 'did:civic:noesis:revoked-test';

// Mock DID-status store that returns 'revoked' for REVOKED_DID
const mockDidStatusStore = {
    getStatus: (did: string): { status: 'active' | 'revoked' | 'unknown' } => {
        if (did === REVOKED_DID) return { status: 'revoked' };
        return { status: 'active' };
    },
};

function buildTestServer(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    // didStatusStore injected via GridServices in Plan 02
    return buildServer({
        clock, space, logos, audit, gridName: GRID_NAME,
        // didStatusStore will be recognized by server.ts after Plan 02 lands
        didStatusStore: mockDidStatusStore as unknown as never,
    });
}

// Simulate a JWT for the revoked DID (will fail verification but tests the route behavior)
const REVOKED_BEARER = `Bearer mock-jwt-for-${REVOKED_DID}`;

describe('revoked DID — D-36-09 revert-to-visitor contract', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestServer();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /api/v1/civic-map/state with revoked DID bearer returns 200 (read access preserved)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/civic-map/state',
            headers: { authorization: REVOKED_BEARER },
        });
        // Revoked DID falls through to visitor tier — read routes are public, so 200
        expect(res.statusCode).toBe(200);
    });

    it('POST /api/v1/trade with revoked DID bearer returns 401 did_required (write access lost)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/trade',
            headers: { authorization: REVOKED_BEARER },
        });
        // Revoked DID falls through to visitor tier — write routes need Civic-DID, so 401
        expect(res.statusCode).toBe(401);
        const body = JSON.parse(res.payload);
        // MUST be did_required (D-36-09), NOT 403 hard-block
        expect(body.error).toBe('did_required');
    });
});
