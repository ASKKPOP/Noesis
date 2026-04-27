// SYNC: brain/src/noesis_brain/governance/commit_reveal.py — formula MUST be identical
// Per D-12-02: commit_hash = sha256(choice + '|' + nonce + '|' + voter_did)
// Pipe delimiters prevent chosen-plaintext ambiguity (e.g. choice='yes_x', nonce='abc' vs choice='yes', nonce='_xabc')
//
// Phase 12 Wave 1 — VOTE-02, VOTE-03 / D-12-02 / T-09-13
// Pure functions, node:crypto only. No wall-clock reads, no third-party hash libs.
// Caller has already validated `choice` is in {yes, no, abstain}; this function re-validates as defence-in-depth.

import { createHash } from 'node:crypto';
import type { BallotChoice } from './types.js';

const NONCE_HEX_LEN = 32;        // 16 bytes hex
const CHOICE_VALUES = ['yes', 'no', 'abstain'] as const;
const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/**
 * Compute sha256(choice|nonce|voter_did) and return lowercase hex (64 chars).
 *
 * Formula (D-12-02): `sha256(choice + '|' + nonce.toLowerCase() + '|' + voter_did)`
 * Pipe delimiters are load-bearing — they prevent chosen-plaintext ambiguity.
 *
 * @throws {Error} if choice not in {yes, no, abstain}
 * @throws {Error} if nonce is not exactly 32 hex chars
 * @throws {Error} if voter_did does not match /^did:noesis:[a-z0-9_\-]+$/i
 *
 * Caller assumption: choice has already been validated at the emitter boundary (Wave 2).
 * This function re-validates as defence-in-depth (T-09-13).
 */
export function computeCommitHash(
    choice: BallotChoice,
    nonce: string,
    voter_did: string,
): string {
    if (!CHOICE_VALUES.includes(choice as typeof CHOICE_VALUES[number])) {
        throw new Error(`commit-reveal: invalid choice "${choice}"`);
    }
    if (typeof nonce !== 'string' || nonce.length !== NONCE_HEX_LEN || !/^[0-9a-fA-F]+$/.test(nonce)) {
        throw new Error(`commit-reveal: nonce must be ${NONCE_HEX_LEN} lowercase hex chars`);
    }
    if (!DID_RE.test(voter_did)) {
        throw new Error(`commit-reveal: voter_did fails DID_RE`);
    }
    const input = `${choice}|${nonce.toLowerCase()}|${voter_did}`;
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Verify a revealed ballot against the originally committed hash.
 * Returns boolean; never throws on mismatch.
 *
 * Uses constant-time hex comparison (XOR-loop) as defence against timing oracles,
 * even though commit_hash is non-secret. Matches Phase 11 whisper-crypto hygiene
 * convention and Brain's hmac.compare_digest equivalent. (T-09-13)
 *
 * @param choice - The revealed ballot choice
 * @param nonce - The 32 hex char nonce revealed by Brain
 * @param voter_did - The voter DID
 * @param expected_commit_hash - The commit_hash from the ballot.committed event
 * @returns true iff sha256(choice|nonce|voter_did) === expected_commit_hash
 */
export function verifyReveal(
    choice: BallotChoice,
    nonce: string,
    voter_did: string,
    expected_commit_hash: string,
): boolean {
    try {
        const actual = computeCommitHash(choice, nonce, voter_did);
        return constantTimeEqualHex(actual, expected_commit_hash);
    } catch {
        return false;
    }
}

/**
 * Constant-time hex string comparison (defence against timing oracles, even though
 * commit_hash is non-secret). XOR all corresponding char codes; diff === 0 iff equal.
 *
 * @internal
 */
function constantTimeEqualHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
