/**
 * WhisperMetricsCounter — in-memory tally for whisper route metrics.
 *
 * Phase 11 Wave 3 — GET /api/v1/whispers/metrics endpoint.
 *
 * Tracks three monotonic counters:
 *   emitted         — envelopes accepted and emitted by WhisperRouter
 *   rate_limited    — envelopes rejected by TickRateLimiter
 *   tombstone_dropped — envelopes silently dropped due to sender/recipient tombstone
 *
 * PRIVACY:
 *   - Zero hashes, zero ciphertext, zero envelope_ids tracked here.
 *   - Counts only (integers).
 *
 * NO Date.now, NO Math.random — wall-clock ban per D-11-13.
 * See: 11-CONTEXT.md D-11-08, WHISPER-05.
 */

export type WhisperMetricKey = 'emitted' | 'rate_limited' | 'tombstone_dropped';

export class WhisperMetricsCounter {
    private counters: { emitted: number; rate_limited: number; tombstone_dropped: number } = {
        emitted: 0,
        rate_limited: 0,
        tombstone_dropped: 0,
    };

    /**
     * Increment a named counter by 1.
     */
    increment(key: WhisperMetricKey): void {
        this.counters[key]++;
    }

    /**
     * Return a frozen snapshot of all counters.
     */
    snapshot(): { emitted: number; rate_limited: number; tombstone_dropped: number } {
        return { ...this.counters };
    }

    /**
     * Reset all counters to zero (test teardown).
     */
    reset(): void {
        this.counters = { emitted: 0, rate_limited: 0, tombstone_dropped: 0 };
    }
}
