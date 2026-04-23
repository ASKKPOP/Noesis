/**
 * SYNC: mirrors dashboard/src/lib/protocol/whisper-types.ts
 * SYNC: mirrors brain/src/noesis_brain/whisper/types.py
 *
 * Drift detected by grid/test/whisper/whisper-wire-format.test.ts (Wave 2+).
 *
 * PRIVACY — WHISPER-03 audit boundary:
 *   Plaintext NEVER enters this file or any downstream grid module.
 *   Only counts and ciphertext_hash (opaque hex) may appear in audit payloads.
 *   The Envelope interface carries the full wire shape but ciphertext_b64 and
 *   nonce_b64 are opaque base64 blobs — never decoded on the Grid side.
 *
 * Per D-11-01 / D-11-06 / CONTEXT-11.
 *
 * No runtime side-effectful code in this file. Types and tuples only.
 * NO Date.now, NO Math.random (wall-clock ban: D-11-13 / check-wallclock-forbidden.mjs).
 */

/**
 * Closed 4-key payload carried by the 'nous.whispered' audit event.
 * Keys are alphabetical — WHISPERED_KEYS enforces this order at the producer boundary.
 *
 * PRIVACY: ciphertext_hash is an opaque SHA-256 hex digest; from_did and to_did
 * are DID strings; tick is the system tick. No plaintext fields EVER.
 */
export interface NousWhisperedPayload {
    readonly ciphertext_hash: string;
    readonly from_did: string;
    readonly tick: number;
    readonly to_did: string;
}

/**
 * Alphabetical tuple of NousWhisperedPayload keys.
 * Used at the sole-producer boundary (appendNousWhispered.ts) for
 * Object.keys(payload).sort() strict-equality enforcement.
 */
export const WHISPERED_KEYS = ['ciphertext_hash', 'from_did', 'tick', 'to_did'] as const;

/**
 * Wire-format envelope carrying an E2E-encrypted Nous↔Nous whisper.
 * Stored in Grid in-memory Map<recipient_did, Envelope[]>; deleted on ack.
 * Sent over HTTP (Brain→Grid POST /api/v1/nous/:did/whispers/send).
 *
 * Per D-11-06:
 *   version: 1 (locked; bump = new allowlist addition)
 *   nonce_b64: base64-encoded 24-byte nonce (32 chars)
 *   ephemeral_pub_b64: reserved for future sealed-sender (WHISPER-FS-01 deferred)
 *   ciphertext_b64: base64-encoded ciphertext (MAC+encrypted, opaque on Grid)
 *   ciphertext_hash: SHA-256 hex of ciphertext bytes (without nonce), 64 chars
 *
 * PRIVACY: Grid never decodes ciphertext_b64 or nonce_b64. The Envelope is
 * an opaque blob from Grid's perspective; only Brain decrypts it.
 */
export interface Envelope {
    readonly version: number;
    readonly from_did: string;
    readonly to_did: string;
    readonly tick: number;
    readonly nonce_b64: string;
    readonly ephemeral_pub_b64: string;
    readonly ciphertext_b64: string;
    readonly ciphertext_hash: string;
    /** Brain-generated UUID for ack dedup (D-11-06). Used by PendingStore.ackDelete. */
    readonly envelope_id: string;
}
