/**
 * Phase 11 Wave 0 RED stub — WHISPER-01 crypto core.
 *
 * Expects importable encryptFor / decryptFrom / deriveNonce / hashCiphertext
 * from grid/src/whisper/crypto.ts (lands in Wave 1).
 *
 * RED at Wave 0: grid/src/whisper/crypto.ts does not yet exist.
 * Tests will fail with module-resolution errors; the test file itself typechecks.
 *
 * Wave 1 turns this GREEN by creating crypto.ts with the following exports:
 *   - encryptFor(recipientPub, senderPriv, plaintext, nonce): Uint8Array
 *   - decryptFrom(senderPub, recipientPriv, ciphertext, nonce): Uint8Array
 *   - deriveNonce(senderPrivSeed, tick, counter): Uint8Array (24 bytes)
 *   - hashCiphertext(ciphertext: Uint8Array): string (64-char hex SHA-256)
 *
 * D-11-02 / D-11-03: libsodium-wrappers crypto_box_seed_keypair with
 * seed = SHA256(DID)[:32]; nonce = blake2b(seed ‖ tick_le64 ‖ counter_le32)[:24]
 */
import { describe, expect, it, beforeAll } from 'vitest';

// RED: these imports will fail at module resolution until Wave 1 ships crypto.ts
// The dynamic import pattern ensures the test file itself compiles cleanly.
describe('whisper crypto — keypair + nonce determinism + roundtrip (RED until Wave 1)', () => {
    it('imports encryptFor from grid/src/whisper/crypto.ts', async () => {
        // This will throw with "Cannot find module" until Wave 1 creates crypto.ts
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

    it('crypto_box_seed_keypair determinism — same seed produces same keypair', async () => {
        const { deriveKeypairFromSeed } = await import('../../src/whisper/crypto.js') as {
            deriveKeypairFromSeed: (seed: Uint8Array) => { publicKey: Uint8Array; privateKey: Uint8Array };
        };
        const seed = new Uint8Array(32).fill(1);
        const kp1 = deriveKeypairFromSeed(seed);
        const kp2 = deriveKeypairFromSeed(seed);
        expect(kp1.publicKey).toEqual(kp2.publicKey);
        expect(kp1.privateKey).toEqual(kp2.privateKey);
    });

    it('deriveNonce is deterministic — same (seed, tick, counter) produces same 24-byte nonce', async () => {
        const { deriveNonce } = await import('../../src/whisper/crypto.js') as {
            deriveNonce: (seed: Uint8Array, tick: number, counter: number) => Uint8Array;
        };
        const seed = new Uint8Array(32).fill(2);
        const n1 = deriveNonce(seed, 42, 0);
        const n2 = deriveNonce(seed, 42, 0);
        expect(n1).toHaveLength(24);
        expect(n1).toEqual(n2);
    });

    it('encrypt/decrypt roundtrip produces original plaintext', async () => {
        const { encryptFor, decryptFrom, deriveKeypairFromSeed, deriveNonce } =
            await import('../../src/whisper/crypto.js') as {
                encryptFor: (recipientPub: Uint8Array, senderPriv: Uint8Array, plaintext: Uint8Array, nonce: Uint8Array) => Uint8Array;
                decryptFrom: (senderPub: Uint8Array, recipientPriv: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array) => Uint8Array;
                deriveKeypairFromSeed: (seed: Uint8Array) => { publicKey: Uint8Array; privateKey: Uint8Array };
                deriveNonce: (seed: Uint8Array, tick: number, counter: number) => Uint8Array;
            };
        const senderSeed = new Uint8Array(32).fill(3);
        const recipientSeed = new Uint8Array(32).fill(4);
        const senderKp = deriveKeypairFromSeed(senderSeed);
        const recipientKp = deriveKeypairFromSeed(recipientSeed);
        const nonce = deriveNonce(senderSeed, 1, 0);
        const plaintext = new TextEncoder().encode('hello whisper');
        const ciphertext = encryptFor(recipientKp.publicKey, senderKp.privateKey, plaintext, nonce);
        const decrypted = decryptFrom(senderKp.publicKey, recipientKp.privateKey, ciphertext, nonce);
        expect(decrypted).toEqual(plaintext);
    });
});
