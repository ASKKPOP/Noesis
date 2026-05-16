/**
 * Phase 18 Wave 0 — D-18-07
 *
 * This test asserts the allowlist count is exactly 36 BEFORE the 3 Phase 18
 * skill events are added (Wave 3). It documents the starting invariant.
 *
 * When Wave 3 adds skill.taught (37), skill.inferred (38), skill.rejected (39),
 * this test will be SUPERSEDED by a new test asserting count === 39 and
 * correct positions. Do not delete this file — mark it obsolete with a comment.
 */
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 18 allowlist baseline — Wave 0 gate (D-18-07)', () => {
    it('allowlist is exactly 36 events before skill.* events are added', () => {
        // If this fails with count > 36, Wave 3 has already run.
        // If it fails with count < 36, a Phase 15/16/17 event was removed — STOP.
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(36);
    });

    it('position 36 is iris.prior_seeded (last Phase 17 event)', () => {
        // Confirm the Phase 17 end-state is intact before Phase 18 additions.
        expect((ALLOWLIST_MEMBERS as readonly string[])[35]).toBe('iris.prior_seeded');
    });
});
