/**
 * Phase 60 HOUSE-3 (D-60-09.3 / R-60-06/11) — Sole-producer for treasury.structure_revenue.
 *
 * Closed 4-key payload: {amount_wei, parcel_id, tick, zone_tax_bps}.
 * actorDid = parcel_id (the revenue is attributed to the land, not a person — the
 *   buyer/seller identity is already audited via the market trade settlement). Mirrors
 *   treasury.parcel_revenue #83 — NO buyer/seller DID on this payload.
 *
 * Allowlist position 98. Records the per-zone tax SKIM (collected at settlement, never
 * filed) when a sale clears at a parcel-bound shop. amount_wei = the skimmed tax;
 * zone_tax_bps = the per-zone rate in basis points (founding-law ZONE_TAX_BPS).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface TreasuryStructureRevenuePayload {
    readonly amount_wei: number;   // positive integer (the skimmed zone tax, >0)
    readonly parcel_id: string;     // PARCEL_ID_RE
    readonly tick: number;          // non-negative integer
    readonly zone_tax_bps: number;  // positive integer (basis points, >0)
}

const EXPECTED_KEYS = ['amount_wei', 'parcel_id', 'tick', 'zone_tax_bps'] as const;

export function appendTreasuryStructureRevenue(
    audit: AuditChain,
    payload: TreasuryStructureRevenuePayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryStructureRevenue: payload must be a plain object`);
    }
    // 2. Positive integer: amount_wei.
    if (!Number.isInteger(payload.amount_wei) || payload.amount_wei <= 0) {
        throw new TypeError(`appendTreasuryStructureRevenue: amount_wei must be positive integer, got ${JSON.stringify(payload.amount_wei)}`);
    }
    // 3. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendTreasuryStructureRevenue: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryStructureRevenue: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Positive integer: zone_tax_bps.
    if (!Number.isInteger(payload.zone_tax_bps) || payload.zone_tax_bps <= 0) {
        throw new TypeError(`appendTreasuryStructureRevenue: zone_tax_bps must be positive integer, got ${JSON.stringify(payload.zone_tax_bps)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendTreasuryStructureRevenue: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_wei: payload.amount_wei,
        parcel_id: payload.parcel_id,
        tick: payload.tick,
        zone_tax_bps: payload.zone_tax_bps,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendTreasuryStructureRevenue: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = parcel_id (mirrors #83 — NO buyer/seller DID).
    return audit.append('treasury.structure_revenue', payload.parcel_id, cleanPayload);
}
