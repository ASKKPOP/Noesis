/**
 * appendPolisRegistrationPending — SOLE producer boundary for `polis.registration_pending` audit events.
 *
 * Human Civic-DID application pipeline (2026-06-10) — allowlist position 88.
 * Fires when the Portal forwards a pre-screened application to the target-Grid Polis for charter review (D-V3-33 pipeline stage 2).
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Field guards (regex / closed-set / integer).
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'polis.registration_pending'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const APPLICATION_ID_RE = /^[0-9a-f][0-9a-f-]{34}[0-9a-f]$/i;

/** Closed 3-key payload for polis.registration_pending. */
export interface PolisRegistrationPendingPayload {
    readonly application_id: string;  // APPLICATION_ID_RE (UUID)
    readonly forwarded_at_tick: number;// non-negative integer
    readonly grid_name: string;       // non-empty string
}

/** The 3 keys a polis.registration_pending payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['application_id', 'forwarded_at_tick', 'grid_name'] as const;

/**
 * Sole producer path for polis.registration_pending audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPolisRegistrationPending(
    audit: AuditChain,
    payload: PolisRegistrationPendingPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPolisRegistrationPending: payload must be a plain object`);
    }
    // Guard: application_id.
    if (typeof payload.application_id !== 'string' || !APPLICATION_ID_RE.test(payload.application_id)) {
        throw new TypeError(
            `appendPolisRegistrationPending: application_id must be a UUID (APPLICATION_ID_RE), got ${JSON.stringify(payload.application_id)}`,
        );
    }
    // Guard: forwarded_at_tick.
    if (!Number.isInteger(payload.forwarded_at_tick) || payload.forwarded_at_tick < 0) {
        throw new TypeError(
            `appendPolisRegistrationPending: forwarded_at_tick must be a non-negative integer, got ${JSON.stringify(payload.forwarded_at_tick)}`,
        );
    }
    // Guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendPolisRegistrationPending: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPolisRegistrationPending: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        application_id: payload.application_id,
        forwarded_at_tick: payload.forwarded_at_tick,
        grid_name: payload.grid_name,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPolisRegistrationPending: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('polis.registration_pending', payload.application_id, cleanPayload);
}
