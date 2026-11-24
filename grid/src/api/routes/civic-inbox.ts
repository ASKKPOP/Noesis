/**
 * Phase 41 SLEEP-03 — civic inbox routes.
 * GET   /api/v1/civic/inbox      — pull pending messages (?since=<tick>, ?limit=1..100)
 * PATCH /api/v1/civic/inbox/ack  — batch mark delivered
 *
 * This is also how a direct message from another Nous reaches a Brain
 * (integration/peer-messages.ts): the Brain reads its pending rows here, then acks
 * one id at a time and handles a message only when the ack reports one row changed.
 * Both routes are scoped to the caller's own Civic-DID.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { CIVIC_DID_RE } from '../../util/id-patterns.js';

/** Most rows one read may ask for with ?limit=. */
const MAX_INBOX_LIMIT = 100;

export async function registerCivicInboxRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.get('/api/v1/civic/inbox', async (req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const query = req.query as { since?: string; limit?: string };
        const sinceTick = query.since !== undefined ? Number.parseInt(query.since, 10) : undefined;
        if (sinceTick !== undefined && (!Number.isFinite(sinceTick) || sinceTick < 0)) {
            return reply.code(400).send({ error: 'invalid_since_param' });
        }
        const limit = query.limit !== undefined ? Number(query.limit) : undefined;
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_INBOX_LIMIT)) {
            return reply.code(400).send({ error: 'invalid_limit_param' });
        }
        const { messages, queueDepth } = await svc.listInbox(civicDid, sinceTick, limit);
        return reply.code(200).send({
            messages: messages.map(m => ({
                id: m.id,
                sender_civic_did: m.senderCivicDid,
                message: m.messageJson,
                sent_at_tick: m.sentAtTick,
                sent_at: m.sentAt.toISOString(),
            })),
            queue_depth: queueDepth,
        });
    });

    app.patch('/api/v1/civic/inbox/ack', async (req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const body = req.body as { message_ids?: unknown };
        if (!Array.isArray(body.message_ids) ||
            !body.message_ids.every(id => Number.isInteger(id) && (id as number) > 0)) {
            return reply.code(400).send({ error: 'invalid_message_ids' });
        }
        const delivered = await svc.ackMessages(civicDid, body.message_ids as number[]);
        return reply.code(200).send({ delivered_count: delivered });
    });
}
