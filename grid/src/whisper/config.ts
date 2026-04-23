/**
 * Whisper rate-limit constants (Phase 11 / D-11-08 / WHISPER-05).
 *
 * Tick-indexed primary rate limit: B sends per N ticks, per sender DID.
 * Env-overridable via WHISPER_RATE_BUDGET and WHISPER_RATE_WINDOW_TICKS.
 *
 * Clones grid/src/relationships/config.ts Object.freeze pattern (Phase 9).
 *
 * NO Date.now, NO Math.random — wall-clock ban per D-11-13 and
 * scripts/check-wallclock-forbidden.mjs (TIER_B_TS_ROOTS includes grid/src/whisper).
 */

const envBudget = Number.parseInt(process.env.WHISPER_RATE_BUDGET ?? '', 10);
const envWindow = Number.parseInt(process.env.WHISPER_RATE_WINDOW_TICKS ?? '', 10);

if (process.env.WHISPER_RATE_BUDGET !== undefined && process.env.WHISPER_RATE_BUDGET !== '') {
    if (!Number.isInteger(envBudget) || envBudget <= 0) {
        console.warn(
            `[whisper/config] WHISPER_RATE_BUDGET="${process.env.WHISPER_RATE_BUDGET}" is not a positive integer — using default 10`,
        );
    }
}
if (process.env.WHISPER_RATE_WINDOW_TICKS !== undefined && process.env.WHISPER_RATE_WINDOW_TICKS !== '') {
    if (!Number.isInteger(envWindow) || envWindow <= 0) {
        console.warn(
            `[whisper/config] WHISPER_RATE_WINDOW_TICKS="${process.env.WHISPER_RATE_WINDOW_TICKS}" is not a positive integer — using default 100`,
        );
    }
}

export const WHISPER_CONFIG = Object.freeze({
    rateBudget: Number.isInteger(envBudget) && envBudget > 0 ? envBudget : 10,
    rateWindowTicks: Number.isInteger(envWindow) && envWindow > 0 ? envWindow : 100,
    envelopeVersion: 1,
} as const);
