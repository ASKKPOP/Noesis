/**
 * L2b (D-MONEY-08 / L2b) — Sole-producer for procurement.bid_placed.
 *
 * Emitted when a Nous places a bid on an open procurement notice.
 * bidder_did_hash is SHA-256 of the bidder's Civic DID —
 * raw DID NEVER crosses the audit boundary.
 *
 * Closed 5-key payload (alphabetical): { bid_id, bidder_did_hash, notice_id,
 * price_wei, tick }.
 * actorDid = bidder_did_hash (HEX64).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface ProcurementBidPlacedPayload {
    readonly bid_id: string;            // UUID_RE
    readonly bidder_did_hash: string;   // HEX64_RE — sha256 of bidder Civic DID
    readonly notice_id: string;         // UUID_RE
    readonly price_wei: string;         // decimal digit string (/^[0-9]+$/)
    readonly tick: number;              // non-negative integer
}

const EXPECTED_KEYS = ['bid_id', 'bidder_did_hash', 'notice_id', 'price_wei', 'tick'] as const;

export function appendProcurementBidPlaced(
    audit: AuditChain,
    payload: ProcurementBidPlacedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendProcurementBidPlaced: payload must be a plain object`);
    }
    // 2. Regex: bidder_did_hash (HEX64).
    if (typeof payload.bidder_did_hash !== 'string' || !HEX64_RE.test(payload.bidder_did_hash)) {
        throw new TypeError(`appendProcurementBidPlaced: bidder_did_hash must match HEX64_RE, got ${JSON.stringify(payload.bidder_did_hash)}`);
    }
    // 3. Regex: bid_id (UUID).
    if (typeof payload.bid_id !== 'string' || !UUID_RE.test(payload.bid_id)) {
        throw new TypeError(`appendProcurementBidPlaced: bid_id must match UUID_RE, got ${JSON.stringify(payload.bid_id)}`);
    }
    // 4. Regex: notice_id (UUID).
    if (typeof payload.notice_id !== 'string' || !UUID_RE.test(payload.notice_id)) {
        throw new TypeError(`appendProcurementBidPlaced: notice_id must match UUID_RE, got ${JSON.stringify(payload.notice_id)}`);
    }
    // 5. Decimal string: price_wei.
    if (typeof payload.price_wei !== 'string' || !DECIMAL_RE.test(payload.price_wei)) {
        throw new TypeError(`appendProcurementBidPlaced: price_wei must match /^[0-9]+$/, got ${JSON.stringify(payload.price_wei)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendProcurementBidPlaced: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendProcurementBidPlaced: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        bid_id: payload.bid_id,
        bidder_did_hash: payload.bidder_did_hash,
        notice_id: payload.notice_id,
        price_wei: payload.price_wei,
        tick: payload.tick,
    };
    // 9. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendProcurementBidPlaced: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit. actorDid = bidder_did_hash.
    return audit.append('procurement.bid_placed', payload.bidder_did_hash, cleanPayload);
}
