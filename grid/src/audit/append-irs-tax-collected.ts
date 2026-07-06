/**
 * Phase 44 D-44-03 — Sole-producer for irs.tax_collected.
 *
 * AUDIT-CHAIN-ONLY (NOT on ALLOWLIST_MEMBERS in Phase 44).
 * Phase 45 will add this to ALLOWLIST_MEMBERS (+3 delta with disbursement_authorized + disbursement_executed).
 * Pattern mirrors append-irs-disbursement-executed.ts (Phase 41).
 *
 * Closed 5-key payload: {amount_wei, listing_id, payer_civic_did_hash, tick, total_treasury_after}.
 * actorDid = payer_civic_did_hash (the buyer who paid the IRS fee at settle time).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface IrsTaxCollectedPayload {
    readonly amount_wei: number;            // positive integer (>0)
    readonly listing_id: string;             // UUID_RE
    readonly payer_civic_did_hash: string;   // HEX64_RE — buyer civicDid sha256
    readonly tick: number;                   // non-negative integer
    readonly total_treasury_after: number;   // non-negative integer (≥0)
}

const EXPECTED_KEYS = ['amount_wei', 'listing_id', 'payer_civic_did_hash', 'tick', 'total_treasury_after'] as const;

export function appendIrsTaxCollected(
    audit: AuditChain,
    payload: IrsTaxCollectedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendIrsTaxCollected: payload must be a plain object`);
    }
    // 2. Regex: listing_id (UUID).
    if (typeof payload.listing_id !== 'string' || !UUID_RE.test(payload.listing_id)) {
        throw new TypeError(`appendIrsTaxCollected: listing_id must match UUID_RE, got ${JSON.stringify(payload.listing_id)}`);
    }
    // 2b. Regex: payer_civic_did_hash (HEX64).
    if (typeof payload.payer_civic_did_hash !== 'string' || !HEX64_RE.test(payload.payer_civic_did_hash)) {
        throw new TypeError(`appendIrsTaxCollected: payer_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.payer_civic_did_hash)}`);
    }
    // 3. Positive integer: amount_wei.
    if (!Number.isInteger(payload.amount_wei) || payload.amount_wei <= 0) {
        throw new TypeError(`appendIrsTaxCollected: amount_wei must be positive integer, got ${JSON.stringify(payload.amount_wei)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendIrsTaxCollected: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Non-negative integer: total_treasury_after.
    if (!Number.isInteger(payload.total_treasury_after) || payload.total_treasury_after < 0) {
        throw new TypeError(`appendIrsTaxCollected: total_treasury_after must be non-negative integer, got ${JSON.stringify(payload.total_treasury_after)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendIrsTaxCollected: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_wei: payload.amount_wei,
        listing_id: payload.listing_id,
        payer_civic_did_hash: payload.payer_civic_did_hash,
        tick: payload.tick,
        total_treasury_after: payload.total_treasury_after,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrsTaxCollected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = payer_civic_did_hash.
    //    NOTE: 'irs.tax_collected' is NOT in ALLOWLIST_MEMBERS — audit-chain-only.
    //    Phase 45 will add it to the allowlist.
    return audit.append('irs.tax_collected', payload.payer_civic_did_hash, cleanPayload);
}
