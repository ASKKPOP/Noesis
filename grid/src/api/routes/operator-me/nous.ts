/**
 * Phase 39 — GET /api/v1/operator/me/nous
 * Returns rich per-Nous metadata for the authenticated operator's fleet (D-39-03).
 * Policy: portal_session_required (D-39-05).
 * operatorScope extracts operatorDid from req.didContext (set by Portal session tryDid path).
 *
 * Phase 44 D-44-08 — Added top-level `business_did` field (oldest active Business-DID for
 * this operator, or null). Join path: brain_tokens.operator_did → brain_tokens.brain_did →
 * civic_did_registry.existence_did → business_did_registry.civic_did.
 * NOTE: civic_did_registry does NOT have an operator_did column (schema v23–v32);
 * the bridge is brain_tokens (schema v27: operator_did column).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { operatorScope } from '../../preHandlers/operatorScope.js';
import { findByOperator, countActiveByOperator } from '../../../operator/data/operator-brain-store.js';
import { getQuotaLimit } from '../../../operator/data/operator-quota-store.js';
import type { RowDataPacket } from 'mysql2/promise';

interface BusinessDidRow extends RowDataPacket {
    business_did: string;
}

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

        // Phase 44 D-44-08 — Fetch oldest active Business-DID for this operator.
        // Join path: brain_tokens (operator_did) → civic_did_registry (existence_did) →
        //            business_did_registry (civic_did).
        // civic_did_registry has no operator_did column (schema v23–v32); bridge via brain_tokens v27.
        let businessDid: string | null = null;
        try {
            const [rows] = await pool.query<BusinessDidRow[]>(
                `SELECT bd.business_did
                 FROM business_did_registry bd
                 JOIN civic_did_registry cd ON cd.civic_did = bd.civic_did
                                           AND cd.grid_name = bd.grid_name
                 JOIN brain_tokens bt ON bt.brain_did = cd.existence_did
                                     AND bt.grid_name = cd.grid_name
                 WHERE bd.grid_name = ?
                   AND bd.status = 'active'
                   AND cd.status = 'active'
                   AND bt.grid_name = ?
                   AND bt.operator_did = ?
                 ORDER BY bd.issued_at_tick ASC
                 LIMIT 1`,
                [gridName, gridName, operatorDid],
            );
            businessDid = rows[0]?.business_did ?? null;
        } catch (err) {
            // Non-fatal: business_did registry may not be populated yet.
            req.log.warn({ event: 'operator_me.business_did_lookup_failed', err }, 'business_did lookup failed — returning null');
        }

        req.log.debug(
            { event: 'operator_me.business_did_resolved', found: businessDid !== null },
            'business_did resolved for operator',
        );
        req.log.info({ event: 'operator_me.nous_listed', operator_did: operatorDid, count: nous.length });
        return reply.code(200).send({
            nous,
            business_did: businessDid ?? null,  // Phase 44 D-44-08
        });
    });
}
