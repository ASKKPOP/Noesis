/**
 * DIDContext interface and FastifyRequest module augmentation.
 *
 * Phase 36 / VIS-02 — preHandler boundary types; consumed by tryDid, requireDid,
 * and all downstream route handlers that read req.didContext.
 */

/**
 * The tiers of identity that can be attached to a request.
 * - anonymous: no token, no cookie
 * - human_visitor: valid portal session cookie (Type B human logged in)
 * - civic_member: valid Civic-DID bearer JWT
 * - government: verified government session (Phase 37 REG-04 / Pitfall 6)
 *   Distinct from 'civic_member' so downstream civic_did_required gates do not
 *   accidentally accept Government sessions. Phase 46 swaps in the real validator
 *   without renaming the tier.
 */
export type VisitorTier =
    | 'anonymous'
    | 'human_visitor'
    | 'civic_member'
    | 'government'; // Phase 37 (REG-04 / D-V3-18 / Pitfall 6) — Phase 46 swap point

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
