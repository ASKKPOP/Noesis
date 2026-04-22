/**
 * Phase 10a DRIVE-03 — broadcast allowlist 18→19 invariant.
 *
 * Pins the full frozen-19 tuple by array-literal comparison. Any reorder,
 * removal, or silent addition fails. Extends the Phase 8 allowlist-eighteen
 * discipline (which this test supersedes as the current-era size gate).
 *
 * D-10a-08: allowlist addition is exactly one — `ananke.drive_crossed`.
 * No `drive_raised`, `drive_saturated`, `drive_reset`. Closed-enum
 * sibling-rejection is asserted here.
 *
 * See: 10a-02-PLAN.md, 10a-CONTEXT.md D-10a-08.
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

/** Frozen expected tuple — Phase 10a position-19 discipline. */
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
    'operator.nous_deleted',
    'ananke.drive_crossed', // position 19 (zero-indexed 18) — Phase 10a DRIVE-03
] as const;

describe('broadcast allowlist — Phase 10a invariant (DRIVE-03 D-10a-08)', () => {
    it('has exactly 19 entries', () => {
        expect(ALLOWLIST.size).toBe(19);
    });

    it('contains ananke.drive_crossed', () => {
        expect(isAllowlisted('ananke.drive_crossed')).toBe(true);
        expect(ALLOWLIST.has('ananke.drive_crossed')).toBe(true);
    });

    it.each(['ananke.drive_raised', 'ananke.drive_saturated', 'ananke.drive_reset'])(
        'rejects forbidden sibling %s',
        (event) => {
            expect(isAllowlisted(event)).toBe(false);
        },
    );

    it('preserves Phase 6/7/8 order and appends ananke.drive_crossed last', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });

    it('preserves all 18 prior allowlist members (regression)', () => {
        const priorMembers = [
            'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
            'trade.proposed', 'trade.reviewed', 'trade.settled',
            'law.triggered', 'tick', 'grid.started', 'grid.stopped',
            'operator.inspected', 'operator.paused', 'operator.resumed',
            'operator.law_changed', 'operator.telos_forced',
            'telos.refined', 'operator.nous_deleted',
        ];
        for (const m of priorMembers) expect(isAllowlisted(m)).toBe(true);
    });

    it('is frozen — mutation attempts throw TypeError', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('malicious.event')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('ananke.drive_crossed')).toThrow(TypeError);
    });
});
