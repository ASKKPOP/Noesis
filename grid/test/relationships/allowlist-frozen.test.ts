/**
 * Phase 9 Plan 06 Task 2 — SC#5 broadcast allowlist frozen at source level.
 *
 * This test imports BROADCAST_ALLOWLIST (re-exported as ALLOWLIST from
 * grid/src/audit/broadcast-allowlist.ts) DIRECTLY and asserts:
 *   1. Size === 18 (pre-Phase-9 baseline per STATE.md Accumulated Context)
 *   2. No relationship.* kinds are admitted
 *   3. Every kind is a non-empty string literal (structural sanity)
 *
 * Complements no-audit-emit.test.ts (runtime behavior) and the CI grep script
 * (file line-count invariant). Together they gate SC#5 at three layers:
 *   - Runtime: listener never calls append (no-audit-emit chain-length delta)
 *   - Source constant: this test (allowlist-frozen ALLOWLIST.size + no relationship.*)
 *   - File structure: check-relationship-graph-deps.mjs (CI line-count assertion)
 *
 * Reference: D-9-13, SC#5, T-09-35.
 */

import { describe, it, expect } from 'vitest';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

describe('SC#5 — broadcast allowlist is frozen across Phase 9', () => {
    it('BROADCAST_ALLOWLIST length === 18 (pre-Phase-9 baseline)', () => {
        // If this fails, something added a new kind — violates SC#5 / D-9-13.
        // See .planning/STATE.md Accumulated Context for the baseline lock.
        expect(ALLOWLIST.size).toBe(18);
    });

    it('no relationship.* kinds are admitted', () => {
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
