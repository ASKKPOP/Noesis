/**
 * POST /api/v1/nous/:did/whisper/send — send handler factory.
 *
 * Phase 11 Wave 3 — WHISPER-01 / D-11-18 / D-11-19.
 *
 * Accepts {to_did, ciphertext_blob_b64} from the local Brain (loopback only).
 * The Brain has ALREADY encrypted the plaintext before POSTing.
 * Grid never decodes ciphertext_blob_b64 — it is opaque bytes.
 *
 * NOTE: The field was renamed from `plaintext_blob_b64` to `ciphertext_blob_b64`
 * per D-11-19 ratified in this wave. The deprecated alias is NOT accepted.
 *
 * TOMBSTONE RULES (D-11-18):
 *   - Recipient tombstoned → silent-drop returning 202 with synthetic envelope_id
 *     (do NOT call router — preserves D-11-18 liveness-silence while satisfying
 *     the local Brain's expectation of a 2xx).
 *   - Sender (`:did`) tombstoned → 410 { error: 'self_tombstoned' }.
 *
 * ERROR LADDER:
 *   400 { error: 'invalid_did' | 'invalid_ciphertext' }   — validation
 *   403 { error: 'loopback_only' }                        — non-loopback caller
 *   410 { error: 'self_tombstoned' }                      — sender is tombstoned
 *   429 { error: 'rate_limited' }                         — TickRateLimiter rejected
 *   202 { envelope_id, ciphertext_hash }                  — accepted (or silent-drop)
 *
 * See: 11-CONTEXT.md D-11-18, D-11-19. WHISPER-01. routes.ts for loopback hook.
 *
 * NO Date.now, NO Math.random (wall-clock ban per D-11-13).
 */

import { createHash, randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WhisperRouteDeps } from './routes.js';
import type { Envelope } from '../../whisper/types.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/;

interface SendBody {
    to_did?: unknown;
    ciphertext_blob_b64?: unknown;
    nonce_b64?: unknown;
    tick?: unknown;
}

/**
 * Build Fastify handler for POST /api/v1/nous/:did/whisper/send.
 */
export function sendHandler(deps: WhisperRouteDeps) {
    return async (
        req: FastifyRequest<{ Params: { did: string }; Body: SendBody }>,
        reply: FastifyReply,
    ) => {
        const senderDid = req.params.did;
        const body = (req.body ?? {}) as SendBody;

        // 1. Validate sender DID shape.
        if (!DID_RE.test(senderDid)) {
            reply.code(400);
            return { error: 'invalid_did' };
        }

        // 2. Validate to_did.
        const toDid = body.to_did;
        if (typeof toDid !== 'string' || !DID_RE.test(toDid)) {
            reply.code(400);
            return { error: 'invalid_did' };
        }

        // 3. Validate ciphertext_blob_b64 (must be a non-empty string).
        const ciphertextB64 = body.ciphertext_blob_b64;
        if (typeof ciphertextB64 !== 'string' || ciphertextB64.length === 0) {
            reply.code(400);
            return { error: 'invalid_ciphertext' };
        }

        // 4. Validate nonce_b64 (must be a string; used to build Envelope).
        const nonceB64 = typeof body.nonce_b64 === 'string' ? body.nonce_b64 : '';

        // 5. Validate tick.
        const tick = typeof body.tick === 'number' && Number.isInteger(body.tick) && body.tick >= 0
            ? body.tick
            : deps.worldClock.currentTick();

        // 6. Recipient tombstone peek — SILENT DROP per D-11-18.
        // Return 202 with synthetic envelope_id. DO NOT call router.
        if (deps.registry.isTombstoned(toDid)) {
            reply.code(202);
            return {
                envelope_id: `silent-drop-${randomUUID()}`,
                ciphertext_hash: '0'.repeat(64),
            };
        }

        // 7. Sender tombstone check — 410.
        if (deps.registry.isTombstoned(senderDid)) {
            reply.code(410);
            return { error: 'self_tombstoned' };
        }

        // 8. Compute ciphertext_hash from raw ciphertext bytes.
        let ciphertextBytes: Buffer;
        try {
            ciphertextBytes = Buffer.from(ciphertextB64, 'base64');
        } catch {
            reply.code(400);
            return { error: 'invalid_ciphertext' };
        }
        const ciphertextHash = createHash('sha256').update(ciphertextBytes).digest('hex');

        // 9. Validate ciphertext_hash shape.
        if (!HEX64_RE.test(ciphertextHash)) {
            reply.code(400);
            return { error: 'invalid_ciphertext' };
        }

        // 10. Build Envelope.
        const envelopeId = randomUUID().replace(/-/g, '');
        const envelope: Envelope = {
            version: 1,
            from_did: senderDid,
            to_did: toDid,
            tick,
            nonce_b64: nonceB64,
            ephemeral_pub_b64: '',   // reserved for WHISPER-FS-01 (deferred)
            ciphertext_b64: ciphertextB64,
            ciphertext_hash: ciphertextHash,
            envelope_id: envelopeId,
        };

        // 11. Route through WhisperRouter.
        let accepted: boolean;
        try {
            accepted = deps.whisperRouter.route(envelope, tick);
        } catch (err) {
            // TypeError from DID regex inside router — treat as 400.
            reply.code(400);
            return { error: 'invalid_did' };
        }

        if (!accepted) {
            // router returns false for rate-limit (tombstone already handled above).
            reply.code(429);
            return { error: 'rate_limited' };
        }

        reply.code(202);
        return { envelope_id: envelopeId, ciphertext_hash: ciphertextHash };
    };
}
