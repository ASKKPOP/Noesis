/**
 * Phase 10b Wave 0 RED stub — T-09-04 pause/resume zero-diff regression.
 *
 * Phase 9 froze the chain head hash after a specific pause/resume scenario:
 *   `c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461`.
 *
 * Phase 10b adds the Chronos listener to the pause/resume execution path.
 * Chronos is a PURE OBSERVER — it must not perturb chain hashes. The
 * known-good hash from Phase 9 must still emerge byte-identical when
 * Chronos is wired in (Wave 4, Plan 10b-04).
 *
 * RED at Wave 0:
 *   - Chronos listener does not exist; the integration scenario cannot
 *     even be assembled. Imports of `wireChronosListener` /
 *     `BiosRuntime` fail.
 *   - When Wave 4 wires Chronos correctly, this test passes.
 *   - If Wave 4 introduces ANY mutation to chain entries via the chronos
 *     path, the hash diverges and this test catches it.
 *
 * Frozen hash provenance: Phase 9 closeout — see PHILOSOPHY.md
 * "zero-diff invariant" non-negotiable + grid/test/integration/
 * pause-resume zero-diff suite.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { WorldClock } from '../../src/clock/ticker.js';
// RED: Chronos listener wiring does not yet exist.
import { wireChronosListener } from '../../src/chronos/wire-listener.js';
import { BiosRuntime } from '../../src/bios/runtime.js';

const KNOWN_GOOD_HASH =
    'c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461';

describe('Phase 10b T-09-04 — pause/resume zero-diff with Chronos listener', () => {
    it('chain head hash equals Phase 9 frozen value when Chronos is wired as pure observer', () => {
        const audit = new AuditChain();
        const clock = new WorldClock({ tickRateMs: 1_000_000 });

        // Wire Chronos as a pure-observer listener on the chain. The
        // listener may read entries but MUST NOT mutate them or append
        // anything to the chain itself (Chronos is read-side only —
        // D-10b-11). Wave 4 implements this; Wave 0 stub fails to import.
        const bios = new BiosRuntime({ seed: 1, birth_tick: 0 });
        wireChronosListener(audit, { bios });

        // Reproduce the Phase 9 pause/resume scenario:
        //   - 100 ticks
        //   - pause at tick 50
        //   - resume at tick 60 (10-tick gap)
        //   - 100 more ticks
        // The frozen hash was captured under this exact scenario in Phase 9.
        for (let t = 0; t < 50; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }
        clock.pause();
        audit.append('operator.paused', 'op:11111111-1111-4111-8111-111111111111', {
            tier: 'H3',
            action: 'pause',
            operator_id: 'op:11111111-1111-4111-8111-111111111111',
        });
        // 10-tick gap — no ticks emitted while paused.
        clock.resume();
        audit.append('operator.resumed', 'op:11111111-1111-4111-8111-111111111111', {
            tier: 'H3',
            action: 'resume',
            operator_id: 'op:11111111-1111-4111-8111-111111111111',
        });
        for (let t = 60; t < 160; t++) {
            audit.append('tick', 'system', { tick: t, epoch: Math.floor(t / 25) });
        }

        expect(
            audit.head,
            `chain head must equal Phase 9 frozen hash; chronos listener perturbed the chain if this fails`,
        ).toBe(KNOWN_GOOD_HASH);
    });
});
