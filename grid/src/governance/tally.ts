/**
 * tally.ts — Pure function: computeTally
 *
 * NO I/O, NO audit.append, NO DB, NO Date.now, NO Math.random.
 * Caller passes hydrated state; this function is deterministic on inputs alone.
 *
 * Pessimistic quorum formula (D-12-03):
 *   participation = revealed.length + unrevealedCommittedCount
 *   quorumThreshold = ceil(quorumPct / 100 * totalNousCount)
 *   quorum_met = totalNousCount > 0 && participation >= quorumThreshold
 *
 * Outcome logic (D-12-03):
 *   !quorum_met                             → 'quorum_fail'
 *   quorum_met && decisive === 0            → 'rejected' (no supermajority reachable)
 *   quorum_met && yes/(yes+no) >= threshold → 'passed'
 *   otherwise                              → 'rejected'
 *
 * Signature matches governance-tally.test.ts (W0 RED stub):
 *   computeTally(reveals, unrevealedCommittedCount, quorumPct, supermajorityPct, totalNousCount)
 *
 * Phase 12 Wave 2 — VOTE-04 / D-12-03 / CONTEXT-12.
 */

import type { BallotRevealedPayload, ProposalOutcome } from './types.js';

export interface TallyResult {
    abstain_count: number;
    no_count: number;
    outcome: ProposalOutcome;
    quorum_met: boolean;
    yes_count: number;
}

/**
 * Compute the tally for a proposal.
 *
 * @param reveals - Array of revealed ballot payloads (each has choice + voter_did + ...)
 * @param unrevealedCommittedCount - Number of committed-but-not-revealed ballots
 * @param quorumPct - Quorum percentage (1..100)
 * @param supermajorityPct - Supermajority percentage (1..100)
 * @param totalNousCount - Total number of Nous in the Grid (for quorum denominator)
 *
 * @returns TallyResult with outcome, counts, and quorum_met flag
 * @throws Error if quorumPct or supermajorityPct are out of range, or totalNousCount < 0
 */
export function computeTally(
    reveals: ReadonlyArray<Pick<BallotRevealedPayload, 'choice' | 'voter_did'>>,
    unrevealedCommittedCount: number,
    quorumPct: number,
    supermajorityPct: number,
    totalNousCount: number,
): TallyResult {
    // Validate
    if (!Number.isInteger(totalNousCount) || totalNousCount < 0) {
        throw new Error('computeTally: totalNousCount must be non-negative integer');
    }
    if (quorumPct < 1 || quorumPct > 100) {
        throw new Error('computeTally: quorumPct out of range (must be 1..100)');
    }
    if (supermajorityPct < 1 || supermajorityPct > 100) {
        throw new Error('computeTally: supermajorityPct out of range (must be 1..100)');
    }
    if (!Number.isInteger(unrevealedCommittedCount) || unrevealedCommittedCount < 0) {
        throw new Error('computeTally: unrevealedCommittedCount must be non-negative integer');
    }

    // Count vote types from reveals
    let yes_count = 0;
    let no_count = 0;
    let abstain_count = 0;
    for (const r of reveals) {
        if (r.choice === 'yes') yes_count++;
        else if (r.choice === 'no') no_count++;
        else if (r.choice === 'abstain') abstain_count++;
    }

    // Pessimistic quorum: revealed + committed-but-unrevealed
    const participation = reveals.length + unrevealedCommittedCount;
    const quorumThreshold = Math.ceil((quorumPct / 100) * totalNousCount);
    const quorum_met = totalNousCount === 0
        ? false
        : participation >= quorumThreshold;

    // Outcome
    let outcome: ProposalOutcome;
    if (!quorum_met) {
        outcome = 'quorum_fail';
    } else {
        const decisive = yes_count + no_count;  // abstain does NOT count toward supermajority denominator
        if (decisive === 0) {
            outcome = 'rejected';  // no supermajority can be reached with zero decisive votes
        } else {
            const yesRatio = yes_count / decisive;
            const supermajorityThreshold = supermajorityPct / 100;
            outcome = yesRatio >= supermajorityThreshold ? 'passed' : 'rejected';
        }
    }

    return { abstain_count, no_count, outcome, quorum_met, yes_count };
}
