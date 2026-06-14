/**
 * Phase 59 HOUSE-2 (D-59-01.2 / D-59-07 / D-59-09 / R-59-07/09) — sole-producer for
 * zoning.condition_changed. Allowlist position 93.
 *
 * Closed 4-key payload: {condition, owner_civic_did_hash, parcel_id, tick}.
 * actorDid = owner_civic_did_hash (the owner whose unpaid upkeep advanced the
 *   condition ladder is the actor of record).
 *
 * Emitted when the upkeep scanner walks a structure down the condition ladder
 * (maintained → worn → derelict) on a missed upkeep period, OR resets it to
 * maintained on a successful payment. Owner DID is hashed (HEX64) — the raw
 * Civic-DID NEVER crosses the audit boundary.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const CONDITIONS = ['maintained', 'worn', 'derelict'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface ZoningConditionChangedPayload {
    readonly condition: string;            // ∈ CONDITIONS
    readonly owner_civic_did_hash: string; // HEX64_RE
    readonly parcel_id: string;            // PARCEL_ID_RE
    readonly tick: number;                 // non-negative integer
}

const EXPECTED_KEYS = ['condition', 'owner_civic_did_hash', 'parcel_id', 'tick'] as const;

export function appendZoningConditionChanged(
    audit: AuditChain,
    payload: ZoningConditionChangedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningConditionChanged: payload must be a plain object`);
    }
    // 2. Enum: condition.
    if (typeof payload.condition !== 'string'
        || !CONDITIONS.includes(payload.condition as typeof CONDITIONS[number])) {
        throw new TypeError(`appendZoningConditionChanged: condition must be one of ${JSON.stringify(CONDITIONS)}, got ${JSON.stringify(payload.condition)}`);
    }
    // 3. Regex: owner_civic_did_hash (HEX64).
    if (typeof payload.owner_civic_did_hash !== 'string' || !HEX64_RE.test(payload.owner_civic_did_hash)) {
        throw new TypeError(`appendZoningConditionChanged: owner_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.owner_civic_did_hash)}`);
    }
    // 4. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningConditionChanged: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningConditionChanged: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningConditionChanged: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        condition: payload.condition,
        owner_civic_did_hash: payload.owner_civic_did_hash,
        parcel_id: payload.parcel_id,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningConditionChanged: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = owner_civic_did_hash.
    return audit.append('zoning.condition_changed', payload.owner_civic_did_hash, cleanPayload);
}
