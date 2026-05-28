/**
 * Phase 44 MKT-06 / D-44-01 — Sole-producer for market.disputed.
 *
 * Closed 4-key payload: {complainant_civic_did_hash, dispute_id, listing_id, tick}.
 * actorDid = complainant_civic_did_hash.
 *
 * Allowlist position 72.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface MarketDisputedPayload {
    readonly complainant_civic_did_hash: string;  // HEX64_RE
    readonly dispute_id: string;                   // UUID_RE
    readonly listing_id: string;                   // UUID_RE
    readonly tick: number;                         // non-negative integer
}

const EXPECTED_KEYS = ['complainant_civic_did_hash', 'dispute_id', 'listing_id', 'tick'] as const;

export function appendMarketDisputed(
    audit: AuditChain,
    payload: MarketDisputedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMarketDisputed: payload must be a plain object`);
    }
    // 2. Regex: dispute_id (UUID).
    if (typeof payload.dispute_id !== 'string' || !UUID_RE.test(payload.dispute_id)) {
        throw new TypeError(`appendMarketDisputed: dispute_id must match UUID_RE, got ${JSON.stringify(payload.dispute_id)}`);
    }
    // 2b. Regex: listing_id (UUID).
    if (typeof payload.listing_id !== 'string' || !UUID_RE.test(payload.listing_id)) {
        throw new TypeError(`appendMarketDisputed: listing_id must match UUID_RE, got ${JSON.stringify(payload.listing_id)}`);
    }
    // 2c. Regex: complainant_civic_did_hash (HEX64).
    if (typeof payload.complainant_civic_did_hash !== 'string' || !HEX64_RE.test(payload.complainant_civic_did_hash)) {
        throw new TypeError(`appendMarketDisputed: complainant_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.complainant_civic_did_hash)}`);
    }
    // 3. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMarketDisputed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 4. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendMarketDisputed: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 5. Explicit reconstruction — no spread.
    const cleanPayload = {
        complainant_civic_did_hash: payload.complainant_civic_did_hash,
        dispute_id: payload.dispute_id,
        listing_id: payload.listing_id,
        tick: payload.tick,
    };
    // 6. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendMarketDisputed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 7. Commit. actorDid = complainant_civic_did_hash.
    return audit.append('market.disputed', payload.complainant_civic_did_hash, cleanPayload);
}
