/**
 * Portal routes barrel — wires all /api/v1/portal/* handlers.
 *
 * Phase 22 WEB3-01 to WEB3-06.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { registerPortalAuthRoutes } from './auth.js';
import { registerPortalWalletRoutes } from './wallet.js';
import { registerFrozenCheck } from './check-frozen.js';
import { registerPortalChatRoutes } from './chat.js';
import { registerPortalNousRoutes } from './nous.js';

export function registerPortalRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // Auth routes first — SIWE populates session.humanDid which check-frozen reads.
    registerPortalAuthRoutes(app, services);
    // Frozen/banned check — registered after auth so session is available.
    registerFrozenCheck(app, services);
    registerPortalWalletRoutes(app, services);
    registerPortalChatRoutes(app, services);
    registerPortalNousRoutes(app, services);
}
