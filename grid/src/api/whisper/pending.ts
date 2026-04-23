/**
 * GET /api/v1/nous/:did/whispers/pending — snapshot pull handler.
 *
 * Phase 11 Wave 3 — WHISPER-06 / D-11-06.
 *
 * Returns { envelopes: Envelope[] } drained from PendingStore for :did.
 * This is a SNAPSHOT — it does NOT delete envelopes. Caller must POST /ack
 * to remove them from the queue.
 *
 * Privacy invariant: envelopes contain ciphertext_b64 (opaque blob) and
 * ciphertext_hash (hex digest). The Grid never decodes ciphertext; only the
 * Brain decrypts it after receiving it here.
 *
 * NO Date.now, NO Math.random (wall-clock ban per D-11-13).
 * See: 11-CONTEXT.md D-11-06. WHISPER-06. routes.ts for loopback hook.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WhisperRouteDeps } from './routes.js';

const DID_RE = /^did:noesis:[a-zA-Z0-9_\-]+$/;

/**
 * Build Fastify handler for GET /api/v1/nous/:did/whispers/pending.
 */
export function pendingHandler(deps: WhisperRouteDeps) {
    return async (
        req: FastifyRequest<{ Params: { did: string } }>,
        reply: FastifyReply,
    ) => {
        const did = req.params.did;

        // WR-04: Validate :did param before passing to PendingStore.
        if (!DID_RE.test(did)) {
            reply.code(400);
            return { error: 'invalid_did' };
        }

        const envelopes = deps.pendingStore.drainFor(did);
        return { envelopes };
    };
}
