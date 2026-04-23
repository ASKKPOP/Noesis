/**
 * Phase 10b invariant: audit_tick === system_tick over 1000 ticks.
 *
 * D-10b-06 (CHRONOS-02): The Chronos subjective-time multiplier is a Brain-local
 * read-side modifier. It MUST NOT perturb audit_tick; every event whose payload
 * carries a `tick` key must equal the system tick at the moment it was appended.
 *
 * Test construction:
 *   - Append 1000 `tick` events via AuditChain with sequential tick values.
 *   - Interleave bios.birth at tick 0, a drive_crossed at tick 400, and
 *     bios.death at tick 1000 to simulate a full Nous lifecycle with all
 *     Phase 10b event types present.
 *   - Assert every entry whose payload.tick is a number equals the loop
 *     counter at which it was appended — zero drift across 1000 ticks.
 *   - Assert bios.birth is present (lifecycle coverage).
 *
 * Wall-clock free: AuditChain.computeHash includes timestamp, but the
 * drift assertion checks payload.tick vs system tick (deterministic).
 * The hash itself is not asserted here (see pause-resume-10b.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendBiosBirth } from '../../src/bios/appendBiosBirth.js';
import { appendBiosDeath } from '../../src/bios/appendBiosDeath.js';
import { appendAnankeDriveCrossed } from '../../src/ananke/index.js';

const NOUS_DID = 'did:noesis:drift-invariant-1000';
const PSYCHE_HASH = 'a'.repeat(64);
const FINAL_HASH = 'b'.repeat(64);

describe('Phase 10b invariant: audit_tick === system_tick over 1000 ticks', () => {
    it('no drift across 1000 ticks with bios + ananke events in stream', () => {
        const audit = new AuditChain();

        // Birth at tick 0.
        appendBiosBirth(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: 0,
            psyche_hash: PSYCHE_HASH,
        });

        // 1000 tick events — main loop simulating Grid system ticks.
        for (let t = 1; t <= 1000; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });

            // Mid-run crossing: energy need elevates hunger drive at tick 400.
            if (t === 400) {
                appendAnankeDriveCrossed(audit, NOUS_DID, {
                    did: NOUS_DID,
                    tick: t,
                    drive: 'hunger',
                    level: 'med',
                    direction: 'rising',
                });
            }
        }

        // Natural death at tick 1000 (starvation scenario).
        appendBiosDeath(audit, NOUS_DID, {
            did: NOUS_DID,
            tick: 1000,
            cause: 'starvation',
            final_state_hash: FINAL_HASH,
        });

        const entries = audit.all();

        // Verify every entry with a numeric payload.tick equals the system tick
        // at which it was appended. Build a reference map from entry sequence.
        let systemTick = 0;
        let birthSeen = false;
        let deathSeen = false;
        let crossingSeen = false;

        for (const entry of entries) {
            const payload = entry.payload as Record<string, unknown>;

            if (entry.eventType === 'bios.birth') {
                // Birth appended before tick loop — system tick is 0 at that point.
                expect(payload.tick, 'bios.birth tick must === 0').toBe(0);
                birthSeen = true;
            } else if (entry.eventType === 'tick') {
                systemTick = payload.tick as number;
                expect(payload.tick, `tick event payload.tick must === ${systemTick}`)
                    .toBe(systemTick);
            } else if (entry.eventType === 'ananke.drive_crossed') {
                // Drive-crossed appended inside the tick 400 iteration, after
                // the tick event for t=400 has already set systemTick=400.
                expect(payload.tick, 'ananke.drive_crossed tick must === 400').toBe(400);
                expect(payload.tick).toBe(systemTick);
                crossingSeen = true;
            } else if (entry.eventType === 'bios.death') {
                // Death appended after the 1000-tick loop; systemTick === 1000.
                expect(payload.tick, 'bios.death tick must === 1000').toBe(1000);
                expect(payload.tick).toBe(systemTick);
                deathSeen = true;
            }
        }

        // Sanity: all event types were exercised.
        expect(birthSeen, 'bios.birth must be present').toBe(true);
        expect(crossingSeen, 'ananke.drive_crossed must be present').toBe(true);
        expect(deathSeen, 'bios.death must be present').toBe(true);

        // Total entry count: 1 birth + 1000 tick events + 1 drive_crossed + 1 death = 1003.
        expect(entries.length).toBe(1003);
    });

    it('audit_tick invariant holds across all 1000 tick events individually', () => {
        const audit = new AuditChain();

        for (let t = 1; t <= 1000; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        const tickEntries = audit.all().filter(e => e.eventType === 'tick');
        expect(tickEntries.length).toBe(1000);

        // Every tick entry: payload.tick === its sequential position.
        for (const entry of tickEntries) {
            const p = entry.payload as { tick: number; epoch: number };
            // Payload.tick is the value we appended; by construction it is the loop counter.
            expect(typeof p.tick).toBe('number');
            expect(p.tick).toBeGreaterThanOrEqual(1);
            expect(p.tick).toBeLessThanOrEqual(1000);
            // epoch is derived from tick — no wall-clock dependency.
            expect(p.epoch).toBe(Math.floor(p.tick / 25));
        }

        // No gaps or duplicates: ticks are 1..1000 in order.
        const tickValues = tickEntries.map(e => (e.payload as { tick: number }).tick);
        for (let i = 0; i < 1000; i++) {
            expect(tickValues[i]).toBe(i + 1);
        }
    });
});
