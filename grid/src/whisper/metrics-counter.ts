/**
 * WhisperMetricsCounter — monotonic counters for the whisper pipeline.
 *
 * Phase 11 Wave 3 — WHISPER-05 / D-11-08.
 *
 * Tracks three counters incremented by WhisperRouter:
 *   emitted           — envelopes successfully accepted (audit emitted + enqueued)
 *   rate_limited      — envelopes silently dropped by TickRateLimiter
 *   tombstone_dropped — envelopes silently dropped because sender OR recipient is tombstoned
 *
 * Exposed via GET /api/v1/whispers/metrics (Wave 3 routes).
 *
 * Design notes:
 *   - Dep is OPTIONAL on WhisperRouterDeps to preserve W2 backward compat.
 *     WhisperRouter calls metricsCounter?.increment(...) with optional chaining.
 *   - In-process only — intentionally ephemeral (restart clears counters).
 *   - reset() is provided for test teardown only; never called in production.
 *
 * NO Date.now, NO Math.random (wall-clock ban per D-11-13).
 * See: 11-CONTEXT.md D-11-08, WHISPER-05. routes.ts for the metrics endpoint.
 */

export class WhisperMetricsCounter {
    private counters = { emitted: 0, rate_limited: 0, tombstone_dropped: 0 };

    /**
     * Increment one of the three counters.
     * Called by WhisperRouter at each terminal branch.
     */
    increment(key: 'emitted' | 'rate_limited' | 'tombstone_dropped'): void {
        this.counters[key]++;
    }

    /**
     * Return a shallow copy of the current counter state.
     * Calling snapshot() does NOT reset any counter.
     */
    snapshot(): { emitted: number; rate_limited: number; tombstone_dropped: number } {
        return { ...this.counters };
    }

    /**
     * Reset all counters to zero. Test teardown only — never call in production.
     */
    reset(): void {
        this.counters = { emitted: 0, rate_limited: 0, tombstone_dropped: 0 };
    }
}
