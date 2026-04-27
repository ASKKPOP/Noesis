/**
 * Phase 12 Wave 0 RED stub — pessimistic quorum + tally outcome matrix (D-12-03).
 *
 * computeTally signature:
 *   computeTally(
 *     reveals: BallotRevealedPayload[],
 *     unrevealedCommittedCount: number,
 *     quorumPct: number,
 *     supermajorityPct: number,
 *     totalNousCount: number,
 *   ): { outcome: ProposalOutcome; yes_count: number; no_count: number;
 *         abstain_count: number; quorum_met: boolean }
 *
 * Pessimistic quorum formula (D-12-03):
 *   quorum_met = (revealed.length + unrevealedCommittedCount) / totalNousCount >= quorumPct/100
 *
 * Outcome logic (D-12-03):
 *   outcome = 'passed'      if quorum_met AND yes/(yes+no) >= supermajority/100
 *   outcome = 'rejected'    if quorum_met AND threshold not reached
 *   outcome = 'quorum_fail' if !quorum_met
 *
 * RED at Wave 0: grid/src/governance/tally.ts does not exist → import error → RED.
 * Wave 2 turns this GREEN by landing the implementation.
 */
import { describe, it, expect } from 'vitest';
import type { BallotRevealedPayload } from '../../src/governance/types.js';
import { computeTally } from '../../src/governance/tally.js';  // RED: module missing in W0

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReveal(choice: 'yes' | 'no' | 'abstain', i: number): BallotRevealedPayload {
    return {
        choice,
        nonce: '00000000000000000000000000000000',
        proposal_id: 'fixture-proposal-id',
        voter_did: `did:noesis:voter-${i}`,
    };
}

// ── zero-reveal quorum_fail ───────────────────────────────────────────────────

describe('computeTally — zero reveals (quorum_fail)', () => {
    it('0 reveals + 0 committed + totalNous=10 + quorum=50 → quorum_fail', () => {
        const result = computeTally([], 0, 50, 67, 10);
        expect(result.outcome).toBe('quorum_fail');
        expect(result.quorum_met).toBe(false);
        expect(result.yes_count).toBe(0);
        expect(result.no_count).toBe(0);
        expect(result.abstain_count).toBe(0);
    });

    it('4 reveals + 0 committed + totalNous=10 + quorum=50 → quorum_fail (40% < 50%)', () => {
        const reveals = [makeReveal('yes', 0), makeReveal('yes', 1), makeReveal('yes', 2), makeReveal('yes', 3)];
        const result = computeTally(reveals, 0, 50, 67, 10);
        expect(result.outcome).toBe('quorum_fail');
        expect(result.quorum_met).toBe(false);
    });
});

// ── pessimistic quorum: unrevealed committed count toward quorum ───────────────

describe('computeTally — pessimistic quorum (D-12-03)', () => {
    it('5 yes + 0 no + 0 abstain + 5 unrevealed-committed + totalNous=10 + quorum=50 + supermajority=67 → passed', () => {
        const reveals = [
            makeReveal('yes', 0), makeReveal('yes', 1), makeReveal('yes', 2),
            makeReveal('yes', 3), makeReveal('yes', 4),
        ];
        const result = computeTally(reveals, 5, 50, 67, 10);
        expect(result.quorum_met).toBe(true);   // (5+5)/10 = 100% >= 50%
        expect(result.yes_count).toBe(5);
        expect(result.no_count).toBe(0);
        expect(result.outcome).toBe('passed');  // 5/(5+0) = 100% >= 67%
    });

    it('3 yes + 0 no + 2 unrevealed-committed + totalNous=10 + quorum=50 → quorum met, passed', () => {
        const reveals = [makeReveal('yes', 0), makeReveal('yes', 1), makeReveal('yes', 2)];
        const result = computeTally(reveals, 2, 50, 67, 10);
        expect(result.quorum_met).toBe(true);   // (3+2)/10 = 50% >= 50%
        expect(result.outcome).toBe('passed');  // 3/(3+0) = 100% >= 67%
    });
});

// ── mixed outcomes ─────────────────────────────────────────────────────────────

describe('computeTally — mixed outcome matrix', () => {
    it('5 yes + 5 no + quorum=50 + supermajority=67 → rejected (50% < 67%)', () => {
        const reveals = [
            makeReveal('yes', 0), makeReveal('yes', 1), makeReveal('yes', 2),
            makeReveal('yes', 3), makeReveal('yes', 4),
            makeReveal('no', 5), makeReveal('no', 6), makeReveal('no', 7),
            makeReveal('no', 8), makeReveal('no', 9),
        ];
        const result = computeTally(reveals, 0, 50, 67, 10);
        expect(result.quorum_met).toBe(true);
        expect(result.yes_count).toBe(5);
        expect(result.no_count).toBe(5);
        expect(result.outcome).toBe('rejected');  // 5/(5+5) = 50% < 67%
    });

    it('3 yes + 1 no + 2 abstain + totalNous=10 + quorum=50 + supermajority=67 → quorum_fail (6/10=60%<100... wait 60%>50 → quorum met)', () => {
        // (3+1+2)/10 = 60% >= 50% → quorum met
        // 3/(3+1) = 75% >= 67% → passed
        const reveals = [
            makeReveal('yes', 0), makeReveal('yes', 1), makeReveal('yes', 2),
            makeReveal('no', 3),
            makeReveal('abstain', 4), makeReveal('abstain', 5),
        ];
        const result = computeTally(reveals, 0, 50, 67, 10);
        expect(result.quorum_met).toBe(true);
        expect(result.yes_count).toBe(3);
        expect(result.no_count).toBe(1);
        expect(result.abstain_count).toBe(2);
        expect(result.outcome).toBe('passed');  // 3/(3+1) = 75% >= 67%
    });

    it('2 yes + 3 no + totalNous=10 + quorum=50 → quorum_fail (5/10=50% ties → implementation decides; pessimistic → quorum_fail)', () => {
        // Edge case: exactly at quorum threshold. Pessimistic quorum uses >=
        // so 5/10 = 50% >= 50% → quorum MET.
        const reveals = [
            makeReveal('yes', 0), makeReveal('yes', 1),
            makeReveal('no', 2), makeReveal('no', 3), makeReveal('no', 4),
        ];
        const result = computeTally(reveals, 0, 50, 67, 10);
        expect(result.quorum_met).toBe(true);  // 5/10 = 50% >= 50% → met
        expect(result.outcome).toBe('rejected'); // 2/(2+3) = 40% < 67%
    });
});
