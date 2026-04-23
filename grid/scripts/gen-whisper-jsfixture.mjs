#!/usr/bin/env node
/**
 * grid/scripts/gen-whisper-jsfixture.mjs
 *
 * Phase 11 Wave 1 — JS fixture generator for cross-language byte-compat test.
 *
 * Produces brain/test/fixtures/whisper/js-encrypted-envelope.json using
 * test DIDs (NOT real Nous identities) with deterministic inputs.
 *
 * Fixture parameters:
 *   sender_did:    did:noesis:alice_test
 *   recipient_did: did:noesis:bob_test
 *   tick:          42
 *   counter:       0
 *   plaintext:     "hello from JS" (UTF-8)
 *
 * GENERATED — DO NOT EDIT; regenerate via:
 *   node grid/scripts/gen-whisper-jsfixture.mjs
 * (Run from repo root)
 *
 * Cross-lang proof: brain/test/whisper/test_roundtrip.py loads this fixture
 * and asserts Python can decrypt it using nacl.bindings.crypto_box_seed_keypair.
 *
 * Note: This script replicates grid/src/whisper/crypto.ts logic inline to avoid
 * TypeScript compilation at runtime. Both must stay in sync.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sodium from 'libsodium-wrappers';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Initialize libsodium ─────────────────────────────────────────────────────

await sodium.ready;

// ── Helpers (mirrors grid/src/whisper/crypto.ts) ─────────────────────────────

function sha256(input) {
    const h = createHash('sha256');
    if (typeof input === 'string') {
        h.update(input, 'utf8');
    } else {
        h.update(input);
    }
    return new Uint8Array(h.digest());
}

function keypairFromDid(did) {
    const seed = sha256(did);  // 32 bytes
    const kp = sodium.crypto_box_seed_keypair(seed);
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

function seedForDid(did) {
    return sha256(did);  // 32 bytes
}

function deriveNonce(senderPrivSeed, tick, counter) {
    const tickBuf = new Uint8Array(8);
    new DataView(tickBuf.buffer).setBigUint64(0, BigInt(tick), true /* LE */);
    const ctrBuf = new Uint8Array(4);
    new DataView(ctrBuf.buffer).setUint32(0, counter, true /* LE */);
    const input = new Uint8Array(senderPrivSeed.length + 8 + 4);
    input.set(senderPrivSeed, 0);
    input.set(tickBuf, senderPrivSeed.length);
    input.set(ctrBuf, senderPrivSeed.length + 8);
    return sodium.crypto_generichash(24, input);  // blake2b
}

function encryptFor(recipientPub, senderPriv, plaintext, nonce) {
    return sodium.crypto_box_easy(plaintext, nonce, recipientPub, senderPriv);
}

function hashCiphertext(ciphertext) {
    const h = sha256(ciphertext);
    return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Fixture parameters ────────────────────────────────────────────────────────

const SENDER_DID = 'did:noesis:alice_test';
const RECIPIENT_DID = 'did:noesis:bob_test';
const TICK = 42;
const COUNTER = 0;
const PLAINTEXT = new TextEncoder().encode('hello from JS');

// ── Derive keys and nonce ────────────────────────────────────────────────────

const senderKp = keypairFromDid(SENDER_DID);
const recipientKp = keypairFromDid(RECIPIENT_DID);
const senderSeed = seedForDid(SENDER_DID);
const nonce = deriveNonce(senderSeed, TICK, COUNTER);

// ── Encrypt ──────────────────────────────────────────────────────────────────

const ciphertext = encryptFor(recipientKp.publicKey, senderKp.privateKey, PLAINTEXT, nonce);
const ciphertextHash = hashCiphertext(ciphertext);

// ── Encode to base64 ─────────────────────────────────────────────────────────

const toB64 = (u8) => Buffer.from(u8).toString('base64');

const envelope = {
    _generated: {
        note: 'GENERATED — DO NOT EDIT; regenerate via: node grid/scripts/gen-whisper-jsfixture.mjs',
        generator: 'grid/scripts/gen-whisper-jsfixture.mjs',
        phase: '11-mesh-whisper',
        wave: 1,
        purpose: 'JS->Python byte-compat roundtrip fixture (RESEARCH §2.2 A2 proof)',
    },
    sender_did: SENDER_DID,
    recipient_did: RECIPIENT_DID,
    tick: TICK,
    counter: COUNTER,
    plaintext_b64: toB64(PLAINTEXT),
    nonce_b64: toB64(nonce),
    ciphertext_b64: toB64(ciphertext),
    ciphertext_hash: ciphertextHash,
    sender_pub_b64: toB64(senderKp.publicKey),
    recipient_pub_b64: toB64(recipientKp.publicKey),
};

// ── Write fixture ────────────────────────────────────────────────────────────

const outDir = join(__dirname, '../../brain/test/fixtures/whisper');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'js-encrypted-envelope.json');
writeFileSync(outPath, JSON.stringify(envelope, null, 2) + '\n', 'utf8');
console.log(`\u2705 JS fixture written to ${outPath}`);
console.log(`   sender_did:      ${SENDER_DID}`);
console.log(`   recipient_did:   ${RECIPIENT_DID}`);
console.log(`   plaintext:       "hello from JS"`);
console.log(`   ciphertext_hash: ${ciphertextHash}`);
console.log(`   sender_pub_hex:  ${Buffer.from(senderKp.publicKey).toString('hex')}`);
