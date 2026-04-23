/**
 * Phase 10b Wave 0 RED stub — BIOS-02 broadcast allowlist 19→21 invariant.
 *
 * Clones grid/test/audit/allowlist-nineteen.test.ts; extends EXPECTED_ORDER
 * by exactly two members at positions 20-21 (zero-indexed 19-20):
 *   - 'bios.birth'   (BIOS-02)
 *   - 'bios.death'   (BIOS-03)
 *
 * D-10b-01: allowlist additions are exactly two — bios.birth + bios.death.
 * No 'bios.resurrect', 'bios.migrate', 'bios.transfer'.
 * No 'chronos.*' (chronos is read-side only — D-10b-11).
 *
 * RED at Wave 0: ALLOWLIST currently has 19 entries; tests expecting 21
 * + bios.birth + bios.death will fail until Wave 2 (Plan 10b-03) extends
 * the allowlist.
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

/** Frozen expected tuple — Phase 10b position-21 discipline. */
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
    'ananke.drive_crossed',
    'bios.birth', // position 20 (zero-indexed 19) — Phase 10b BIOS-02
    'bios.death', // position 21 (zero-indexed 20) — Phase 10b BIOS-03
] as const;

describe('broadcast allowlist — Phase 10b invariant (BIOS-02 D-10b-01)', () => {
    it('has exactly 21 entries', () => {
        expect(ALLOWLIST.size).toBe(21);
    });

    it('contains bios.birth at position 20 (index 19)', () => {
        expect(isAllowlisted('bios.birth')).toBe(true);
        expect([...ALLOWLIST][19]).toBe('bios.birth');
    });

    it('contains bios.death at position 21 (index 20)', () => {
        expect(isAllowlisted('bios.death')).toBe(true);
        expect([...ALLOWLIST][20]).toBe('bios.death');
    });

    it.each([
        'bios.resurrect',
        'bios.migrate',
        'bios.transfer',
        'chronos.time_slipped',
        'chronos.multiplier_changed',
        'chronos.tick',
    ])('rejects forbidden sibling / chronos event %s', (event) => {
        expect(isAllowlisted(event)).toBe(false);
    });

    it('preserves Phase 6/7/8/10a order and appends bios.birth + bios.death last', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });

    it('preserves all 19 prior allowlist members (regression — Phase 10a)', () => {
        const priorMembers = [
            'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
            'trade.proposed', 'trade.reviewed', 'trade.settled',
            'law.triggered', 'tick', 'grid.started', 'grid.stopped',
            'operator.inspected', 'operator.paused', 'operator.resumed',
            'operator.law_changed', 'operator.telos_forced',
            'telos.refined', 'operator.nous_deleted', 'ananke.drive_crossed',
        ];
        for (const m of priorMembers) expect(isAllowlisted(m)).toBe(true);
    });

    it('is frozen — mutation attempts throw TypeError', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('malicious.event')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('bios.birth')).toThrow(TypeError);
    });
});
