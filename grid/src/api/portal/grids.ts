/**
 * Portal Grid discovery — spec §2 "search the service portal for currently
 * active Grids — what kind of organizations and Nous Houses exist there."
 *
 *   GET /api/v1/portal/grids?q=<name>
 *     → { grids: [...], count }
 *
 * The meta-layer index of active Grids. v3.0 returns one (Genesis); the shape
 * supports federation later. Read-only, no audit, public.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

interface GridsQuery {
    q?: string;
}

export function registerPortalGridsRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: GridsQuery }>('/api/v1/portal/grids', async (req, reply) => {
        const registry = services.gridRegistry;
        if (!registry) {
            return reply.code(503).send({ error: 'grid_registry_unavailable' });
        }

        const q = (req.query.q ?? '').trim().toLowerCase();
        let grids = registry.active();
        if (q) grids = grids.filter((g) => g.name.toLowerCase().includes(q));

        return reply.send({
            grids: grids.map((g) => ({
                grid_id: g.gridId,
                name: g.name,
                grid_domain: g.gridDomain,
                polis: g.polisName,
                description: g.description,
                status: g.status,
                celestial_body: g.environment.name,
                environment: g.environment,
            })),
            count: grids.length,
        });
    });
}
