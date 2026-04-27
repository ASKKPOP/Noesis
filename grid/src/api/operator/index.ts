/**
 * Operator routes barrel — wires all /api/v1/operator/* handlers.
 *
 * Called once by buildServerWithHub (src/api/server.ts). Individual route
 * registrars are colocated in this subtree per CONTEXT 06's Claude's
 * Discretion bullet 4: keep operator endpoints isolated from Phase 4's
 * inspector/economy routes so the AGENCY-03 producer-boundary invariant
 * (all operator.* writes go through appendOperatorEvent) stays auditable
 * via a single directory scan.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { registerClockOperatorRoutes } from './clock-pause-resume.js';
import { registerGovernanceOperatorRoutes } from './governance-laws.js';
import { registerMemoryQueryRoute } from './memory-query.js';
import { registerTelosForceRoute } from './telos-force.js';
import { registerDeleteNousRoute } from './delete-nous.js';
import { relationshipsRoutes } from './relationships.js';
import { registerReplayExportRoute } from './export-replay.js';

export function registerOperatorRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    registerClockOperatorRoutes(app, services);
    registerGovernanceOperatorRoutes(app, services);
    registerMemoryQueryRoute(app, services);
    registerTelosForceRoute(app, services);
    // Phase 8 AGENCY-05: H5 Sovereign Operations — Nous deletion.
    registerDeleteNousRoute(app, services);
    // Phase 9 REL-04: Relationship graph endpoints (H1/H2/H5 tier-graded).
    relationshipsRoutes(app, services);
    // Phase 13 REPLAY-02: H5 Sovereign Operations — operator replay export.
    registerReplayExportRoute(app, services);
}
