/**
 * Phase 59 HOUSE-2 (D-59-01.4 / D-59-06 / D-59-09 / R-59-06/09) — sole-producer for
 * treasury.upkeep_collected. Allowlist position 95.
 *
 * Closed 4-key payload: {amount_wei, owner_civic_did_hash, parcel_id, tick}.
 * actorDid = parcel_id (the upkeep is attributed to the land, not a person —
 *   mirrors treasury.parcel_revenue #83 land-attribution discipline).
 *
 * Emitted when the upkeep scanner auto-debits owner Ousia → TREASURY_DID on a
 * period boundary. The owner DID is hashed (HEX64) — the raw Civic-DID NEVER
 * crosses the audit boundary. Mirrors the irs.* / treasury.* revenue discipline
 * (amount_wei positive integer).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface TreasuryUpkeepCollectedPayload {
    readonly amount_wei: number;          // positive integer (>0)
    readonly owner_civic_did_hash: string; // HEX64_RE
    readonly parcel_id: string;            // PARCEL_ID_RE
    readonly tick: number;                 // non-negative integer
}

const EXPECTED_KEYS = ['amount_wei', 'owner_civic_did_hash', 'parcel_id', 'tick'] as const;

export function appendTreasuryUpkeepCollected(
    audit: AuditChain,
    payload: TreasuryUpkeepCollectedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryUpkeepCollected: payload must be a plain object`);
    }
    // 2. Positive integer: amount_wei.
    if (!Number.isInteger(payload.amount_wei) || payload.amount_wei <= 0) {
        throw new TypeError(`appendTreasuryUpkeepCollected: amount_wei must be positive integer, got ${JSON.stringify(payload.amount_wei)}`);
    }
    // 3. Regex: owner_civic_did_hash (HEX64).
    if (typeof payload.owner_civic_did_hash !== 'string' || !HEX64_RE.test(payload.owner_civic_did_hash)) {
        throw new TypeError(`appendTreasuryUpkeepCollected: owner_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.owner_civic_did_hash)}`);
    }
    // 4. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendTreasuryUpkeepCollected: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryUpkeepCollected: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendTreasuryUpkeepCollected: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_wei: payload.amount_wei,
        owner_civic_did_hash: payload.owner_civic_did_hash,
        parcel_id: payload.parcel_id,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendTreasuryUpkeepCollected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = parcel_id (mirrors treasury.parcel_revenue #83).
    return audit.append('treasury.upkeep_collected', payload.parcel_id, cleanPayload);
}
