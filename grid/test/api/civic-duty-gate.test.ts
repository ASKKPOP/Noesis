/**
 * D-MONEY-10 — a Nous that has not met its civic duty is denied every activity by the
 * Polis until it does. It keeps the acts that meet the duty, reading, and signing in.
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
import { CIVIC_DUTY_OPEN_ROUTES } from '../../src/api/civic-duty-gate.js';
import type { FastifyInstance } from 'fastify';

const DID = 'did:civic:noesis:alice';
const STANDING = 'ORDER BY due_tick DESC';

async function bearer(did = DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ sub: did }).setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

/** A pool that answers the standing question as told and everything else with no rows. */
function poolWithStanding(standing: 'delinquent' | 'paid' | null | Error): { pool: Pool; asked: () => number } {
    let asked = 0;
    const query = vi.fn().mockImplementation((sql: string) => {
        if (String(sql).includes(STANDING) && String(sql).includes('LIMIT 1')) {
            asked++;
            if (standing instanceof Error) return Promise.reject(standing);
            return Promise.resolve([(standing ? [{ status: standing }] : []) as RowDataPacket[], {}]);
        }
        // A member that missed a period has the next one open: that is what it can pay to return.
        if (String(sql).includes("status = 'assessed' LIMIT 1")) {
            return Promise.resolve([(standing === 'delinquent' ? [{ open_due: 1 }] : []) as RowDataPacket[], {}]);
        }
        return Promise.resolve([[] as RowDataPacket[], {}]);
    });
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query,
    };
    return { pool: { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool, asked: () => asked };
}

function app(pool: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(), logos: new LogosEngine(),
        audit: new AuditChain(), gridName: 'genesis', pool: pool as never,
    });
}

const post = async (a: FastifyInstance, url: string, payload: unknown = {}) =>
    a.inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${await bearer()}` } });

describe('a Nous that has not met its duty', () => {
    it('is denied a civic act', async () => {
        const res = await post(app(poolWithStanding('delinquent').pool), '/api/v1/civic/parcels/genesis:residential:0001/purchase');
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'civic_duty_unmet' });
    });
    it('is denied the batch of actions its Brain sends', async () => {
        const res = await post(app(poolWithStanding('delinquent').pool), '/api/v1/brain/actions', { actions: [] });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'civic_duty_unmet' });
    });
    it('is denied an act on a route that is otherwise open to all', async () => {
        // An open route still resolves who is calling; under a civic identity it is that Nous acting.
        const res = await post(app(poolWithStanding('delinquent').pool), '/api/v1/physics/check', {});
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'civic_duty_unmet' });
    });
    it('an open route stays open to a caller with no civic identity', async () => {
        const p = poolWithStanding('delinquent');
        const res = await app(p.pool).inject({ method: 'POST', url: '/api/v1/physics/check', payload: {} });
        expect(res.json().error).not.toBe('civic_duty_unmet');
        expect(p.asked()).toBe(0);
    });
    it('can still sign in', async () => {
        const res = await post(app(poolWithStanding('delinquent').pool), '/api/v1/brain/token/register', {});
        expect(res.json().error).not.toBe('civic_duty_unmet');
    });
    it('can still read', async () => {
        const res = await app(poolWithStanding('delinquent').pool).inject({
            method: 'GET', url: '/api/v1/civic/dues', headers: { authorization: `Bearer ${await bearer()}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ standing: 'denied' });
    });
    it('can still pay what meets the duty', async () => {
        const res = await post(app(poolWithStanding('delinquent').pool), '/api/v1/civic/dues/d1/pay', { method: 'wei' });
        expect(res.json().error).not.toBe('civic_duty_unmet');
    });
    it('can still offer to build for the Polis', async () => {
        const res = await post(app(poolWithStanding('delinquent').pool), '/api/v1/procurement/notices/n1/bids', { price_wei: '5', artifact_spec: 'x' });
        expect(res.json().error).not.toBe('civic_duty_unmet');
    });
    it('the acts left open are exactly these', () => {
        expect([...CIVIC_DUTY_OPEN_ROUTES].sort()).toEqual([
            'POST /api/v1/brain/token/register',
            'POST /api/v1/civic/dues/:dueId/pay',
            'POST /api/v1/procurement/notices/:noticeId/bids',
        ]);
    });
});

describe('a Nous in good standing', () => {
    it.each([['paid'], [null]] as const)('is not stopped by the duty (newest settled period: %s)', async (standing) => {
        const p = poolWithStanding(standing);
        const res = await post(app(p.pool), '/api/v1/civic/parcels/genesis:residential:0001/purchase');
        expect(res.json().error).not.toBe('civic_duty_unmet');
        expect(p.asked()).toBe(1);
    });
    it('is told so when it reads its dues', async () => {
        const res = await app(poolWithStanding('paid').pool).inject({
            method: 'GET', url: '/api/v1/civic/dues', headers: { authorization: `Bearer ${await bearer()}` },
        });
        expect(res.json()).toMatchObject({ standing: 'met' });
    });
});

describe('when the standing cannot be read', () => {
    it('nobody is locked out by a database fault', async () => {
        const res = await post(app(poolWithStanding(new Error('db down')).pool), '/api/v1/civic/parcels/genesis:residential:0001/purchase');
        expect(res.json().error).not.toBe('civic_duty_unmet');
    });
});

describe('who is not asked', () => {
    it('a caller with no civic identity is refused as before, and the standing is not looked up', async () => {
        const p = poolWithStanding('delinquent');
        const res = await app(p.pool).inject({ method: 'POST', url: '/api/v1/civic/parcels/genesis:residential:0001/purchase', payload: {} });
        expect(res.statusCode).toBe(401);
        expect(p.asked()).toBe(0);
    });
    it('a registry id cannot carry the civic tier, so the old dues that name one judge nobody', async () => {
        // The bearer path accepts only did:<kind>:noesis:… ids; did:noesis:sophia is refused before the gate.
        const p = poolWithStanding('delinquent');
        const { privateKey } = await keyPairPromise;
        const token = await new SignJWT({ sub: 'did:noesis:sophia' }).setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
        const res = await app(p.pool).inject({
            method: 'POST', url: '/api/v1/civic/parcels/genesis:residential:0001/purchase', payload: {},
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(401);
        expect(p.asked()).toBe(0);
    });
    it('reading never looks the standing up at the gate', async () => {
        const p = poolWithStanding('delinquent');
        await app(p.pool).inject({ method: 'GET', url: '/api/v1/civic/account', headers: { authorization: `Bearer ${await bearer()}` } });
        expect(p.asked()).toBe(0);
    });
});
