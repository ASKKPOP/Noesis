/**
 * O3 Forest / O2c-b — human-authed PERSISTENT conversation routes.
 *
 *   POST /api/v1/portal/conversation/:nousId/messages — human posts (portal session)
 *   GET  /api/v1/portal/conversation/:nousId           — read the persisted thread
 *
 * The persistent counterpart to /api/v1/portal/chat/nous/:nousId (which is
 * transient). Auth = the Portal session cookie (→ humanDid); the thread is scoped
 * to that humanDid, so a human only ever reads/posts their OWN threads (ownership).
 * Persists via ConversationStore (conversation_messages, v53) — content stays
 * off the audit chain (private, D-O2c).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const HUMAN = 'did:noesis:human:0xabc';
const NOUS = 'did:noesis:human-nous:sophia-7q';
const URL = `/api/v1/portal/conversation/${NOUS}`;

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

describe('POST /api/v1/portal/conversation/:nousId/messages', () => {
    it('persists a human message and returns its id', async () => {
        const pool = poolReturning([]);
        const app = makeApp(pool);
        const res = await app.inject({
            method: 'POST', url: `${URL}/messages`,
            cookies: { [COOKIE_NAME]: await cookie() },
            payload: { text: 'hello sophia' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
        expect(res.json().message_id).toMatch(/^[0-9a-f-]{36}$/i);
        // ConversationStore.postMessage → INSERT INTO conversation_messages
        const insert = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find((c) => /INSERT INTO conversation_messages/i.test(c[0]));
        expect(insert).toBeDefined();
        const params = (insert![1] as unknown[]).map(String);
        expect(params).toContain(HUMAN);   // human_did = session DID
        expect(params).toContain(NOUS);    // nous_did = path param
        expect(params).toContain('human'); // sender
        await app.close();
    });

    it('401 without a portal session cookie', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: `${URL}/messages`, payload: { text: 'hi' } });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('400 on empty text', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: `${URL}/messages`, cookies: { [COOKIE_NAME]: await cookie() }, payload: { text: '   ' } });
        expect(res.statusCode).toBe(400);
        await app.close();
    });

    it('404 for a non-Nous partner id', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: '/api/v1/portal/conversation/not-a-did/messages', cookies: { [COOKIE_NAME]: await cookie() }, payload: { text: 'hi' } });
        expect(res.statusCode).toBe(404);
        await app.close();
    });
});

describe('GET /api/v1/portal/conversation/:nousId', () => {
    it('returns the caller\'s persisted thread with that Nous', async () => {
        const rows = [
            { message_id: 'm1', sender: 'human', text: 'hello', tick: 1 },
            { message_id: 'm2', sender: 'nous', text: 'hi there', tick: 2 },
        ];
        const pool = poolReturning(rows);
        const app = makeApp(pool);
        const res = await app.inject({ method: 'GET', url: URL, cookies: { [COOKIE_NAME]: await cookie() } });
        expect(res.statusCode).toBe(200);
        expect(res.json().messages).toHaveLength(2);
        expect(res.json().count).toBe(2);
        // listThread is scoped to (humanDid, nousDid) → the SELECT binds both
        const sel = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find((c) => /FROM conversation_messages/i.test(c[0]));
        expect((sel![1] as unknown[]).map(String)).toEqual(expect.arrayContaining([HUMAN, NOUS]));
        await app.close();
    });

    it('401 without a cookie', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'GET', url: URL });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});
