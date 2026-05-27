/**
 * Phase 39 — operatorScope preHandler (TENANT-02 / D-39-09)
 * Enforces that the requesting operator DID matches the resource owner DID.
 * Violation: Pino structured warn (no audit chain event per D-39-09).
 *
 * NOTE (T-39-03-01): operatorDid must start with 'did:noesis:human:' (Human Visitor tier).
 * Any operatorDid starting with 'did:noesis:nous:' indicates a bug in the Portal session
 * tryDid path — Brain DIDs must not appear as operatorDid in DIDContext.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../util/logger.js';

/**
 * Extracts the operator DID from the Portal-session-populated DIDContext.
 * Returns the operatorDid string, or sends 403 and returns null if absent.
 * Call this at the start of every operator/me/* handler.
 */
export async function operatorScope(
    req: FastifyRequest,
    reply: FastifyReply,
): Promise<string | null> {
    const operatorDid = req.didContext?.operatorDid;
    if (!operatorDid) {
        await reply.code(403).send({ error: 'operator_scope_required' });
        return null;
    }
    return operatorDid;
}

/**
 * Asserts that the requesting operator owns the resource.
 * If the DIDs do not match, fires a Pino structured warning and sends 403.
 * Returns true if ownership is confirmed, false if access was denied.
 *
 * Usage: call after retrieving a resource that has an operator_did field.
 * Cross-operator access logs the violation and blocks the request.
 */
export function assertOperatorOwns(
    req: FastifyRequest,
    reply: FastifyReply,
    resourceOperatorDid: string | null,
    tick: number,
): boolean {
    const requestingDid = req.didContext?.operatorDid;
    if (!requestingDid || requestingDid !== resourceOperatorDid) {
        logger.warn({
            event: 'operator_scope_violation',
            requesting_operator_did: requestingDid ?? null,
            target_operator_did: resourceOperatorDid,
            route: req.url,
            tick,
        });
        void reply.code(403).send({ error: 'forbidden', reason: 'operator_scope' });
        return false;
    }
    return true;
}
