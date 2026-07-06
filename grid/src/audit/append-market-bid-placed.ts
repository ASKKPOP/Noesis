/**
 * Phase 44 MKT-06 / D-44-01 — Sole-producer for market.bid_placed.
 *
 * Closed 4-key payload: {bidder_civic_did_hash, listing_id, offer_price_wei, tick}.
 * actorDid = bidder_civic_did_hash.
 *
 * Allowlist position 70.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface MarketBidPlacedPayload {
    readonly bidder_civic_did_hash: string;  // HEX64_RE
    readonly listing_id: string;             // UUID_RE
    readonly offer_price_wei: number;       // positive integer (>0)
    readonly tick: number;                   // non-negative integer
}

const EXPECTED_KEYS = ['bidder_civic_did_hash', 'listing_id', 'offer_price_wei', 'tick'] as const;

export function appendMarketBidPlaced(
    audit: AuditChain,
    payload: MarketBidPlacedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMarketBidPlaced: payload must be a plain object`);
    }
    // 2. Regex: listing_id (UUID).
    if (typeof payload.listing_id !== 'string' || !UUID_RE.test(payload.listing_id)) {
        throw new TypeError(`appendMarketBidPlaced: listing_id must match UUID_RE, got ${JSON.stringify(payload.listing_id)}`);
    }
    // 2b. Regex: bidder_civic_did_hash (HEX64).
    if (typeof payload.bidder_civic_did_hash !== 'string' || !HEX64_RE.test(payload.bidder_civic_did_hash)) {
        throw new TypeError(`appendMarketBidPlaced: bidder_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.bidder_civic_did_hash)}`);
    }
    // 3. Positive integer: offer_price_wei.
    if (!Number.isInteger(payload.offer_price_wei) || payload.offer_price_wei <= 0) {
        throw new TypeError(`appendMarketBidPlaced: offer_price_wei must be positive integer, got ${JSON.stringify(payload.offer_price_wei)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMarketBidPlaced: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendMarketBidPlaced: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        bidder_civic_did_hash: payload.bidder_civic_did_hash,
        listing_id: payload.listing_id,
        offer_price_wei: payload.offer_price_wei,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendMarketBidPlaced: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = bidder_civic_did_hash.
    return audit.append('market.bid_placed', payload.bidder_civic_did_hash, cleanPayload);
}
