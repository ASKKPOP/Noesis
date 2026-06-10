/**
 * appendPortalRegistrationRejected — SOLE producer boundary for `portal.registration_rejected` audit events.
 *
 * Human Civic-DID application pipeline (2026-06-10) — allowlist position 90.
 * Fires when the Portal pre-screen or Polis charter review rejects a human Civic-DID application (reason_code only — no application text crosses the audit boundary).
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Field guards (regex / closed-set / integer).
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'portal.registration_rejected'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const APPLICATION_ID_RE = /^[0-9a-f][0-9a-f-]{34}[0-9a-f]$/i;
/** Closed rejection reason set — never free text (privacy: no application content in audit). */
export const REASON_CODES = ['account_sanctioned', 'already_registered', 'oath_mismatch', 'statement_invalid'] as const;

/** Closed 4-key payload for portal.registration_rejected. */
export interface PortalRegistrationRejectedPayload {
    readonly application_id: string;  // APPLICATION_ID_RE (UUID)
    readonly grid_name: string;       // non-empty string
    readonly reason_code: string;     // closed REASON_CODES set
    readonly rejected_at_tick: number;// non-negative integer
}

/** The 4 keys a portal.registration_rejected payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['application_id', 'grid_name', 'reason_code', 'rejected_at_tick'] as const;

/**
 * Sole producer path for portal.registration_rejected audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalRegistrationRejected(
    audit: AuditChain,
    payload: PortalRegistrationRejectedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalRegistrationRejected: payload must be a plain object`);
    }
    // Guard: application_id.
    if (typeof payload.application_id !== 'string' || !APPLICATION_ID_RE.test(payload.application_id)) {
        throw new TypeError(
            `appendPortalRegistrationRejected: application_id must be a UUID (APPLICATION_ID_RE), got ${JSON.stringify(payload.application_id)}`,
        );
    }
    // Guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendPortalRegistrationRejected: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // Guard: reason_code.
    if (typeof payload.reason_code !== 'string' || !(REASON_CODES as readonly string[]).includes(payload.reason_code)) {
        throw new TypeError(
            `appendPortalRegistrationRejected: reason_code must be one of ${JSON.stringify(REASON_CODES)}, got ${JSON.stringify(payload.reason_code)}`,
        );
    }
    // Guard: rejected_at_tick.
    if (!Number.isInteger(payload.rejected_at_tick) || payload.rejected_at_tick < 0) {
        throw new TypeError(
            `appendPortalRegistrationRejected: rejected_at_tick must be a non-negative integer, got ${JSON.stringify(payload.rejected_at_tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalRegistrationRejected: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        application_id: payload.application_id,
        grid_name: payload.grid_name,
        reason_code: payload.reason_code,
        rejected_at_tick: payload.rejected_at_tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalRegistrationRejected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('portal.registration_rejected', payload.application_id, cleanPayload);
}
