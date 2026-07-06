/**
 * Phase 44 MKT-01 / MKT-06 / D-44-01 — Sole-producer for market.listing_created.
 *
 * Closed 5-key payload: {category, listing_id, price_wei, seller_business_did_hash, tick}.
 * actorDid = seller_business_did_hash.
 *
 * Allowlist position 69. Listing title/description live in marketplace_listings DB table —
 * audit chain carries listing_id only (description matches FORBIDDEN_KEY_PATTERN).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface MarketListingCreatedPayload {
    readonly category: string;                  // non-empty, ≤63 chars
    readonly listing_id: string;                // UUID_RE
    readonly price_wei: number;                // positive integer (>0)
    readonly seller_business_did_hash: string;  // HEX64_RE
    readonly tick: number;                      // non-negative integer
}

const EXPECTED_KEYS = ['category', 'listing_id', 'price_wei', 'seller_business_did_hash', 'tick'] as const;

export function appendMarketListingCreated(
    audit: AuditChain,
    payload: MarketListingCreatedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMarketListingCreated: payload must be a plain object`);
    }
    // 2. Regex: listing_id (UUID).
    if (typeof payload.listing_id !== 'string' || !UUID_RE.test(payload.listing_id)) {
        throw new TypeError(`appendMarketListingCreated: listing_id must match UUID_RE, got ${JSON.stringify(payload.listing_id)}`);
    }
    // 2b. Regex: seller_business_did_hash (HEX64).
    if (typeof payload.seller_business_did_hash !== 'string' || !HEX64_RE.test(payload.seller_business_did_hash)) {
        throw new TypeError(`appendMarketListingCreated: seller_business_did_hash must match HEX64_RE, got ${JSON.stringify(payload.seller_business_did_hash)}`);
    }
    // 3. Non-empty string: category (≤63 chars).
    if (typeof payload.category !== 'string' || payload.category.length === 0 || payload.category.length > 63) {
        throw new TypeError(`appendMarketListingCreated: category must be non-empty string ≤63 chars, got ${JSON.stringify(payload.category)}`);
    }
    // 4. Positive integer: price_wei.
    if (!Number.isInteger(payload.price_wei) || payload.price_wei <= 0) {
        throw new TypeError(`appendMarketListingCreated: price_wei must be positive integer, got ${JSON.stringify(payload.price_wei)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMarketListingCreated: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendMarketListingCreated: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        category: payload.category,
        listing_id: payload.listing_id,
        price_wei: payload.price_wei,
        seller_business_did_hash: payload.seller_business_did_hash,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendMarketListingCreated: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = seller_business_did_hash.
    return audit.append('market.listing_created', payload.seller_business_did_hash, cleanPayload);
}
