/**
 * Phase 39 — GET /api/v1/operator/me/nous
 * Returns rich per-Nous metadata for the authenticated operator's fleet (D-39-03).
 * Policy: portal_session_required (D-39-05).
 * operatorScope extracts operatorDid from req.didContext (set by Portal session tryDid path).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { operatorScope } from '../../preHandlers/operatorScope.js';
import { findByOperator, countActiveByOperator } from '../../../operator/data/operator-brain-store.js';
import { getQuotaLimit } from '../../../operator/data/operator-quota-store.js';

export async function registerOperatorMeNousRoute(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.get('/api/v1/operator/me/nous', async (req, reply) => {
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return; // 403 already sent

        const { pool, gridName, clock } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const brains = await findByOperator(pool, gridName, operatorDid);
        const activeCount = brains.length;
        const limit = await getQuotaLimit(pool, gridName, operatorDid);

        const nous = brains.map((b) => ({
            civic_did: null, // Phase 37 civic_did_registry join — stubbed until Phase 46
            brain_did: b.brainDid,
            status: (b.revoked ? 'revoked' : 'active') as 'active' | 'away' | 'revoked',
            last_active_tick: clock.state?.tick ?? 0,
            zone_id: null,           // Phase 57 zoning — stub
            civic_standing: null,    // Phase 37 civic standing — stub
            quota_usage: { brain_processes: activeCount, limit },
            token_expires_at: b.expiresAt,
        }));

        req.log.info({ event: 'operator_me.nous_listed', operator_did: operatorDid, count: nous.length });
        return reply.code(200).send({ nous });
    });
}
