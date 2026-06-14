/**
 * Phase 60 HOUSE-3 (D-60-09.4 / R-60-08/11) — Sole-producer for zoning.cowork_session.
 *
 * Closed 5-key payload: {end_tick, parcel_id, participant_count, participants_hash, start_tick}.
 * actorDid = parcel_id (the session is attributed to the land).
 *
 * participants_hash is a SINGLE HEX64 hash over the sorted participant Civic-DID set —
 * NO raw DIDs, NO board/task text, NO scope_ref body ever crosses the audit boundary
 * (D-60-10). Only the aggregated hash + a count + the tick span. Allowlist position 99.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface ZoningCoworkSessionPayload {
    readonly end_tick: number;          // non-negative integer
    readonly parcel_id: string;         // PARCEL_ID_RE
    readonly participant_count: number; // positive integer (>0)
    readonly participants_hash: string; // HEX64_RE (single hash over the sorted DID set)
    readonly start_tick: number;        // non-negative integer
}

const EXPECTED_KEYS = ['end_tick', 'parcel_id', 'participant_count', 'participants_hash', 'start_tick'] as const;

export function appendZoningCoworkSession(
    audit: AuditChain,
    payload: ZoningCoworkSessionPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningCoworkSession: payload must be a plain object`);
    }
    // 2. Non-negative integer: end_tick.
    if (!Number.isInteger(payload.end_tick) || payload.end_tick < 0) {
        throw new TypeError(`appendZoningCoworkSession: end_tick must be non-negative integer, got ${JSON.stringify(payload.end_tick)}`);
    }
    // 3. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningCoworkSession: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 4. Positive integer: participant_count.
    if (!Number.isInteger(payload.participant_count) || payload.participant_count <= 0) {
        throw new TypeError(`appendZoningCoworkSession: participant_count must be positive integer, got ${JSON.stringify(payload.participant_count)}`);
    }
    // 5. Regex: participants_hash (HEX64, single hash over the sorted DID set).
    if (typeof payload.participants_hash !== 'string' || !HEX64_RE.test(payload.participants_hash)) {
        throw new TypeError(`appendZoningCoworkSession: participants_hash must match HEX64_RE, got ${JSON.stringify(payload.participants_hash)}`);
    }
    // 6. Non-negative integer: start_tick.
    if (!Number.isInteger(payload.start_tick) || payload.start_tick < 0) {
        throw new TypeError(`appendZoningCoworkSession: start_tick must be non-negative integer, got ${JSON.stringify(payload.start_tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningCoworkSession: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        end_tick: payload.end_tick,
        parcel_id: payload.parcel_id,
        participant_count: payload.participant_count,
        participants_hash: payload.participants_hash,
        start_tick: payload.start_tick,
    };
    // 9. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningCoworkSession: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit. actorDid = parcel_id.
    return audit.append('zoning.cowork_session', payload.parcel_id, cleanPayload);
}
