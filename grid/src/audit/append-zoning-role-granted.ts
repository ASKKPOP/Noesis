/**
 * Phase 60 HOUSE-3 (D-60-09.1 / R-60-02/11) — Sole-producer for zoning.role_granted.
 *
 * Closed 5-key payload: {grantor_civic_did_hash, holder_civic_did_hash, parcel_id, role, tick}.
 * actorDid = grantor_civic_did_hash (the role is granted BY the grantor).
 *
 * role ∈ {staff, guest} — owner is implicit from Parcel.ownerDid and is NEVER granted
 * (D-60-01). Both DIDs are HEX64-hashed; the raw Civic-DIDs and any place/scope text stay
 * Grid-side and NEVER cross the audit boundary (D-60-10). Allowlist position 96.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const GRANTABLE_ROLES = ['guest', 'staff'] as const;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface ZoningRoleGrantedPayload {
    readonly grantor_civic_did_hash: string; // HEX64_RE
    readonly holder_civic_did_hash: string;  // HEX64_RE
    readonly parcel_id: string;              // PARCEL_ID_RE
    readonly role: 'staff' | 'guest';        // owner is implicit, never granted
    readonly tick: number;                   // non-negative integer
}

const EXPECTED_KEYS = ['grantor_civic_did_hash', 'holder_civic_did_hash', 'parcel_id', 'role', 'tick'] as const;

export function appendZoningRoleGranted(
    audit: AuditChain,
    payload: ZoningRoleGrantedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningRoleGranted: payload must be a plain object`);
    }
    // 2. Regex: grantor_civic_did_hash (HEX64).
    if (typeof payload.grantor_civic_did_hash !== 'string' || !HEX64_RE.test(payload.grantor_civic_did_hash)) {
        throw new TypeError(`appendZoningRoleGranted: grantor_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.grantor_civic_did_hash)}`);
    }
    // 3. Regex: holder_civic_did_hash (HEX64).
    if (typeof payload.holder_civic_did_hash !== 'string' || !HEX64_RE.test(payload.holder_civic_did_hash)) {
        throw new TypeError(`appendZoningRoleGranted: holder_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.holder_civic_did_hash)}`);
    }
    // 4. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningRoleGranted: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 5. Enum: role ∈ {staff, guest} (owner is implicit, never granted).
    if (!GRANTABLE_ROLES.includes(payload.role as (typeof GRANTABLE_ROLES)[number])) {
        throw new TypeError(`appendZoningRoleGranted: role must be one of ${JSON.stringify(GRANTABLE_ROLES)}, got ${JSON.stringify(payload.role)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningRoleGranted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningRoleGranted: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        grantor_civic_did_hash: payload.grantor_civic_did_hash,
        holder_civic_did_hash: payload.holder_civic_did_hash,
        parcel_id: payload.parcel_id,
        role: payload.role,
        tick: payload.tick,
    };
    // 9. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningRoleGranted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit. actorDid = grantor_civic_did_hash.
    return audit.append('zoning.role_granted', payload.grantor_civic_did_hash, cleanPayload);
}
