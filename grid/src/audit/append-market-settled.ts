/**
 * Phase 44 MKT-06 / D-44-01 — Sole-producer for market.settled.
 *
 * Closed 6-key payload: {buyer_civic_did_hash, irs_fee_wei, listing_id, price_wei, seller_business_did_hash, tick}.
 * actorDid = buyer_civic_did_hash.
 *
 * Allowlist position 71.
 * Note: After emit, appendIrsTaxCollected fires audit-chain-only (NOT on allowlist until Phase 45 — D-44-03).
 * irs_fee_wei is non-negative integer (0 valid when FLOOR(price * rate) = 0 for tiny amounts).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 6-key payload. Keys ALPHABETICAL. */
export interface MarketSettledPayload {
    readonly buyer_civic_did_hash: string;      // HEX64_RE
    readonly irs_fee_wei: number;              // non-negative integer (≥0, 0 valid if irs_fee_rate=0)
    readonly listing_id: string;                // UUID_RE
    readonly price_wei: number;                // positive integer (>0)
    readonly seller_business_did_hash: string;  // HEX64_RE
    readonly tick: number;                      // non-negative integer
}

const EXPECTED_KEYS = ['buyer_civic_did_hash', 'irs_fee_wei', 'listing_id', 'price_wei', 'seller_business_did_hash', 'tick'] as const;

export function appendMarketSettled(
    audit: AuditChain,
    payload: MarketSettledPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMarketSettled: payload must be a plain object`);
    }
    // 2. Regex: listing_id (UUID).
    if (typeof payload.listing_id !== 'string' || !UUID_RE.test(payload.listing_id)) {
        throw new TypeError(`appendMarketSettled: listing_id must match UUID_RE, got ${JSON.stringify(payload.listing_id)}`);
    }
    // 2b. Regex: buyer_civic_did_hash (HEX64).
    if (typeof payload.buyer_civic_did_hash !== 'string' || !HEX64_RE.test(payload.buyer_civic_did_hash)) {
        throw new TypeError(`appendMarketSettled: buyer_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.buyer_civic_did_hash)}`);
    }
    // 2c. Regex: seller_business_did_hash (HEX64).
    if (typeof payload.seller_business_did_hash !== 'string' || !HEX64_RE.test(payload.seller_business_did_hash)) {
        throw new TypeError(`appendMarketSettled: seller_business_did_hash must match HEX64_RE, got ${JSON.stringify(payload.seller_business_did_hash)}`);
    }
    // 3. Positive integer: price_wei.
    if (!Number.isInteger(payload.price_wei) || payload.price_wei <= 0) {
        throw new TypeError(`appendMarketSettled: price_wei must be positive integer, got ${JSON.stringify(payload.price_wei)}`);
    }
    // 4. Non-negative integer: irs_fee_wei (0 valid — FLOOR semantics).
    if (!Number.isInteger(payload.irs_fee_wei) || payload.irs_fee_wei < 0) {
        throw new TypeError(`appendMarketSettled: irs_fee_wei must be non-negative integer, got ${JSON.stringify(payload.irs_fee_wei)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMarketSettled: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendMarketSettled: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        buyer_civic_did_hash: payload.buyer_civic_did_hash,
        irs_fee_wei: payload.irs_fee_wei,
        listing_id: payload.listing_id,
        price_wei: payload.price_wei,
        seller_business_did_hash: payload.seller_business_did_hash,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendMarketSettled: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = buyer_civic_did_hash.
    return audit.append('market.settled', payload.buyer_civic_did_hash, cleanPayload);
}
