/**
 * Tick-metrics REST route — Phase 25a-04 OBS-BRAIN-HEALTH.
 *
 * GET /api/v1/nous/:did/tick-metrics
 *   200: { p50, p95, queue_depth, sample_count }   // durations in ms
 *   400: { error: 'invalid_did' }
 *   404: { error: 'unknown_nous' }
 *
 * Read-only: zero audit emissions. Backed by NousRunner.tickLatencyBuffer
 * (in-memory RingBuffer<number>(100), drop-oldest eviction).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';

export function registerTickMetricsRoute(app: FastifyInstance, services: GridServices): void {
    app.get<{ Params: { did: string } }>(
        '/api/v1/nous/:did/tick-metrics',
        async (req, reply) => {
            const { did } = req.params;

            if (!DID_REGEX.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            const runner = services.getRunner ? services.getRunner(did) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }

            if (typeof runner.getTickMetrics !== 'function') {
                // Runner exists but predates Phase 25a — return zero metrics gracefully.
                return { p50: 0, p95: 0, queue_depth: 0, sample_count: 0 };
            }

            return runner.getTickMetrics();
        },
    );
}
