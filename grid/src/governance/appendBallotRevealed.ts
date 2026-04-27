/**
 * SOLE PRODUCER for `ballot.revealed` audit event. Per D-12-01 / VOTE-03:
 *   This is the ONLY file in grid/src/** that may call `audit.append('ballot.revealed', ...)`.
 *   The grep gate `grid/test/governance/governance-producer-boundary.test.ts` enforces this contract.
 *
 * Forbidden siblings: see governance-producer-boundary.test.ts for the full list.
 *
 * Hash verification (D-12-02):
 *   verifyReveal(choice, nonce, voter_did, stored_commit_hash) — if mismatch, throws
 *   GovernanceError('ballot_reveal_mismatch', 422). Does NOT emit audit event.
 *
 * Wall-clock ban: no Date.now / Math.random in this file. Tick is provided by caller.
 *
 * Phase 12 Wave 2 — VOTE-03 / D-12-01 / D-12-02 / T-09-13 / CONTEXT-12.
 */

import type { AuditChain } from '../audit/chain.js';
import {
    BALLOT_REVEALED_KEYS,
    GOVERNANCE_FORBIDDEN_KEYS,
    type BallotRevealedPayload,
    type BallotChoice,
} from './types.js';
import { verifyReveal } from './commit-reveal.js';
import { GovernanceError } from './errors.js';
import type { GovernanceStore } from './store.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const NONCE_RE = /^[0-9a-f]{32}$/;
const VALID_CHOICES: ReadonlySet<string> = new Set(['yes', 'no', 'abstain']);

export interface AppendBallotRevealedInput {
    proposal_id: string;
    voter_did: string;
    choice: BallotChoice;
    nonce: string;                // 32 lowercase hex chars (16 bytes)
    currentTick: number;
    store: GovernanceStore;
}

export async function appendBallotRevealed(
    audit: AuditChain,
    input: AppendBallotRevealedInput,
): Promise<void> {
    // 1. Validate voter_did
    if (!DID_RE.test(input.voter_did)) {
        throw new Error('ballot.revealed: voter_did fails DID_RE');
    }

    // 2. Validate choice
    if (!VALID_CHOICES.has(input.choice)) {
        throw new Error(`ballot.revealed: choice must be yes|no|abstain, got "${input.choice}"`);
    }

    // 3. Validate nonce (32 lowercase hex chars = 16 bytes)
    if (!NONCE_RE.test(input.nonce)) {
        throw new Error('ballot.revealed: nonce must be 32 lowercase hex chars');
    }

    // 4. Validate proposal_id non-empty
    if (typeof input.proposal_id !== 'string' || input.proposal_id.length === 0) {
        throw new Error('ballot.revealed: proposal_id must be non-empty string');
    }

    // 5. Fetch the stored commit_hash for (proposal_id, voter_did)
    const ballotRow = await input.store.getBallot(input.proposal_id, input.voter_did);
    if (!ballotRow) {
        throw new GovernanceError('ballot_not_found', 404);
    }

    // 6. Verify reveal against stored commit_hash (D-12-02 / T-09-13)
    const isValid = verifyReveal(input.choice, input.nonce, input.voter_did, ballotRow.commit_hash);
    if (!isValid) {
        // Log to server: structured warn pattern (inline log since no logger injected at W2)
        // Wave 3 API route maps GovernanceError(422) → HTTP 422
        throw new GovernanceError('ballot_reveal_mismatch', 422);
    }

    // 7. Build closed payload
    const payload: BallotRevealedPayload = {
        choice: input.choice,
        nonce: input.nonce,
        proposal_id: input.proposal_id,
        voter_did: input.voter_did,
    };

    // 8. Closed-tuple shape check
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...BALLOT_REVEALED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new Error(`ballot.revealed: payload keys ${JSON.stringify(actualKeys)} != ${JSON.stringify(expectedKeys)}`);
    }

    // 9. Forbidden-key check
    const forbiddenSet = new Set<string>(GOVERNANCE_FORBIDDEN_KEYS as readonly string[]);
    for (const k of actualKeys) {
        if (forbiddenSet.has(k)) {
            throw new Error(`ballot.revealed: forbidden key "${k}" in payload`);
        }
    }

    // 10. DB write FIRST
    await input.store.updateBallotReveal({
        proposal_id: input.proposal_id,
        voter_did: input.voter_did,
        choice: input.choice,
        nonce: input.nonce,
        revealed_tick: input.currentTick,
    });

    // 11. Audit append (sole-producer line)
    audit.append('ballot.revealed', input.voter_did, payload as unknown as Record<string, unknown>);
}
