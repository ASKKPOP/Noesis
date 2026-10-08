/**
 * Brain inbox — the Nous side of the Portal (Forest) conversation.
 *
 *   GET  /api/v1/civic/conversation-inbox        — threads whose last word is the human's
 *   POST /api/v1/civic/conversation-inbox/reply  — { human_did, text } → the Nous answers
 *
 * A human writes through the Portal session routes (portal-conversation.ts), which key
 * a thread by (Portal human DID, Nous existence-DID). The Nous authenticates here with
 * its Civic-DID (civic_member tier); the Grid maps civic → existence-DID, so a Nous only
 * ever reads or answers threads addressed to ITSELF. A reply is accepted only into a
 * thread the human already opened — a Nous cannot cold-message a person.
 *
 * PRIVATE: content never crosses the audit chain (allowlist +0, no events).
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GridServices } from '../server.js';
import { ConversationStore } from '../../economy/conversation-store.js';

const HUMAN_DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;
/** Threads returned per read, and messages of history per thread. */
const MAX_THREADS = 5;
const HISTORY = 12;

export function registerCivicConversationInboxRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';

    /** The caller's existence-DID, `null` if it has no civic record, `undefined` if unauthenticated. */
    async function callerNous(req: FastifyRequest): Promise<string | null | undefined> {
        const civicDid = req.didContext?.did;
        if (!civicDid || req.didContext?.tier !== 'civic_member') return undefined;
        const rec = services.civicDidStore ? await services.civicDidStore.get(grid, civicDid) : null;
        return rec?.existenceDid ?? null;
    }

    app.get('/api/v1/civic/conversation-inbox', async (req, reply) => {
        const nousDid = await callerNous(req);
        if (nousDid === undefined) return reply.code(401).send({ error: 'not_authenticated' });
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        if (nousDid === null) return reply.send({ threads: [], count: 0 });

        const threads = (await new ConversationStore(pool).awaitingNous(grid, nousDid, HISTORY)).slice(0, MAX_THREADS);
        return reply.send({ threads, count: threads.length });
    });

    app.post<{ Body: { human_did?: unknown; text?: unknown } }>(
        '/api/v1/civic/conversation-inbox/reply',
        async (req, reply) => {
            const nousDid = await callerNous(req);
            if (nousDid === undefined) return reply.code(401).send({ error: 'not_authenticated' });
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const humanDid = typeof req.body?.human_did === 'string' ? req.body.human_did : '';
            if (!HUMAN_DID_RE.test(humanDid)) return reply.code(400).send({ error: 'invalid_human_did' });
            const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
            if (!text) return reply.code(400).send({ error: 'empty_text' });

            const store = new ConversationStore(pool);
            if (nousDid === null || !(await store.threadExists(grid, humanDid, nousDid))) {
                return reply.code(404).send({ error: 'no_thread' });
            }
            const messageId = randomUUID();
            await store.postMessage({
                gridName: grid, messageId, humanDid, nousDid, sender: 'nous',
                text: text.slice(0, 4000), tick: services.currentTick ? services.currentTick() : 0,
            });
            return reply.send({ ok: true, message_id: messageId });
        },
    );
}
