// Phase 36 / D-36-05 + D-36-07 — visitor rate-limit 120 req/min per IP.
// Phase 39 / D-39-08 — per-DID rate-limit 600 req/min layered on top of IP bucket.
//
// Behavior:
//   - IP bucket: 60_000 ms window, max 120 req/min per source IP (D-36-05).
//   - DID bucket: 60_000 ms window, max 600 req/min per DID string (D-39-08).
//   - Bucket exhaustion: HTTP 429 + Retry-After header (D-36-07).
//   - Lazy eviction: entries older than 2 windows are cleaned on each check.
//   - IP bucket applies to ALL requests at onRequest (before DID resolution).
//   - DID bucket must be registered AFTER the policy onRequest hook so req.didContext is set.

import type { FastifyInstance } from 'fastify';

/** Rate-limit bucket entry per IP or DID. */
interface Bucket {
    count: number;
    windowStart: number;
}

const WINDOW_MS = 60_000;      // 1 minute
const MAX_REQUESTS = 120;       // D-36-05 — IP bucket
const DID_MAX_REQUESTS = 600;   // D-39-08 — 5× visitor rate for DID-authenticated requests

/** Module-scoped IP bucket map. */
const buckets = new Map<string, Bucket>();

/** Per-DID bucket map. Phase 39 addition. Key = operatorDid or civic DID. */
const didBuckets = new Map<string, Bucket>();

/**
 * Register the visitor rate-limit onRequest hook.
 *
 * Must be registered FIRST in buildServerWithHub — before registerFrozenCheck and
 * before the global policy preHandler. This ensures 429 short-circuit happens before
 * any other processing.
 */
export function registerVisitorRateLimit(app: FastifyInstance): void {
    // Production default is 120/min/IP (D-36-05). Overridable via env for operators
    // who front the Grid with their own edge limiter, and for connection-churn stress
    // tests (the WS leak-guard opens thousands of sockets from one loopback IP).
    const envMax = Number.parseInt(process.env.GRID_IP_RATE_LIMIT_MAX ?? '', 10);
    const maxRequests = Number.isFinite(envMax) && envMax > 0 ? envMax : MAX_REQUESTS;
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

        if (bucket.count > maxRequests) {
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

/**
 * Register the per-DID rate-limit onRequest hook (D-39-08).
 *
 * Must be registered AFTER the policy onRequest hook so req.didContext is populated.
 * DID-authenticated requests get 600 req/min. Anonymous visitors keep the 120/min IP bucket.
 */
export function registerDidRateLimit(app: FastifyInstance): void {
    void app.addHook('onRequest', async (req, reply) => {
        // CORS preflight passes through.
        if (req.method === 'OPTIONS') return;

        const did = req.didContext?.did;
        if (!did) return; // No DID — anonymous visitors are handled by IP bucket

        const now = Date.now();
        const existing = didBuckets.get(did);
        if (!existing || now - existing.windowStart >= WINDOW_MS) {
            didBuckets.set(did, { count: 1, windowStart: now });
            return;
        }
        existing.count += 1;
        if (existing.count > DID_MAX_REQUESTS) {
            const retryAfter = Math.ceil((WINDOW_MS - (now - existing.windowStart)) / 1000);
            reply.header('Retry-After', String(retryAfter));
            return reply.code(429).send({
                error: 'rate_limit_exceeded',
                limit: DID_MAX_REQUESTS,
                window: '1m',
                retry_after_seconds: retryAfter,
            });
        }

        // Lazy eviction: clean up stale DID buckets
        if (didBuckets.size > 5_000) {
            for (const [k, v] of didBuckets) {
                if (now - v.windowStart > WINDOW_MS * 2) didBuckets.delete(k);
            }
        }
    });
}
