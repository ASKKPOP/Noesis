/**
 * Phase 10b Wave 0 RED stub — T-09-01 audit-size ceiling for bios + drives.
 *
 * Clones grid/test/audit/audit-size-ceiling-ananke.test.ts shape.
 *
 * Two ceilings, both must hold simultaneously:
 *
 *   1. Per-Nous bios entries: 1000-tick window × 1 Nous emits at most 10
 *      bios.* entries (typical: 1 birth + 0-2 transitions + ≤1 death).
 *      Hard ceiling 10 with 5× margin over expected ~2.
 *
 *   2. Per-Nous ananke entries (10a regression): 1000 ticks × 5 drives ×
 *      1 Nous still ≤ 50 ananke.drive_crossed entries (carried over from
 *      Phase 10a — Bios elevation MUST NOT inflate this number).
 *
 * RED at Wave 0: imports `appendBiosBirth` / `appendBiosDeath` from
 * modules that do not exist. Wave 2 turns this GREEN.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendBiosBirth } from '../../src/bios/appendBiosBirth.js';
import { appendBiosDeath } from '../../src/bios/appendBiosDeath.js';
import { appendAnankeDriveCrossed } from '../../src/ananke/index.js';
import { ANANKE_DRIVE_NAMES } from '../../src/ananke/types.js';

const TICK_COUNT = 1000;
const NOUS_DID = 'did:noesis:audit-size-ceiling-bios-01';
const PSYCHE = 'a'.repeat(64);
const FINAL = 'b'.repeat(64);

// Bios ceiling: 1 birth + ≤ 4 crossings + ≤ 1 death = ≤ 6 typical;
// hard cap 10 (1.6× margin for transitions both directions).
const BIOS_CEILING = 10;
// Ananke ceiling: carried from Phase 10a (5× margin over expected ~10).
const ANANKE_CEILING = 50;

describe('Phase 10b audit-size ceiling — T-09-01 defense', () => {
    it('1000-tick window × 1 Nous produces <= 10 bios.* entries (BIOS-CEILING)', () => {
        const audit = new AuditChain();

        // Birth at tick 0.
        appendBiosBirth(audit, NOUS_DID, { did: NOUS_DID, psyche_hash: PSYCHE, tick: 0 });

        // No deaths in this scenario — typical Nous lives for the whole
        // window. Add a few non-bios events to simulate background noise.
        for (let t = 0; t < TICK_COUNT; t += 100) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        const biosEntries = audit.all().filter(e => e.eventType.startsWith('bios.'));
        expect(
            biosEntries.length,
            `BIOS-CEILING breach: ${biosEntries.length} > ${BIOS_CEILING}`,
        ).toBeLessThanOrEqual(BIOS_CEILING);
        expect(biosEntries.length).toBeGreaterThanOrEqual(1); // at least the birth
    });

    it('1000-tick window emits exactly 1 birth + 1 death when starvation occurs', () => {
        const audit = new AuditChain();
        appendBiosBirth(audit, NOUS_DID, { did: NOUS_DID, psyche_hash: PSYCHE, tick: 0 });
        appendBiosDeath(audit, NOUS_DID, {
            cause: 'starvation',
            did: NOUS_DID,
            final_state_hash: FINAL,
            tick: 800,
        });
        const biosEntries = audit.all().filter(e => e.eventType.startsWith('bios.'));
        expect(biosEntries.length).toBe(2);
        expect(biosEntries.length).toBeLessThanOrEqual(BIOS_CEILING);
    });

    it('1000-tick window × 5 drives × 1 Nous still <= 50 ananke entries (10a regression)', () => {
        const audit = new AuditChain();

        // Bios birth + 2 drive crossings per drive (rising + falling).
        appendBiosBirth(audit, NOUS_DID, { did: NOUS_DID, psyche_hash: PSYCHE, tick: 0 });
        for (const drive of ANANKE_DRIVE_NAMES) {
            appendAnankeDriveCrossed(audit, NOUS_DID, {
                did: NOUS_DID,
                tick: 400,
                drive,
                level: 'med',
                direction: 'rising',
            });
            appendAnankeDriveCrossed(audit, NOUS_DID, {
                did: NOUS_DID,
                tick: 850,
                drive,
                level: 'low',
                direction: 'falling',
            });
        }

        const anankeEntries = audit.all().filter(e => e.eventType === 'ananke.drive_crossed');
        expect(
            anankeEntries.length,
            `Phase 10a ANANKE-CEILING regression: ${anankeEntries.length} > ${ANANKE_CEILING}`,
        ).toBeLessThanOrEqual(ANANKE_CEILING);
        // Calibration check: exactly 2 × 5 = 10 crossings.
        expect(anankeEntries.length).toBe(2 * ANANKE_DRIVE_NAMES.length);
    });
});
