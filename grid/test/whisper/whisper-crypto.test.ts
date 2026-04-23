/**
 * Phase 11 Wave 1 — whisper-crypto.test.ts
 *
 * Tests for grid/src/whisper/crypto.ts: deterministic keypair derivation,
 * deterministic nonce derivation, AEAD encrypt/decrypt, and ciphertext hash.
 *
 * D-11-02: libsodium-wrappers (non-sumo), crypto_box_seed_keypair
 * D-11-03: seed = SHA256(DID)[:32]; nonce = blake2b(seed ‖ tick_le64 ‖ counter_le32)[:24]
 * D-11-13: no wall-clock reads; no Math.random; deterministic output
 */
import { describe, expect, it, beforeAll } from 'vitest';
import {
    initSodium,
    deriveKeypairFromSeed,
    keypairFromDid,
    seedForDid,
    deriveNonce,
    encryptFor,
    decryptFrom,
    hashCiphertext,
} from '../../src/whisper/crypto.js';

// Ensure sodium is ready before any test runs.
// (Module-level top-level await makes this redundant, but explicit for clarity.)
beforeAll(async () => {
    await initSodium();
});

// ── initSodium ────────────────────────────────────────────────────────────────

describe('initSodium', () => {
    it('returns a promise that resolves to the sodium module', async () => {
        const s = await initSodium();
        expect(s).toBeDefined();
        expect(typeof s.crypto_box_easy).toBe('function');
    });

    it('memoizes — second call returns the same promise object', () => {
        const p1 = initSodium();
        const p2 = initSodium();
        expect(p1).toBe(p2);
    });
});

// ── deriveKeypairFromSeed ─────────────────────────────────────────────────────

describe('deriveKeypairFromSeed', () => {
    it('returns a keypair with 32-byte publicKey and 32-byte privateKey', () => {
        const seed = new Uint8Array(32).fill(1);
        const kp = deriveKeypairFromSeed(seed);
        expect(kp.publicKey).toHaveLength(32);
        expect(kp.privateKey).toHaveLength(32);
    });

    it('is deterministic — same seed produces byte-identical keypair', () => {
        const seed = new Uint8Array(32).fill(1);
        const kp1 = deriveKeypairFromSeed(seed);
        const kp2 = deriveKeypairFromSeed(seed);
        expect(kp1.publicKey).toEqual(kp2.publicKey);
        expect(kp1.privateKey).toEqual(kp2.privateKey);
    });

    it('produces distinct keypairs for distinct seeds', () => {
        const seed1 = new Uint8Array(32).fill(1);
        const seed2 = new Uint8Array(32).fill(2);
        const kp1 = deriveKeypairFromSeed(seed1);
        const kp2 = deriveKeypairFromSeed(seed2);
        expect(kp1.publicKey).not.toEqual(kp2.publicKey);
        expect(kp1.privateKey).not.toEqual(kp2.privateKey);
    });
});

// ── keypairFromDid ────────────────────────────────────────────────────────────

describe('keypairFromDid', () => {
    it('is deterministic — same DID produces byte-identical keypair', () => {
        const kp1 = keypairFromDid('did:noesis:alice_test');
        const kp2 = keypairFromDid('did:noesis:alice_test');
        expect(kp1.publicKey).toEqual(kp2.publicKey);
        expect(kp1.privateKey).toEqual(kp2.privateKey);
    });

    it('produces distinct keypairs for distinct DIDs', () => {
        const kp1 = keypairFromDid('did:noesis:alice_test');
        const kp2 = keypairFromDid('did:noesis:bob_test');
        expect(kp1.publicKey).not.toEqual(kp2.publicKey);
    });

    it('matches deriveKeypairFromSeed(seedForDid(did))', () => {
        const did = 'did:noesis:alice_test';
        const seed = seedForDid(did);
        const kpDirect = keypairFromDid(did);
        const kpFromSeed = deriveKeypairFromSeed(seed);
        expect(kpDirect.publicKey).toEqual(kpFromSeed.publicKey);
        expect(kpDirect.privateKey).toEqual(kpFromSeed.privateKey);
    });
});

// ── deriveNonce ───────────────────────────────────────────────────────────────

describe('deriveNonce', () => {
    it('returns exactly 24 bytes', () => {
        const seed = new Uint8Array(32).fill(2);
        const n = deriveNonce(seed, 42, 0);
        expect(n).toHaveLength(24);
    });

    it('is deterministic — same (seed, tick, counter) produces byte-identical nonce', () => {
        const seed = new Uint8Array(32).fill(2);
        const n1 = deriveNonce(seed, 42, 0);
        const n2 = deriveNonce(seed, 42, 0);
        expect(n1).toEqual(n2);
    });

    it('counter scope — different counter produces different nonce at same tick', () => {
        const seed = new Uint8Array(32).fill(2);
        const n0 = deriveNonce(seed, 42, 0);
        const n1 = deriveNonce(seed, 42, 1);
        expect(n0).not.toEqual(n1);
    });

    it('tick scope — different tick produces different nonce at same counter', () => {
        const seed = new Uint8Array(32).fill(2);
        const n42 = deriveNonce(seed, 42, 0);
        const n43 = deriveNonce(seed, 43, 0);
        expect(n42).not.toEqual(n43);
    });

    it('seed scope — different seed produces different nonce at same tick+counter', () => {
        const seed1 = new Uint8Array(32).fill(2);
        const seed2 = new Uint8Array(32).fill(3);
        const n1 = deriveNonce(seed1, 42, 0);
        const n2 = deriveNonce(seed2, 42, 0);
        expect(n1).not.toEqual(n2);
    });

    it('tick=0, counter=0 produces valid 24-byte nonce', () => {
        const seed = new Uint8Array(32).fill(5);
        const n = deriveNonce(seed, 0, 0);
        expect(n).toHaveLength(24);
    });
});

// ── encryptFor + decryptFrom ──────────────────────────────────────────────────

describe('encryptFor + decryptFrom', () => {
    const senderSeed = new Uint8Array(32).fill(3);
    const recipientSeed = new Uint8Array(32).fill(4);
    const senderKp = deriveKeypairFromSeed(senderSeed);
    const recipientKp = deriveKeypairFromSeed(recipientSeed);
    const plaintext = new TextEncoder().encode('hello whisper');

    it('encrypt/decrypt round-trip produces original plaintext', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const ciphertext = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        const decrypted = decryptFrom(senderKp.publicKey, recipientKp.privateKey, ciphertext, nonce);
        expect(decrypted).toEqual(plaintext);
    });

    it('ciphertext is plaintext.length + 16 (Poly1305 MAC)', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const ciphertext = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        expect(ciphertext).toHaveLength(plaintext.length + 16);
    });

    it('is deterministic — same inputs produce byte-identical ciphertext', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const ct1 = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        const ct2 = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        expect(ct1).toEqual(ct2);
    });

    it('MAC failure — decryptFrom throws on tampered ciphertext', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const ciphertext = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        // Corrupt the first byte of the ciphertext (MAC region)
        const corrupted = new Uint8Array(ciphertext);
        corrupted[0] ^= 0xff;
        expect(() => decryptFrom(senderKp.publicKey, recipientKp.privateKey, corrupted, nonce)).toThrow();
    });

    it('MAC failure — decryptFrom throws on wrong nonce', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const wrongNonce = deriveNonce(senderSeed, 2, 0); // different tick
        const ciphertext = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        expect(() => decryptFrom(senderKp.publicKey, recipientKp.privateKey, ciphertext, wrongNonce)).toThrow();
    });

    it('different counter nonces produce distinct ciphertexts', () => {
        const nonce0 = deriveNonce(senderSeed, 1, 0);
        const nonce1 = deriveNonce(senderSeed, 1, 1);
        const ct0 = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce0);
        const ct1 = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce1);
        expect(ct0).not.toEqual(ct1);
    });
});

// ── hashCiphertext ────────────────────────────────────────────────────────────

describe('hashCiphertext', () => {
    const senderSeed = new Uint8Array(32).fill(3);
    const recipientSeed = new Uint8Array(32).fill(4);
    const senderKp = deriveKeypairFromSeed(senderSeed);
    const recipientKp = deriveKeypairFromSeed(recipientSeed);
    const plaintext = new TextEncoder().encode('hello whisper');

    it('returns a 64-character lowercase hex string', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const ct = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        const h = hashCiphertext(ct);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic — same ciphertext produces identical hash', () => {
        const nonce = deriveNonce(senderSeed, 1, 0);
        const ct = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        const h1 = hashCiphertext(ct);
        const h2 = hashCiphertext(ct);
        expect(h1).toBe(h2);
    });

    it('distinct ciphertexts produce distinct hashes', () => {
        const nonce0 = deriveNonce(senderSeed, 1, 0);
        const nonce1 = deriveNonce(senderSeed, 1, 1);
        const ct0 = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce0);
        const ct1 = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce1);
        const h0 = hashCiphertext(ct0);
        const h1 = hashCiphertext(ct1);
        expect(h0).not.toBe(h1);
    });
});

// ── Module-level import compatibility (original Wave 0 stubs) ─────────────────

describe('whisper crypto — module import compatibility', () => {
    it('imports encryptFor from grid/src/whisper/crypto.ts', async () => {
        await expect(import('../../src/whisper/crypto.js')).resolves.toHaveProperty('encryptFor');
    });

    it('imports decryptFrom from grid/src/whisper/crypto.ts', async () => {
        await expect(import('../../src/whisper/crypto.js')).resolves.toHaveProperty('decryptFrom');
    });

    it('imports deriveNonce from grid/src/whisper/crypto.ts', async () => {
        await expect(import('../../src/whisper/crypto.js')).resolves.toHaveProperty('deriveNonce');
    });

    it('imports hashCiphertext from grid/src/whisper/crypto.ts', async () => {
        await expect(import('../../src/whisper/crypto.js')).resolves.toHaveProperty('hashCiphertext');
    });

    it('crypto_box_seed_keypair determinism (original Wave 0 stub)', async () => {
        const { deriveKeypairFromSeed: dkfs } = await import('../../src/whisper/crypto.js') as {
            deriveKeypairFromSeed: (seed: Uint8Array) => { publicKey: Uint8Array; privateKey: Uint8Array };
        };
        const seed = new Uint8Array(32).fill(1);
        const kp1 = dkfs(seed);
        const kp2 = dkfs(seed);
        expect(kp1.publicKey).toEqual(kp2.publicKey);
        expect(kp1.privateKey).toEqual(kp2.privateKey);
    });

    it('deriveNonce determinism (original Wave 0 stub)', async () => {
        const { deriveNonce: dn } = await import('../../src/whisper/crypto.js') as {
            deriveNonce: (seed: Uint8Array, tick: number, counter: number) => Uint8Array;
        };
        const seed = new Uint8Array(32).fill(2);
        const n1 = dn(seed, 42, 0);
        const n2 = dn(seed, 42, 0);
        expect(n1).toHaveLength(24);
        expect(n1).toEqual(n2);
    });

    it('encrypt/decrypt roundtrip (original Wave 0 stub)', async () => {
        const { encryptFor: ef, decryptFrom: df, deriveKeypairFromSeed: dkfs, deriveNonce: dn } =
            await import('../../src/whisper/crypto.js') as {
                encryptFor: (recipientPub: Uint8Array, senderPriv: Uint8Array, plaintext: Uint8Array, nonce: Uint8Array) => Uint8Array;
                decryptFrom: (senderPub: Uint8Array, recipientPriv: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array) => Uint8Array;
                deriveKeypairFromSeed: (seed: Uint8Array) => { publicKey: Uint8Array; privateKey: Uint8Array };
                deriveNonce: (seed: Uint8Array, tick: number, counter: number) => Uint8Array;
            };
        const senderSeed = new Uint8Array(32).fill(3);
        const recipientSeed = new Uint8Array(32).fill(4);
        const senderKp = dkfs(senderSeed);
        const recipientKp = dkfs(recipientSeed);
        const nonce = dn(senderSeed, 1, 0);
        const pt = new TextEncoder().encode('hello whisper');
        const ciphertext = ef(recipientKp.publicKey, senderKp.privateKey, pt, nonce);
        const decrypted = df(senderKp.publicKey, recipientKp.privateKey, ciphertext, nonce);
        expect(decrypted).toEqual(pt);
    });
});
