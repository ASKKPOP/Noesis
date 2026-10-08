/**
 * Phase 56 (PORTAL-07/08) — GET /api/v1/portal/me/overview.
 * One session-authed read that backs the Portal user dashboard: the caller's
 * Nous, the Grids they live in, wei balances per Grid, and registrations in flight.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const HUMAN = 'did:noesis:human:0xabc';
const URL = '/api/v1/portal/me/overview';

async function cookie(did = HUMAN): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xabc', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

function pool(): Pool {
    const query = vi.fn().mockImplementation((sql: string, params: unknown[]) => {
        if (sql.includes('nous_sponsors')) return Promise.resolve([[{ nous_did: 'did:noesis:alice' }, { nous_did: 'did:noesis:bob' }], {}]);
        if (sql.includes('civic_did_registry')) {
            return Promise.resolve([params[1] === 'did:noesis:alice'
                ? [{ grid_name: 'genesis', civic_did: 'did:civic:noesis:alice', existence_did: 'did:noesis:alice', credential_json: '{}', status: 'active', issued_at_tick: 3, presence_status: 'awake', last_seen_tick: 40 }]
                : [], {}]);
        }
        if (sql.includes('nous_accounts')) return Promise.resolve([[{ balance_wei: '2500' }], {}]);
        if (sql.includes('nous_registrations')) {
            return Promise.resolve([[{ request_id: 'r-1', nous_type: 'A', registrant_did: HUMAN, nous_did: 'did:noesis:bob', target_grid: 'genesis', status: 'polis_pending', reason_code: null, filed_tick: 9 }], {}]);
        }
        return Promise.resolve([[], {}]);
    });
    return { query } as unknown as Pool;
}

function makeApp(p?: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(),
        logos: new LogosEngine(), audit: new AuditChain(), gridName: 'genesis',
        pool: p as never, currentTick: () => 50,
    });
}

describe('GET /api/v1/portal/me/overview (Phase 56)', () => {
    it('401 without a Portal session', async () => {
        const app = makeApp(pool());
        expect((await app.inject({ method: 'GET', url: URL })).statusCode).toBe(401);
        await app.close();
    });

    it('503 when the pool is not wired', async () => {
        const app = makeApp(undefined);
        const res = await app.inject({ method: 'GET', url: URL, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(503);
        await app.close();
    });

    it('returns owned Nous with civic status and balance, wallet totals, and registrations', async () => {
        const app = makeApp(pool());
        const res = await app.inject({ method: 'GET', url: URL, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.human_did).toBe(HUMAN);
        expect(body.nous).toEqual([
            { nous_did: 'did:noesis:alice', grid_id: 'genesis', civic_status: 'active', presence: 'awake', last_seen_tick: 40, balance_wei: '2500' },
            { nous_did: 'did:noesis:bob', grid_id: 'genesis', civic_status: 'none', presence: null, last_seen_tick: null, balance_wei: '0' },
        ]);
        // wei is a decimal string end to end (it overflows a JS number)
        expect(body.wallet).toEqual({ total_wei: '2500', by_grid: [{ grid_id: 'genesis', balance_wei: '2500' }] });
        expect(body.grids).toEqual([{ grid_id: 'genesis', nous_count: 2 }]);
        expect(body.registrations).toEqual([
            { request_id: 'r-1', nous_did: 'did:noesis:bob', nous_type: 'A', target_grid: 'genesis', status: 'polis_pending', reason_code: null, filed_tick: 9 },
        ]);
        await app.close();
    });

    it('an account with no Nous gets empty sections, not an error', async () => {
        const empty = { query: vi.fn().mockResolvedValue([[], {}]) } as unknown as Pool;
        const app = makeApp(empty);
        const res = await app.inject({ method: 'GET', url: URL, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.json()).toMatchObject({ nous: [], grids: [], registrations: [], wallet: { total_wei: '0', by_grid: [] } });
        await app.close();
    });
});
