/**
 * Phase 48b LAND-02 / D-48b-01 — Sole-producer for treasury.parcel_revenue.
 *
 * Closed 3-key payload: {amount_wei, parcel_id, tick}.
 * actorDid = parcel_id (the revenue is attributed to the land, not a person —
 *   the buyer's identity is already audited via zoning.parcel_purchased #82).
 *
 * Allowlist position 83. Records the bios credit into the Polis civic treasury
 * when a parcel is sold. Mirrors the irs.* revenue discipline (amount_wei).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface TreasuryParcelRevenuePayload {
    readonly amount_wei: number; // positive integer (>0)
    readonly parcel_id: string;   // PARCEL_ID_RE
    readonly tick: number;        // non-negative integer
}

const EXPECTED_KEYS = ['amount_wei', 'parcel_id', 'tick'] as const;

export function appendTreasuryParcelRevenue(
    audit: AuditChain,
    payload: TreasuryParcelRevenuePayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryParcelRevenue: payload must be a plain object`);
    }
    // 2. Positive integer: amount_wei.
    if (!Number.isInteger(payload.amount_wei) || payload.amount_wei <= 0) {
        throw new TypeError(`appendTreasuryParcelRevenue: amount_wei must be positive integer, got ${JSON.stringify(payload.amount_wei)}`);
    }
    // 3. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendTreasuryParcelRevenue: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryParcelRevenue: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendTreasuryParcelRevenue: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_wei: payload.amount_wei,
        parcel_id: payload.parcel_id,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendTreasuryParcelRevenue: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = parcel_id.
    return audit.append('treasury.parcel_revenue', payload.parcel_id, cleanPayload);
}
