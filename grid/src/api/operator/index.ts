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
// Plan 05 will add memory + telos operator routes.

export function registerOperatorRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    registerClockOperatorRoutes(app, services);
    registerGovernanceOperatorRoutes(app, services);
    // registerMemoryQueryRoute(app, services);          -- Plan 05
    // registerTelosForceRoute(app, services);           -- Plan 05
}
