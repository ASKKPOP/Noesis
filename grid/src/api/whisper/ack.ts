/**
 * POST /api/v1/nous/:did/whispers/ack — ack-delete handler.
 *
 * Phase 11 Wave 3 — WHISPER-06 / D-11-06.
 *
 * Accepts {envelope_ids: string[]} and calls PendingStore.ackDelete.
 * Returns {deleted: count}.
 *
 * Acking a non-existent id is a no-op (count=0, no error).
 * Acking with empty list returns {deleted: 0}.
 * Bad body shape → 400.
 *
 * NO Date.now, NO Math.random (wall-clock ban per D-11-13).
 * See: 11-CONTEXT.md D-11-06. WHISPER-06. routes.ts for loopback hook.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WhisperRouteDeps } from './routes.js';

interface AckBody {
    envelope_ids?: unknown;
}

/**
 * Build Fastify handler for POST /api/v1/nous/:did/whispers/ack.
 */
export function ackHandler(deps: WhisperRouteDeps) {
    return async (
        req: FastifyRequest<{ Params: { did: string }; Body: AckBody }>,
        reply: FastifyReply,
    ) => {
        const did = req.params.did;
        const body = (req.body ?? {}) as AckBody;
        const ids = body.envelope_ids;

        // Validate body shape.
        if (!Array.isArray(ids) || !ids.every((i) => typeof i === 'string')) {
            reply.code(400);
            return { error: 'invalid_envelope_ids' };
        }

        const deleted = deps.pendingStore.ackDelete(did, new Set(ids));
        return { deleted };
    };
}
