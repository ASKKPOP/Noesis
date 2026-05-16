/**
 * Phase 18 allowlist post-Wave-3 assertions (D-18-07).
 *
 * Complements the Wave 0 baseline test (skill-allowlist-baseline.test.ts).
 * Now that skill events are added, this test asserts the final count and positions.
 * Canonical count assertion for Phase 18 completeness.
 */
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 18 skill.* allowlist — post-Wave-3 (D-18-07)', () => {
    it('allowlist is exactly 39 events after skill.* additions', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(39);
    });

    it('skill.taught is at position 37 (index 36)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[36]).toBe('skill.taught');
    });

    it('skill.inferred is at position 38 (index 37)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[37]).toBe('skill.inferred');
    });

    it('skill.rejected is at position 39 (index 38)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[38]).toBe('skill.rejected');
    });

    it('iris.prior_seeded (position 36, index 35) is still intact', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[35]).toBe('iris.prior_seeded');
    });
});
