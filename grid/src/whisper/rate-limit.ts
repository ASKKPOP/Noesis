/**
 * TickRateLimiter — tick-indexed per-sender sliding-window rate limit.
 *
 * Phase 11 WHISPER-05 / D-11-08 / CONTEXT-11.
 *
 * Primary rate-limit for whisper sends: B sends per N ticks per sender DID.
 * Defaults: B=10 (rateBudget), N=100 (rateWindowTicks).
 * Env-overridable via WHISPER_RATE_BUDGET / WHISPER_RATE_WINDOW_TICKS
 * (read from WHISPER_CONFIG, set at module import time).
 *
 * @fastify/rate-limit is the seconds-based DDoS belt mounted by routes.ts
 * (Wave 3). This module is the tick-indexed primary that enforces the
 * zero-wall-clock invariant — the authoritative rate-limit for replay safety.
 *
 * Clones grid/src/dialogue/aggregator.ts per-key Map + sliding-window prune
 * pattern (Phase 7). Pause-safe clone: reset() wipes all history when
 * WorldClock pauses (Phase 7 D-04).
 *
 * NO Date.now, NO Math.random, NO performance.now, NO setTimeout, NO setInterval.
 * Wall-clock ban enforced by scripts/check-wallclock-forbidden.mjs (TIER_B_TS_ROOTS
 * includes grid/src/whisper). Only @fastify/rate-limit (third-party boundary)
 * is permitted to use Date.now internally.
 *
 * See: 11-CONTEXT.md D-11-07, D-11-08. scripts/check-wallclock-forbidden.mjs.
 */

import { WHISPER_CONFIG } from './config.js';

export interface WhisperConfig {
    readonly rateBudget: number;
    readonly rateWindowTicks: number;
    readonly envelopeVersion: number;
}

/**
 * Tick-indexed sliding-window rate limiter.
 *
 * Per-sender history: Map<senderDid, number[]> where each number is a tick
 * at which a send was accepted. On tryConsume, entries older than
 * (currentTick - cfg.rateWindowTicks) are pruned first, then budget is checked.
 */
export class TickRateLimiter {
    private readonly history = new Map<string, number[]>();

    constructor(private readonly cfg: WhisperConfig = WHISPER_CONFIG) {}

    /**
     * Attempt to consume one unit of the sender's budget.
     *
     * Prunes entries with tick <= (currentTick - cfg.rateWindowTicks) first.
     * Returns true and records the tick if count < cfg.rateBudget.
     * Returns false (without recording) if budget is exhausted.
     */
    tryConsume(senderDid: string, currentTick: number): boolean {
        const cutoff = currentTick - this.cfg.rateWindowTicks;
        const prev = this.history.get(senderDid) ?? [];
        // Prune entries at or before the cutoff (strictly older than the window).
        // Entries where tick > cutoff are within the window.
        const pruned = prev.filter(t => t > cutoff);

        if (pruned.length >= this.cfg.rateBudget) {
            // Persist prune even on rejection so next call doesn't re-scan.
            this.history.set(senderDid, pruned);
            return false;
        }

        pruned.push(currentTick);
        this.history.set(senderDid, pruned);
        return true;
    }

    /**
     * Wipe all sender history.
     *
     * Called when WorldClock pauses (Phase 7 D-04 pause-safe clone).
     * Prevents rate-limit windows from spanning pause/resume boundaries.
     */
    reset(): void {
        this.history.clear();
    }
}
