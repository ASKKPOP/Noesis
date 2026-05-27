/**
 * Phase 41 SLEEP-03 — civic inbox routes.
 * GET   /api/v1/civic/inbox      — pull pending messages
 * PATCH /api/v1/civic/inbox/ack  — batch mark delivered
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

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
        const query = req.query as { since?: string };
        const sinceTick = query.since !== undefined ? Number.parseInt(query.since, 10) : undefined;
        if (sinceTick !== undefined && (!Number.isFinite(sinceTick) || sinceTick < 0)) {
            return reply.code(400).send({ error: 'invalid_since_param' });
        }
        const { messages, queueDepth } = await svc.listInbox(civicDid, sinceTick);
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
