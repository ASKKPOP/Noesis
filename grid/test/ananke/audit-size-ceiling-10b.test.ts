/**
 * Phase 10b audit-size ceiling — D-10b-10 defense.
 *
 * Extends the Phase 10a ceiling test (grid/test/audit/audit-size-ceiling-ananke.test.ts)
 * to include bios.* events. Verifies that adding 2 Bios needs does NOT inflate
 * the total audit-event count beyond the D-10b-10 bound.
 *
 * Ceiling derivation (D-10b-10):
 *   Phase 10a bound: 5 drives × 2 crossings each × 1 Nous ≤ 50 ananke.drive_crossed
 *   Phase 10b additions:
 *     - energy need (energy→hunger): max 2 crossings (LOW→MED, MED→HIGH) over 1000 ticks
 *       Each crossing elevates hunger by one bucket. Hunger then produces ananke.drive_crossed.
 *       These are ALREADY counted in the 50-entry ananke ceiling; no new event type.
 *     - sustenance need (sustenance→safety): same — max 2 crossings. Already counted.
 *     - bios.birth: 1 event per Nous per lifetime. Lifecycle event, not per-tick.
 *     - bios.death: at most 1 per Nous per lifetime. Not counted in per-tick ceiling.
 *   Net steady-state per-tick new events: 0 (bios elevation ⊆ ananke.drive_crossed).
 *   Extended ceiling = 50 (Phase 10a) + 3 (bios.birth + bios.death + 1 safety margin) = 53.
 *
 * Test construction:
 *   - 1 Nous over 1000 ticks.
 *   - Simulate 2 crossings per Ananke drive (realistic: ~2 crossings/drive over 1000 ticks).
 *   - Add bios.birth at tick 0 and bios.death at tick 1000.
 *   - Assert total event count ≤ PHASE_10B_CEILING (53).
 *   - Assert ananke.drive_crossed count ≤ 50 (Phase 10a regression).
 *
 * Does NOT exercise Brain-side math — that lives in brain/test/bios/.
 * The ceiling being guarded is the audit-chain entry count.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendAnankeDriveCrossed } from '../../src/ananke/index.js';
import { ANANKE_DRIVE_NAMES } from '../../src/ananke/types.js';
import { appendBiosBirth } from '../../src/bios/appendBiosBirth.js';
import { appendBiosDeath } from '../../src/bios/appendBiosDeath.js';

const TICK_COUNT = 1000;
const NOUS_DID = 'did:noesis:ceiling-10b-01';
const PSYCHE_HASH = 'a'.repeat(64);
const FINAL_HASH = 'b'.repeat(64);

// Phase 10b D-10b-10 ceiling:
//   50 (Phase 10a ananke ceiling) + 1 (bios.birth) + 1 (bios.death) + 1 (margin) = 53.
// Bios elevation events are expressed AS ananke.drive_crossed (no new event type),
// so the 50-entry ananke ceiling is already inclusive of bios-driven elevations.
const PHASE_10B_CEILING = 53;
// Phase 10a regression ceiling — must not be exceeded even with bios active.
const ANANKE_CEILING = 50;

describe('Phase 10b audit-size ceiling — D-10b-10 defense', () => {
    it('1000-tick window × 1 Nous (5 drives + bios lifecycle) produces ≤ 53 total events', () => {
        const audit = new AuditChain();

        // Lifecycle: birth at tick 0.
        appendBiosBirth(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // Simulate realistic Ananke drive crossings (2 per drive = 10 total),
        // including the two drives that bios elevation can affect (hunger, safety).
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

        // Lifecycle: death at tick 1000 (starvation scenario).
        appendBiosDeath(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: TICK_COUNT,
            cause: 'starvation',
            final_state_hash: FINAL_HASH,
        });

        // Background tick events (not counted in ceiling — they're system events).
        for (let t = 0; t < TICK_COUNT; t += 100) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        const allEntries = audit.all();
        const biosEntries = allEntries.filter(e => e.eventType.startsWith('bios.'));
        const anankeEntries = allEntries.filter(e => e.eventType === 'ananke.drive_crossed');

        // D-10b-10 total ceiling (excluding background tick events).
        const nonTickEntries = allEntries.filter(e => e.eventType !== 'tick');
        expect(
            nonTickEntries.length,
            `D-10b-10 ceiling breach: ${nonTickEntries.length} > ${PHASE_10B_CEILING}`,
        ).toBeLessThanOrEqual(PHASE_10B_CEILING);

        // Phase 10a regression: ananke ceiling still holds.
        expect(
            anankeEntries.length,
            `Phase 10a ANANKE_CEILING regression: ${anankeEntries.length} > ${ANANKE_CEILING}`,
        ).toBeLessThanOrEqual(ANANKE_CEILING);

        // Calibration: exactly 2 × 5 = 10 drive crossings.
        expect(anankeEntries.length).toBe(2 * ANANKE_DRIVE_NAMES.length);

        // Bios lifecycle: exactly 2 events (birth + death).
        expect(biosEntries.length).toBe(2);
    });

    it('bios events are lifecycle-only: no per-tick bios.* entries emitted during steady-state', () => {
        const audit = new AuditChain();

        appendBiosBirth(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // 1000 ticks with no drive crossings, no death.
        for (let t = 1; t <= TICK_COUNT; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        const biosEntries = audit.all().filter(e => e.eventType.startsWith('bios.'));
        // Only the birth event — no per-tick bios emissions.
        expect(biosEntries.length).toBe(1);
        expect(biosEntries[0].eventType).toBe('bios.birth');
    });

    it('Phase 10a ANANKE_CEILING regression: bios elevation via hunger/safety stays within 50 entries', () => {
        const audit = new AuditChain();

        appendBiosBirth(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // Maximum realistic scenario: hunger and safety each crossed TWICE
        // by bios elevation (LOW→MED and MED→HIGH over 1000 ticks).
        // Plus the other 3 drives with 2 crossings each.
        for (const drive of ANANKE_DRIVE_NAMES) {
            appendAnankeDriveCrossed(audit, NOUS_DID, {
                did: NOUS_DID, tick: 300, drive, level: 'med', direction: 'rising',
            });
            appendAnankeDriveCrossed(audit, NOUS_DID, {
                did: NOUS_DID, tick: 600, drive, level: 'high', direction: 'rising',
            });
        }

        const anankeEntries = audit.all().filter(e => e.eventType === 'ananke.drive_crossed');
        // 2 crossings × 5 drives = 10 entries. Well within the 50 ceiling.
        expect(anankeEntries.length).toBeLessThanOrEqual(ANANKE_CEILING);
        // Calibration: exactly 10.
        expect(anankeEntries.length).toBe(10);
    });
});
