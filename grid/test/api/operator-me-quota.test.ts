/**
 * Phase 39 — GET /api/v1/operator/me/quota
 * Tests quota response shape (TENANT-03)
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

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
import { countActiveByOperator } from '../../src/operator/data/operator-brain-store.js';
import { getFullQuota } from '../../src/operator/data/operator-quota-store.js';

// ANY_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i — tryDid cookie path uses this.
// Human DIDs (did:noesis:human:0x...) do NOT match ANY_DID_RE due to a Phase 37/38 regression.
// Use did:portal:noesis:* format which matches ANY_DID_RE for test portal cookies.
const OP_A_DID = 'did:portal:noesis:operator-a';

async function makePortalCookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
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

describe('Phase 39: GET /api/v1/operator/me/quota (TENANT-03)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestApp({});
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 with shape { brain_processes: { current, limit }, event_rate: { per_did_per_min, limit }, p2p_bandwidth_cap_bytes }', async () => {
        vi.mocked(getFullQuota).mockResolvedValue({
            brainProcessLimit: 3,
            eventRatePerDidPerMin: 600,
            p2pBandwidthCapBytes: null,
        });
        vi.mocked(countActiveByOperator).mockResolvedValue(1);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/quota',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{
            brain_processes: { current: number; limit: number };
            event_rate: { per_did_per_min: number; limit: number };
            p2p_bandwidth_cap_bytes: number | null;
        }>();

        expect(typeof body.brain_processes.current).toBe('number');
        expect(typeof body.brain_processes.limit).toBe('number');
        expect(typeof body.event_rate.per_did_per_min).toBe('number');
        expect(typeof body.event_rate.limit).toBe('number');
        expect('p2p_bandwidth_cap_bytes' in body).toBe(true);
    });

    it('brain_processes.limit defaults to 3 when no per-operator override exists', async () => {
        vi.mocked(getFullQuota).mockResolvedValue({
            brainProcessLimit: 3,
            eventRatePerDidPerMin: 600,
            p2pBandwidthCapBytes: null,
        });
        vi.mocked(countActiveByOperator).mockResolvedValue(0);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/quota',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json<{ brain_processes: { limit: number } }>().brain_processes.limit).toBe(3);
    });

    it('event_rate.per_did_per_min defaults to 600 (D-39-08)', async () => {
        vi.mocked(getFullQuota).mockResolvedValue({
            brainProcessLimit: 3,
            eventRatePerDidPerMin: 600,
            p2pBandwidthCapBytes: null,
        });
        vi.mocked(countActiveByOperator).mockResolvedValue(0);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/quota',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json<{ event_rate: { per_did_per_min: number } }>().event_rate.per_did_per_min).toBe(600);
    });

    it('brain_processes.current reflects actual active brain_tokens count via DB query', async () => {
        vi.mocked(getFullQuota).mockResolvedValue({
            brainProcessLimit: 3,
            eventRatePerDidPerMin: 600,
            p2pBandwidthCapBytes: null,
        });
        vi.mocked(countActiveByOperator).mockResolvedValue(2);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/quota',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json<{ brain_processes: { current: number } }>().brain_processes.current).toBe(2);
    });

    it('returns 401 when no Portal session cookie is present', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/quota',
        });
        expect(res.statusCode).toBe(401);
    });
});
