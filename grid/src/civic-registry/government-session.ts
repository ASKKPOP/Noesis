/**
 * Phase 37 / REG-04 — Government session JWT validator stub.
 *
 * Phase 46 (Government v3) will replace this with the real Polis session validator.
 * The iss-claim discipline (did:gov:noesis:genesis-polis) is permanent — only the
 * underlying key verification may change in Phase 46.
 *
 * Constitutional invariant (D-V3-18 + D-V3-21):
 * - Operator-DIDs (did:noesis:human:*) CANNOT revoke Civic-DIDs.
 * - Revocation requires a valid government session JWT signed by the Polis.
 * - This stub uses the Grid's keyPairPromise key for verification (Phase 37 bootstrap).
 */

import { jwtVerify } from 'jose';
import { keyPairPromise } from '../api/portal/auth.js';

export const GOV_SESSION_ISSUER_DID = 'did:gov:noesis:genesis-polis';

export type GovernmentSessionResult =
    | { ok: true; courtConvictionRef: string }
    | { ok: false; reason: 'court_order_required' | 'court_conviction_ref_required' };

/**
 * Verify a government session bearer JWT.
 *
 * Returns ok: true with courtConvictionRef when:
 *   - authHeader is 'Bearer <jwt>'
 *   - jwt verifies with keyPairPromise public key
 *   - payload.iss === GOV_SESSION_ISSUER_DID
 *   - payload.court_conviction_ref is a non-empty string
 *
 * Returns ok: false with reason in all other cases.
 * Operator-DID JWTs are explicitly rejected with court_order_required.
 */
export async function verifyGovernmentSession(
    authHeader: string | undefined,
): Promise<GovernmentSessionResult> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, reason: 'court_order_required' };
    }
    const token = authHeader.substring('Bearer '.length);
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        if (payload.iss !== GOV_SESSION_ISSUER_DID) {
            return { ok: false, reason: 'court_order_required' };
        }
        const ref = payload['court_conviction_ref'];
        if (typeof ref !== 'string' || ref.length === 0) {
            return { ok: false, reason: 'court_conviction_ref_required' };
        }
        return { ok: true, courtConvictionRef: ref };
    } catch {
        return { ok: false, reason: 'court_order_required' };
    }
}

/**
 * Phase 45 (IRS-03) — Government disbursement authorization.
 *
 * Mirrors verifyGovernmentSession() exactly but checks payload.legislation_ref
 * instead of court_conviction_ref. Disbursements are legislative authorizations,
 * not court orders (D-V3-21 — Nous-only legislative VOTE-05 in Phase 46).
 *
 * In Phase 45, Phase 46 Government has not shipped yet — IRS disburse tests use
 * a test-fixture JWT signed with the same keyPairPromise infrastructure. Phase 46
 * will replace the stub keypair with the elected-Speaker keypair.
 */
export type DisbursementAuthResult =
    | { ok: true; legislationRef: string }
    | { ok: false; reason: 'legislation_auth_required' | 'legislation_ref_required' };

export async function verifyDisbursementAuth(
    authHeader: string | undefined,
): Promise<DisbursementAuthResult> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, reason: 'legislation_auth_required' };
    }
    const token = authHeader.substring('Bearer '.length);
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        if (payload.iss !== GOV_SESSION_ISSUER_DID) {
            return { ok: false, reason: 'legislation_auth_required' };
        }
        const ref = payload['legislation_ref'];
        if (typeof ref !== 'string' || ref.length === 0) {
            return { ok: false, reason: 'legislation_ref_required' };
        }
        return { ok: true, legislationRef: ref };
    } catch {
        return { ok: false, reason: 'legislation_auth_required' };
    }
}
