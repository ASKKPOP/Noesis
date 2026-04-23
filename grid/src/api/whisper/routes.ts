/**
 * Whisper API routes — Fastify plugin mounting the whisper endpoint suite.
 *
 * Phase 11 Wave 3 — WHISPER-01 / WHISPER-05 / WHISPER-06 / D-11-08.
 *
 * Mounts four routes:
 *   POST  /api/v1/nous/:did/whisper/send     — encrypt-and-route (loopback only)
 *   GET   /api/v1/nous/:did/whispers/pending — snapshot pull (loopback only)
 *   POST  /api/v1/nous/:did/whispers/ack     — ack-delete (loopback only)
 *   GET   /api/v1/whispers/metrics           — counts-only metrics (loopback only)
 *
 * Security:
 *   ALL routes are loopback-only (127.0.0.1 / ::1). Non-loopback callers
 *   receive 403 { error: 'loopback_only' }. Only the local Brain may call
 *   these routes — they are not exposed to LAN/WAN.
 *
 * Rate limiting:
 *   @fastify/rate-limit must be registered at the TOP LEVEL Fastify instance
 *   BEFORE this plugin is registered. The send route uses config.rateLimit
 *   to set a 60/min per-sender-DID limit. Other routes disable rate-limiting.
 *
 *   Reason: @fastify/rate-limit cannot be nested inside a scoped Fastify plugin
 *   and have inject() work correctly in test environments (Fastify v5 encapsulation).
 *   The parent app must register it at the top level.
 *
 *   This is the wall-clock DDoS belt (secondary). TickRateLimiter inside
 *   WhisperRouter is the tick-indexed primary (D-11-08).
 *
 * NOTE on the 429 vs silent-drop tension:
 *   The send handler returns 429 when TickRateLimiter rejects. This is acceptable
 *   because the caller is the local Brain (loopback) — it's not a remote attacker
 *   probing for tombstone state. Tombstone-of-RECIPIENT remains silent (202 w/ synthetic
 *   envelope_id per D-11-18). The 429 is INFORMATIONAL metadata to the local Brain only.
 *
 * See: 11-CONTEXT.md D-11-08, D-11-18, D-11-19. WHISPER-01/05/06.
 *
 * NO Date.now, NO Math.random, NO setTimeout, NO setInterval (wall-clock ban D-11-13).
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { WhisperRouter } from '../../whisper/router.js';
import type { PendingStore } from '../../whisper/pending-store.js';
import type { WhisperRegistry } from '../../whisper/router.js';
import type { WhisperMetricsCounter } from '../../whisper/metrics-counter.js';
import { sendHandler } from './send.js';
import { pendingHandler } from './pending.js';
import { ackHandler } from './ack.js';
import { metricsHandler } from './metrics.js';

export interface WhisperRouteDeps {
    readonly whisperRouter: WhisperRouter;
    readonly pendingStore: PendingStore;
    readonly registry: WhisperRegistry;
    readonly worldClock: { currentTick(): number };
    readonly metricsCounter: WhisperMetricsCounter;
}

/**
 * Loopback guard — reject non-loopback callers with 403.
 * Applied as an onRequest hook to ALL routes in this plugin.
 */
function loopbackOnly(req: FastifyRequest, reply: { code(n: number): void; send(v: unknown): void }): void {
    const ip = req.ip;
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        reply.code(403);
        reply.send({ error: 'loopback_only' });
    }
}

/**
 * Fastify plugin registering all whisper HTTP routes.
 *
 * IMPORTANT: @fastify/rate-limit MUST be registered on the parent Fastify instance
 * before calling app.register(whisperRoutes, ...). The send route configures
 * per-route rate-limit via config.rateLimit. Other routes opt-out via config.rateLimit: false.
 *
 * Usage:
 *   await app.register(fastifyRateLimit, { max: 60, timeWindow: '1 minute', ... });
 *   await app.register(whisperRoutes, { deps: { whisperRouter, pendingStore, ... } });
 */
export const whisperRoutes: FastifyPluginAsync<{ deps: WhisperRouteDeps }> = async (
    fastify,
    { deps },
) => {
    // Loopback guard applied to every route in this plugin scope.
    fastify.addHook('onRequest', loopbackOnly);

    // POST /api/v1/nous/:did/whisper/send
    // Rate-limited at 60/min per sender DID via @fastify/rate-limit route config.
    // Parent app must have registered @fastify/rate-limit at top level.
    fastify.post<{ Params: { did: string } }>(
        '/api/v1/nous/:did/whisper/send',
        {
            config: {
                rateLimit: {
                    max: 60,
                    timeWindow: '1 minute',
                    keyGenerator: (req: FastifyRequest) => (req.params as { did?: string }).did ?? req.ip,
                },
            },
        },
        sendHandler(deps),
    );

    // GET /api/v1/nous/:did/whispers/pending — no rate limit (loopback pull only).
    fastify.get<{ Params: { did: string } }>(
        '/api/v1/nous/:did/whispers/pending',
        { config: { rateLimit: false } },
        pendingHandler(deps),
    );

    // POST /api/v1/nous/:did/whispers/ack — no rate limit (loopback ack only).
    fastify.post<{ Params: { did: string } }>(
        '/api/v1/nous/:did/whispers/ack',
        { config: { rateLimit: false } },
        ackHandler(deps),
    );

    // GET /api/v1/whispers/metrics — no rate limit (operator monitoring).
    fastify.get(
        '/api/v1/whispers/metrics',
        { config: { rateLimit: false } },
        metricsHandler(deps),
    );
};
