/**
 * GET /api/v1/nous/:did/whispers/pending — snapshot handler.
 *
 * Phase 11 Wave 3 — WHISPER-06 / D-11-06.
 *
 * Returns a snapshot of all pending envelopes for the given recipient DID.
 * Does NOT delete envelopes — caller must POST /whispers/ack to confirm delivery.
 *
 * PRIVACY: envelopes contain ciphertext_b64 and nonce_b64 (opaque blobs).
 * Grid never decodes these. The Brain decrypts locally after receiving.
 *
 * NO Date.now, NO Math.random (wall-clock ban per D-11-13).
 * See: 11-CONTEXT.md D-11-06. WHISPER-06. routes.ts for loopback hook.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WhisperRouteDeps } from './routes.js';

/**
 * Build Fastify handler for GET /api/v1/nous/:did/whispers/pending.
 */
export function pendingHandler(deps: WhisperRouteDeps) {
    return async (
        req: FastifyRequest<{ Params: { did: string } }>,
        _reply: FastifyReply,
    ) => {
        const did = req.params.did;
        const envelopes = deps.pendingStore.drainFor(did);
        return { envelopes };
    };
}
