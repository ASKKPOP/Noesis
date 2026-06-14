/**
 * Phase 60 HOUSE-3 (D-60-09.2 / R-60-03/11) — Sole-producer for zoning.role_revoked.
 *
 * Closed 4-key payload: {holder_civic_did_hash, parcel_id, reason, tick}.
 * actorDid = parcel_id (the revocation is attributed to the land — the holder's
 * identity is HEX64-hashed, mirroring the #83 land-attribution discipline).
 *
 * reason ∈ {owner_revoked, for_cause, severance_complete} (the closed severance outcomes).
 * The raw Civic-DID stays Grid-side and NEVER crosses the audit boundary (D-60-10).
 * Allowlist position 97.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const REVOKE_REASONS = ['for_cause', 'owner_revoked', 'severance_complete'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface ZoningRoleRevokedPayload {
    readonly holder_civic_did_hash: string; // HEX64_RE
    readonly parcel_id: string;             // PARCEL_ID_RE
    readonly reason: 'owner_revoked' | 'for_cause' | 'severance_complete';
    readonly tick: number;                  // non-negative integer
}

const EXPECTED_KEYS = ['holder_civic_did_hash', 'parcel_id', 'reason', 'tick'] as const;

export function appendZoningRoleRevoked(
    audit: AuditChain,
    payload: ZoningRoleRevokedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningRoleRevoked: payload must be a plain object`);
    }
    // 2. Regex: holder_civic_did_hash (HEX64).
    if (typeof payload.holder_civic_did_hash !== 'string' || !HEX64_RE.test(payload.holder_civic_did_hash)) {
        throw new TypeError(`appendZoningRoleRevoked: holder_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.holder_civic_did_hash)}`);
    }
    // 3. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningRoleRevoked: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 4. Enum: reason ∈ {owner_revoked, for_cause, severance_complete}.
    if (!REVOKE_REASONS.includes(payload.reason as (typeof REVOKE_REASONS)[number])) {
        throw new TypeError(`appendZoningRoleRevoked: reason must be one of ${JSON.stringify(REVOKE_REASONS)}, got ${JSON.stringify(payload.reason)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningRoleRevoked: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningRoleRevoked: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        holder_civic_did_hash: payload.holder_civic_did_hash,
        parcel_id: payload.parcel_id,
        reason: payload.reason,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningRoleRevoked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = parcel_id.
    return audit.append('zoning.role_revoked', payload.parcel_id, cleanPayload);
}
