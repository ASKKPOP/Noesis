/**
 * grid/src/whisper/crypto.ts
 *
 * Phase 11 Wave 1 — D-11-02, D-11-03, D-11-13
 * Deterministic libsodium-wrappers wrapper: keypair derivation, nonce derivation,
 * AEAD encrypt/decrypt, and ciphertext hash.
 *
 * SECURITY:
 *   - No Date.now, Math.random, performance.now anywhere in this file.
 *   - Nonce is blake2b(sender_priv_seed ‖ tick_le64 ‖ counter_le32)[:24] — deterministic.
 *   - Keypair seed = SHA256(DID)[:32] passed to crypto_box_seed_keypair.
 *   - crypto_box_easy / crypto_box_open_easy (XSalsa20-Poly1305) — AEAD.
 *   - MAC failure in decryptFrom throws — never returns garbage.
 *
 * Cross-language compatibility:
 *   Python: nacl.bindings.crypto_box_seed_keypair(hashlib.sha256(did.encode()).digest()[:32])
 *   JS:     sodium.crypto_box_seed_keypair(nodeCrypto.createHash('sha256').update(did).digest())
 *   Both use SHA-256 of the UTF-8 DID as the 32-byte seed passed to crypto_box_seed_keypair.
 *   SHA-256 via Node built-in `crypto` — libsodium-wrappers (non-sumo) omits crypto_hash_sha256.
 *
 * Initialization:
 *   initSodium() memoizes the ready promise. Must be resolved before any call.
 *   Module-level top-level await ensures sodium is ready for synchronous API callers
 *   (used by test fixtures that call functions directly after dynamic import).
 */
import sodium from 'libsodium-wrappers';
import { createHash } from 'node:crypto';

// ── Initialization ────────────────────────────────────────────────────────────

let _readyPromise: Promise<typeof sodium> | null = null;

/**
 * Memoized sodium ready promise. Second call resolves instantly via cached promise.
 * Must be awaited before any libsodium operation.
 */
export function initSodium(): Promise<typeof sodium> {
    if (_readyPromise) return _readyPromise;
    _readyPromise = sodium.ready.then(() => sodium);
    return _readyPromise;
}

// Top-level await: ensures sodium is ready before any synchronous export is used.
// This allows test code to call synchronous functions immediately after dynamic import().
await initSodium();

// ── SHA-256 helper (Node built-in; libsodium-wrappers non-sumo lacks crypto_hash_sha256) ──

function sha256(input: Uint8Array | string): Uint8Array {
    const h = createHash('sha256');
    if (typeof input === 'string') {
        h.update(input, 'utf8');
    } else {
        h.update(input);
    }
    return new Uint8Array(h.digest());
}

// ── Keypair derivation ────────────────────────────────────────────────────────

/**
 * Derive a deterministic X25519 keypair from a 32-byte seed.
 * Uses crypto_box_seed_keypair: internally SHA-512s the seed, uses first 32 bytes
 * as clamped scalar — matches Python nacl.bindings.crypto_box_seed_keypair exactly.
 *
 * Synchronous — safe to call after initSodium() has resolved.
 */
export function deriveKeypairFromSeed(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array } {
    const kp = sodium.crypto_box_seed_keypair(seed);
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/**
 * Derive a deterministic keypair from a DID string.
 * Seed = SHA256(UTF-8(did))[:32] → crypto_box_seed_keypair.
 * Same DID always yields same keypair.
 *
 * Uses Node's built-in crypto.createHash('sha256') — libsodium-wrappers non-sumo
 * does not expose crypto_hash_sha256. Byte-compatible with Python hashlib.sha256.
 */
export function keypairFromDid(did: string): { publicKey: Uint8Array; privateKey: Uint8Array } {
    const seed = sha256(did);   // 32 bytes — SHA256 always yields 32 bytes
    return deriveKeypairFromSeed(seed);
}

/**
 * Derive the 32-byte seed for a given DID (SHA256(UTF-8(did))).
 * Used for nonce derivation — never exposed on wire.
 */
export function seedForDid(did: string): Uint8Array {
    return sha256(did);  // 32 bytes
}

// ── Nonce derivation ──────────────────────────────────────────────────────────

/**
 * Derive a deterministic 24-byte nonce via blake2b.
 * Formula: blake2b(sender_priv_seed_32 ‖ tick_le64 ‖ counter_le32, digest_size=24)
 *
 * Matches Python: hashlib.blake2b(buf, digest_size=24).digest()
 * Nonce is unique per (sender_seed, tick, counter) — no Math.random, no Date.now.
 *
 * Synchronous — safe to call after initSodium() has resolved.
 */
export function deriveNonce(senderPrivSeed: Uint8Array, tick: number, counter: number): Uint8Array {
    const tickBuf = new Uint8Array(8);
    new DataView(tickBuf.buffer).setBigUint64(0, BigInt(tick), /* littleEndian */ true);
    const ctrBuf = new Uint8Array(4);
    new DataView(ctrBuf.buffer).setUint32(0, counter, /* littleEndian */ true);
    const input = new Uint8Array(senderPrivSeed.length + 8 + 4);
    input.set(senderPrivSeed, 0);
    input.set(tickBuf, senderPrivSeed.length);
    input.set(ctrBuf, senderPrivSeed.length + 8);
    // crypto_generichash = blake2b; 24-byte output
    return sodium.crypto_generichash(24, input);
}

// ── AEAD encrypt / decrypt ────────────────────────────────────────────────────

/**
 * Encrypt plaintext for recipient using sender's private key (X25519 key agreement,
 * XSalsa20-Poly1305 AEAD). Returns ciphertext only — nonce NOT prepended.
 *
 * ciphertext.length === plaintext.length + crypto_box_MACBYTES (16)
 *
 * Parameter order: (recipientPub, senderPriv, plaintext, nonce)
 * Synchronous — safe to call after initSodium() has resolved.
 */
export function encryptFor(
    recipientPub: Uint8Array,
    senderPriv: Uint8Array,
    plaintext: Uint8Array,
    nonce: Uint8Array,
): Uint8Array {
    return sodium.crypto_box_easy(plaintext, nonce, recipientPub, senderPriv);
}

/**
 * Decrypt ciphertext from sender using recipient's private key.
 * Throws on MAC failure — never returns garbage.
 *
 * Parameter order: (senderPub, recipientPriv, ciphertext, nonce)
 * Synchronous — safe to call after initSodium() has resolved.
 */
export function decryptFrom(
    senderPub: Uint8Array,
    recipientPriv: Uint8Array,
    ciphertext: Uint8Array,
    nonce: Uint8Array,
): Uint8Array {
    // crypto_box_open_easy throws on MAC failure (libsodium convention)
    return sodium.crypto_box_open_easy(ciphertext, nonce, senderPub, recipientPriv);
}

// ── Ciphertext hash ───────────────────────────────────────────────────────────

/**
 * Hash ciphertext bytes via SHA-256, returning 64-char lowercase hex.
 * Nonce is NOT included — allows determinism test to compare hash across runs.
 * Uses Node's built-in crypto.createHash('sha256') — matches Python hashlib.sha256.
 *
 * Synchronous — safe to call after initSodium() has resolved.
 */
export function hashCiphertext(ciphertext: Uint8Array): string {
    const h = sha256(ciphertext);
    return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('');
}
