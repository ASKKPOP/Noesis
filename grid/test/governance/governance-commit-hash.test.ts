/**
 * Phase 12 Wave 0 RED stub — commit_hash cross-language fixture (D-12-02).
 *
 * commit_hash formula: sha256(choice + '|' + nonce + '|' + voter_did)
 * Pipe delimiters prevent chosen-plaintext ambiguity.
 *
 * This test imports computeCommitHash from grid/src/governance/commit-reveal.ts
 * which does NOT exist yet → import error → RED at Wave 0.
 * Wave 1 turns this GREEN by landing the implementation.
 *
 * The expected hex value is pre-computed via:
 *   node -e "require('node:crypto').createHash('sha256').update('yes|00000000000000000000000000000000|did:noesis:alice').digest('hex')"
 *   → 0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2
 *
 * Brain Python parity (D-12-02):
 *   import hashlib
 *   hashlib.sha256(b'yes|00000000000000000000000000000000|did:noesis:alice').hexdigest()
 *   → same hex — verified in Wave 1 Brain cross-language fixture.
 */
import { describe, it, expect } from 'vitest';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';  // RED: module missing in W0

describe('commit_hash — sha256(choice|nonce|voter_did) cross-language fixture (D-12-02)', () => {
    it('matches the canonical fixture: yes|00000...|did:noesis:alice', () => {
        const choice = 'yes';
        const nonce = '00000000000000000000000000000000';  // 32 hex chars (16 zero bytes)
        const voter_did = 'did:noesis:alice';
        // Expected: node -e "require('node:crypto').createHash('sha256').update('yes|00000000000000000000000000000000|did:noesis:alice').digest('hex')"
        const expected = '0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2';
        expect(computeCommitHash(choice, nonce, voter_did)).toBe(expected);
    });

    it('uses pipe delimiters — sha256(choice|nonce|voter_did) not sha256(choiceNonceVoter_did)', () => {
        // The pipe delimiter is load-bearing: without it, 'yes' + 'abc' + 'did' is
        // indistinguishable from 'ye' + 'sabc' + 'did'. Verify by computing a hash
        // with a different choice that would collide without delimiters.
        const hash1 = computeCommitHash('yes', 'abc', 'did:noesis:x');
        const hash2 = computeCommitHash('ye', 'sabc', 'did:noesis:x');
        expect(hash1).not.toBe(hash2);
    });

    it('nonce must be exactly 32 hex chars (16 bytes) — D-12-02', () => {
        // The nonce contract is 32 hex chars; the function may or may not validate
        // length (validation is at the emitter boundary in Wave 2), but the fixture
        // proves the formula works with a valid nonce.
        const hash = computeCommitHash('no', '00000000000000000000000000000000', 'did:noesis:bob');
        expect(typeof hash).toBe('string');
        expect(hash).toHaveLength(64);  // sha256 → 64 hex chars
    });

    it('abstain choice produces a valid 64-char hash', () => {
        const hash = computeCommitHash('abstain', '00000000000000000000000000000000', 'did:noesis:carol');
        expect(typeof hash).toBe('string');
        expect(hash).toHaveLength(64);
    });
});
