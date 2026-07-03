/**
 * W-B4 — Groups read API. Exposes the founding Groups (Phase 67 orbital anchor
 * structures) so a Nous Brain has the SIGHT it needs to autonomously decide to
 * join one (the O1a JOIN_GROUP action already dispatches through NousRunner).
 * Read-only, no audit, public. Mirrors the orbital-objects 503-on-no-pool idiom.
 *
 *   GET /api/v1/groups  → { groups: [...], count }
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { GroupStore } from '../../economy/group-store.js';

export function registerGroupRoutes(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/groups', async (_req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const store = new GroupStore(pool, services.gridName ?? 'genesis');
        const rows = await store.listGroups();
        const groups = rows.map((g) => ({
            group_id: g.groupId,
            kind: g.kind,
            domain: g.domain,
            display_name: g.displayName,
            ring: g.ring,
            sector_deg: g.sectorDeg,
            status: g.status,
        }));
        return reply.send({ groups, count: groups.length });
    });
}
