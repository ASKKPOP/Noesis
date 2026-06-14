/**
 * Phase 59 HOUSE-2 (D-59-01.3 / D-59-07 / R-59-07/09) — sole-producer for
 * zoning.parcel_reclaimed. Allowlist position 94.
 *
 * Closed 4-key payload: {former_owner_civic_did_hash, parcel_id, reason, tick}.
 * actorDid = parcel_id (the land returns to the treasury — attributed to the
 *   parcel, not the departing owner, mirroring treasury.parcel_revenue #83).
 *
 * Emitted when the upkeep scanner crosses the reclaim threshold: ownership
 * returns to TREASURY_DID for resale, the structure is razed, occupants ejected.
 * The former owner DID is hashed (HEX64) — the raw Civic-DID NEVER crosses the
 * audit boundary.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const REASONS = ['upkeep_default'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface ZoningParcelReclaimedPayload {
    readonly former_owner_civic_did_hash: string; // HEX64_RE
    readonly parcel_id: string;                    // PARCEL_ID_RE
    readonly reason: string;                       // ∈ REASONS
    readonly tick: number;                         // non-negative integer
}

const EXPECTED_KEYS = ['former_owner_civic_did_hash', 'parcel_id', 'reason', 'tick'] as const;

export function appendZoningParcelReclaimed(
    audit: AuditChain,
    payload: ZoningParcelReclaimedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningParcelReclaimed: payload must be a plain object`);
    }
    // 2. Regex: former_owner_civic_did_hash (HEX64).
    if (typeof payload.former_owner_civic_did_hash !== 'string' || !HEX64_RE.test(payload.former_owner_civic_did_hash)) {
        throw new TypeError(`appendZoningParcelReclaimed: former_owner_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.former_owner_civic_did_hash)}`);
    }
    // 3. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningParcelReclaimed: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 4. Enum: reason.
    if (typeof payload.reason !== 'string'
        || !REASONS.includes(payload.reason as typeof REASONS[number])) {
        throw new TypeError(`appendZoningParcelReclaimed: reason must be one of ${JSON.stringify(REASONS)}, got ${JSON.stringify(payload.reason)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningParcelReclaimed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningParcelReclaimed: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        former_owner_civic_did_hash: payload.former_owner_civic_did_hash,
        parcel_id: payload.parcel_id,
        reason: payload.reason,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningParcelReclaimed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = parcel_id (the land returns to treasury).
    return audit.append('zoning.parcel_reclaimed', payload.parcel_id, cleanPayload);
}
