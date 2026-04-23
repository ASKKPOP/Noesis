/**
 * Phase 10b Wave 0 RED stub — BIOS-02 closed-enum lifecycle gate.
 *
 * D-10b-01 / D-10b-11: bios lifecycle is exactly 2 events
 *   { 'bios.birth', 'bios.death' }.
 * Forbidden lifecycle siblings:
 *   { 'bios.resurrect', 'bios.migrate', 'bios.transfer' }.
 * Forbidden chronos events (chronos is read-side only):
 *   { 'chronos.time_slipped', 'chronos.multiplier_changed' }.
 *
 * Each forbidden event, when attempted via audit.append, must throw —
 * the AuditChain's allowlist gate (default-deny per
 * grid/src/audit/broadcast-allowlist.ts) rejects events not in ALLOWLIST.
 *
 * RED at Wave 0 because:
 *   - bios.birth / bios.death are NOT yet in ALLOWLIST → the happy-path
 *     "accepts" cases would fail (but they're not asserted here — this
 *     test only asserts forbidden REJECTIONS).
 *   - This test reaches GREEN immediately once Wave 2 extends the
 *     allowlist to 21 (the rejection assertions are positively-true
 *     even today; what makes them fully meaningful is the contrast with
 *     bios.birth / bios.death being accepted).
 *
 * Note: AuditChain.append() in 10a does not gate on allowlist — that
 * gate lives in the WsHub broadcast path. Here we instead assert
 * isAllowlisted(forbidden) === false for each.
 */
import { describe, expect, it } from 'vitest';
import { isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

const FORBIDDEN_BIOS_LIFECYCLE = [
    'bios.resurrect',
    'bios.migrate',
    'bios.transfer',
] as const;

const FORBIDDEN_CHRONOS = [
    'chronos.time_slipped',
    'chronos.multiplier_changed',
    'chronos.tick',
    'chronos.subjective_time',
] as const;

const FORBIDDEN_BIOS_VARIANTS = [
    'bios.spawn',     // not the canonical name (bios.birth is)
    'bios.die',       // not the canonical name (bios.death is)
    'bios.respawn',
    'bios.fork',
] as const;

describe('closed-enum bios lifecycle — BIOS-02 gate', () => {
    it.each(FORBIDDEN_BIOS_LIFECYCLE)('rejects forbidden lifecycle event %s', (event) => {
        expect(isAllowlisted(event)).toBe(false);
    });

    it.each(FORBIDDEN_BIOS_VARIANTS)('rejects non-canonical bios variant %s', (event) => {
        expect(isAllowlisted(event)).toBe(false);
    });

    it.each(FORBIDDEN_CHRONOS)('rejects forbidden chronos event %s (D-10b-11 — read-side only)', (event) => {
        expect(isAllowlisted(event)).toBe(false);
    });

    it('accepts bios.birth (canonical) — Wave 2 turns this GREEN', () => {
        expect(isAllowlisted('bios.birth')).toBe(true);
    });

    it('accepts bios.death (canonical) — Wave 2 turns this GREEN', () => {
        expect(isAllowlisted('bios.death')).toBe(true);
    });
});
