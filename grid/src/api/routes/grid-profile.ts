/**
 * Grid identity profile route (D-V3-40).
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts. On a private Grid the
 * private-Grid gate limits it to members, like every other public read.
 *
 * GET /api/v1/grid/profile
 *   200: {grid, window_size, actions, activities: [{activity, count, share}], previous}
 *
 * A read-only projection over the audit chain — see identity/grid-profile.ts. Counts only.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { gridProfile } from '../../identity/grid-profile.js';

export function registerGridProfileRoute(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/grid/profile', async (_req, reply) => {
        if (!services.audit) return reply.code(503).send({ error: 'profile_unavailable' });
        return reply.code(200).send({ grid: services.gridName ?? 'genesis', ...gridProfile(services.audit) });
    });
}
