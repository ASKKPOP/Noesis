/**
 * appendPortalDidIssued — SOLE producer boundary for `portal.did_issued` audit events.
 *
 * Phase 36 / VIS-05 — sole producer for `portal.did_issued`.
 * Allowlist position: 57 (Phase 36 D-36-17). Closed-tuple payload;
 * PORTAL_AUTH_FORBIDDEN_KEYS preserved. Tested via
 * grid/test/audit/append-portal-did-issued.test.ts.
 *
 * Fires when the Portal issues a Civic-DID to a human or Nous.
 *
 * Discipline mirrors appendPortalAuthLogin exactly:
 *   1. Type guard: payload must be a plain non-null non-array object.
 *   2. Regex guard: human_or_nous_did (DID_RE).
 *   3. (No enum — skip step 3.) Non-negative integer guard: issued_at_tick.
 *   4. Non-empty string guard: issuer_portal_id.
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'portal.did_issued'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/** Closed 3-key payload for portal.did_issued. */
export interface PortalDidIssuedPayload {
    readonly human_or_nous_did: string;  // DID_RE
    readonly issued_at_tick: number;     // non-negative integer
    readonly issuer_portal_id: string;   // non-empty string
}

/** The 3 keys a portal.did_issued payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['human_or_nous_did', 'issued_at_tick', 'issuer_portal_id'] as const;

/**
 * Sole producer path for portal.did_issued audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalDidIssued(
    audit: AuditChain,
    payload: PortalDidIssuedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalDidIssued: payload must be a plain object`);
    }

    // 2. Regex guard: human_or_nous_did.
    if (typeof payload.human_or_nous_did !== 'string' || !DID_RE.test(payload.human_or_nous_did)) {
        throw new TypeError(
            `appendPortalDidIssued: human_or_nous_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_or_nous_did)}`,
        );
    }

    // 3. Non-negative integer guard: issued_at_tick.
    if (!Number.isInteger(payload.issued_at_tick) || payload.issued_at_tick < 0) {
        throw new TypeError(
            `appendPortalDidIssued: issued_at_tick must be a non-negative integer, got ${JSON.stringify(payload.issued_at_tick)}`,
        );
    }

    // 4. Non-empty string guard: issuer_portal_id.
    if (typeof payload.issuer_portal_id !== 'string' || payload.issuer_portal_id.length === 0) {
        throw new TypeError(
            `appendPortalDidIssued: issuer_portal_id must be a non-empty string, got ${JSON.stringify(payload.issuer_portal_id)}`,
        );
    }

    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalDidIssued: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        human_or_nous_did: payload.human_or_nous_did,
        issued_at_tick: payload.issued_at_tick,
        issuer_portal_id: payload.issuer_portal_id,
    };

    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalDidIssued: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('portal.did_issued', payload.human_or_nous_did, cleanPayload);
}
