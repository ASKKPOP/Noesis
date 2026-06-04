/**
 * Phase 46 (CIVGOV-03/06) — Sole-producer for gov.session_closed.
 *
 * Emitted when the Speaker closes a legislative session. outcome 'advanced_to_vote'
 * means the bill proceeds to a VOTE-05 commit-reveal vote (existing governance pipeline);
 * 'withdrawn' means debate ended without advancing. actorDid = speaker_civic_did_hash.
 * Closed 5-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type GovSessionClosedPayload, GOV_SESSION_CLOSED_KEYS } from '../gov/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_OUTCOMES = new Set(['advanced_to_vote', 'withdrawn']);

export function appendGovSessionClosed(
    audit: AuditChain,
    payload: GovSessionClosedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGovSessionClosed: payload must be a plain object`);
    }
    // 2. Regex: bill_id (UUID).
    if (typeof payload.bill_id !== 'string' || !UUID_RE.test(payload.bill_id)) {
        throw new TypeError(`appendGovSessionClosed: bill_id must be a UUID, got ${JSON.stringify(payload.bill_id)}`);
    }
    // 3. Regex: gov_session_id (UUID). (D-46-01: named gov_session_id, not session_id.)
    if (typeof payload.gov_session_id !== 'string' || !UUID_RE.test(payload.gov_session_id)) {
        throw new TypeError(`appendGovSessionClosed: gov_session_id must be a UUID, got ${JSON.stringify(payload.gov_session_id)}`);
    }
    // 4. Regex: speaker_civic_did_hash (HEX64).
    if (typeof payload.speaker_civic_did_hash !== 'string' || !HEX64_RE.test(payload.speaker_civic_did_hash)) {
        throw new TypeError(`appendGovSessionClosed: speaker_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.speaker_civic_did_hash)}`);
    }
    // 5. Enum: outcome.
    if (typeof payload.outcome !== 'string' || !VALID_OUTCOMES.has(payload.outcome)) {
        throw new TypeError(`appendGovSessionClosed: outcome must be one of ${JSON.stringify([...VALID_OUTCOMES])}, got ${JSON.stringify(payload.outcome)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGovSessionClosed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== GOV_SESSION_CLOSED_KEYS.length
        || !actualKeys.every((k, i) => k === GOV_SESSION_CLOSED_KEYS[i])) {
        throw new TypeError(`appendGovSessionClosed: closed-tuple violation — expected ${JSON.stringify(GOV_SESSION_CLOSED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        bill_id: payload.bill_id,
        gov_session_id: payload.gov_session_id,
        outcome: payload.outcome,
        speaker_civic_did_hash: payload.speaker_civic_did_hash,
        tick: payload.tick,
    };
    // 9. Privacy gate + audit.append. actorDid = speaker_civic_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGovSessionClosed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('gov.session_closed', payload.speaker_civic_did_hash, cleanPayload);
}
