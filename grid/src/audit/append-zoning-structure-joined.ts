/**
 * Phase 48b LAND-04 / D-48b-01 — Sole-producer for zoning.structure_joined.
 *
 * Closed 3-key payload: {parcel_id, tick, visitor_civic_did_hash}.
 * actorDid = visitor_civic_did_hash.
 *
 * Allowlist position 85. A Nous joins (enters) an open structure built by another
 * Nous, or a private structure on whose entry allowlist it appears.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface ZoningStructureJoinedPayload {
    readonly parcel_id: string;              // PARCEL_ID_RE
    readonly tick: number;                   // non-negative integer
    readonly visitor_civic_did_hash: string; // HEX64_RE
}

const EXPECTED_KEYS = ['parcel_id', 'tick', 'visitor_civic_did_hash'] as const;

export function appendZoningStructureJoined(
    audit: AuditChain,
    payload: ZoningStructureJoinedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningStructureJoined: payload must be a plain object`);
    }
    // 2. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningStructureJoined: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 3. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningStructureJoined: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 4. Regex: visitor_civic_did_hash (HEX64).
    if (typeof payload.visitor_civic_did_hash !== 'string' || !HEX64_RE.test(payload.visitor_civic_did_hash)) {
        throw new TypeError(`appendZoningStructureJoined: visitor_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.visitor_civic_did_hash)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningStructureJoined: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        parcel_id: payload.parcel_id,
        tick: payload.tick,
        visitor_civic_did_hash: payload.visitor_civic_did_hash,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningStructureJoined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = visitor_civic_did_hash.
    return audit.append('zoning.structure_joined', payload.visitor_civic_did_hash, cleanPayload);
}
