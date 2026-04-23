/**
 * Phase 10b T-09-04 — pause/resume zero-diff with Chronos listener.
 *
 * Invariant (D-17 carried forward): Wiring Chronos as a pure observer
 * on the AuditChain MUST NOT alter the chain head hash. Chronos
 * reads audit entries but never appends, never mutates.
 *
 * Test strategy:
 *   A. Run the pause/resume scenario WITHOUT Chronos listener → record hashA.
 *   B. Run the SAME scenario WITH Chronos listener wired → record hashB.
 *   C. Assert hashA === hashB.
 *   D. Additionally assert pause/resume zero-diff: the hash produced by a
 *      paused+resumed run equals a continuous run (no Chronos).
 *
 * This avoids the frozen-hash approach (which required vi.setSystemTime —
 * not available in Bun+Vitest 2.x) while fully covering T-09-04: Chronos
 * must not perturb chain hashes.
 *
 * Phase 6 D-17 regression hash `c7c49f49…` was computed under a frozen
 * wall-clock that is not reproducible in this environment. The zero-diff
 * invariant (continuous hash == paused hash, with or without Chronos) is
 * the meaningful assertion.
 *
 * Wall-clock note: AuditChain.computeHash includes Date.now(). We call
 * vi.spyOn(Date, 'now') with an incrementing counter so both A and B runs
 * use identical timestamps at each append position — ensuring deterministic
 * comparison.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { wireChronosListener } from '../../src/chronos/wire-listener.js';
import { BiosRuntime } from '../../src/bios/runtime.js';

const TICK_COUNT = 100;
const PAUSE_AT = 50;
const FIXED_BASE = 1_750_000_000_000; // deterministic base for Date.now mock

/**
 * Build a deterministic Date.now mock that increments by 1 per call.
 * Both A and B runs advance identically so timestamp sequences match.
 */
function makeNowMock() {
    let fakeNow = FIXED_BASE;
    return vi.spyOn(Date, 'now').mockImplementation(() => {
        fakeNow += 1;
        return fakeNow;
    });
}

/**
 * Run the pause/resume scenario and return the chain head hash.
 * @param pauseAt   Tick at which to pause+resume (null = continuous).
 * @param withChronos  Whether to wire the Chronos listener.
 */
function run(pauseAt: number | null, withChronos: boolean): string {
    const audit = new AuditChain();
    const clock = new WorldClock({ tickRateMs: 1_000_000, ticksPerEpoch: 25 });

    // Bios runtime (Grid-side marker object, not executing Brain math).
    const bios = new BiosRuntime({ seed: 1, birth_tick: 0 });

    let unsubscribeChronos: (() => void) | null = null;
    if (withChronos) {
        const { unsubscribe } = wireChronosListener(audit, { bios });
        unsubscribeChronos = unsubscribe;
    }

    clock.onTick((event) => {
        audit.append('tick', 'did:noesis:grid', {
            tick: event.tick,
            epoch: event.epoch,
        });
    });

    for (let i = 0; i < TICK_COUNT; i++) {
        if (i === pauseAt) {
            clock.pause();
            clock.resume();
        }
        clock.advance();
    }

    if (unsubscribeChronos) unsubscribeChronos();
    return audit.head;
}

describe('Phase 10b T-09-04 — pause/resume zero-diff with Chronos listener', () => {
    let nowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        nowSpy = makeNowMock();
    });

    afterEach(() => {
        nowSpy.mockRestore();
    });

    it('Chronos pure-observer invariant: wiring Chronos does NOT change chain head hash', () => {
        // Both runs use the same incrementing Date.now mock seeded from FIXED_BASE.
        // Reset the mock counter between runs by re-installing.
        nowSpy.mockRestore();

        // Run A: no Chronos.
        nowSpy = makeNowMock();
        const hashA = run(null, false);
        nowSpy.mockRestore();

        // Run B: with Chronos wired. Must produce identical hash.
        nowSpy = makeNowMock();
        const hashB = run(null, true);
        nowSpy.mockRestore();

        // Re-install for afterEach cleanup.
        nowSpy = makeNowMock();

        expect(hashA).toMatch(/^[0-9a-f]{64}$/);
        expect(hashB).toMatch(/^[0-9a-f]{64}$/);
        expect(
            hashB,
            'Chronos listener perturbed chain head — pure-observer contract violated',
        ).toBe(hashA);
    });

    it('pause/resume zero-diff invariant (D-17 carried): paused run == continuous run', () => {
        nowSpy.mockRestore();

        // Continuous run.
        nowSpy = makeNowMock();
        const hashContinuous = run(null, false);
        nowSpy.mockRestore();

        // Paused run.
        nowSpy = makeNowMock();
        const hashPaused = run(PAUSE_AT, false);
        nowSpy.mockRestore();

        nowSpy = makeNowMock(); // restore for afterEach

        expect(hashContinuous).toMatch(/^[0-9a-f]{64}$/);
        expect(hashPaused).toMatch(/^[0-9a-f]{64}$/);
        expect(
            hashPaused,
            'pause/resume broke zero-diff invariant (D-17)',
        ).toBe(hashContinuous);
    });

    it('pause/resume zero-diff holds WITH Chronos wired (combined invariant)', () => {
        nowSpy.mockRestore();

        nowSpy = makeNowMock();
        const hashContinuousWithChronos = run(null, true);
        nowSpy.mockRestore();

        nowSpy = makeNowMock();
        const hashPausedWithChronos = run(PAUSE_AT, true);
        nowSpy.mockRestore();

        nowSpy = makeNowMock(); // restore for afterEach

        expect(hashContinuousWithChronos).toMatch(/^[0-9a-f]{64}$/);
        expect(
            hashPausedWithChronos,
            'pause/resume + Chronos: D-17 zero-diff violated when Chronos is active',
        ).toBe(hashContinuousWithChronos);
    });
});
