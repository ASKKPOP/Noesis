/**
 * Phase 6 Plan 04 Task 1 — Zero-Diff Invariant across pause/resume boundary.
 *
 * D-17 + commit 29c3516 (broadcast-allowlist / AuditChain baseline). This is
 * Phase 6's SECOND crown-jewel regression: pausing the sim must NOT corrupt
 * the cryptographic chain of custody.
 *
 * Test construction: run two WorldClock + AuditChain pairs to tick N.
 *   - Pair A: continuous — advance() N times back-to-back.
 *   - Pair B: paused at tick N/2, then resumed, then advance() to N.
 * AuditChain head hashes MUST be byte-identical.
 *
 * Why fake timers? `AuditChain.computeHash` incorporates Date.now() (chain.ts:26).
 * Without `vi.useFakeTimers() + vi.setSystemTime()` both heads are
 * nondeterministic — Phase 5 zero-diff.test.ts uses the same pattern.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldClock } from '../src/clock/ticker.js';
import { AuditChain } from '../src/audit/chain.js';

const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z');
const TICK_COUNT = 100;
const PAUSE_AT = 50;

describe('WorldClock zero-diff invariant (commit 29c3516 preserved across pause/resume per D-17)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function run(pauseAt: number | null): string {
        // Repin fake-clock baseline so both runs start from identical wall-clock.
        vi.setSystemTime(FIXED_TIME);
        const clock = new WorldClock({ tickRateMs: 1_000_000, ticksPerEpoch: 25 });
        const chain = new AuditChain();
        clock.onTick((event) => {
            chain.append(
                'tick',
                'did:noesis:grid',
                { tick: event.tick, epoch: event.epoch },
                'did:noesis:grid',
            );
        });
        for (let i = 0; i < TICK_COUNT; i++) {
            if (i === pauseAt) {
                clock.pause();
                clock.resume();
            }
            clock.advance();
            // Advance fake time by 1ms per tick to keep chain hashes realistic
            // — both runs advance identically so the timestamps match.
            vi.advanceTimersByTime(1);
        }
        return chain.head;
    }

    it('a paused+resumed 100-tick run produces identical AuditChain head to a continuous 100-tick run', () => {
        const headContinuous = run(null);
        const headPaused = run(PAUSE_AT);
        expect(headPaused).toBe(headContinuous);
        expect(headPaused).toMatch(/^[0-9a-f]{64}$/);
    });

    it('the paused run timer is actually cleared — no lingering interval firing extra ticks', () => {
        vi.setSystemTime(FIXED_TIME);
        const clock = new WorldClock({ tickRateMs: 10 });
        const ticks: number[] = [];
        clock.onTick((e) => ticks.push(e.tick));

        clock.start();
        clock.advance();
        clock.advance();
        clock.pause();
        // Real timers would normally fire ~100 ticks in 1 second; with the
        // interval cleared we expect exactly zero more listener invocations.
        vi.advanceTimersByTime(1000);
        expect(ticks).toEqual([1, 2]);
        expect(clock.running).toBe(false);
        clock.stop();
    });
});
