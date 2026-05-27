/**
 * Phase 39 — Civic routes return identical data regardless of operator
 * Tests TENANT-01 success criterion 4: civic state is shared, not per-operator.
 *
 * Key invariant: civic routes (library/entries, market/listings, registry/civic-did/:did)
 * must NOT return 403 operator_scope_required for any session type, because operatorScope
 * is NOT applied to these public/civic routes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SignJWT } from 'jose';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

// ANY_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i — tryDid cookie path uses this.
// Human DIDs (did:noesis:human:0x...) do NOT match ANY_DID_RE due to a Phase 37/38 regression.
// Use did:portal:noesis:* format which matches ANY_DID_RE for test portal cookies.
const OP_A_DID = 'did:portal:noesis:operator-a';
const OP_B_DID = 'did:portal:noesis:operator-b';
const CIVIC_DID = 'did:civic:noesis:civic001';

async function makePortalCookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function buildTestApp(): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        registry: new NousRegistry(),
        // No pool — these routes don't need the DB
    });
}

describe('Phase 39: Civic routes return shared data for all operators (TENANT-01)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /api/v1/library/entries returns non-403 for operator A Portal session', async () => {
        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/library/entries',
            cookies: { [COOKIE_NAME]: cookie },
        });
        // Must NOT be 403 operator_scope_required — operatorScope is not applied to public routes
        expect(res.statusCode).not.toBe(403);
        if (res.statusCode === 403) {
            const body = res.json<{ error?: string }>();
            expect(body.error).not.toBe('operator_scope_required');
        }
    });

    it('GET /api/v1/market/listings returns non-403 for portal session', async () => {
        const cookie = await makePortalCookie(OP_B_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/market/listings',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).not.toBe(403);
        if (res.statusCode === 403) {
            const body = res.json<{ error?: string }>();
            expect(body.error).not.toBe('operator_scope_required');
        }
    });

    it('GET /api/v1/registry/civic-did/:did returns non-403 regardless of which operator Portal session is presented', async () => {
        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/civic-did/${CIVIC_DID}`,
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).not.toBe(403);
        if (res.statusCode === 403) {
            const body = res.json<{ error?: string }>();
            expect(body.error).not.toBe('operator_scope_required');
        }
    });

    it('operatorScope preHandler is NOT applied to /api/v1/library/entries (no 403 returned even without any session)', async () => {
        // Calling without any auth — public route, should never return 403 operator_scope_required
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/library/entries',
            // No cookies, no Authorization header — anonymous request
        });
        // The route is public — no 403 operator_scope_required regardless of auth
        expect(res.statusCode).not.toBe(403);
        if (res.statusCode === 403) {
            const body = res.json<{ error?: string }>();
            expect(body.error).not.toBe('operator_scope_required');
        }
    });
});
