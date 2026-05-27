/**
 * Phase 39 — Operator fleet management routes (D-39-04)
 * Registers all 5 operator/me/* routes.
 * All routes are portal_session_required (D-39-05).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { registerOperatorMeNousRoute } from './nous.js';
import { registerOperatorMeBrainsRoute } from './brains.js';
import { registerOperatorMeQuotaRoute } from './quota.js';
import { registerOperatorMeSettingsRoutes } from './settings.js';

export async function registerOperatorMeRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    await registerOperatorMeNousRoute(app, services);
    await registerOperatorMeBrainsRoute(app, services);
    await registerOperatorMeQuotaRoute(app, services);
    await registerOperatorMeSettingsRoutes(app, services);
}
