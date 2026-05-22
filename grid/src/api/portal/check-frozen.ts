/**
 * Portal preHandler — frozen/banned check for portal action routes.
 *
 * Phase 25b plan 13 (D-25b-NEW-4, D-25b-NEW-5).
 *
 * Blocks portal write-action routes for humans whose human_users.frozen=1 (frozen)
 * or human_users.banned=1 (banned). SIWE sign-in routes are explicitly excluded so
 * frozen humans can still authenticate to see their read-only frozen status.
 *
 * Hook registration order MATTERS: registerFrozenCheck must be called AFTER
 * registerPortalAuthRoutes so that session.humanDid is populated by the SIWE
 * auth flow before this hook reads it.
 *
 * Forward-compat: PORTAL_ACTION_PATTERNS will be extended when phases 26 (chat, tip)
 * and 27 (spawn) land their portal routes.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GridServices } from '../server.js';

// Routes that constitute portal "actions" (write-side). Auth-only routes excluded.
// Forward-compat: phases 26 (chat, tip), 27 (spawn) will add to this list.
const PORTAL_ACTION_PATTERNS: RegExp[] = [
    /^\/api\/v1\/portal\/wallet\//,  // Phase 23/24 wallet write actions
    // Phase 26+27 routes added here when shipped
];

function isPortalActionRoute(url: string): boolean {
    return PORTAL_ACTION_PATTERNS.some((re) => re.test(url));
}

export function registerFrozenCheck(app: FastifyInstance, services: GridServices): void {
    app.addHook('preHandler', async (req: FastifyRequest, reply) => {
        // Only intercept portal action routes
        if (!isPortalActionRoute(req.url)) return;

        // No humanSanctionStore wired (test/dev stub missing) → pass through
        if (!services.humanSanctionStore) return;

        // Read humanDid from session — populated by SIWE auth preHandler
        const humanDid = (req as FastifyRequest & { session?: { humanDid?: string } }).session?.humanDid;
        if (!humanDid) return;  // unauthenticated — auth middleware handles this

        const flags = await services.humanSanctionStore.getFlags(humanDid);
        if (!flags) return;  // human not found → pass through (auth handles 401)

        if (flags.banned === 1) {
            reply.code(403);
            return reply.send({ error: 'human_banned' });
        }
        if (flags.frozen === 1) {
            reply.code(403);
            return reply.send({ error: 'human_frozen' });
        }
    });
}
