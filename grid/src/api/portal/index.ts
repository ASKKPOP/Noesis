/**
 * Portal routes barrel — wires all /api/v1/portal/* handlers.
 *
 * Phase 22 WEB3-01 to WEB3-06.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { registerPortalAuthRoutes } from './auth.js';
import { registerPortalWalletRoutes } from './wallet.js';

export function registerPortalRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    registerPortalAuthRoutes(app, services);
    registerPortalWalletRoutes(app, services);
}
