/**
 * POST /api/v1/nous/:did/whisper/send — encrypt-and-route handler.
 *
 * Phase 11 Wave 3 — WHISPER-01 / D-11-18 / D-11-19.
 *
 * Accepts { to_did, ciphertext_blob_b64 } from the local Brain ONLY (loopback).
 * Builds an Envelope, calls WhisperRouter.route(envelope, tick), and returns:
 *   202 { envelope_id, ciphertext_hash }   — accepted
 *   202 { envelope_id, ciphertext_hash }   — recipient tombstoned (silent-drop per D-11-18)
 *   400 { error: 'invalid_did' }           — bad to_did shape
 *   400 { error: 'invalid_ciphertext' }    — missing / non-string ciphertext_blob_b64
 *   410 { error: 'self_tombstoned' }       — sender's own DID is tombstoned
 *   429 { error: 'rate_limited' }          — TickRateLimiter rejected (INFORMATIONAL — loopback only)
 *
 * D-11-18 silent-drop rationale:
 *   Recipient tombstone is NOT exposed to the sender — 202 with a synthetic
 *   envelope_id is returned so the sender cannot probe tombstone state.
 *   Sender tombstone IS exposed (410) because the caller is the local Brain
 *   and the information is already known locally via the state mechanism.
 *
 * D-11-19 field naming:
 *   Body field is `ciphertext_blob_b64` (Brain encrypts BEFORE POST).
 *   The older name `plaintext_blob_b64` is deprecated; any reference to
 *   "plaintext" in this file is documentation-only and never a wire key.
 *
 * Privacy invariant (Wave 4 gate):
 *   Response body contains ONLY envelope_id + ciphertext_hash.
 *   NO plaintext, NO ciphertext blob, NO DID leak beyond what the caller sent.
 *
 * NO Date.now, NO Math.random, NO setTimeout, NO setInterval (wall-clock ban D-11-13).
 * See: 11-CONTEXT.md D-11-08, D-11-18, D-11-19. WHISPER-01. routes.ts for loopback hook.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WhisperRouteDeps } from './routes.js';

const DID_RE = /^did:noesis:[a-zA-Z0-9_\-]+$/;

interface SendBody {
    to_did?: unknown;
    ciphertext_blob_b64?: unknown;
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

        // Validate to_did shape.
        const toDid = body.to_did;
        if (typeof toDid !== 'string' || !DID_RE.test(toDid)) {
            reply.code(400);
            return { error: 'invalid_did' };
        }

        // Validate ciphertext_blob_b64.
        const ctB64 = body.ciphertext_blob_b64;
        if (typeof ctB64 !== 'string' || ctB64.length === 0) {
            reply.code(400);
            return { error: 'invalid_ciphertext' };
        }

        // D-11-18: Recipient tombstone → silent 202 (no router invocation, no audit).
        // The sender CANNOT tell the recipient is tombstoned.
        if (deps.registry.isTombstoned(toDid)) {
            reply.code(202);
            return {
                envelope_id: 'silent-drop-' + randomUUID(),
                ciphertext_hash: '0'.repeat(64),
            };
        }

        // Sender (self) tombstone → 410 (informational — the local Brain already knows).
        if (deps.registry.isTombstoned(senderDid)) {
            reply.code(410);
            return { error: 'self_tombstoned' };
        }

        // Decode ciphertext bytes and compute SHA-256 hash.
        let ctBytes: Buffer;
        try {
            ctBytes = Buffer.from(ctB64, 'base64');
        } catch {
            reply.code(400);
            return { error: 'invalid_ciphertext' };
        }
        const ciphertextHash = createHash('sha256').update(ctBytes).digest('hex');

        const currentTick = deps.worldClock.currentTick();
        const envelopeId = randomUUID();

        // Build the Envelope — Grid never decodes ciphertext; it's opaque here.
        const envelope = {
            version: 1,
            from_did: senderDid,
            to_did: toDid,
            tick: currentTick,
            nonce_b64: '',          // Brain includes nonce in ciphertext_blob_b64 body; Grid doesn't split it
            ephemeral_pub_b64: '',  // Reserved for future forward-secrecy (WHISPER-FS-01 deferred)
            ciphertext_b64: ctB64,
            ciphertext_hash: ciphertextHash,
            envelope_id: envelopeId,
        };

        // Call router — returns false on rate-limit or tombstone silent-drop.
        let accepted: boolean;
        try {
            accepted = deps.whisperRouter.route(envelope, currentTick);
        } catch (err) {
            // Step 1 DID validation failure in router (programmer error / malformed input).
            reply.code(400);
            return { error: 'invalid_did' };
        }

        if (!accepted) {
            // Router returned false — TickRateLimiter rejected (tombstone checked above).
            reply.code(429);
            return { error: 'rate_limited' };
        }

        reply.code(202);
        return { envelope_id: envelopeId, ciphertext_hash: ciphertextHash };
    };
}
