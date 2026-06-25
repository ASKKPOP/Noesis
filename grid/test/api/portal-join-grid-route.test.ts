/**
 * Join-a-Grid S2 + S3 routes.
 *
 *   POST /api/v1/portal/nous/:nousId/claim   — human claims/owns a Nous (cookie auth)
 *   GET  /api/v1/portal/nous                 — the Nous a human owns
 *   POST /api/v1/portal/grid-recommendations — recommend a Grid to your owned Nous
 *   GET  /api/v1/civic/grid-recommendations  — a Nous reads its own recommendations
 *
 * User-side routes auth via the Portal session cookie; the Nous-read route auths as
 * civic_member and maps civic→existence. Private stores (allowlist +0).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { registerPortalJoinGridRoutes } from '../../src/api/routes/portal-join-grid.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const HUMAN = 'did:noesis:human:0xabc';
const NOUS = 'did:noesis:nous:alice';

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

describe('S2 — POST /api/v1/portal/nous/:nousId/claim', () => {
    it('claims ownership of a Nous and INSERTs the pairing', async () => {
        const pool = poolReturning([]);
        const app = makeApp(pool);
        const res = await app.inject({ method: 'POST', url: `/api/v1/portal/nous/${NOUS}/claim`, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true, human_did: HUMAN, nous_did: NOUS });
        const insert = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find((c) => /INSERT INTO nous_sponsors/i.test(c[0]));
        expect((insert![1] as unknown[]).map(String)).toEqual(expect.arrayContaining([HUMAN, NOUS]));
        await app.close();
    });

    it('401 without a portal session', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: `/api/v1/portal/nous/${NOUS}/claim` });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('404 for a non-Nous id', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: '/api/v1/portal/nous/not-a-did/claim', cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(404);
        await app.close();
    });
});

describe('S3 — POST /api/v1/portal/grid-recommendations', () => {
    it('recommends a Grid to an owned Nous (explicit) → INSERT', async () => {
        const pool = poolReturning([{ '1': 1 }]); // owns() sees a row → owned
        const app = makeApp(pool);
        const res = await app.inject({
            method: 'POST', url: '/api/v1/portal/grid-recommendations', cookies: { [COOKIE_NAME]: await cookie() },
            payload: { grid_id: 'genesis', nous_did: NOUS },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true, recommended_to: 1, grid_id: 'genesis' });
        const insert = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find((c) => /INSERT INTO grid_join_recommendations/i.test(c[0]));
        expect(insert).toBeDefined();
        await app.close();
    });

    it('403 when recommending to a Nous the human does not own', async () => {
        const app = makeApp(poolReturning([])); // owns() sees no row
        const res = await app.inject({
            method: 'POST', url: '/api/v1/portal/grid-recommendations', cookies: { [COOKIE_NAME]: await cookie() },
            payload: { grid_id: 'genesis', nous_did: NOUS },
        });
        expect(res.statusCode).toBe(403);
        await app.close();
    });

    it('400 with no owned Nous (implicit, recommend-to-all)', async () => {
        const app = makeApp(poolReturning([])); // sponsorsOf → []
        const res = await app.inject({
            method: 'POST', url: '/api/v1/portal/grid-recommendations', cookies: { [COOKIE_NAME]: await cookie() },
            payload: { grid_id: 'genesis' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('no_owned_nous');
        await app.close();
    });

    it('400 on an invalid grid_id', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({
            method: 'POST', url: '/api/v1/portal/grid-recommendations', cookies: { [COOKIE_NAME]: await cookie() },
            payload: { grid_id: 'not a grid!!' },
        });
        expect(res.statusCode).toBe(400);
        await app.close();
    });

    it('401 without a portal session', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: '/api/v1/portal/grid-recommendations', payload: { grid_id: 'genesis' } });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});

// ── Nous-read route (mini app: inject didContext + mock civic registry) ──────────
function civicApp(opts: { ctx?: DIDContext | null; existenceDid?: string | null; pending?: unknown[] }): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([(opts.pending ?? []) as RowDataPacket[], {}]) } as unknown as Pool;
    const civicDidStore = { get: vi.fn(async () => (opts.existenceDid ? { existenceDid: opts.existenceDid } : null)) };
    const services = { gridName: 'genesis', currentTick: () => 5, pool, civicDidStore } as unknown as GridServices;
    const app = Fastify({ logger: false });
    if (opts.ctx !== undefined) app.addHook('onRequest', async (req) => { req.didContext = opts.ctx ?? undefined; });
    registerPortalJoinGridRoutes(app, services);
    return app;
}

describe('S3 — GET /api/v1/civic/grid-recommendations (Nous reads its own)', () => {
    it('maps civic→existence and returns pending grid_ids', async () => {
        const app = civicApp({
            ctx: { did: 'did:civic:noesis:alice', tier: 'civic_member' },
            existenceDid: NOUS,
            pending: [{ recommendation_id: 'r1', nous_did: NOUS, target_grid_id: 'moon', status: 'pending' }],
        });
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/grid-recommendations' });
        expect(res.statusCode).toBe(200);
        expect(res.json().grid_ids).toContain('moon');
        expect(res.json().count).toBe(1);
        await app.close();
    });

    it('401 without civic_member context', async () => {
        const app = civicApp({ ctx: null });
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/grid-recommendations' });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('empty when the civic DID has no existence mapping', async () => {
        const app = civicApp({ ctx: { did: 'did:civic:noesis:ghost', tier: 'civic_member' }, existenceDid: null });
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/grid-recommendations' });
        expect(res.statusCode).toBe(200);
        expect(res.json().count).toBe(0);
        await app.close();
    });
});
