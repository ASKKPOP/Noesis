/**
 * Phase 39/40 — Operator fleet management routes (D-39-04)
 * Registers all operator/me/* routes.
 * Portal session routes (D-39-05): nous, brains, quota, settings.
 * Brain JWT route (D-40-01): brain-settings (uses its own Bearer auth).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { registerOperatorMeNousRoute } from './nous.js';
import { registerOperatorMeBrainsRoute } from './brains.js';
import { registerOperatorMeQuotaRoute } from './quota.js';
import { registerOperatorMeSettingsRoutes } from './settings.js';
import { registerOperatorMeBrainSettingsRoutes } from './brain-settings.js';

export async function registerOperatorMeRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    await registerOperatorMeNousRoute(app, services);
    await registerOperatorMeBrainsRoute(app, services);
    await registerOperatorMeQuotaRoute(app, services);
    await registerOperatorMeSettingsRoutes(app, services);
    await registerOperatorMeBrainSettingsRoutes(app, services);
}
