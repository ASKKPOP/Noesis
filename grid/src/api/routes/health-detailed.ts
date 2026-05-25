/**
 * /health/detailed REST route — Phase 32 OBS-06 (D-32-C3).
 *
 * GET /health/detailed
 *   200: HealthDetailedPayload { status, timestamp, audit, firehose, clock }
 *   503: { error: 'watchdog_not_ready' } — narrow startup window before
 *        buildServerWithHub calls launcher.attachHealthWatchdog (Pitfall 4).
 *
 * Read-only: zero audit emissions. Pure-pull — does NOT block on DB.
 * Reads cached values from launcher.auditReconcile + firehoseHub.stats().
 * p95 latency target: < 50ms (OBS-06 success criterion 5).
 *
 * Existing /health route at server.ts:284 stays unchanged (Docker
 * healthcheck SLA — kept cheap, no payload).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { GenesisLauncher } from '../../genesis/launcher.js';
import type { ApiError } from '../types.js';

export function registerHealthDetailedRoute(
    app: FastifyInstance,
    _services: GridServices,
    launcher: GenesisLauncher,
): void {
    app.get('/health/detailed', async (_req, reply) => {
        if (!launcher.healthWatchdog) {
            reply.code(503);
            return { error: 'watchdog_not_ready' } satisfies ApiError;
        }
        return launcher.healthWatchdog.snapshot();
    });
}
