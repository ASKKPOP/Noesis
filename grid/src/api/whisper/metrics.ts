/**
 * GET /api/v1/whispers/metrics — counts-only metrics handler.
 *
 * Phase 11 Wave 3 — WHISPER-05 / D-11-08.
 *
 * Returns:
 *   {
 *     total_pending: number,
 *     per_did_counts: Record<string, number>,   // DID → envelope count
 *     total_emitted: number,
 *     total_rate_limited: number,
 *     total_tombstone_dropped: number,
 *   }
 *
 * CRITICAL PRIVACY:
 *   - ZERO hashes in response body
 *   - ZERO ciphertext in response body
 *   - ZERO envelope_ids in response body
 *   - per_did_counts keys ARE DIDs (observable) but values are INTEGERS ONLY
 *
 * NO Date.now, NO Math.random (wall-clock ban per D-11-13).
 * See: 11-CONTEXT.md D-11-08, WHISPER-05. routes.ts for loopback hook.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { WhisperRouteDeps } from './routes.js';

/**
 * Build Fastify handler for GET /api/v1/whispers/metrics.
 */
export function metricsHandler(deps: WhisperRouteDeps) {
    return async (
        _req: FastifyRequest,
        _reply: FastifyReply,
    ) => {
        const snap = deps.metricsCounter.snapshot();
        const per_did_counts = deps.pendingStore.allDidsWithCounts();
        const total_pending = deps.pendingStore.size();

        return {
            total_pending,
            per_did_counts,
            total_emitted: snap.emitted,
            total_rate_limited: snap.rate_limited,
            total_tombstone_dropped: snap.tombstone_dropped,
        };
    };
}
