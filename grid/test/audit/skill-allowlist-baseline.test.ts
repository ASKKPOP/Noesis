/**
 * Phase 18 — D-18-07 (updated after Wave 2 landed skill.* events)
 *
 * Wave 0 RED gate (count===36) has been superseded. Wave 2 added
 * skill.taught (37), skill.inferred (38), skill.rejected (39).
 * This file now documents the Phase 18 final allowlist invariant.
 */
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 18 allowlist baseline — Wave 0 gate (D-18-07)', () => {
    it('allowlist has at least 39 events (Phase 18 skill.* events present)', () => {
        // Wave 2 added skill.taught (pos 37), skill.inferred (pos 38), skill.rejected (pos 39).
        // Phase 19 (D-19-11) adds norm.candidate (pos 40) + norm.crystallized (pos 41) → total 41.
        // If this fails with count < 39, a Phase 18 skill event was removed — STOP.
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBeGreaterThanOrEqual(39);
    });

    it('position 36 is iris.prior_seeded (last Phase 17 event)', () => {
        // Confirm the Phase 17 end-state is intact — iris.prior_seeded must not shift.
        expect((ALLOWLIST_MEMBERS as readonly string[])[35]).toBe('iris.prior_seeded');
    });

    it('positions 37-39 are the three Phase 18 skill events in order', () => {
        const members = ALLOWLIST_MEMBERS as readonly string[];
        expect(members[36]).toBe('skill.taught');
        expect(members[37]).toBe('skill.inferred');
        expect(members[38]).toBe('skill.rejected');
    });
});
