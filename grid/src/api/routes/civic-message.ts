/**
 * Phase 41 SLEEP-02 — civic message send route.
 * POST /api/v1/civic/message — queue-aware direct message, T-41-02 depth cap.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export async function registerCivicMessageRoute(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.post('/api/v1/civic/message', async (req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const sender = req.didContext?.did;
        if (!sender || !CIVIC_DID_RE.test(sender) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const body = req.body as { recipient_civic_did?: unknown; message?: unknown };
        const recipient = body.recipient_civic_did;
        if (typeof recipient !== 'string' || !CIVIC_DID_RE.test(recipient)) {
            return reply.code(400).send({ error: 'invalid_recipient_did' });
        }
        if (body.message === undefined || body.message === null) {
            return reply.code(400).send({ error: 'missing_message' });
        }
        const serialized = JSON.stringify(body.message);
        if (serialized.length > 64 * 1024) {
            return reply.code(413).send({ error: 'message_too_large' });
        }
        const result = await svc.sendDirectMessage(recipient, sender, body.message);
        if (result.queueFull) {
            return reply.code(429).send({ error: 'queue_full' });
        }
        if (!result.queued) {
            return reply.code(404).send({ error: 'recipient_not_found' });
        }
        return reply.code(202).send({ queued: true, message_id: result.messageId });
    });
}
