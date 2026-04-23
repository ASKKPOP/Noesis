/**
 * Phase 11 Wave 1 — whisper-keyring.test.ts
 *
 * JS decrypts the Python-produced fixture (py-encrypted-envelope.json),
 * proving byte-for-byte cross-language compatibility in the Python→JS direction.
 *
 * This is the second half of the A2 assumption proof:
 *   JS-encrypted → Python-decrypted: test_roundtrip.py TestJSEncryptedPythonDecrypts
 *   Python-encrypted → JS-decrypted: THIS FILE
 *
 * D-11-02: libsodium-wrappers crypto_box_seed_keypair
 * D-11-03: seed = SHA256(DID)[:32]; nonce = blake2b(seed ‖ tick_le64 ‖ counter_le32)[:24]
 * RESEARCH §2.2 A2: nacl.bindings.crypto_box_seed_keypair byte-compatible with libsodium-wrappers
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    initSodium,
    keypairFromDid,
    seedForDid,
    deriveNonce,
    decryptFrom,
    encryptFor,
    hashCiphertext,
} from '../../src/whisper/crypto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixture paths ────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, '../../../brain/test/fixtures/whisper');
const PY_FIXTURE_PATH = join(FIXTURES_DIR, 'py-encrypted-envelope.json');
const JS_FIXTURE_PATH = join(FIXTURES_DIR, 'js-encrypted-envelope.json');

beforeAll(async () => {
    await initSodium();
});

// ── Direction: Python encrypted → JS decrypted ───────────────────────────────

describe('whisper-keyring: Python-encrypted → JS-decrypted (A2 proof)', () => {
    it('py fixture file exists on disk', () => {
        expect(() => readFileSync(PY_FIXTURE_PATH, 'utf8')).not.toThrow();
    });

    it('JS decrypts Python-encrypted envelope → correct plaintext', () => {
        const env = JSON.parse(readFileSync(PY_FIXTURE_PATH, 'utf8'));

        const senderPub = new Uint8Array(Buffer.from(env.sender_pub_b64, 'base64'));
        const nonce = new Uint8Array(Buffer.from(env.nonce_b64, 'base64'));
        const ciphertext = new Uint8Array(Buffer.from(env.ciphertext_b64, 'base64'));
        const expectedPlaintext = new Uint8Array(Buffer.from(env.plaintext_b64, 'base64'));

        // Reconstruct recipient keypair from DID (same derivation as Python side)
        const recipientKp = keypairFromDid(env.recipient_did);

        const decrypted = decryptFrom(senderPub, recipientKp.privateKey, ciphertext, nonce);
        expect(decrypted).toEqual(expectedPlaintext);

        // Verify decoded plaintext is "hello from Python"
        const text = new TextDecoder().decode(decrypted);
        expect(text).toBe('hello from Python');
    });

    it('JS-derived sender pub matches Python sender pub in fixture', () => {
        const env = JSON.parse(readFileSync(PY_FIXTURE_PATH, 'utf8'));
        const fixturePub = new Uint8Array(Buffer.from(env.sender_pub_b64, 'base64'));
        const jsPub = keypairFromDid(env.sender_did).publicKey;
        expect(jsPub).toEqual(fixturePub);
    });

    it('JS-derived recipient pub matches Python recipient pub in fixture', () => {
        const env = JSON.parse(readFileSync(PY_FIXTURE_PATH, 'utf8'));
        const fixturePub = new Uint8Array(Buffer.from(env.recipient_pub_b64, 'base64'));
        const jsPub = keypairFromDid(env.recipient_did).publicKey;
        expect(jsPub).toEqual(fixturePub);
    });

    it('JS-computed nonce matches fixture nonce', () => {
        const env = JSON.parse(readFileSync(PY_FIXTURE_PATH, 'utf8'));
        const fixtureNonce = new Uint8Array(Buffer.from(env.nonce_b64, 'base64'));
        const senderSeed = seedForDid(env.sender_did);
        const computedNonce = deriveNonce(senderSeed, env.tick, env.counter);
        expect(computedNonce).toEqual(fixtureNonce);
    });

    it('ciphertext_hash matches SHA256(ciphertext)', () => {
        const env = JSON.parse(readFileSync(PY_FIXTURE_PATH, 'utf8'));
        const ciphertext = new Uint8Array(Buffer.from(env.ciphertext_b64, 'base64'));
        const computed = hashCiphertext(ciphertext);
        expect(computed).toBe(env.ciphertext_hash);
    });
});

// ── Direction: JS encrypted → verify pub consistency ────────────────────────

describe('whisper-keyring: JS fixture pub bytes match Python pub bytes', () => {
    it('js fixture file exists on disk', () => {
        expect(() => readFileSync(JS_FIXTURE_PATH, 'utf8')).not.toThrow();
    });

    it('JS alice pub in fixture matches JS keypairFromDid output', () => {
        const env = JSON.parse(readFileSync(JS_FIXTURE_PATH, 'utf8'));
        const fixturePub = new Uint8Array(Buffer.from(env.sender_pub_b64, 'base64'));
        const jsPub = keypairFromDid(env.sender_did).publicKey;
        expect(jsPub).toEqual(fixturePub);
    });

    it('JS can re-encrypt and hash matches — determinism check', () => {
        const env = JSON.parse(readFileSync(JS_FIXTURE_PATH, 'utf8'));
        const recipientPub = new Uint8Array(Buffer.from(env.recipient_pub_b64, 'base64'));
        const nonce = new Uint8Array(Buffer.from(env.nonce_b64, 'base64'));
        const plaintext = new Uint8Array(Buffer.from(env.plaintext_b64, 'base64'));

        const senderKp = keypairFromDid(env.sender_did);
        const ciphertext = encryptFor(recipientPub, senderKp.privateKey, plaintext, nonce);
        const hash = hashCiphertext(ciphertext);
        // Same inputs → same ciphertext_hash as recorded in fixture
        expect(hash).toBe(env.ciphertext_hash);
    });
});
