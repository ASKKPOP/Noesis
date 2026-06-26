/**
 * Phase 55 Portal Cross-Grid Framework (DORMANT in v3.0) — read endpoints + a 503 stub.
 *
 * Only Genesis is active in v3.0, so identity/grid reads return at most [Genesis] and the
 * marketplace-mediation endpoint returns 503 not_yet_active. The dormant cross-Grid producers
 * are NOT imported here (they stay unreachable; check-cross-grid-dormant.mjs enforces it).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { CROSS_GRID_DORMANT_REASON } from '../../portal-workflows/cross-grid-types.js';

export function registerPortalCrossGridRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';

    // Grids where an account holds a Civic-DID — v3.0 returns at most [Genesis].
    app.get<{ Params: { accountDid: string } }>(
        '/portal/api/v1/nous/:accountDid/grids',
        async (_req, reply) => reply.code(200).send({ grids: [{ grid_name: grid }], dormant: true }),
    );

    // Cross-Grid identity resolution — existence-DID profile + Civic-DIDs (Genesis only in v3.0).
    app.get<{ Params: { existenceDid: string } }>(
        '/portal/api/v1/identity/:existenceDid',
        async (req, reply) => reply.code(200).send({ existence_did: req.params.existenceDid, civic_dids: [{ grid_name: grid }], dormant: true }),
    );

    // Marketplace mediation — DORMANT in v3.0: contract surface only.
    app.post(
        '/portal/api/v1/cross-grid/marketplace/quote',
        async (_req, reply) => reply.code(503).send({ error: CROSS_GRID_DORMANT_REASON, detail: 'cross-Grid marketplace activates in v3.1+' }),
    );

    // Federated audit aggregation — v3.0 returns Genesis-scoped only.
    app.get(
        '/portal/api/v1/audit/cross-grid',
        async (_req, reply) => reply.code(200).send({ grids: [grid], timeline: [], dormant: true }),
    );
}
