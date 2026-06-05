/**
 * Phase 48b LAND-03 / D-48b-01 — Sole-producer for zoning.structure_built.
 *
 * Closed 6-key payload: {name_hash, owner_civic_did_hash, parcel_id, structure_type, tick, visibility}.
 * actorDid = owner_civic_did_hash.
 *
 * Allowlist position 84. The parcel owner builds one structure. The plaintext
 * structure name lives Grid-side (ParcelRegistry / NDS) — only name_hash crosses
 * the audit boundary (`name` would be fine, but we hash for forward-compat with
 * the search directory that serves plaintext from registry state).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const STRUCTURE_TYPES = ['home', 'shop', 'workshop', 'venue'] as const;
const VISIBILITIES = ['open', 'private'] as const;

/** Closed 6-key payload. Keys ALPHABETICAL. */
export interface ZoningStructureBuiltPayload {
    readonly name_hash: string;            // HEX64_RE
    readonly owner_civic_did_hash: string; // HEX64_RE
    readonly parcel_id: string;            // PARCEL_ID_RE
    readonly structure_type: string;       // ∈ STRUCTURE_TYPES
    readonly tick: number;                 // non-negative integer
    readonly visibility: string;           // ∈ VISIBILITIES
}

const EXPECTED_KEYS = ['name_hash', 'owner_civic_did_hash', 'parcel_id', 'structure_type', 'tick', 'visibility'] as const;

export function appendZoningStructureBuilt(
    audit: AuditChain,
    payload: ZoningStructureBuiltPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningStructureBuilt: payload must be a plain object`);
    }
    // 2. Regex: name_hash (HEX64).
    if (typeof payload.name_hash !== 'string' || !HEX64_RE.test(payload.name_hash)) {
        throw new TypeError(`appendZoningStructureBuilt: name_hash must match HEX64_RE, got ${JSON.stringify(payload.name_hash)}`);
    }
    // 2b. Regex: owner_civic_did_hash (HEX64).
    if (typeof payload.owner_civic_did_hash !== 'string' || !HEX64_RE.test(payload.owner_civic_did_hash)) {
        throw new TypeError(`appendZoningStructureBuilt: owner_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.owner_civic_did_hash)}`);
    }
    // 2c. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningStructureBuilt: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 3. Enum: structure_type.
    if (typeof payload.structure_type !== 'string' || !STRUCTURE_TYPES.includes(payload.structure_type as typeof STRUCTURE_TYPES[number])) {
        throw new TypeError(`appendZoningStructureBuilt: structure_type must be one of ${JSON.stringify(STRUCTURE_TYPES)}, got ${JSON.stringify(payload.structure_type)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningStructureBuilt: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Enum: visibility.
    if (typeof payload.visibility !== 'string' || !VISIBILITIES.includes(payload.visibility as typeof VISIBILITIES[number])) {
        throw new TypeError(`appendZoningStructureBuilt: visibility must be one of ${JSON.stringify(VISIBILITIES)}, got ${JSON.stringify(payload.visibility)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningStructureBuilt: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        name_hash: payload.name_hash,
        owner_civic_did_hash: payload.owner_civic_did_hash,
        parcel_id: payload.parcel_id,
        structure_type: payload.structure_type,
        tick: payload.tick,
        visibility: payload.visibility,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningStructureBuilt: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = owner_civic_did_hash.
    return audit.append('zoning.structure_built', payload.owner_civic_did_hash, cleanPayload);
}
