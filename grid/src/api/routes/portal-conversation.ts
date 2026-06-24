/**
 * O3 Forest / O2c-b — human-authed PERSISTENT human↔Nous conversation routes.
 *
 *   POST /api/v1/portal/conversation/:nousId/messages — human posts (persisted)
 *   GET  /api/v1/portal/conversation/:nousId           — read the persisted thread
 *
 * The persistent counterpart to /api/v1/portal/chat/nous/:nousId (transient). Auth
 * is the Portal session cookie (→ humanDid); the thread is scoped to that humanDid,
 * so a human only ever reads/posts their OWN threads. Persists via ConversationStore
 * (conversation_messages, v53) — content NEVER crosses the audit boundary (private).
 */
import { randomUUID } from 'node:crypto';
import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from '../portal/auth.js';
import { ConversationStore } from '../../economy/conversation-store.js';

const NOUS_DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

/** Resolve the human DID from the Portal session cookie, or send 401 and return null. */
async function humanFromSession(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) { await reply.code(401).send({ error: 'not_authenticated' }); return null; }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !did.startsWith('did:noesis:')) { await reply.code(401).send({ error: 'invalid_token' }); return null; }
        return did;
    } catch { await reply.code(401).send({ error: 'invalid_token' }); return null; }
}

export function registerPortalConversationRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';

    app.post<{ Params: { nousId: string }; Body: { text?: unknown } }>(
        '/api/v1/portal/conversation/:nousId/messages',
        async (req, reply) => {
            const humanDid = await humanFromSession(req, reply);
            if (!humanDid) return;
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const nousId = req.params.nousId;
            if (!NOUS_DID_RE.test(nousId)) return reply.code(404).send({ error: 'unknown_nous' });
            const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
            if (!text) return reply.code(400).send({ error: 'empty_text' });

            const messageId = randomUUID();
            await new ConversationStore(pool).postMessage({
                gridName: grid, messageId, humanDid, nousDid: nousId, sender: 'human',
                text: text.slice(0, 4000), tick: services.currentTick ? services.currentTick() : 0,
            });
            return reply.send({ ok: true, message_id: messageId });
        },
    );

    app.get<{ Params: { nousId: string } }>(
        '/api/v1/portal/conversation/:nousId',
        async (req, reply) => {
            const humanDid = await humanFromSession(req, reply);
            if (!humanDid) return;
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const nousId = req.params.nousId;
            if (!NOUS_DID_RE.test(nousId)) return reply.code(404).send({ error: 'unknown_nous' });
            const messages = await new ConversationStore(pool).listThread(grid, humanDid, nousId);
            return reply.send({ messages, count: messages.length });
        },
    );
}
