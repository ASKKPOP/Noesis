/**
 * Phase 9 Plan 06 Task 2 — SC#5 broadcast allowlist frozen at source level.
 * Phase 10a update: baseline grows 18 → 19 with the explicit addition of
 * `ananke.drive_crossed` per D-10a-08.
 * Phase 10b update: baseline grows 19 → 21 with the explicit addition of
 * `bios.birth` and `bios.death` per D-10b-01. No relationship.* kinds are
 * admitted (Phase 9 SC#5 still holds).
 * Phase 12 update: baseline grows 22 → 26 with the explicit addition of
 * `proposal.opened`, `ballot.committed`, `ballot.revealed`, `proposal.tallied`
 * per D-12-01. The four governance events occupy positions 23..26.
 *
 * This test imports BROADCAST_ALLOWLIST (re-exported as ALLOWLIST from
 * grid/src/audit/broadcast-allowlist.ts) DIRECTLY and asserts:
 *   1. Size === 26 (Phase 12 baseline: +4 governance events)
 *   2. No relationship.* kinds are admitted
 *   3. Every kind is a non-empty string literal (structural sanity)
 *
 * Complements no-audit-emit.test.ts (runtime behavior) and the CI grep script
 * (file line-count invariant). Together they gate SC#5 at three layers:
 *   - Runtime: listener never calls append (no-audit-emit chain-length delta)
 *   - Source constant: this test (allowlist-frozen ALLOWLIST.size + no relationship.*)
 *   - File structure: check-relationship-graph-deps.mjs (CI line-count assertion)
 *
 * Reference: D-9-13, SC#5, T-09-35, D-10a-08, D-12-01.
 */

import { describe, it, expect } from 'vitest';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

describe('SC#5 — broadcast allowlist is frozen across Phase 9 (Phase 10b-adjusted baseline)', () => {
    it('BROADCAST_ALLOWLIST length === 27 (Phase 13 baseline: +1 operator.exported event)', () => {
        // If this fails, something added or removed kinds unexpectedly.
        // Phase 11 (WHISPER-04 D-11-01) added nous.whispered at position 22.
        // Phase 12 (VOTE-01..04 D-12-01) added proposal.opened, ballot.committed,
        // ballot.revealed, proposal.tallied at positions 23..26.
        // Phase 13 (REPLAY-02 D-13-09) added operator.exported at position 27.
        // See .planning/STATE.md Accumulated Context for the baseline lock.
        expect(ALLOWLIST.size).toBe(27);
    });

    it('no relationship.* kinds are admitted (Phase 9 SC#5 still holds)', () => {
        const relationshipKinds = Array.from(ALLOWLIST).filter(k => k.startsWith('relationship'));
        expect(relationshipKinds).toEqual([]);
    });

    it('every kind is a non-empty string literal (structural sanity)', () => {
        for (const kind of ALLOWLIST) {
            expect(typeof kind).toBe('string');
            expect(kind.length).toBeGreaterThan(0);
        }
    });

    it('allowlist is frozen — runtime mutation throws (belt-and-suspenders)', () => {
        // Verify the runtime-immutable discipline from broadcast-allowlist.ts buildFrozenAllowlist().
        expect(() => (ALLOWLIST as unknown as Set<string>).add('relationship.warmed')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('nous.spoke')).toThrow(TypeError);
    });
});
