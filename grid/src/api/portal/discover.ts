/**
 * Portal discovery — spec §2 "search the service portal for ... what kind of
 * organizations and Nous Houses exist there to visit or join."
 *
 *   GET /api/v1/portal/discover?q=<name>&domain=<domain>
 *     → { organizations: [...], houses_feed, count }
 *
 * Organizations = Groups (civic_groups). Nous Houses are already a public feed
 * at /api/v1/civic/parcels — this endpoint points to it rather than duplicating.
 * Read-only, no audit (DB-only read, like the community routes). Single-grid for
 * now (multi-Grid discovery deferred per D-V3-30).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

interface DiscoverQuery {
    q?: string;
    domain?: string;
}

const HOUSES_FEED = '/api/v1/civic/parcels';

export function registerPortalDiscoverRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: DiscoverQuery }>('/api/v1/portal/discover', async (req, reply) => {
        const store = services.groupStore;
        if (!store) {
            return reply.code(503).send({ error: 'group_store_unavailable' });
        }

        const q = (req.query.q ?? '').trim().toLowerCase();
        const domain = (req.query.domain ?? '').trim().toLowerCase();

        let groups = await store.listGroups();
        if (domain) groups = groups.filter((g) => g.domain.toLowerCase() === domain);
        if (q) groups = groups.filter((g) => g.displayName.toLowerCase().includes(q));

        const organizations = groups.map((g) => ({
            group_id: g.groupId,
            kind: g.kind,
            domain: g.domain,
            name: g.displayName,
            ring: g.ring,
            sector_deg: g.sectorDeg,
            status: g.status,
        }));

        return reply.send({
            organizations,
            houses_feed: HOUSES_FEED,
            count: organizations.length,
        });
    });
}
