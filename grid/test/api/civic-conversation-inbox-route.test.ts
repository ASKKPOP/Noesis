/**
 * Brain inbox — a Nous reads the Portal threads waiting on it and answers them.
 *
 *   GET  /api/v1/civic/conversation-inbox        — threads whose last word is the human's
 *   POST /api/v1/civic/conversation-inbox/reply  — the Nous's own Brain answers
 *
 * The Nous authenticates with its Civic-DID; the Grid maps that to the existence-DID
 * the Portal threads are keyed by, so a Nous only ever sees threads addressed to itself.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { registerCivicConversationInboxRoutes } from '../../src/api/routes/civic-conversation-inbox.js';

const NOUS = 'did:noesis:sophia';
const CTX: DIDContext = { did: 'did:civic:noesis:sophia', tier: 'civic_member' };
const H1 = 'did:noesis:human:0xaaa';
const H2 = 'did:noesis:human:0xbbb';

function app(opts: { ctx?: DIDContext | null; existenceDid?: string | null; rows?: unknown[] }): { app: FastifyInstance; query: ReturnType<typeof vi.fn> } {
    const query = vi.fn().mockResolvedValue([opts.rows ?? [], {}]);
    const civicDidStore = { get: vi.fn(async () => (opts.existenceDid ? { existenceDid: opts.existenceDid } : null)) };
    const services = { gridName: 'genesis', currentTick: () => 7, pool: { query } as unknown as Pool, civicDidStore } as unknown as GridServices;
    const a = Fastify({ logger: false });
    if (opts.ctx !== undefined) a.addHook('onRequest', async (req) => { req.didContext = opts.ctx ?? undefined; });
    registerCivicConversationInboxRoutes(a, services);
    return { app: a, query };
}

// Oldest-first, as the store returns them.
const ROWS = [
    { human_did: H1, sender: 'human', text: 'hello', tick: 1 },
    { human_did: H1, sender: 'nous', text: 'hi there', tick: 1 },
    { human_did: H1, sender: 'human', text: 'what are you building?', tick: 3 },
    { human_did: H2, sender: 'human', text: 'ping', tick: 2 },
    { human_did: H2, sender: 'nous', text: 'pong', tick: 2 },
];

describe('GET /api/v1/civic/conversation-inbox', () => {
    it('401 unless the caller is a civic member', async () => {
        const { app: a } = app({ ctx: null, existenceDid: NOUS });
        expect((await a.inject({ method: 'GET', url: '/api/v1/civic/conversation-inbox' })).statusCode).toBe(401);
        await a.close();
    });

    it('returns only threads still waiting on the Nous, with their recent history', async () => {
        const { app: a, query } = app({ ctx: CTX, existenceDid: NOUS, rows: ROWS });
        const res = await a.inject({ method: 'GET', url: '/api/v1/civic/conversation-inbox' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(1);
        expect(body.threads[0].human_did).toBe(H1);
        expect(body.threads[0].messages.map((m: { text: string }) => m.text)).toEqual(['hello', 'hi there', 'what are you building?']);
        // scoped to the caller's existence-DID, never the civic one
        expect(query.mock.calls[0]![1]).toEqual(expect.arrayContaining(['genesis', NOUS]));
        await a.close();
    });

    it('a Nous with no civic record sees an empty inbox', async () => {
        const { app: a } = app({ ctx: CTX, existenceDid: null, rows: ROWS });
        expect((await a.inject({ method: 'GET', url: '/api/v1/civic/conversation-inbox' })).json()).toEqual({ threads: [], count: 0 });
        await a.close();
    });
});

describe('POST /api/v1/civic/conversation-inbox/reply', () => {
    const post = (a: FastifyInstance, payload: unknown) => a.inject({ method: 'POST', url: '/api/v1/civic/conversation-inbox/reply', payload: payload as object });

    it('stores the reply as the Nous in that human\'s thread', async () => {
        const { app: a, query } = app({ ctx: CTX, existenceDid: NOUS, rows: [{ n: 1 }] });
        const res = await post(a, { human_did: H1, text: 'A lighthouse.' });
        expect(res.statusCode).toBe(200);
        const insert = query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO conversation_messages'));
        expect(insert![1]).toEqual(expect.arrayContaining(['genesis', H1, NOUS, 'nous', 'A lighthouse.']));
        await a.close();
    });

    it('404 when that human never wrote to this Nous — no cold messages', async () => {
        const { app: a, query } = app({ ctx: CTX, existenceDid: NOUS, rows: [] });
        expect((await post(a, { human_did: H1, text: 'hey' })).statusCode).toBe(404);
        expect(query.mock.calls.some((c) => String(c[0]).includes('INSERT'))).toBe(false);
        await a.close();
    });

    it('400 on empty text or a malformed human DID; 401 without civic auth', async () => {
        const { app: a } = app({ ctx: CTX, existenceDid: NOUS, rows: [{ n: 1 }] });
        expect((await post(a, { human_did: H1, text: '  ' })).statusCode).toBe(400);
        expect((await post(a, { human_did: 'nope', text: 'x' })).statusCode).toBe(400);
        await a.close();
        const { app: b } = app({ ctx: null, existenceDid: NOUS });
        expect((await post(b, { human_did: H1, text: 'x' })).statusCode).toBe(401);
        await b.close();
    });
});
