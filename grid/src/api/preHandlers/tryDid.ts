// Phase 36 / VIS-02 — preHandler boundary; tested via grid/test/api/did-required-enforcement.test.ts and policy-coverage.test.ts

import type { FastifyRequest } from 'fastify';
import { jwtVerify } from 'jose';
import { keyPairPromise, COOKIE_NAME } from '../portal/auth.js';
import { DID_RE } from '../../audit/append-human-joined.js';
import type { DIDContext } from './types.js';

// Phase 37 (REG-02 prep): accept all noesis DID families in bearer JWTs.
// DID_RE = did:noesis:* only. Civic-DID bearer JWTs use did:civic:noesis:* subjects
// and Business-DID bearer JWTs (Phase 38) use did:biz:noesis:* — both must resolve here.
// DID_RE remains canonical for audit payloads that haven't yet adopted local regex constants.
const ANY_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i;

/**
 * Optional DID store interface for revocation checks.
 * Plan 05 will wire the concrete implementation.
 */
export interface DidStoreRef {
    isRevoked(did: string): boolean | Promise<boolean>;
}

/**
 * tryDid — resolve DIDContext from request headers/cookies without short-circuiting.
 *
 * Resolution order:
 *  1. Authorization: Bearer <jwt>  → civic_member tier (Civic-DID bearer)
 *  2. Cookie noesis_portal_token   → human_visitor tier (Portal session)
 *  3. Neither                      → null (anonymous)
 *
 * Invalid or expired tokens fall through (catch-and-continue), not throw.
 *
 * D-36-09: revoked Civic-DID reverts to visitor tier (NOT hard-block).
 */
export async function tryDid(
    req: FastifyRequest,
    services?: { didStore?: DidStoreRef },
): Promise<DIDContext | null> {
    const { publicKey } = await keyPairPromise;

    // Step 1: Civic-DID bearer JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring('Bearer '.length);
        try {
            const { payload } = await jwtVerify(token, publicKey);
            const sub = payload.sub;
            if (typeof sub === 'string' && sub.length > 0 && ANY_DID_RE.test(sub)) {
                // D-36-09: revoked Civic-DID reverts to visitor tier (NOT hard-block).
                const didStore = services?.didStore;
                if (didStore) {
                    const revoked = await didStore.isRevoked(sub);
                    if (revoked) {
                        // Demote to anonymous — revoked civic DID loses write access
                        return null;
                    }
                }
                return { did: sub, tier: 'civic_member' };
            }
        } catch {
            // Invalid token — fall through to cookie check
        }
    }

    // Step 2: Portal session cookie (Human Visitor)
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const cookieToken = cookies?.[COOKIE_NAME];
    if (cookieToken) {
        try {
            const { payload } = await jwtVerify(cookieToken, publicKey);
            const did = payload['did'];
            if (typeof did === 'string' && did.length > 0 && ANY_DID_RE.test(did)) {
                return { did, tier: 'human_visitor', operatorDid: did };
            }
        } catch {
            // Invalid cookie — fall through to anonymous
        }
    }

    // Step 3: Anonymous
    return null;
}
