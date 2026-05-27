/**
 * Phase 39 — GET /api/v1/operator/me/nous
 * Tests cross-operator isolation (TENANT-02)
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// vi.mock must be at top level before any imports from the mocked modules.
vi.mock('../../src/operator/data/operator-brain-store.js', () => ({
    findByOperator: vi.fn(),
    countActiveByOperator: vi.fn(),
    setOwner: vi.fn(),
}));
vi.mock('../../src/operator/data/operator-quota-store.js', () => ({
    getQuotaLimit: vi.fn(),
    getEventRateLimit: vi.fn(),
    getFullQuota: vi.fn(),
    setQuotaOverride: vi.fn(),
}));

import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SignJWT } from 'jose';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';
import { findByOperator } from '../../src/operator/data/operator-brain-store.js';
import { getQuotaLimit } from '../../src/operator/data/operator-quota-store.js';
import type { BrainTokenRecord } from '../../src/db/stores/brain-token-store.js';

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

async function makeCivicBearer(sub: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({})
        .setSubject(sub)
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function buildTestApp(pool?: object): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        registry: new NousRegistry(),
        pool: pool as import('mysql2/promise').Pool,
    });
}

const BRAIN_A: BrainTokenRecord = {
    brainDid: 'did:noesis:nous:brain-a001',
    publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'aaaa' },
    issuedAt: Math.floor(Date.now() / 1000) - 100,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
    revoked: false,
    operatorDid: OP_A_DID,
};

const BRAIN_B: BrainTokenRecord = {
    brainDid: 'did:noesis:nous:brain-b001',
    publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'bbbb' },
    issuedAt: Math.floor(Date.now() / 1000) - 100,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
    revoked: false,
    operatorDid: OP_B_DID,
};

describe('Phase 39: GET /api/v1/operator/me/nous — operator isolation (TENANT-02)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestApp({});
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 with operator A Nous list when Portal session belongs to operator A', async () => {
        vi.mocked(findByOperator).mockResolvedValue([BRAIN_A]);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/nous',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{ nous: Array<{ brain_did: string }> }>();
        expect(body.nous[0].brain_did).toBe('did:noesis:nous:brain-a001');
    });

    it('returns Nous entries with shape: { civic_did, brain_did, status, last_active_tick, zone_id, civic_standing, quota_usage, token_expires_at }', async () => {
        vi.mocked(findByOperator).mockResolvedValue([BRAIN_A]);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/nous',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{ nous: Array<Record<string, unknown>> }>();
        const entry = body.nous[0];

        expect(entry).toHaveProperty('civic_did', null);
        expect(entry).toHaveProperty('brain_did', 'did:noesis:nous:brain-a001');
        expect(entry).toHaveProperty('status', 'active');
        expect(typeof entry['last_active_tick']).toBe('number');
        expect(entry).toHaveProperty('zone_id', null);
        expect(entry).toHaveProperty('civic_standing', null);
        expect(entry).toHaveProperty('quota_usage');
        const quota = entry['quota_usage'] as { brain_processes: number; limit: number };
        expect(quota.brain_processes).toBe(1);
        expect(quota.limit).toBe(3);
        expect(typeof entry['token_expires_at']).toBe('number');
    });

    it('returns only operator A brains — not operator B brains — even when both are registered', async () => {
        vi.mocked(findByOperator).mockImplementation(
            (_pool, _gridName, did) => Promise.resolve(did === OP_A_DID ? [BRAIN_A] : [BRAIN_B]),
        );
        vi.mocked(getQuotaLimit).mockResolvedValue(3);

        const cookieA = await makePortalCookie(OP_A_DID);
        const resA = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/nous',
            cookies: { [COOKIE_NAME]: cookieA },
        });

        const cookieB = await makePortalCookie(OP_B_DID);
        const resB = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/nous',
            cookies: { [COOKIE_NAME]: cookieB },
        });

        expect(resA.statusCode).toBe(200);
        expect(resB.statusCode).toBe(200);

        const bodyA = resA.json<{ nous: Array<{ brain_did: string }> }>();
        const bodyB = resB.json<{ nous: Array<{ brain_did: string }> }>();

        expect(bodyA.nous).toHaveLength(1);
        expect(bodyA.nous[0].brain_did).toBe('did:noesis:nous:brain-a001');

        expect(bodyB.nous).toHaveLength(1);
        expect(bodyB.nous[0].brain_did).toBe('did:noesis:nous:brain-b001');
    });

    it('returns 401 when no Portal session cookie is present', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/nous',
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 403 when session has no operatorDid (ES256 civic Bearer JWT)', async () => {
        const bearer = await makeCivicBearer(CIVIC_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/nous',
            headers: { authorization: `Bearer ${bearer}` },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json<{ error: string }>().error).toBe('operator_scope_required');
    });
});
