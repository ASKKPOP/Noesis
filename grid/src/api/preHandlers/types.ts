/**
 * DIDContext interface and FastifyRequest module augmentation.
 *
 * Phase 36 / VIS-02 — preHandler boundary types; consumed by tryDid, requireDid,
 * and all downstream route handlers that read req.didContext.
 */

/**
 * The three tiers of identity that can be attached to a request.
 * - anonymous: no token, no cookie
 * - human_visitor: valid portal session cookie (Type B human logged in)
 * - civic_member: valid Civic-DID bearer JWT
 */
export type VisitorTier = 'anonymous' | 'human_visitor' | 'civic_member';

/**
 * Resolved identity context attached to every request by the global onRequest hook.
 * Downstream handlers read req.didContext without re-verifying the JWT.
 */
export interface DIDContext {
    readonly did: string;
    readonly tier: VisitorTier;
    readonly operatorDid?: string;
}

// Module augmentation: extend FastifyRequest so handlers see req.didContext without casting.
declare module 'fastify' {
    interface FastifyRequest {
        didContext?: DIDContext | null;
    }
}
