/**
 * W — procurement member route tests.
 *
 * Mirrors civic-dues-route.test.ts: mock pool + injected didContext via Civic-DID JWT.
 * Invariants checked:
 *   - GET list/detail: public-readable (no auth needed)
 *   - POST bid: civic_member required; validates price_wei + artifact_spec
 *   - 503 when no pool
 *   - issue/award routes DO NOT EXIST on these paths (VOTE-05)
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const DID = 'did:civic:noesis:alice';
// UUID-format IDs required by audit append validators (appendProcurementBidPlaced checks UUID_RE)
const NOTICE_UUID = '99200ab8-897e-41ca-8761-608c2ba16fb3';

/** Mint a valid ES256 Civic-DID bearer token for DID using the server's signing key. */
async function makeCivicBearer(did = DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ sub: did })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function poolReturning(rows: unknown[]): Pool {
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]),
    };
    return {
        query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]),
        getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as Pool;
}

function makeApp(pool?: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        pool: pool as never,
    });
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/v1/procurement/notices
// ────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/procurement/notices', () => {
    it('returns open notices (public — no auth required)', async () => {
        const app = makeApp(
            poolReturning([
                { notice_id: 'n1', title: 'Energy module', status: 'open', budget_wei: '5000', deadline_tick: 100 },
            ]),
        );
        const res = await app.inject({ method: 'GET', url: '/api/v1/procurement/notices' });
        expect(res.statusCode).toBe(200);
        expect(res.json().notices[0]).toMatchObject({ notice_id: 'n1', status: 'open' });
        expect(res.json().count).toBe(1);
        await app.close();
    });

    it('accepts a ?status= query param', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'GET', url: '/api/v1/procurement/notices?status=awarded' });
        expect(res.statusCode).toBe(200);
        expect(res.json().notices).toHaveLength(0);
        await app.close();
    });

    it('503 without a pool', async () => {
        const app = makeApp(undefined);
        const res = await app.inject({ method: 'GET', url: '/api/v1/procurement/notices' });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/v1/procurement/notices/:noticeId
// ────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/procurement/notices/:noticeId', () => {
    it('returns notice + bids (public — no auth required)', async () => {
        // First call → notice row; second call → bids rows
        const pool = (() => {
            let call = 0;
            const responses = [
                [{ notice_id: 'n1', title: 'Energy module', status: 'open' }],
                [{ bid_id: 'b1', bidder_did: 'did:civic:noesis:bob', price_wei: '999', status: 'submitted' }],
            ];
            return {
                query: vi.fn().mockImplementation(() => Promise.resolve([responses[call++] as RowDataPacket[], {}])),
                getConnection: vi.fn(),
            } as unknown as Pool;
        })();
        const app = makeApp(pool);
        const res = await app.inject({ method: 'GET', url: '/api/v1/procurement/notices/n1' });
        expect(res.statusCode).toBe(200);
        expect(res.json().notice).toMatchObject({ notice_id: 'n1' });
        expect(res.json().bids[0]).toMatchObject({ bid_id: 'b1' });
        await app.close();
    });

    it('404 when notice not found', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'GET', url: '/api/v1/procurement/notices/missing' });
        expect(res.statusCode).toBe(404);
        await app.close();
    });

    it('503 without a pool', async () => {
        const app = makeApp(undefined);
        const res = await app.inject({ method: 'GET', url: '/api/v1/procurement/notices/n1' });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/v1/procurement/notices/:noticeId/bids
// ────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/procurement/notices/:noticeId/bids', () => {
    it('places a bid (201) when notice is open', async () => {
        // pool.getConnection used by placeBid transaction
        const conn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn()
                .mockResolvedValueOnce([[{ status: 'open', deadline_tick: 200 }], {}])
                .mockResolvedValueOnce([[], {}]),
        };
        const pool = {
            query: vi.fn().mockResolvedValue([[], {}]),
            getConnection: vi.fn().mockResolvedValue(conn),
        } as unknown as Pool;
        const app = makeApp(pool);
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            headers: { authorization: `Bearer ${token}` },
            payload: { price_wei: '4000', artifact_spec: 'module:power-v1' },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().ok).toBe(true);
        expect(res.json().bid_id).toBeTruthy();
        await app.close();
    });

    it('409 when notice is not open (notice_not_open)', async () => {
        const conn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn().mockResolvedValue([[{ status: 'awarded', deadline_tick: 100 }], {}]),
        };
        const pool = {
            query: vi.fn().mockResolvedValue([[], {}]),
            getConnection: vi.fn().mockResolvedValue(conn),
        } as unknown as Pool;
        const app = makeApp(pool);
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            headers: { authorization: `Bearer ${token}` },
            payload: { price_wei: '4000', artifact_spec: 'module:power-v1' },
        });
        expect(res.statusCode).toBe(409);
        await app.close();
    });

    it('400 when price_wei is not a digit string', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            headers: { authorization: `Bearer ${token}` },
            payload: { price_wei: 'not-a-number', artifact_spec: 'module:power-v1' },
        });
        expect(res.statusCode).toBe(400);
        await app.close();
    });

    it('400 when price_wei is numeric but zero (invalid_amount)', async () => {
        // placeBid throws invalid_amount for 0 (checked in store before DB access)
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            headers: { authorization: `Bearer ${token}` },
            payload: { price_wei: '0', artifact_spec: 'module:power-v1' },
        });
        expect(res.statusCode).toBe(400);
        await app.close();
    });

    it('400 when artifact_spec is empty', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            headers: { authorization: `Bearer ${token}` },
            payload: { price_wei: '4000', artifact_spec: '   ' },
        });
        expect(res.statusCode).toBe(400);
        await app.close();
    });

    it('401 without auth header', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            payload: { price_wei: '4000', artifact_spec: 'module:power-v1' },
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('503 without a pool', async () => {
        const app = makeApp(undefined);
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/procurement/notices/${NOTICE_UUID}/bids`,
            headers: { authorization: `Bearer ${token}` },
            payload: { price_wei: '4000', artifact_spec: 'module:power-v1' },
        });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// VOTE-05 invariant: issue/award routes do NOT exist on these paths
// ────────────────────────────────────────────────────────────────────────────
describe('VOTE-05 — issue/award not exposed', () => {
    it('POST /api/v1/procurement/notices (issue) returns 404', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/procurement/notices',
            headers: { authorization: `Bearer ${token}` },
            payload: { title: 'Energy module', spec: 's', budget_wei: '5000' },
        });
        // Must NOT be 200/201 — 404 (unregistered) is the correct outcome
        expect(res.statusCode).toBe(404);
        await app.close();
    });

    it('POST /api/v1/procurement/notices/:id/award returns 404', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/procurement/notices/n1/award',
            headers: { authorization: `Bearer ${token}` },
            payload: { bid_id: 'b1' },
        });
        expect(res.statusCode).toBe(404);
        await app.close();
    });
});
