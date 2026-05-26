// Phase 36 / D-36-05 + D-36-07 — visitor rate-limit 120 req/min per IP.
// In-process Map; single-server v3.0 scope.
// Phase 39 will refactor to per-DID buckets + multi-instance backend.
//
// Behavior:
//   - Window: 60_000 ms (1 minute), max 120 requests per source IP.
//   - Bucket exhaustion: HTTP 429 + Retry-After header (D-36-07).
//   - Lazy eviction: entries older than 2 windows are cleaned on each check.
//   - Applies to ALL requests at onRequest (before preHandler/DID resolution).
//   - Phase 39: refactor to per-DID buckets (DID holders get higher limits).

import type { FastifyInstance } from 'fastify';

/** Rate-limit bucket entry per IP. */
interface Bucket {
    count: number;
    windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // D-36-05

/** Module-scoped IP bucket map. Phase 39 replaces with per-DID buckets. */
const buckets = new Map<string, Bucket>();

/**
 * Register the visitor rate-limit onRequest hook.
 *
 * Must be registered FIRST in buildServerWithHub — before registerFrozenCheck and
 * before the global policy preHandler. This ensures 429 short-circuit happens before
 * any other processing.
 */
export function registerVisitorRateLimit(app: FastifyInstance): void {
    void app.addHook('onRequest', async (req, reply) => {
        // CORS preflight passes through (no client content to rate-limit).
        if (req.method === 'OPTIONS') return;

        const ip = req.ip ?? '0.0.0.0';
        const now = Date.now();

        // Lazy eviction: clean stale buckets older than 2 windows on each access.
        for (const [key, bucket] of buckets) {
            if (now - bucket.windowStart > WINDOW_MS * 2) {
                buckets.delete(key);
            }
        }

        const bucket = buckets.get(ip);

        if (!bucket || now - bucket.windowStart > WINDOW_MS) {
            // New window or first request from this IP.
            buckets.set(ip, { count: 1, windowStart: now });
            return;
        }

        // Within existing window.
        bucket.count++;

        if (bucket.count > MAX_REQUESTS) {
            // Rate limit exceeded — compute seconds remaining in window.
            const windowElapsedMs = now - bucket.windowStart;
            const secondsRemaining = Math.ceil((WINDOW_MS - windowElapsedMs) / 1000);

            reply.header('Retry-After', String(secondsRemaining));
            return reply.code(429).send({
                error: 'rate_limit_exceeded',
                retry_after: secondsRemaining,
            });
        }
    });
}
