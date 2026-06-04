/**
 * Phase 46 (CIVGOV-02/06) — Sole-producer for gov.bill_cosponsored.
 *
 * Emitted when a distinct Civic-DID holder co-sponsors a bill. Once cosponsor_count
 * reaches the configured threshold (N≥2), the bill becomes session-eligible.
 * actorDid = cosponsor_civic_did_hash. Closed 4-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type GovBillCosponsoredPayload, GOV_BILL_COSPONSORED_KEYS } from '../gov/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appendGovBillCosponsored(
    audit: AuditChain,
    payload: GovBillCosponsoredPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGovBillCosponsored: payload must be a plain object`);
    }
    // 2. Regex: bill_id (UUID).
    if (typeof payload.bill_id !== 'string' || !UUID_RE.test(payload.bill_id)) {
        throw new TypeError(`appendGovBillCosponsored: bill_id must be a UUID, got ${JSON.stringify(payload.bill_id)}`);
    }
    // 3. Regex: cosponsor_civic_did_hash (HEX64).
    if (typeof payload.cosponsor_civic_did_hash !== 'string' || !HEX64_RE.test(payload.cosponsor_civic_did_hash)) {
        throw new TypeError(`appendGovBillCosponsored: cosponsor_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.cosponsor_civic_did_hash)}`);
    }
    // 4. Positive integer: cosponsor_count.
    if (!Number.isInteger(payload.cosponsor_count) || payload.cosponsor_count <= 0) {
        throw new TypeError(`appendGovBillCosponsored: cosponsor_count must be positive integer, got ${JSON.stringify(payload.cosponsor_count)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGovBillCosponsored: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== GOV_BILL_COSPONSORED_KEYS.length
        || !actualKeys.every((k, i) => k === GOV_BILL_COSPONSORED_KEYS[i])) {
        throw new TypeError(`appendGovBillCosponsored: closed-tuple violation — expected ${JSON.stringify(GOV_BILL_COSPONSORED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        bill_id: payload.bill_id,
        cosponsor_civic_did_hash: payload.cosponsor_civic_did_hash,
        cosponsor_count: payload.cosponsor_count,
        tick: payload.tick,
    };
    // 8. Privacy gate + audit.append. actorDid = cosponsor_civic_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGovBillCosponsored: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('gov.bill_cosponsored', payload.cosponsor_civic_did_hash, cleanPayload);
}
