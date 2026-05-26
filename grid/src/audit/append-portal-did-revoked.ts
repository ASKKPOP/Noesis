/**
 * appendPortalDidRevoked — SOLE producer boundary for `portal.did_revoked` audit events.
 *
 * Phase 36 / VIS-05 — sole producer for `portal.did_revoked`.
 * Allowlist position: 58 (Phase 36 D-36-17). Closed-tuple payload;
 * PORTAL_AUTH_FORBIDDEN_KEYS preserved. Tested via
 * grid/test/audit/append-portal-did-revoked.test.ts.
 *
 * Fires when the Portal revokes a Civic-DID from a human or Nous.
 *
 * Discipline mirrors appendPortalAuthLogin exactly:
 *   1. Type guard: payload must be a plain non-null non-array object.
 *   2. Regex guard: human_or_nous_did (DID_RE).
 *   3. (No enum — skip step 3.) Non-negative integer guard: revoked_at_tick.
 *   4. Non-empty string guard: revoker_portal_id.
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'portal.did_revoked'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/** Closed 3-key payload for portal.did_revoked. */
export interface PortalDidRevokedPayload {
    readonly human_or_nous_did: string;  // DID_RE
    readonly revoked_at_tick: number;    // non-negative integer
    readonly revoker_portal_id: string;  // non-empty string
}

/** The 3 keys a portal.did_revoked payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['human_or_nous_did', 'revoked_at_tick', 'revoker_portal_id'] as const;

/**
 * Sole producer path for portal.did_revoked audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalDidRevoked(
    audit: AuditChain,
    payload: PortalDidRevokedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalDidRevoked: payload must be a plain object`);
    }

    // 2. Regex guard: human_or_nous_did.
    if (typeof payload.human_or_nous_did !== 'string' || !DID_RE.test(payload.human_or_nous_did)) {
        throw new TypeError(
            `appendPortalDidRevoked: human_or_nous_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_or_nous_did)}`,
        );
    }

    // 3. Non-negative integer guard: revoked_at_tick.
    if (!Number.isInteger(payload.revoked_at_tick) || payload.revoked_at_tick < 0) {
        throw new TypeError(
            `appendPortalDidRevoked: revoked_at_tick must be a non-negative integer, got ${JSON.stringify(payload.revoked_at_tick)}`,
        );
    }

    // 4. Non-empty string guard: revoker_portal_id.
    if (typeof payload.revoker_portal_id !== 'string' || payload.revoker_portal_id.length === 0) {
        throw new TypeError(
            `appendPortalDidRevoked: revoker_portal_id must be a non-empty string, got ${JSON.stringify(payload.revoker_portal_id)}`,
        );
    }

    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalDidRevoked: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        human_or_nous_did: payload.human_or_nous_did,
        revoked_at_tick: payload.revoked_at_tick,
        revoker_portal_id: payload.revoker_portal_id,
    };

    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalDidRevoked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('portal.did_revoked', payload.human_or_nous_did, cleanPayload);
}
