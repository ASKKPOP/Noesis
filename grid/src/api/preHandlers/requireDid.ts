// Phase 36 / VIS-02 — preHandler boundary; tested via grid/test/api/did-required-enforcement.test.ts and policy-coverage.test.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DIDContext } from './types.js';
import type { DidStoreRef, TryDidServices } from './tryDid.js';
import { tryDid } from './tryDid.js';

/**
 * Phase 41 SLEEP-04 frozen-DID deps — extends TryDidServices with optional
 * PresenceService for isFrozen() check.
 * Uses dynamic import type to avoid circular dependency with presence-service.ts
 * (mirrors firehose-hub.ts pattern).
 */
export interface RequireDidServices extends TryDidServices {
    presenceService?: import('../../civic-presence/presence-service.js').PresenceService;
}

/**
 * requireDid — enforce civic_did_required policy.
 *
 * Returns the DIDContext if the request carries a valid Civic-DID bearer JWT.
 * Returns null and sends 401 if the context is missing or has insufficient tier.
 * Returns null and sends 409 if the Civic-DID is frozen (Phase 41 T-41-04).
 *
 * Used by the global onRequest hook for civic_did_required (and higher) policies.
 */
export async function requireDid(
    req: FastifyRequest,
    reply: FastifyReply,
    services?: RequireDidServices,
): Promise<DIDContext | null> {
    const ctx = await tryDid(req, services);
    if (!ctx || ctx.tier !== 'civic_member') {
        reply.code(401).send({
            error: 'did_required',
            accepted_methods: ['civic_did_bearer', 'portal_session'],
        });
        return null;
    }
    // Phase 41 T-41-04: frozen Civic-DID gate — 409 before any handler runs.
    if (services?.presenceService !== undefined) {
        const frozen = await services.presenceService.isFrozen(ctx.did);
        if (frozen) {
            await reply.code(409).send({ error: 'civic_did_frozen' });
            return null;
        }
    }
    return ctx;
}

/**
 * requirePortalSession — enforce portal_session_required policy.
 *
 * Returns the DIDContext for Human Visitor or Civic Member tiers.
 * Returns null and sends 401 only for Anonymous (null) contexts.
 *
 * Covers D-36-18 soft interaction routes: Human Visitors and Civic Members both pass.
 */
export async function requirePortalSession(
    req: FastifyRequest,
    reply: FastifyReply,
    services?: TryDidServices,
): Promise<DIDContext | null> {
    const ctx = await tryDid(req, services);
    if (!ctx) {
        reply.code(401).send({
            error: 'portal_session_required',
            accepted_methods: ['portal_session'],
        });
        return null;
    }
    return ctx;
}
