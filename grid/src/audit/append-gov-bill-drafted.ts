/**
 * Phase 46 (CIVGOV-01/06) — Sole-producer for gov.bill_drafted.
 *
 * Emitted when a Civic-DID holder drafts a legislative bill. Hash-only discipline:
 * the bill body lives Grid-side (gov_bills.body_text); only title_hash + body_hash cross.
 * actorDid = author_civic_did_hash (sha256 of the author's Civic-DID).
 * Closed 6-key payload (alphabetical): see GOV_BILL_DRAFTED_KEYS.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type GovBillDraftedPayload, GOV_BILL_DRAFTED_KEYS } from '../gov/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CATEGORY_LEN = 63;

export function appendGovBillDrafted(
    audit: AuditChain,
    payload: GovBillDraftedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGovBillDrafted: payload must be a plain object`);
    }
    // 2. Regex: author_civic_did_hash (HEX64).
    if (typeof payload.author_civic_did_hash !== 'string' || !HEX64_RE.test(payload.author_civic_did_hash)) {
        throw new TypeError(`appendGovBillDrafted: author_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.author_civic_did_hash)}`);
    }
    // 3. Regex: bill_id (UUID).
    if (typeof payload.bill_id !== 'string' || !UUID_RE.test(payload.bill_id)) {
        throw new TypeError(`appendGovBillDrafted: bill_id must be a UUID, got ${JSON.stringify(payload.bill_id)}`);
    }
    // 4. Regex: content_hash + title_hash (HEX64). (D-46-01: content_hash = sha256(body_text).)
    if (typeof payload.content_hash !== 'string' || !HEX64_RE.test(payload.content_hash)) {
        throw new TypeError(`appendGovBillDrafted: content_hash must match HEX64_RE, got ${JSON.stringify(payload.content_hash)}`);
    }
    if (typeof payload.title_hash !== 'string' || !HEX64_RE.test(payload.title_hash)) {
        throw new TypeError(`appendGovBillDrafted: title_hash must match HEX64_RE, got ${JSON.stringify(payload.title_hash)}`);
    }
    // 5. Non-empty bounded string: category.
    if (typeof payload.category !== 'string' || payload.category.length === 0 || payload.category.length > MAX_CATEGORY_LEN) {
        throw new TypeError(`appendGovBillDrafted: category must be non-empty string ≤${MAX_CATEGORY_LEN}, got ${JSON.stringify(payload.category)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGovBillDrafted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== GOV_BILL_DRAFTED_KEYS.length
        || !actualKeys.every((k, i) => k === GOV_BILL_DRAFTED_KEYS[i])) {
        throw new TypeError(`appendGovBillDrafted: closed-tuple violation — expected ${JSON.stringify(GOV_BILL_DRAFTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        author_civic_did_hash: payload.author_civic_did_hash,
        bill_id: payload.bill_id,
        category: payload.category,
        content_hash: payload.content_hash,
        tick: payload.tick,
        title_hash: payload.title_hash,
    };
    // 9. Privacy gate + audit.append. actorDid = author_civic_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGovBillDrafted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('gov.bill_drafted', payload.author_civic_did_hash, cleanPayload);
}
