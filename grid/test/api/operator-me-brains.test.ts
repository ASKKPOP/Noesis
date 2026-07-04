/**
 * Phase 39 — POST /api/v1/operator/me/brains
 * Tests quota enforcement (TENANT-03) and atomic claim (TENANT-01)
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
import { countActiveByOperator, setOwner } from '../../src/operator/data/operator-brain-store.js';
import { getQuotaLimit } from '../../src/operator/data/operator-quota-store.js';
import type { BrainTokenRecord } from '../../src/db/stores/brain-token-store.js';

// QA fix: tryDid.ts's portal-cookie path now correctly uses DID_RE
// (did:noesis:*), matching the real shape SIWE/email signup issue.
const OP_A_DID = 'did:noesis:human:operator-a';
const BRAIN_DID = 'did:noesis:nous:brain-b001';

async function makePortalCookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function makeMockBrainTokenStore() {
    const store = new Map<string, BrainTokenRecord>();
    return {
        async insert(rec: BrainTokenRecord): Promise<void> {
            if (!store.has(rec.brainDid)) store.set(rec.brainDid, { ...rec });
        },
        async upsert(rec: BrainTokenRecord): Promise<void> {
            store.set(rec.brainDid, { ...rec });
        },
        async getByDid(brainDid: string): Promise<BrainTokenRecord | null> {
            return store.get(brainDid) ?? null;
        },
        async revoke(brainDid: string, _atTick: number): Promise<boolean> {
            const rec = store.get(brainDid);
            if (!rec || rec.revoked) return false;
            rec.revoked = true;
            return true;
        },
        async isRevoked(brainDid: string): Promise<boolean> {
            const rec = store.get(brainDid);
            return rec?.revoked ?? false;
        },
        _store: store,
    };
}

type MockBrainTokenStore = ReturnType<typeof makeMockBrainTokenStore>;

function buildTestApp(brainTokenStore?: MockBrainTokenStore, pool?: object): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        registry: new NousRegistry(),
        pool: pool as import('mysql2/promise').Pool,
        brainTokenStore: brainTokenStore as unknown as import('../../src/db/stores/brain-token-store.js').BrainTokenStore,
    });
}

const FAKE_BRAIN_RECORD: BrainTokenRecord = {
    brainDid: BRAIN_DID,
    publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'test' },
    issuedAt: Math.floor(Date.now() / 1000) - 100,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
    revoked: false,
    operatorDid: null,
};

describe('Phase 39: POST /api/v1/operator/me/brains — quota + claim (TENANT-03)', () => {
    let app: FastifyInstance;
    let brainTokenStore: MockBrainTokenStore;

    beforeAll(async () => {
        brainTokenStore = makeMockBrainTokenStore();
        await brainTokenStore.upsert(FAKE_BRAIN_RECORD);
        app = buildTestApp(brainTokenStore, {});
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 { ok: true, brain_did, operator_did } when brain is unclaimed and quota not exceeded', async () => {
        vi.mocked(countActiveByOperator).mockResolvedValue(0);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);
        vi.mocked(setOwner).mockResolvedValue(true);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/me/brains',
            cookies: { [COOKIE_NAME]: cookie },
            payload: { brain_did: BRAIN_DID },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{ ok: boolean; brain_did: string; operator_did: string }>();
        expect(body.ok).toBe(true);
        expect(body.brain_did).toBe(BRAIN_DID);
        expect(body.operator_did).toBe(OP_A_DID);
    });

    it('returns 429 { error: "quota_exceeded", resource: "brain_processes", current: 3, limit: 3 } when operator already owns 3 active Brains (D-39-06)', async () => {
        vi.mocked(countActiveByOperator).mockResolvedValue(3);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/me/brains',
            cookies: { [COOKIE_NAME]: cookie },
            payload: { brain_did: BRAIN_DID },
        });

        expect(res.statusCode).toBe(429);
        const body = res.json<{ error: string; resource: string; current: number; limit: number }>();
        expect(body.error).toBe('quota_exceeded');
        expect(body.resource).toBe('brain_processes');
        expect(body.current).toBe(3);
        expect(body.limit).toBe(3);
    });

    it('returns 409 { error: "already_claimed" } when brain_did is already owned by another operator', async () => {
        vi.mocked(countActiveByOperator).mockResolvedValue(0);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);
        vi.mocked(setOwner).mockResolvedValue(false);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/me/brains',
            cookies: { [COOKIE_NAME]: cookie },
            payload: { brain_did: BRAIN_DID },
        });

        expect(res.statusCode).toBe(409);
        const body = res.json<{ error: string }>();
        expect(body.error).toBe('already_claimed');
    });

    it('returns 404 { error: "unknown_brain_did" } when brain_did is not registered', async () => {
        vi.mocked(countActiveByOperator).mockResolvedValue(0);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);

        const unknownBrainDid = 'did:noesis:nous:brain-unknown-999';
        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/me/brains',
            cookies: { [COOKIE_NAME]: cookie },
            payload: { brain_did: unknownBrainDid },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json<{ error: string }>().error).toBe('unknown_brain_did');
    });

    it('returns 400 { error: "invalid_request" } when brain_did fails BRAIN_DID_RE validation', async () => {
        vi.mocked(countActiveByOperator).mockResolvedValue(0);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);

        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/me/brains',
            cookies: { [COOKIE_NAME]: cookie },
            payload: { brain_did: 'not-a-valid-did' },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json<{ error: string }>().error).toBe('invalid_request');
    });

    it('returns 401 when no Portal session cookie is present', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/me/brains',
            payload: { brain_did: BRAIN_DID },
        });
        expect(res.statusCode).toBe(401);
    });

    it('claim is atomic — setOwner returns true first time, false second time results in one 200 and one 409', async () => {
        // First call returns true (claim succeeds), second returns false (already claimed).
        vi.mocked(countActiveByOperator).mockResolvedValue(0);
        vi.mocked(getQuotaLimit).mockResolvedValue(3);
        vi.mocked(setOwner)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        const cookie = await makePortalCookie(OP_A_DID);

        const [res1, res2] = await Promise.all([
            app.inject({
                method: 'POST',
                url: '/api/v1/operator/me/brains',
                cookies: { [COOKIE_NAME]: cookie },
                payload: { brain_did: BRAIN_DID },
            }),
            app.inject({
                method: 'POST',
                url: '/api/v1/operator/me/brains',
                cookies: { [COOKIE_NAME]: cookie },
                payload: { brain_did: BRAIN_DID },
            }),
        ]);

        const statuses = [res1.statusCode, res2.statusCode].sort();
        expect(statuses).toEqual([200, 409]);
    });
});
