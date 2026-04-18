/**
 * Full-jitter exponential backoff per AWS Architecture Blog.
 * delay = Math.random() * Math.min(MAX_DELAY_MS, BASE_MS * 2^attempt)
 * Range [0, ceiling) — 0 is allowed (immediate retry) per the full-jitter
 * definition; total thundering-herd avoidance relies on Math.random being
 * independent across clients.
 *
 * Reference: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */

export const MAX_DELAY_MS = 30_000;
export const BASE_MS = 250;

export function nextDelayMs(attempt: number): number {
    if (!Number.isInteger(attempt) || attempt < 0) {
        throw new TypeError(`attempt must be a non-negative integer, got ${attempt}`);
    }
    // Clamp 2^attempt to avoid Number overflow at extreme attempt counts.
    // Math.pow(2, 50) ≈ 1.1e15 — already far above MAX_DELAY_MS / BASE_MS,
    // so clamping at 50 is safe and cheap.
    const exp = Math.min(attempt, 50);
    const ceiling = Math.min(MAX_DELAY_MS, BASE_MS * (2 ** exp));
    return Math.random() * ceiling;
}
