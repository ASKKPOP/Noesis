/**
 * appendPortalRegistrationRequested — SOLE producer boundary for `portal.registration_requested` audit events.
 *
 * Human Civic-DID application pipeline (2026-06-10) — allowlist position 87.
 * Fires when a human submits a Civic-DID application at the Portal (D-36-04 step 2; pipeline D-V3-33).
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Field guards (regex / closed-set / integer).
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'portal.registration_requested'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

// Human operator-DIDs: did:noesis:human:0x<40hex> (SIWE) or did:noesis:human:email:<uuid>.
const HUMAN_DID_RE = /^did:noesis:human:[a-z0-9_:\\-]+$/i;
const APPLICATION_ID_RE = /^[0-9a-f][0-9a-f-]{34}[0-9a-f]$/i;

/** Closed 4-key payload for portal.registration_requested. */
export interface PortalRegistrationRequestedPayload {
    readonly application_id: string;  // APPLICATION_ID_RE (UUID)
    readonly grid_name: string;       // non-empty string
    readonly human_did: string;       // HUMAN_DID_RE
    readonly requested_at_tick: number;// non-negative integer
}

/** The 4 keys a portal.registration_requested payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['application_id', 'grid_name', 'human_did', 'requested_at_tick'] as const;

/**
 * Sole producer path for portal.registration_requested audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalRegistrationRequested(
    audit: AuditChain,
    payload: PortalRegistrationRequestedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalRegistrationRequested: payload must be a plain object`);
    }
    // Guard: application_id.
    if (typeof payload.application_id !== 'string' || !APPLICATION_ID_RE.test(payload.application_id)) {
        throw new TypeError(
            `appendPortalRegistrationRequested: application_id must be a UUID (APPLICATION_ID_RE), got ${JSON.stringify(payload.application_id)}`,
        );
    }
    // Guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendPortalRegistrationRequested: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // Guard: human_did.
    if (typeof payload.human_did !== 'string' || !HUMAN_DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendPortalRegistrationRequested: human_did must match HUMAN_DID_RE, got ${JSON.stringify(payload.human_did)}`,
        );
    }
    // Guard: requested_at_tick.
    if (!Number.isInteger(payload.requested_at_tick) || payload.requested_at_tick < 0) {
        throw new TypeError(
            `appendPortalRegistrationRequested: requested_at_tick must be a non-negative integer, got ${JSON.stringify(payload.requested_at_tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalRegistrationRequested: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        application_id: payload.application_id,
        grid_name: payload.grid_name,
        human_did: payload.human_did,
        requested_at_tick: payload.requested_at_tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalRegistrationRequested: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('portal.registration_requested', payload.application_id, cleanPayload);
}
