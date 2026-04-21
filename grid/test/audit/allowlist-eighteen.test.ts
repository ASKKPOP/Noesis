/**
 * Phase 8 AGENCY-05 — broadcast allowlist 17→18 invariant.
 *
 * Pins the full frozen-18 tuple by array-literal comparison. Any reorder,
 * removal, or silent addition fails. Extends the Phase 7 allowlist-seventeen
 * discipline (which this test supersedes).
 *
 * See: 08-CONTEXT.md D-23, D-24 (position 18, operator.nous_deleted).
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

/** Frozen expected tuple — Phase 8 position-18 discipline. */
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
    'telos.refined',
    'operator.nous_deleted',  // position 18 (zero-indexed 17) — Phase 8 AGENCY-05
] as const;

describe('broadcast allowlist — Phase 8 invariant (AGENCY-05 D-23/D-24)', () => {
    it('contains exactly 18 members', () => {
        expect(ALLOWLIST.size).toBe(18);
    });

    it('includes operator.nous_deleted', () => {
        expect(ALLOWLIST.has('operator.nous_deleted')).toBe(true);
        expect(isAllowlisted('operator.nous_deleted')).toBe(true);
    });

    it('preserves Phase 6/7 order and appends operator.nous_deleted last', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });

    it('is frozen — mutation attempts throw', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('malicious.event')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('operator.nous_deleted')).toThrow(TypeError);
    });
});
