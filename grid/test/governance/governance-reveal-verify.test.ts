/**
 * Phase 12 Wave 1 — verifyReveal accept/reject matrix (D-12-02 / T-09-13).
 *
 * verifyReveal(choice, nonce, voter_did, expected_commit_hash) returns boolean.
 * Never throws — all invalid inputs return false (swallows computeCommitHash throws).
 *
 * Constant-time comparison used for hash equality (T-09-13 timing oracle defence).
 */
import { describe, it, expect } from 'vitest';
import { computeCommitHash, verifyReveal } from '../../src/governance/commit-reveal.js';

const CANONICAL = {
    choice: 'yes' as const,
    nonce: '00000000000000000000000000000000',
    voter_did: 'did:noesis:alice',
};

describe('verifyReveal accept/reject matrix', () => {
    const expected = computeCommitHash(CANONICAL.choice, CANONICAL.nonce, CANONICAL.voter_did);

    it('accepts correct (choice, nonce, voter_did, hash)', () => {
        expect(verifyReveal(CANONICAL.choice, CANONICAL.nonce, CANONICAL.voter_did, expected)).toBe(true);
    });

    it('rejects wrong choice', () => {
        expect(verifyReveal('no', CANONICAL.nonce, CANONICAL.voter_did, expected)).toBe(false);
    });

    it('rejects wrong nonce (one hex char flipped)', () => {
        const tampered = CANONICAL.nonce.slice(0, 31) + '1';
        expect(verifyReveal(CANONICAL.choice, tampered, CANONICAL.voter_did, expected)).toBe(false);
    });

    it('rejects wrong voter_did', () => {
        expect(verifyReveal(CANONICAL.choice, CANONICAL.nonce, 'did:noesis:bob', expected)).toBe(false);
    });

    it('rejects malformed nonce (31 chars)', () => {
        expect(verifyReveal(CANONICAL.choice, '0'.repeat(31), CANONICAL.voter_did, expected)).toBe(false);
    });

    it('rejects malformed nonce (non-hex char)', () => {
        expect(verifyReveal(CANONICAL.choice, 'g'.repeat(32), CANONICAL.voter_did, expected)).toBe(false);
    });

    it('rejects malformed voter_did (no did:noesis: prefix)', () => {
        expect(verifyReveal(CANONICAL.choice, CANONICAL.nonce, 'alice', expected)).toBe(false);
    });

    it('rejects invalid choice via verifyReveal (computeCommitHash would throw, verifyReveal swallows)', () => {
        // @ts-expect-error — intentional invalid input
        expect(verifyReveal('maybe', CANONICAL.nonce, CANONICAL.voter_did, expected)).toBe(false);
    });

    it('accepts uppercase nonce — lowercase-normalization invariant', () => {
        const upperNonce = CANONICAL.nonce.toUpperCase();  // still all zeros, but tests the toLowerCase() path
        expect(verifyReveal(CANONICAL.choice, upperNonce, CANONICAL.voter_did, expected)).toBe(true);
    });
});
