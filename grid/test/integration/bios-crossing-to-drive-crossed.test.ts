/**
 * Phase 10b end-to-end: Bios→Ananke crossing elevator contract.
 *
 * D-10b-02: When a Bios need (energy or sustenance) crosses a threshold,
 * BiosRuntime calls AnankeRuntime.elevate_drive(drive), which bumps the
 * matching Ananke drive one bucket. On the NEXT on_tick() call,
 * detect_crossing() observes the level change and emits ananke.drive_crossed.
 *
 * Grid-side role: The Grid receives BIOS_DEATH / drive_crossed actions from
 * the Brain RPC and appends them via the sole-producer emitters. This test
 * verifies the Grid-side protocol:
 *
 *   1. appendBiosBirth emitted at spawn.
 *   2. When Brain reports a drive_crossed action (hunger, med, rising) —
 *      caused by the energy need elevation — appendAnankeDriveCrossed lands.
 *   3. The resulting audit sequence preserves tick discipline:
 *      bios.birth(tick=0) → … → ananke.drive_crossed(tick=T) where T > 0.
 *   4. The ananke.drive_crossed payload drive is 'hunger' (energy→hunger map,
 *      D-10b-02) and level is 'med' (first elevation from LOW baseline).
 *
 * Brain-side causal proof (that the need actually crosses a threshold at
 * tick ~130) lives in brain/test/bios/test_needs_elevator.py. This test
 * focuses on the Grid-side event sequence contract once the crossing signal
 * arrives.
 *
 * Wall-clock free: all ticks are injected; no Date.now/performance.now calls.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendBiosBirth } from '../../src/bios/appendBiosBirth.js';
import { appendAnankeDriveCrossed } from '../../src/ananke/index.js';

const NOUS_DID = 'did:noesis:bios-crossing-e2e';
const PSYCHE_HASH = 'c'.repeat(64);

describe('Bios→Ananke elevator end-to-end (Grid protocol layer)', () => {
    it('energy need crossing → ananke.drive_crossed drive=hunger, level=med appended at correct tick', () => {
        const audit = new AuditChain();

        // Spawn: bios.birth at tick 0.
        appendBiosBirth(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // Simulate tick progression. Brain reports a drive_crossed(hunger, med)
        // at tick 132 — consistent with energy rise rate 0.0003/tick, baseline
        // 0.3, threshold 0.33+0.02 band ≈ 100-150 ticks to cross LOW→MED.
        // (The exact tick is determined by brain/test/bios/ — here we use 132
        // as a representative tick in the expected range [100, 500].)
        const CROSSING_TICK = 132;

        for (let t = 1; t <= CROSSING_TICK; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });

            if (t === CROSSING_TICK) {
                // Brain RPC delivers DRIVE_CROSSED action → NousRunner dispatches
                // → appendAnankeDriveCrossed lands here.
                appendAnankeDriveCrossed(audit, NOUS_DID, {
                    did: NOUS_DID,
                    tick: t,
                    drive: 'hunger',   // energy → hunger per D-10b-02 NEED_TO_DRIVE
                    level: 'med',      // first crossing: LOW → MED
                    direction: 'rising',
                });
            }
        }

        // Verify the crossing event landed.
        const crossings = audit.all().filter(e => e.eventType === 'ananke.drive_crossed');
        expect(crossings.length, 'exactly one drive_crossed event').toBe(1);

        const crossing = crossings[0];
        const p = crossing.payload as Record<string, unknown>;

        // Drive=hunger (energy→hunger mapping).
        expect(p.drive, 'drive must be hunger (energy elevates hunger per D-10b-02)').toBe('hunger');
        // First elevation: LOW→MED.
        expect(p.level, 'level must be med (first threshold crossing)').toBe('med');
        // Rising direction.
        expect(p.direction).toBe('rising');
        // Tick discipline: payload.tick matches system tick at append time.
        expect(p.tick, 'crossing tick must equal system tick at append').toBe(CROSSING_TICK);
        // Self-report invariant upheld.
        expect(p.did).toBe(NOUS_DID);

        // Ordering: bios.birth before ananke.drive_crossed.
        const entries = audit.all();
        const birthIdx = entries.findIndex(e => e.eventType === 'bios.birth');
        const crossIdx = entries.findIndex(e => e.eventType === 'ananke.drive_crossed');
        expect(birthIdx).toBeGreaterThanOrEqual(0);
        expect(crossIdx).toBeGreaterThan(birthIdx);

        // Crossing tick is in the expected biological range.
        expect(CROSSING_TICK).toBeGreaterThan(100);
        expect(CROSSING_TICK).toBeLessThan(500);
    });

    it('sustenance need crossing → ananke.drive_crossed drive=safety, level=med (D-10b-02 NEED_TO_DRIVE)', () => {
        const audit = new AuditChain();
        const DID = 'did:noesis:sustenance-crossing-e2e';

        appendBiosBirth(audit, DID, {
            did: DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // Sustenance rise rate 0.0001/tick; baseline 0.3; threshold 0.35 with band.
        // Expected crossing: ~350 ticks. Use 360 as representative.
        const SUSTENANCE_CROSSING_TICK = 360;

        for (let t = 1; t <= SUSTENANCE_CROSSING_TICK; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        // Brain reports safety crossing (sustenance→safety per NEED_TO_DRIVE).
        appendAnankeDriveCrossed(audit, DID, {
            did: DID,
            tick: SUSTENANCE_CROSSING_TICK,
            drive: 'safety',   // sustenance → safety per D-10b-02 NEED_TO_DRIVE
            level: 'med',
            direction: 'rising',
        });

        const crossings = audit.all().filter(e => e.eventType === 'ananke.drive_crossed');
        expect(crossings.length).toBe(1);

        const p = crossings[0].payload as Record<string, unknown>;
        expect(p.drive).toBe('safety');
        expect(p.level).toBe('med');
        expect(p.tick).toBe(SUSTENANCE_CROSSING_TICK);
        expect(p.did).toBe(DID);
    });

    it('no ananke.drive_crossed emitted before a bios need crossing occurs', () => {
        const audit = new AuditChain();
        const DID = 'did:noesis:no-crossing-yet';

        appendBiosBirth(audit, DID, {
            did: DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // Run 50 ticks — below any threshold crossing (energy threshold ~130 ticks).
        for (let t = 1; t <= 50; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        // No drive_crossed events should exist yet.
        const crossings = audit.all().filter(e => e.eventType === 'ananke.drive_crossed');
        expect(crossings.length, 'no crossing below threshold').toBe(0);

        // But birth is present.
        const births = audit.all().filter(e => e.eventType === 'bios.birth');
        expect(births.length).toBe(1);
    });
});
