/**
 * Phase 46 (CIVGOV-03/06) — Sole-producer for gov.session_opened.
 *
 * Emitted when the Speaker opens a scheduled legislative session on a co-sponsored bill.
 * speaker_civic_did_hash = sha256 of the Speaker's CIVIC DID (never the did:gov: issuer —
 * carries D-45-06 forward; a did:gov: value hashed-as-civic is fine since we hash, but the
 * route supplies a civic DID / civic placeholder, not the gov issuer string).
 * actorDid = speaker_civic_did_hash. Closed 5-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type GovSessionOpenedPayload, GOV_SESSION_OPENED_KEYS } from '../gov/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appendGovSessionOpened(
    audit: AuditChain,
    payload: GovSessionOpenedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGovSessionOpened: payload must be a plain object`);
    }
    // 2. Regex: bill_id (UUID).
    if (typeof payload.bill_id !== 'string' || !UUID_RE.test(payload.bill_id)) {
        throw new TypeError(`appendGovSessionOpened: bill_id must be a UUID, got ${JSON.stringify(payload.bill_id)}`);
    }
    // 3. Regex: gov_session_id (UUID). (D-46-01: named gov_session_id, not session_id.)
    if (typeof payload.gov_session_id !== 'string' || !UUID_RE.test(payload.gov_session_id)) {
        throw new TypeError(`appendGovSessionOpened: gov_session_id must be a UUID, got ${JSON.stringify(payload.gov_session_id)}`);
    }
    // 4. Regex: speaker_civic_did_hash (HEX64).
    if (typeof payload.speaker_civic_did_hash !== 'string' || !HEX64_RE.test(payload.speaker_civic_did_hash)) {
        throw new TypeError(`appendGovSessionOpened: speaker_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.speaker_civic_did_hash)}`);
    }
    // 5. Positive integer: debate_deadline_tick. Non-negative integer: tick.
    if (!Number.isInteger(payload.debate_deadline_tick) || payload.debate_deadline_tick <= 0) {
        throw new TypeError(`appendGovSessionOpened: debate_deadline_tick must be positive integer, got ${JSON.stringify(payload.debate_deadline_tick)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGovSessionOpened: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== GOV_SESSION_OPENED_KEYS.length
        || !actualKeys.every((k, i) => k === GOV_SESSION_OPENED_KEYS[i])) {
        throw new TypeError(`appendGovSessionOpened: closed-tuple violation — expected ${JSON.stringify(GOV_SESSION_OPENED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        bill_id: payload.bill_id,
        debate_deadline_tick: payload.debate_deadline_tick,
        gov_session_id: payload.gov_session_id,
        speaker_civic_did_hash: payload.speaker_civic_did_hash,
        tick: payload.tick,
    };
    // 8. Privacy gate + audit.append. actorDid = speaker_civic_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGovSessionOpened: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('gov.session_opened', payload.speaker_civic_did_hash, cleanPayload);
}
