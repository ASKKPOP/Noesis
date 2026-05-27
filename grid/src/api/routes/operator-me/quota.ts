/**
 * Phase 39 — GET /api/v1/operator/me/quota
 * Returns per-operator quota usage + limits (D-39-04 / D-39-08).
 * Policy: portal_session_required (D-39-05).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { operatorScope } from '../../preHandlers/operatorScope.js';
import { countActiveByOperator } from '../../../operator/data/operator-brain-store.js';
import { getFullQuota } from '../../../operator/data/operator-quota-store.js';

export async function registerOperatorMeQuotaRoute(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.get('/api/v1/operator/me/quota', async (req, reply) => {
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return; // 403 already sent

        const { pool, gridName } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const current = await countActiveByOperator(pool, gridName, operatorDid);
        const quotaRecord = await getFullQuota(pool, gridName, operatorDid);

        return reply.code(200).send({
            brain_processes: {
                current,
                limit: quotaRecord.brainProcessLimit,
            },
            event_rate: {
                per_did_per_min: quotaRecord.eventRatePerDidPerMin,
                limit: quotaRecord.eventRatePerDidPerMin,
            },
            p2p_bandwidth_cap_bytes: quotaRecord.p2pBandwidthCapBytes,
        });
    });
}
