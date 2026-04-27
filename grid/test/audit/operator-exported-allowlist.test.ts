/**
 * RED tests for operator.exported allowlist membership (REPLAY-02).
 *
 * These tests encode the acceptance criteria for Wave 3 (Plan 13-04).
 * They MUST fail until grid/src/audit/broadcast-allowlist.ts is bumped
 * from 26 to 27 entries by appending 'operator.exported' at position 27.
 *
 * Threat mitigation: T-13-01-01 — "Tampering via allowlist reorder".
 * The test pins 'operator.exported' at exact position 27 (index 26) so
 * any reordering of the allowlist fails CI immediately.
 */

import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS, ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

describe('operator.exported allowlist membership', () => {
    it('allowlist size === 27 (Phase 13 bump from 26)', () => {
        // RED: current size is 26; Wave 3 (Plan 13-04) bumps to 27
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(27);
    });
    // RED until Wave 3 (Plan 13-04) bumps allowlist 26→27

    it("operator.exported is at position 27 (index 26) — exact order locked", () => {
        // RED: 'operator.exported' does not yet exist at position 26
        expect((ALLOWLIST_MEMBERS as readonly string[])[26]).toBe('operator.exported');
    });
    // RED until Wave 3 (Plan 13-04) bumps allowlist 26→27

    it('ALLOWLIST.has("operator.exported") is true', () => {
        // RED: ALLOWLIST is built from ALLOWLIST_MEMBERS; will pass once appended
        expect(ALLOWLIST.has('operator.exported')).toBe(true);
    });
    // RED until Wave 3 (Plan 13-04) bumps allowlist 26→27
});
