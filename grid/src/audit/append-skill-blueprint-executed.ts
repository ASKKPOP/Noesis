/**
 * Phase 61 HOUSE-4 / D-61-05 / R-61-07 — Sole-producer for skill.blueprint_executed.
 *
 * Closed 4-key payload (keys ALPHABETICAL): {blueprint_hash, builder_civic_did_hash,
 *   parcel_id, tick}.
 * actorDid = builder_civic_did_hash (the build is attributed to the hashed builder DID —
 *   the raw DID NEVER crosses; the blueprint_hash IS the Phase 18 skill hash).
 *
 * Allowlist position 100 (the ONE new HOUSE-4 event, +1 → 100). Emitted once per executed
 * build by the Wave-2 buildFromBlueprint executor via its emitBlueprintExecuted seam.
 *
 * Privacy (D-61-06): no recipe body, no sub-task content, no teaching location, no raw DID —
 *   only the hash, the hashed builder, the parcel, and the tick. No FORBIDDEN_KEY_PATTERN key.
 *
 * Clones the append-treasury-parcel-revenue / appendSkillTaught triad: closed-tuple
 *   Object.keys(payload).sort() check, explicit no-spread reconstruction, payloadPrivacyCheck
 *   gate, single audit.append.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
/** 64-char lowercase hex (full sha256 hexdigest). */
const HEX64_RE = /^[0-9a-f]{64}$/;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface SkillBlueprintExecutedPayload {
    readonly blueprint_hash: string;          // HEX64 (the Phase 18 skill hash)
    readonly builder_civic_did_hash: string;  // HEX64 (the hashed builder DID)
    readonly parcel_id: string;               // PARCEL_ID_RE
    readonly tick: number;                     // non-negative integer
}

const EXPECTED_KEYS = ['blueprint_hash', 'builder_civic_did_hash', 'parcel_id', 'tick'] as const;

export function appendSkillBlueprintExecuted(
    audit: AuditChain,
    payload: SkillBlueprintExecutedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendSkillBlueprintExecuted: payload must be a plain object`);
    }
    // 2. Hash format: blueprint_hash (64-char hex).
    if (typeof payload.blueprint_hash !== 'string' || !HEX64_RE.test(payload.blueprint_hash)) {
        throw new TypeError(`appendSkillBlueprintExecuted: blueprint_hash must be 64-char lowercase hex (HEX64), got ${JSON.stringify(payload.blueprint_hash)}`);
    }
    // 3. Hash format: builder_civic_did_hash (64-char hex — the builder DID is HASHED).
    if (typeof payload.builder_civic_did_hash !== 'string' || !HEX64_RE.test(payload.builder_civic_did_hash)) {
        throw new TypeError(`appendSkillBlueprintExecuted: builder_civic_did_hash must be 64-char lowercase hex (HEX64), got ${JSON.stringify(payload.builder_civic_did_hash)}`);
    }
    // 4. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendSkillBlueprintExecuted: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendSkillBlueprintExecuted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendSkillBlueprintExecuted: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        blueprint_hash: payload.blueprint_hash,
        builder_civic_did_hash: payload.builder_civic_did_hash,
        parcel_id: payload.parcel_id,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendSkillBlueprintExecuted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = builder_civic_did_hash.
    return audit.append('skill.blueprint_executed', payload.builder_civic_did_hash, cleanPayload);
}
