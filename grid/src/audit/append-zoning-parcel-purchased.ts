/**
 * Phase 48b LAND-01 / D-48b-01 — Sole-producer for zoning.parcel_purchased.
 *
 * Closed 5-key payload: {buyer_civic_did_hash, parcel_id, price_wei, tick, zone_id}.
 * actorDid = buyer_civic_did_hash.
 *
 * Allowlist position 82. A Nous buys an unclaimed parcel from the Polis treasury.
 * DIDs are hashed (HEX64) on the chain like the market and gov events — raw DID never crosses.
 * parcel_id is the canonical slug address (e.g. "genesis:residential:0007").
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface ZoningParcelPurchasedPayload {
    readonly buyer_civic_did_hash: string; // HEX64_RE
    readonly parcel_id: string;            // PARCEL_ID_RE
    readonly price_wei: number;           // positive integer (>0)
    readonly tick: number;                 // non-negative integer
    readonly zone_id: string;              // non-empty, ≤63 chars
}

const EXPECTED_KEYS = ['buyer_civic_did_hash', 'parcel_id', 'price_wei', 'tick', 'zone_id'] as const;

export function appendZoningParcelPurchased(
    audit: AuditChain,
    payload: ZoningParcelPurchasedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningParcelPurchased: payload must be a plain object`);
    }
    // 2. Regex: buyer_civic_did_hash (HEX64).
    if (typeof payload.buyer_civic_did_hash !== 'string' || !HEX64_RE.test(payload.buyer_civic_did_hash)) {
        throw new TypeError(`appendZoningParcelPurchased: buyer_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.buyer_civic_did_hash)}`);
    }
    // 2b. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningParcelPurchased: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 3. Positive integer: price_wei.
    if (!Number.isInteger(payload.price_wei) || payload.price_wei <= 0) {
        throw new TypeError(`appendZoningParcelPurchased: price_wei must be positive integer, got ${JSON.stringify(payload.price_wei)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningParcelPurchased: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Non-empty string: zone_id (≤63 chars).
    if (typeof payload.zone_id !== 'string' || payload.zone_id.length === 0 || payload.zone_id.length > 63) {
        throw new TypeError(`appendZoningParcelPurchased: zone_id must be non-empty string ≤63 chars, got ${JSON.stringify(payload.zone_id)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningParcelPurchased: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        buyer_civic_did_hash: payload.buyer_civic_did_hash,
        parcel_id: payload.parcel_id,
        price_wei: payload.price_wei,
        tick: payload.tick,
        zone_id: payload.zone_id,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningParcelPurchased: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = buyer_civic_did_hash.
    return audit.append('zoning.parcel_purchased', payload.buyer_civic_did_hash, cleanPayload);
}
