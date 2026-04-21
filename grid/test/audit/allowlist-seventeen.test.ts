/**
 * Phase 7 DIALOG-02 — broadcast allowlist 16→17 invariant.
 *
 * Pins the full frozen-17 tuple by array-literal comparison. Any reorder,
 * removal, or silent addition fails. Closes T-07-22 (allowlist tampering).
 *
 * See: 07-CONTEXT.md D-19, 07-PLAN-03 Task 1.
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

/** Frozen expected tuple — Phase 7 position-17 discipline. */
const EXPECTED_ORDER = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message',
    'trade.proposed',
    'trade.reviewed',
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
    'telos.refined',              // position 17 (zero-indexed 16) — Phase 7 DIALOG-02
] as const;

describe('broadcast allowlist — Phase 7 invariant (DIALOG-02 D-19)', () => {
    it('contains exactly 17 members', () => {
        expect(ALLOWLIST.size).toBe(17);
    });

    it('includes telos.refined', () => {
        expect(ALLOWLIST.has('telos.refined')).toBe(true);
        expect(isAllowlisted('telos.refined')).toBe(true);
    });

    it('preserves the Phase 6 order and appends telos.refined last', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });

    it('is frozen — mutation attempts throw', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('malicious.event')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('telos.refined')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).clear()).toThrow(TypeError);
    });
});
