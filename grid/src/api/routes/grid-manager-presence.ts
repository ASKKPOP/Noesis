/**
 * Phase 41 SLEEP-02 — Tier-2 Grid Manager presence overview endpoint.
 * Used by Steward Console /system/operators Section 4.
 * Policy: portal_session_required (Phase 39 pattern).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

interface PresenceOverviewRow {
    operator_did: string | null;
    civic_did: string;
    nous_name: string | null;
    presence_status: string;
    last_seen_at: string | null;
    queue_depth: number;
}

export async function registerGridManagerPresenceRoute(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.get('/api/v1/grid-manager/presence-overview', async (_req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const records = await svc.listAllPresence();
        const queueDepths = await svc.queueDepthByRecipient();

        // Map civic_did → operator_did via brain_tokens
        const gridName = services.gridName ?? 'genesis';
        const [rows] = await pool.query<import('mysql2').RowDataPacket[]>(
            `SELECT bt.civic_did, bt.operator_did
             FROM brain_tokens bt
             WHERE bt.grid_name = ?
             GROUP BY bt.civic_did, bt.operator_did`,
            [gridName],
        );
        const operatorByCivic: Record<string, string | null> = {};
        for (const r of rows) {
            operatorByCivic[r.civic_did as string] = (r.operator_did as string | null) ?? null;
        }

        // Only non-awake OR queue_depth > 0
        const overview: PresenceOverviewRow[] = [];
        for (const rec of records) {
            const queueDepth = queueDepths[rec.civicDid] ?? 0;
            if (rec.presenceStatus === 'awake' && queueDepth === 0) continue;
            overview.push({
                operator_did: operatorByCivic[rec.civicDid] ?? null,
                civic_did: rec.civicDid,
                nous_name: null,
                presence_status: rec.presenceStatus,
                last_seen_at: rec.lastSeenAt ? rec.lastSeenAt.toISOString() : null,
                queue_depth: queueDepth,
            });
        }

        return reply.code(200).send({ presence_summary: overview });
    });
}
