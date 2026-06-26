/**
 * Phase 51 Type Mobility (Plan 1) — abandon + adopt routes (Portal-cookie auth).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance as Fi } from 'fastify';
import { SignJWT } from 'jose';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { buildServer } from '../../src/api/server.js';
import { registerMobilityRoutes } from '../../src/api/routes/mobility.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const HUMAN = 'did:noesis:human:0xabc';
const NOUS = 'did:noesis:nous:sophia';

async function cookie(did = HUMAN): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xabc', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}
function poolReturning(rows: unknown[]): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
function makeApp(pool?: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(),
        logos: new LogosEngine(), audit: new AuditChain(), gridName: 'genesis',
        pool: pool as never, currentTick: () => 5,
    });
}

describe('POST /api/v1/mobility/abandon', () => {
    it('201 when the caller owns the Nous', async () => {
        const app = makeApp(poolReturning([{ '1': 1 }])); // NousSponsorStore.owns → true
        const res = await app.inject({ method: 'POST', url: '/api/v1/mobility/abandon', cookies: { [COOKIE_NAME]: await cookie() }, payload: { nous_did: NOUS } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('adoption_pending');
        await app.close();
    });
    it('403 when the caller does not own the Nous', async () => {
        const app = makeApp(poolReturning([])); // owns → false
        const res = await app.inject({ method: 'POST', url: '/api/v1/mobility/abandon', cookies: { [COOKIE_NAME]: await cookie() }, payload: { nous_did: NOUS } });
        expect(res.statusCode).toBe(403);
        await app.close();
    });
    it('401 without a session', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: '/api/v1/mobility/abandon', payload: { nous_did: NOUS } });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});

describe('POST /api/v1/mobility/adopt/:nousId', () => {
    it('201 adopting a pending Nous within the window', async () => {
        const app = makeApp(poolReturning([{ nous_did: NOUS, status: 'adoption_pending', abandoned_by_human_did: 'did:noesis:human:old', window_end_tick: 999999 }]));
        const res = await app.inject({ method: 'POST', url: `/api/v1/mobility/adopt/${NOUS}`, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('adopted');
        await app.close();
    });
    it('409 not_adoptable when there is no pending record', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: `/api/v1/mobility/adopt/${NOUS}`, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(409);
        await app.close();
    });
    it('410 window_expired past the window', async () => {
        const app = makeApp(poolReturning([{ nous_did: NOUS, status: 'adoption_pending', abandoned_by_human_did: 'did:noesis:human:old', window_end_tick: 1 }]));
        const res = await app.inject({ method: 'POST', url: `/api/v1/mobility/adopt/${NOUS}`, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(410);
        await app.close();
    });
    it('401 without a session', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: `/api/v1/mobility/adopt/${NOUS}` });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
    it('🔒 403 forbidden_in_v3.0 when adopting a CONVERTED Type B Nous (B→A blocked)', async () => {
        const app = makeApp(poolReturning([{ nous_did: NOUS, status: 'converted', abandoned_by_human_did: 'did:noesis:human:old', window_end_tick: 1 }]));
        const res = await app.inject({ method: 'POST', url: `/api/v1/mobility/adopt/${NOUS}`, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('forbidden_in_v3.0');
        await app.close();
    });
});

// Convert is government_only → a mini app with an injected government didContext.
function govApp(rows: unknown[], ctx: DIDContext | null = { did: 'did:gov:noesis:session', tier: 'government' }): Fi {
    const pool = { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerMobilityRoutes(a, services);
    return a;
}

describe('POST /api/v1/mobility/:nousId/convert (government_only)', () => {
    it('201 converting an expired pending abandonment to Type B', async () => {
        const a = govApp([{ nous_did: NOUS, status: 'adoption_pending', abandoned_by_human_did: 'did:noesis:human:old', window_end_tick: 1 }]);
        const res = await a.inject({ method: 'POST', url: `/api/v1/mobility/${NOUS}/convert` });
        expect(res.statusCode).toBe(201);
        expect(res.json().auto_civic_did).toMatch(/^did:noesis:nous:auto:/);
        await a.close();
    });
    it('403 for a non-Government caller', async () => {
        const a = govApp([], { did: 'did:civic:noesis:alice', tier: 'civic_member' });
        const res = await a.inject({ method: 'POST', url: `/api/v1/mobility/${NOUS}/convert` });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('409 not_convertible when the window has not expired', async () => {
        const a = govApp([{ nous_did: NOUS, status: 'adoption_pending', abandoned_by_human_did: 'did:noesis:human:old', window_end_tick: 999999 }]);
        const res = await a.inject({ method: 'POST', url: `/api/v1/mobility/${NOUS}/convert` });
        expect(res.statusCode).toBe(409);
        await a.close();
    });
});
