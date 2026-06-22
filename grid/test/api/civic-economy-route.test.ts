/**
 * W — economy read routes tests.
 *   GET /api/v1/civic/account  — civic_member; returns caller's wei balance
 *   GET /api/v1/civic/credit   — civic_member; returns caller's civic-labor credit
 *   GET /api/v1/civic/treasury — public; returns the treasury wei balance
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

describe('GET /api/v1/civic/account', () => {
    it('200 — returns balance_wei as string for authenticated member', async () => {
        const app = makeApp(
            poolReturning([{ balance_wei: '42000000000000000000' }]),
        );
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/civic/account',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.civic_did).toBe(DID);
        expect(typeof body.balance_wei).toBe('string');
        expect(body.balance_wei).toBe('42000000000000000000');
        await app.close();
    });

    it('401 — no auth header', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/account' });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('503 — no pool', async () => {
        const app = makeApp(undefined);
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/civic/account',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});

describe('GET /api/v1/civic/credit', () => {
    it('200 — returns credit_balance as string for authenticated member', async () => {
        const app = makeApp(
            poolReturning([{ credit_balance: '750' }]),
        );
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/civic/credit',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.civic_did).toBe(DID);
        expect(typeof body.credit_balance).toBe('string');
        expect(body.credit_balance).toBe('750');
        await app.close();
    });

    it('401 — no auth header', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/credit' });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});

describe('GET /api/v1/civic/treasury', () => {
    it('200 — returns balance_wei as string with no auth required', async () => {
        const app = makeApp(
            poolReturning([{ balance_wei: '9999000000000000000000' }]),
        );
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/treasury' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.grid).toBe('genesis');
        expect(typeof body.balance_wei).toBe('string');
        expect(body.balance_wei).toBe('9999000000000000000000');
        await app.close();
    });

    it('503 — no pool', async () => {
        const app = makeApp(undefined);
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/treasury' });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});
