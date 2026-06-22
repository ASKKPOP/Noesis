/**
 * W — Conversation routes: human↔Nous chat thread, reachable over HTTP.
 *   POST /api/v1/civic/conversation/:partnerDid/messages  — post a message to a partner
 *   GET  /api/v1/civic/conversation/:partnerDid           — read the thread
 *
 * Auth: civic_did_required (req.didContext). Sender inferred from DID form:
 *   caller is human (HUMAN_DID_RE matches) → sender='human', humanDid=caller, nousDid=partner
 *   caller is nous → sender='nous', nousDid=caller, humanDid=partner
 *   neither party is human → 400 no_human_party
 *
 * PRIVATE: content never crosses the audit chain (allowlist +0, no events).
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ConversationStore } from '../../economy/conversation-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
export const HUMAN_DID_RE = /^did:civic:noesis:human:/i;

interface ResolvedParty {
    humanDid: string;
    nousDid: string;
    sender: 'human' | 'nous';
}

/**
 * Resolve (humanDid, nousDid, sender) from a (caller, partner) pair.
 * Returns null when neither party is a human (route should return 400 no_human_party).
 */
function resolveParty(caller: string, partner: string): ResolvedParty | null {
    if (HUMAN_DID_RE.test(caller)) {
        return { humanDid: caller, nousDid: partner, sender: 'human' };
    }
    if (HUMAN_DID_RE.test(partner)) {
        return { humanDid: partner, nousDid: caller, sender: 'nous' };
    }
    return null;
}

export function registerConversationRoutes(app: FastifyInstance, services: GridServices): void {
    // POST /api/v1/civic/conversation/:partnerDid/messages
    // Post a message to a partner (human→nous OR nous→human).
    app.post<{
        Params: { partnerDid: string };
        Body: { text?: unknown };
    }>(
        '/api/v1/civic/conversation/:partnerDid/messages',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const caller = req.didContext?.did;
            if (!caller || !CIVIC_DID_RE.test(caller) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }

            const { partnerDid } = req.params;
            if (!CIVIC_DID_RE.test(partnerDid)) {
                return reply.code(400).send({ error: 'invalid_partner_did' });
            }

            const resolved = resolveParty(caller, partnerDid);
            if (!resolved) {
                return reply.code(400).send({ error: 'no_human_party' });
            }

            const text = req.body?.text;
            if (typeof text !== 'string' || text.trim() === '') {
                return reply.code(400).send({ error: 'empty_text' });
            }

            const gridName = services.gridName ?? 'genesis';
            const messageId = randomUUID();
            const tick = services.clock?.currentTick ?? 0;

            const store = new ConversationStore(pool);
            await store.postMessage({
                gridName,
                messageId,
                humanDid: resolved.humanDid,
                nousDid: resolved.nousDid,
                sender: resolved.sender,
                text,
                tick,
            });

            return reply.code(201).send({ ok: true, message_id: messageId });
        },
    );

    // GET /api/v1/civic/conversation/:partnerDid
    // Read the thread between the caller and their partner.
    app.get<{ Params: { partnerDid: string } }>(
        '/api/v1/civic/conversation/:partnerDid',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const caller = req.didContext?.did;
            if (!caller || !CIVIC_DID_RE.test(caller) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }

            const { partnerDid } = req.params;
            if (!CIVIC_DID_RE.test(partnerDid)) {
                return reply.code(400).send({ error: 'invalid_partner_did' });
            }

            const resolved = resolveParty(caller, partnerDid);
            if (!resolved) {
                return reply.code(400).send({ error: 'no_human_party' });
            }

            const gridName = services.gridName ?? 'genesis';
            const store = new ConversationStore(pool);
            const messages = await store.listThread(gridName, resolved.humanDid, resolved.nousDid);

            return reply.send({ messages, count: messages.length });
        },
    );
}
