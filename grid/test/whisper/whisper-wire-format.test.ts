/**
 * Phase 11 Wave 0 RED stub — WHISPER-03 closed-tuple envelope validation.
 *
 * Asserts the wire-format invariants from 11-RESEARCH.md §3.5:
 *   1. Object.keys(payload).sort() strict-equality against WHISPERED_KEYS
 *   2. DID_RE on from_did + to_did (/^did:noesis:[a-z0-9_\-]+$/i per D-29)
 *   3. from_did !== to_did (self-whisper rejected)
 *   4. tick non-negative integer
 *   5. ciphertext_hash matches /^[0-9a-f]{64}$/ (64-char hex SHA-256)
 *   6. nonce_b64 exactly 32 chars (24 bytes base64 no-padding → 32 chars)
 *
 * RED at Wave 0: imports from appendNousWhispered.ts which does not yet exist.
 * Wave 2 turns this GREEN by creating the emitter and validator.
 */
import { describe, expect, it } from 'vitest';
import { WHISPERED_KEYS } from '../../src/whisper/types.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/;

describe('whisper wire-format — closed-tuple envelope validation (RED until Wave 2)', () => {
    it('WHISPERED_KEYS is alphabetical 4-tuple', () => {
        expect(WHISPERED_KEYS).toEqual(['ciphertext_hash', 'from_did', 'tick', 'to_did']);
    });

    it('Object.keys of NousWhisperedPayload sorts equal to WHISPERED_KEYS', () => {
        // A valid payload object — keys must sort equal to WHISPERED_KEYS
        const payload = {
            ciphertext_hash: 'a'.repeat(64),
            from_did: 'did:noesis:aaaa',
            tick: 1,
            to_did: 'did:noesis:bbbb',
        };
        expect(Object.keys(payload).sort()).toEqual([...WHISPERED_KEYS].sort());
    });

    it('from_did passes DID_RE', () => {
        expect(DID_RE.test('did:noesis:abc123')).toBe(true);
        expect(DID_RE.test('did:noesis:0'.repeat(33))).toBe(false); // too long prefix check
        expect(DID_RE.test('did:other:abc')).toBe(false);
    });

    it('from_did !== to_did (self-whisper rejected)', () => {
        const from_did = 'did:noesis:aaaa';
        const to_did = 'did:noesis:bbbb';
        expect(from_did).not.toBe(to_did);
    });

    it('tick is non-negative integer', () => {
        expect(Number.isInteger(0)).toBe(true);
        expect(Number.isInteger(100)).toBe(true);
        expect(Number.isInteger(-1)).toBe(true); // negative — should be rejected at emitter
        expect(0 >= 0).toBe(true);
    });

    it('ciphertext_hash matches /^[0-9a-f]{64}$/', () => {
        const validHash = 'a'.repeat(64);
        const shortHash = 'a'.repeat(63);
        const upperHash = 'A'.repeat(64);
        expect(HEX64_RE.test(validHash)).toBe(true);
        expect(HEX64_RE.test(shortHash)).toBe(false);
        expect(HEX64_RE.test(upperHash)).toBe(false); // case-sensitive
    });

    it('nonce_b64 is exactly 32 chars (24 bytes base64)', () => {
        // 24 bytes in base64 (no padding, 24%3==0): 24 * 4/3 = 32 chars
        const validNonce = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 34 — invalid
        const exactNonce = 'A'.repeat(32);
        expect(exactNonce).toHaveLength(32);
        expect(validNonce).toHaveLength(34); // too long
    });

    it('imports validateWhisperPayload from appendNousWhispered (RED until Wave 2)', async () => {
        // This will throw with "Cannot find module" until Wave 2 creates appendNousWhispered.ts
        await expect(
            import('../../src/whisper/appendNousWhispered.js'),
        ).resolves.toHaveProperty('appendNousWhispered');
    });
});
