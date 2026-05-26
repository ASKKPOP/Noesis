// Phase 36 / D-36-21 — OAuth stubs return 501 Not Implemented.
// Full PKCE flow lands in Phase 52-54 Portal Infrastructure.
// CI gate `scripts/check-no-did-exception-count.mjs` (Plan 06) asserts count = 5
// no-DID auth exceptions (was 3 pre-v3.0).

import type { FastifyInstance } from 'fastify';

/**
 * Register OAuth provider stub routes.
 *
 * Returns 501 Not Implemented for Google and Apple OAuth.
 * Real PKCE OAuth flow deferred to Phase 52-54 Portal Infrastructure.
 * D-36-21: no-DID auth exceptions grow from 3 → 5 with these 2 stubs.
 */
export function registerOAuthStubRoutes(app: FastifyInstance): void {
    app.post('/portal/auth/oauth/google', async (_req, reply) => {
        return reply.code(501).send({
            status: 'coming_soon',
            provider: 'google',
            planned_phase: '52-54',
        });
    });

    app.post('/portal/auth/oauth/apple', async (_req, reply) => {
        return reply.code(501).send({
            status: 'coming_soon',
            provider: 'apple',
            planned_phase: '52-54',
        });
    });
}
