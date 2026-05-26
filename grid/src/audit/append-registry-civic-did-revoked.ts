/**
 * appendRegistryCivicDidRevoked — SOLE producer boundary for `registry.civic_did_revoked` audit events.
 *
 * Phase 37 / REG-06 — sole producer for registry.civic_did_revoked.
 * Allowlist position: 62 (Phase 37 D-V3-33). Closed-tuple 4-key payload.
 * Fires when the Grid Registry revokes a Civic-DID following a court conviction.
 *
 * PRIVACY INVARIANT: court_conviction_ref is HASHED (HEX64 SHA-256). Plaintext refs
 * NEVER cross the wire (same discipline as sanction_reasons D-25b-11).
 * The plaintext reference lives only in the civic_did_registry MySQL column.
 *
 * 8-step discipline mirrors appendPortalDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Regex guard: civic_did (CIVIC_DID_RE).
 *   2b. HEX64 guard: court_conviction_ref_hash (HEX64_RE — SHA-256).
 *   3. Non-empty string guard: grid_name.
 *   4. Non-negative integer guard: revoked_at_tick.
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'registry.civic_did_revoked'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

// Phase 37 introduces did:civic:* — DID_RE only covers did:noesis:*.
// Local regex constants required (do NOT import DID_RE).
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

/** Closed 4-key payload for registry.civic_did_revoked. */
export interface RegistryCivicDidRevokedPayload {
    readonly civic_did: string;                    // CIVIC_DID_RE
    readonly court_conviction_ref_hash: string;    // HEX64_RE — SHA-256 of plaintext ref
    readonly grid_name: string;                    // non-empty string
    readonly revoked_at_tick: number;              // non-negative integer
}

/** The 4 keys a registry.civic_did_revoked payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['civic_did', 'court_conviction_ref_hash', 'grid_name', 'revoked_at_tick'] as const;

/**
 * Sole producer path for registry.civic_did_revoked audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendRegistryCivicDidRevoked(
    audit: AuditChain,
    payload: RegistryCivicDidRevokedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryCivicDidRevoked: payload must be a plain object`);
    }
    // 2. Regex guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(
            `appendRegistryCivicDidRevoked: civic_did must match CIVIC_DID_RE, got ${JSON.stringify(payload.civic_did)}`,
        );
    }
    // 2b. HEX64 guard: court_conviction_ref_hash must be SHA-256 hex (64 chars, hex only).
    if (typeof payload.court_conviction_ref_hash !== 'string' || !HEX64_RE.test(payload.court_conviction_ref_hash)) {
        throw new TypeError(
            `appendRegistryCivicDidRevoked: court_conviction_ref_hash must match HEX64_RE (SHA-256), got ${JSON.stringify(payload.court_conviction_ref_hash)}`,
        );
    }
    // 3. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendRegistryCivicDidRevoked: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // 4. Non-negative integer guard: revoked_at_tick.
    if (!Number.isInteger(payload.revoked_at_tick) || payload.revoked_at_tick < 0) {
        throw new TypeError(
            `appendRegistryCivicDidRevoked: revoked_at_tick must be a non-negative integer, got ${JSON.stringify(payload.revoked_at_tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendRegistryCivicDidRevoked: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        civic_did: payload.civic_did,
        court_conviction_ref_hash: payload.court_conviction_ref_hash,
        grid_name: payload.grid_name,
        revoked_at_tick: payload.revoked_at_tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendRegistryCivicDidRevoked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('registry.civic_did_revoked', payload.civic_did, cleanPayload);
}
