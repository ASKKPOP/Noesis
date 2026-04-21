/**
 * Phase 6 Plan 04 Task 1 — WorldClock.pause() / resume() / isPaused.
 *
 * D-17: pause clears the interval + sets paused=true without resetting the
 * tick counter; resume restores the interval without resetting startedAt.
 * Both operations are idempotent. Preserves the Phase 2 zero-diff invariant
 * (commit 29c3516) — tested separately in worldclock-zero-diff.test.ts.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { WorldClock } from '../../src/clock/ticker.js';

describe('WorldClock.pause/resume (D-17 producer-side invariant)', () => {
    let clock: WorldClock | undefined;

    afterEach(() => {
        clock?.stop();
        clock = undefined;
        vi.useRealTimers();
    });

    it('pause() clears the interval timer, sets isPaused=true, preserves tick counter', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        clock.start();
        clock.advance();
        clock.advance();
        clock.advance();
        expect(clock.currentTick).toBe(3);
        expect(clock.running).toBe(true);

        clock.pause();
        expect(clock.isPaused).toBe(true);
        expect(clock.running).toBe(false);
        expect(clock.currentTick).toBe(3); // counter preserved
    });

    it('pause() is idempotent — second call is a no-op', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        clock.start();
        clock.pause();
        expect(clock.isPaused).toBe(true);
        expect(() => clock!.pause()).not.toThrow();
        expect(clock.isPaused).toBe(true);
        expect(clock.running).toBe(false);
    });

    it('pause() on a clock that never started is a no-op (nothing to pause)', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        expect(() => clock!.pause()).not.toThrow();
        // Guard: if the timer is null AND paused was false, pause short-circuits.
        expect(clock.isPaused).toBe(false);
        expect(clock.running).toBe(false);
    });

    it('resume() from paused restores running state; tick counter preserved', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        clock.start();
        clock.advance();
        clock.advance();
        clock.pause();
        expect(clock.currentTick).toBe(2);

        clock.resume();
        expect(clock.isPaused).toBe(false);
        expect(clock.running).toBe(true);
        expect(clock.currentTick).toBe(2); // not reset
    });

    it('resume() is idempotent — resume-when-not-paused is a no-op', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        expect(() => clock!.resume()).not.toThrow();
        expect(clock.isPaused).toBe(false);
        expect(clock.running).toBe(false);

        clock.start();
        expect(() => clock!.resume()).not.toThrow();
        expect(clock.running).toBe(true);
    });

    it('no ticks emitted while paused — listener fires only on explicit advance', () => {
        vi.useFakeTimers();
        clock = new WorldClock({ tickRateMs: 20 });
        const ticks: number[] = [];
        clock.onTick((e) => ticks.push(e.tick));

        clock.start();
        clock.advance();
        clock.advance();
        clock.advance();
        expect(ticks).toEqual([1, 2, 3]);

        clock.pause();
        // Even if fake-time passes much longer than tickRateMs, no more ticks fire.
        vi.advanceTimersByTime(1000);
        expect(ticks).toEqual([1, 2, 3]);

        clock.resume();
        clock.advance();
        expect(ticks).toEqual([1, 2, 3, 4]);
    });
});
