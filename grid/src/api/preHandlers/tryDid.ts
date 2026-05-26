// Phase 36 / VIS-02 — preHandler boundary; tested via grid/test/api/did-required-enforcement.test.ts and policy-coverage.test.ts

import type { FastifyRequest } from 'fastify';
import { jwtVerify, decodeProtectedHeader, decodeJwt, importJWK } from 'jose';
import { keyPairPromise, COOKIE_NAME } from '../portal/auth.js';
import { DID_RE } from '../../audit/append-human-joined.js';
import type { DIDContext } from './types.js';
import type { BrainTokenStore } from '../../db/stores/brain-token-store.js';

// Phase 37 (REG-02 prep): accept all noesis DID families in bearer JWTs.
// DID_RE = did:noesis:* only. Civic-DID bearer JWTs use did:civic:noesis:* subjects
// and Business-DID bearer JWTs (Phase 38) use did:biz:noesis:* — both must resolve here.
// DID_RE remains canonical for audit payloads that haven't yet adopted local regex constants.
const ANY_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i;

// Phase 38 WIRE-02: existence-DID regex for Brain-signed JWTs (iss field).
// Brain tokens have iss = did:noesis:nous:* (existence-DID) + sub = did:civic:noesis:* (civic-DID).
const NOUS_DID_RE = /^did:noesis:nous:[a-z0-9_\-]+$/i;

/**
 * Optional DID store interface for revocation checks.
 * Plan 05 will wire the concrete implementation.
 */
export interface DidStoreRef {
    isRevoked(did: string): boolean | Promise<boolean>;
}

/**
 * Services interface for tryDid — extended in Phase 38 to support Brain JWT verification.
 * Both fields are optional so existing callers that pass {didStore} still compile.
 */
export interface TryDidServices {
    didStore?: DidStoreRef;
    /** Phase 38 WIRE-02: Brain bearer-token store. When present, EdDSA JWTs with
     *  iss=did:noesis:nous:* are verified against the stored public JWK. */
    brainTokenStore?: BrainTokenStore;
}

/**
 * tryDid — resolve DIDContext from request headers/cookies without short-circuiting.
 *
 * Resolution order:
 *  1. Authorization: Bearer <jwt> with alg=EdDSA + iss=did:noesis:nous:*
 *     → Brain-signed JWT — verify against brainTokenStore (Phase 38 WIRE-02)
 *  2. Authorization: Bearer <jwt> with alg=ES256
 *     → civic_member tier (Civic-DID bearer, existing path)
 *  3. Cookie noesis_portal_token   → human_visitor tier (Portal session)
 *  4. Neither                      → null (anonymous)
 *
 * Invalid or expired tokens fall through (catch-and-continue), not throw.
 *
 * D-36-09: revoked Civic-DID reverts to visitor tier (NOT hard-block).
 */
export async function tryDid(
    req: FastifyRequest,
    services?: TryDidServices,
): Promise<DIDContext | null> {
    const { publicKey } = await keyPairPromise;

    // Step 1: Bearer JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring('Bearer '.length);

        // Phase 38 WIRE-02: Brain-signed EdDSA JWT branch.
        // First-pass: peek at the header + payload WITHOUT verifying (decodeJwt is unverified).
        // Only enter this branch when alg=EdDSA AND iss matches did:noesis:nous:*.
        // If EdDSA verification fails, fall through to the ES256 path (defensive).
        try {
            const hdr = decodeProtectedHeader(token);
            const claims = decodeJwt(token);
            const iss = claims.iss;
            if (hdr.alg === 'EdDSA' && typeof iss === 'string' && NOUS_DID_RE.test(iss)) {
                // Brain-signed JWT path.
                const store = (services as TryDidServices | undefined)?.brainTokenStore;
                if (store) {
                    // Revocation check: a revoked Brain DID → null (anonymous).
                    if (await store.isRevoked(iss)) return null;
                    const rec = await store.getByDid(iss);
                    if (rec) {
                        // Verify signature against the stored Ed25519 public JWK.
                        const publicKeyObj = await importJWK(
                            rec.publicKeyJwk as Parameters<typeof importJWK>[0],
                            'EdDSA',
                        );
                        const { payload } = await jwtVerify(token, publicKeyObj);
                        const sub = payload.sub;
                        if (typeof sub === 'string' && ANY_DID_RE.test(sub)) {
                            // D-36-09: Civic-DID revocation check still applies to the sub.
                            const didStore = services?.didStore;
                            if (didStore && (await didStore.isRevoked(sub))) return null;
                            // Brain token verified — civic_member tier with operatorDid = iss.
                            return { did: sub, tier: 'civic_member', operatorDid: iss };
                        }
                    }
                }
                // EdDSA token but brainTokenStore not wired, or sub doesn't parse →
                // fall through to ES256 path intentionally.
            }
        } catch {
            // Header peek failed or EdDSA verify failed — fall through to ES256 path.
        }

        // Step 1b: ES256 Civic-DID bearer JWT (existing path — unchanged).
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
