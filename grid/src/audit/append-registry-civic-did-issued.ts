/**
 * appendRegistryCivicDidIssued — SOLE producer boundary for `registry.civic_did_issued` audit events.
 *
 * Phase 37 / REG-06 — sole producer for registry.civic_did_issued.
 * Allowlist position: 61 (Phase 37 D-V3-33). Closed-tuple 4-key payload.
 * Fires when the Grid Registry issues a new Civic-DID to a Nous.
 *
 * 8-step discipline mirrors appendPortalDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Regex guard: civic_did (CIVIC_DID_RE).
 *   2b. Regex guard: existence_did (EXISTENCE_DID_RE).
 *   3. Non-empty string guard: grid_name.
 *   4. Non-negative integer guard: issued_at_tick.
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'registry.civic_did_issued'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

// Phase 37 introduces did:civic:* and did:noesis:nous:* — DID_RE only covers did:noesis:*.
// Local regex constants required (do NOT import DID_RE).
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
// Mirror registry.ts: standard nous: form + the three founding legacy DIDs (BLOCKER-01).
const EXISTENCE_DID_RE = /^did:noesis:(nous:[a-z0-9_:\-]+|sophia|hermes|themis)$/i;

/** Closed 4-key payload for registry.civic_did_issued. */
export interface RegistryCivicDidIssuedPayload {
    readonly civic_did: string;       // CIVIC_DID_RE
    readonly existence_did: string;   // EXISTENCE_DID_RE
    readonly grid_name: string;       // non-empty string
    readonly issued_at_tick: number;  // non-negative integer
}

/** The 4 keys a registry.civic_did_issued payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['civic_did', 'existence_did', 'grid_name', 'issued_at_tick'] as const;

/**
 * Sole producer path for registry.civic_did_issued audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendRegistryCivicDidIssued(
    audit: AuditChain,
    payload: RegistryCivicDidIssuedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryCivicDidIssued: payload must be a plain object`);
    }
    // 2. Regex guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: civic_did must match CIVIC_DID_RE, got ${JSON.stringify(payload.civic_did)}`,
        );
    }
    // 2b. Regex guard: existence_did.
    if (typeof payload.existence_did !== 'string' || !EXISTENCE_DID_RE.test(payload.existence_did)) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: existence_did must match EXISTENCE_DID_RE, got ${JSON.stringify(payload.existence_did)}`,
        );
    }
    // 3. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // 4. Non-negative integer guard: issued_at_tick.
    if (!Number.isInteger(payload.issued_at_tick) || payload.issued_at_tick < 0) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: issued_at_tick must be a non-negative integer, got ${JSON.stringify(payload.issued_at_tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        civic_did: payload.civic_did,
        existence_did: payload.existence_did,
        grid_name: payload.grid_name,
        issued_at_tick: payload.issued_at_tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('registry.civic_did_issued', payload.civic_did, cleanPayload);
}
