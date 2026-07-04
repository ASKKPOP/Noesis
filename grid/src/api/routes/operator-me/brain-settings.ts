/**
 * Phase 40 — GET /api/v1/operator/me/brain-settings
 * Brain-JWT-authenticated settings endpoint for Brain startup (D-40-01).
 *
 * Resolves the auth gap: the existing GET /api/v1/operator/me/settings route uses
 * operatorScope (portal_session_required). Brain startup uses the Phase 38 EdDSA
 * bearer token — NOT a portal session cookie — so it cannot use that route.
 *
 * Auth: Authorization: Bearer <brain-jwt>
 * The Brain JWT (EdDSA, from Phase 38 TokenManager) has:
 *   iss = did:noesis:nous:* (Brain's existence-DID / brain_did)
 *   sub = did:civic:noesis:* (Brain's civic-DID)
 *
 * This route:
 *   1. Extracts the Bearer token from Authorization header.
 *   2. Decodes the JWT header — verifies alg=EdDSA + iss matches did:noesis:nous:*.
 *   3. Looks up the Brain's public key from brainTokenStore.getByDid(iss).
 *   4. Verifies the EdDSA signature.
 *   5. Reads rec.operatorDid — the human operator DID linked via Phase 39 two-step claim.
 *   6. Returns getSettings(pool, gridName, rec.operatorDid).
 *
 * Policy: 'public' in ROUTE_DID_POLICY (the route handles its own JWT verification
 * internally, same pattern as POST /api/v1/brain/token/register and GET /portal/auth/me).
 *
 * Security: T-40-02-01 — EdDSA signature verified against registered public key in
 * brain_tokens table. Unknown Brain DIDs → 401. Revoked tokens → 401.
 */

import { decodeProtectedHeader, decodeJwt, importJWK, jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { getSettings } from '../../../operator/data/operator-settings-store.js';

// Standard nous: form + the three founding legacy DIDs (BLOCKER-01).
const NOUS_DID_RE = /^did:noesis:(nous:[a-z0-9_\-]+|sophia|hermes|themis)$/i;

export async function registerOperatorMeBrainSettingsRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    // GET /api/v1/operator/me/brain-settings
    // Brain startup calls this with Bearer <brain-jwt> to fetch LocalAiSettings before
    // OllamaAdapter construction. Returns same shape as GET /operator/me/settings.
    app.get('/api/v1/operator/me/brain-settings', async (req, reply) => {
        // Step 1: Extract Bearer token.
        const authHeader = req.headers.authorization ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'bearer_required' });
        }
        const token = authHeader.slice(7);

        // Step 2: Decode JWT header + claims WITHOUT verifying (existence-check only).
        let iss: string;
        try {
            const hdr = decodeProtectedHeader(token);
            const claims = decodeJwt(token);
            const rawIss = claims.iss;
            if (
                hdr.alg !== 'EdDSA' ||
                typeof rawIss !== 'string' ||
                !NOUS_DID_RE.test(rawIss)
            ) {
                return reply.code(401).send({ error: 'invalid_brain_token' });
            }
            iss = rawIss;
        } catch {
            return reply.code(401).send({ error: 'invalid_brain_token' });
        }

        // Step 3: Look up registered Brain token in brain_tokens table.
        const store = services.brainTokenStore;
        if (!store) {
            return reply.code(503).send({ error: 'brain_token_store_unavailable' });
        }

        // Revocation check first (fast path).
        if (await store.isRevoked(iss)) {
            return reply.code(401).send({ error: 'brain_token_revoked' });
        }

        const rec = await store.getByDid(iss);
        if (!rec) {
            return reply.code(401).send({ error: 'unknown_brain_did' });
        }

        // Step 4: Verify EdDSA signature against stored public key.
        try {
            const publicKeyObj = await importJWK(
                rec.publicKeyJwk as Parameters<typeof importJWK>[0],
                'EdDSA',
            );
            await jwtVerify(token, publicKeyObj);
        } catch {
            return reply.code(401).send({ error: 'invalid_brain_token' });
        }

        // Step 5: Extract operator DID from the brain_tokens row (Phase 39 ownership link).
        const operatorDid = rec.operatorDid;
        if (!operatorDid) {
            // Brain is registered but not yet claimed by an operator.
            return reply.code(403).send({ error: 'brain_not_claimed' });
        }

        // Step 6: Fetch and return settings.
        const { pool, gridName } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const settings = await getSettings(pool, gridName, operatorDid);
        return reply.code(200).send(settings);
    });
}
