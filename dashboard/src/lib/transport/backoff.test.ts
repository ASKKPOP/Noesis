/**
 * Tests for full-jitter exponential backoff.
 *
 * Formula under test:
 *   delay = Math.random() * Math.min(MAX_DELAY_MS, BASE_MS * 2^attempt)
 *
 * Per AWS Architecture Blog (Exponential Backoff And Jitter, 2015):
 *   full-jitter is the simplest bound-preserving jitter strategy and
 *   gives the best avoidance of thundering-herd reconnect storms.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { BASE_MS, MAX_DELAY_MS, nextDelayMs } from './backoff';

describe('nextDelayMs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a value in [0, min(MAX_DELAY_MS, BASE_MS * 2^attempt))', () => {
        // Math.random -> 0 gives the lower bound exactly.
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        for (let attempt = 0; attempt <= 20; attempt += 1) {
            expect(nextDelayMs(attempt)).toBe(0);
        }
        random.mockReturnValue(0.999999);
        for (let attempt = 0; attempt <= 20; attempt += 1) {
            const ceiling = Math.min(MAX_DELAY_MS, BASE_MS * 2 ** attempt);
            const got = nextDelayMs(attempt);
            expect(got).toBeGreaterThanOrEqual(0);
            expect(got).toBeLessThan(ceiling);
            if (attempt >= 7) {
                // 250 * 2^7 = 32_000 > MAX_DELAY_MS, so ceiling is clamped.
                expect(ceiling).toBe(MAX_DELAY_MS);
            }
        }
    });

    it('clamps ceiling at exactly 30_000 ms', () => {
        expect(MAX_DELAY_MS).toBe(30_000);
        // Return 1 to probe the absolute upper edge of the formula (even
        // though Math.random is documented as [0,1), our implementation
        // must behave sanely if a mock returns the closed upper bound).
        vi.spyOn(Math, 'random').mockReturnValue(1);
        for (const attempt of [10, 20, 50]) {
            expect(nextDelayMs(attempt)).toBeLessThanOrEqual(MAX_DELAY_MS);
        }
    });

    it('keeps attempt=0 bounded at [0, BASE_MS) across many samples', () => {
        // No mock — exercise real Math.random for statistical confidence.
        for (let i = 0; i < 1000; i += 1) {
            const d = nextDelayMs(0);
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThan(BASE_MS);
        }
    });

    it('throws TypeError for negative, NaN, or non-integer attempts', () => {
        expect(() => nextDelayMs(-1)).toThrow(TypeError);
        expect(() => nextDelayMs(Number.NaN)).toThrow(TypeError);
        expect(() => nextDelayMs(1.5)).toThrow(TypeError);
        expect(() => nextDelayMs(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    });
});
