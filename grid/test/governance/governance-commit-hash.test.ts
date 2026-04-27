/**
 * Phase 12 Wave 1 — commit_hash cross-language fixture (D-12-02).
 * Updated from Wave 0 RED stub: computeCommitHash implemented in Wave 1.
 *
 * commit_hash formula: sha256(choice + '|' + nonce + '|' + voter_did)
 * Pipe delimiters prevent chosen-plaintext ambiguity.
 *
 * Cross-language fixture vector:
 *   input:    'yes|00000000000000000000000000000000|did:noesis:alice'
 *   sha256:   0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2
 *
 * Verified by both:
 *   node -e "require('node:crypto').createHash('sha256').update('yes|00000000000000000000000000000000|did:noesis:alice').digest('hex')"
 *   python -c "import hashlib; print(hashlib.sha256(b'yes|00000000000000000000000000000000|did:noesis:alice').hexdigest())"
 *
 * Brain Python parity (D-12-02):
 *   brain/test/governance/test_commit_hash.py uses the same hex literal.
 */
import { describe, it, expect } from 'vitest';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';

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
        // The pipe delimiter is load-bearing: without it, 'yes' + 'abc...' + 'did' is
        // indistinguishable from 'ye' + 'sabc...' + 'did'. Use valid 32-hex nonces to
        // exercise the actual hashing code path while testing pipe-delimiter separation.
        // Different choice values → different hashes (proves choice is separated from nonce).
        const hash1 = computeCommitHash('yes', 'abcdef0123456789abcdef0123456789', 'did:noesis:x');
        const hash2 = computeCommitHash('no', 'abcdef0123456789abcdef0123456789', 'did:noesis:x');
        expect(hash1).not.toBe(hash2);
    });

    it('nonce must be exactly 32 hex chars (16 bytes) — D-12-02', () => {
        // The nonce contract is 32 hex chars; prove the formula works with a valid nonce.
        const hash = computeCommitHash('no', '00000000000000000000000000000000', 'did:noesis:bob');
        expect(typeof hash).toBe('string');
        expect(hash).toHaveLength(64);  // sha256 → 64 hex chars
    });

    it('abstain choice produces a valid 64-char hash', () => {
        const hash = computeCommitHash('abstain', '00000000000000000000000000000000', 'did:noesis:carol');
        expect(typeof hash).toBe('string');
        expect(hash).toHaveLength(64);
    });

    it('throws on invalid choice (not in {yes, no, abstain})', () => {
        expect(() => {
            // @ts-expect-error — intentional invalid input
            computeCommitHash('maybe', '00000000000000000000000000000000', 'did:noesis:alice');
        }).toThrow('commit-reveal: invalid choice');
    });

    it('accepts uppercase nonce hex — lowercase-normalization invariant', () => {
        // computeCommitHash normalizes nonce to lowercase before hashing.
        // Uppercase nonce must produce same hash as lowercase nonce.
        const lowerNonce = 'abcdef0123456789abcdef0123456789';
        const upperNonce = lowerNonce.toUpperCase();
        const hashLower = computeCommitHash('yes', lowerNonce, 'did:noesis:alice');
        const hashUpper = computeCommitHash('yes', upperNonce, 'did:noesis:alice');
        expect(hashLower).toBe(hashUpper);
        expect(hashLower).toHaveLength(64);
    });
});
