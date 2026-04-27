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
 * Date.now is mocked (vi.spyOn) to produce deterministic chain hashes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runFixtureReplay } from '../../src/governance/replay.js';

describe('governance zero-diff — chain-tail hash byte-stability (T-09-13)', () => {
    let fakeNow = 1_700_000_000_000;
    let nowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fakeNow = 1_700_000_000_000;
        nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });
    });

    afterEach(() => {
        nowSpy.mockRestore();
    });

    it('fixture-A with 0 reveals produces a stable chain-tail hash', async () => {
        fakeNow = 1_700_000_000_000;
        const expected = 'a3fb2a6368d66a608083a63840c95f60aa86f305d3e49729d8a661acf0acaf1c';
        expect(await runFixtureReplay('fixture-A', 0)).toBe(expected);
    });

    it('fixture-A with 1 reveal produces a stable chain-tail hash', async () => {
        fakeNow = 1_700_000_000_000;
        const expected = '37a3c8b369a9fa0cba323a2b15aad7ca035f9e82a13b6837a1456fc68c350985';
        expect(await runFixtureReplay('fixture-A', 1)).toBe(expected);
    });

    it('fixture-A with 5 reveals produces a stable chain-tail hash', async () => {
        fakeNow = 1_700_000_000_000;
        const expected = '642d5e101312108c20ef78d1321952803764c9010cf89d77b3c73def14364ef3';
        expect(await runFixtureReplay('fixture-A', 5)).toBe(expected);
    });

    it('fixture-A with 10 reveals produces a stable chain-tail hash', async () => {
        fakeNow = 1_700_000_000_000;
        const expected = 'c2636503f177bd36888661deda4ef2a3e46f610520e87c0592626422973e06c7';
        expect(await runFixtureReplay('fixture-A', 10)).toBe(expected);
    });

    it('different reveal counts produce different chain-tail hashes (uniqueness guard)', async () => {
        // Once Wave 2 lands the implementation, the four hashes above must all differ.
        // This structural assertion remains valid: replay with different inputs ≠ same hash.
        fakeNow = 1_700_000_000_000;
        const hash0 = await runFixtureReplay('fixture-A', 0);
        fakeNow = 1_700_000_000_000;
        const hash1 = await runFixtureReplay('fixture-A', 1);
        // 0 reveals and 1 reveal must produce different audit chains → different hashes.
        expect(hash0).not.toBe(hash1);
    });
});
