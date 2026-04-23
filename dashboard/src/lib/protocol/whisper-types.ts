/**
 * SYNC: mirrors grid/src/whisper/types.ts
 * SYNC: mirrors brain/src/noesis_brain/whisper/types.py
 *
 * Drift detected by dashboard/test/lib/whisper-types.drift.test.ts (lands in Wave 4).
 *
 * PRIVACY — WHISPER-02 render surface:
 *   Plaintext NEVER enters this file or any downstream dashboard module.
 *   Only counts and ciphertext_hash (opaque hex) may be mirrored here.
 *
 * Per Phase 10a, the fourth mirror is the threshold for consolidation into
 * @noesis/protocol-types. That refactor is logged as deferred and does NOT
 * block Phase 11.
 *
 * Two-source copy intentional — dashboard is a Next.js app with no
 * workspace dep on grid/ or brain/; a divergent copy surfaces in grep the
 * moment upstream shapes change.
 *
 * NO Date.now, NO Math.random — wall-clock discipline applies (D-11-13).
 * Dashboard whisper tree is render-only counts; wall-clock IS allowed for
 * UI state (Date.now for display timestamps) but NOT for whisper payload
 * processing or type definitions.
 */

/**
 * Closed 4-key payload carried by the 'nous.whispered' audit event.
 * Keys are alphabetical — matches grid/src/whisper/types.ts WHISPERED_KEYS.
 *
 * PRIVACY: ciphertext_hash is an opaque SHA-256 hex digest.
 * Dashboard never decodes or displays ciphertext_hash content.
 */
export interface NousWhisperedPayload {
    readonly ciphertext_hash: string;
    readonly from_did: string;
    readonly tick: number;
    readonly to_did: string;
}

/**
 * Alphabetical tuple of NousWhisperedPayload keys.
 * Mirrors grid/src/whisper/types.ts WHISPERED_KEYS.
 */
export const WHISPERED_KEYS = ['ciphertext_hash', 'from_did', 'tick', 'to_did'] as const;

/**
 * Wire-format envelope shape (read-only mirror for type checking).
 * Dashboard only renders count-level summaries — never raw ciphertext_b64.
 * Mirrors grid/src/whisper/types.ts Envelope.
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
}
