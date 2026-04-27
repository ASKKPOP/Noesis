/**
 * Phase 12 Wave 0 RED stub — governance zero-diff / chain-tail hash regression (T-09-13).
 *
 * Imports runFixtureReplay from grid/src/governance/replay.ts which does NOT
 * exist yet → import error → RED at Wave 0.
 * Wave 2 lands the implementation and populates the fixture-A expected hash.
 *
 * The test asserts byte-stable chain-tail hashes for fixture-A across four
 * reveal-count variants: 0, 1, 5, 10 reveals.
 *
 * Purpose: once Wave 2 ships, replacing 'TBD-W2' with the computed hash
 * freezes the governance replay pipeline against regressions. Any refactor
 * that changes how events are appended will break this test.
 *
 * fixture-A parameters:
 *   proposal_id: 'fixture-A'
 *   totalNousCount: 10
 *   quorumPct: 50
 *   supermajorityPct: 67
 *   deadlineTick: 100
 *   The reveal counts (0, 1, 5, 10) exercise quorum_fail, quorum_fail,
 *   quorum_met+tallied, and quorum_met+tallied branches.
 *
 * Clones the zero-diff regression approach from Phase 10b / Phase 11.
 */
import { describe, it, expect } from 'vitest';
import { runFixtureReplay } from '../../src/governance/replay.js';  // RED: module missing in W0

describe('governance zero-diff — chain-tail hash byte-stability (T-09-13)', () => {
    it('fixture-A with 0 reveals produces a stable chain-tail hash (RED: TBD-W2)', () => {
        const expected = 'TBD-W2';  // Wave 2 computes and pastes the actual sha256 hex
        expect(runFixtureReplay('fixture-A', 0)).toBe(expected);
    });

    it('fixture-A with 1 reveal produces a stable chain-tail hash (RED: TBD-W2)', () => {
        const expected = 'TBD-W2';
        expect(runFixtureReplay('fixture-A', 1)).toBe(expected);
    });

    it('fixture-A with 5 reveals produces a stable chain-tail hash (RED: TBD-W2)', () => {
        const expected = 'TBD-W2';
        expect(runFixtureReplay('fixture-A', 5)).toBe(expected);
    });

    it('fixture-A with 10 reveals produces a stable chain-tail hash (RED: TBD-W2)', () => {
        const expected = 'TBD-W2';
        expect(runFixtureReplay('fixture-A', 10)).toBe(expected);
    });

    it('different reveal counts produce different chain-tail hashes (uniqueness guard)', () => {
        // Once Wave 2 lands the implementation, the four hashes above must all differ.
        // This structural assertion remains valid: replay with different inputs ≠ same hash.
        const hash0 = runFixtureReplay('fixture-A', 0);
        const hash1 = runFixtureReplay('fixture-A', 1);
        // 0 reveals and 1 reveal must produce different audit chains → different hashes.
        expect(hash0).not.toBe(hash1);
    });
});
