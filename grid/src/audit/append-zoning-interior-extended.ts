/**
 * Phase 59 HOUSE-2 (D-59-01.1 / D-59-08 / R-59-04/09) — sole-producer for
 * zoning.interior_extended. Allowlist position 92 (the allowlist MEMBER is added in
 * Wave 4; this producer file lands in Wave 1 because the interior-tree contract test
 * verifies the closed-tuple + interior-never-broadcast boundary against it).
 *
 * Closed 4-key payload: {object_class, object_kind, parcel_id, tick}. actorDid =
 * parcel_id (the owner identity is already audited via zoning.structure_built #84).
 *
 * INTERIOR CONTENTS (area/object names, state, the tree) NEVER cross the audit
 * boundary — only the object_class enum + object_kind catalog enum are carried.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const PARCEL_ID_RE = /^[a-z0-9_-]+:[a-z_]+:\d{4}$/;
const OBJECT_CLASSES = ['mirror', 'functional'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface ZoningInteriorExtendedPayload {
    readonly object_class: string;  // ∈ OBJECT_CLASSES
    readonly object_kind: string;   // a furniture catalog kind
    readonly parcel_id: string;     // PARCEL_ID_RE
    readonly tick: number;          // non-negative integer
}

const EXPECTED_KEYS = ['object_class', 'object_kind', 'parcel_id', 'tick'] as const;

export function appendZoningInteriorExtended(
    audit: AuditChain,
    payload: ZoningInteriorExtendedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningInteriorExtended: payload must be a plain object`);
    }
    // 2. Enum: object_class.
    if (typeof payload.object_class !== 'string'
        || !OBJECT_CLASSES.includes(payload.object_class as typeof OBJECT_CLASSES[number])) {
        throw new TypeError(`appendZoningInteriorExtended: object_class must be one of ${JSON.stringify(OBJECT_CLASSES)}, got ${JSON.stringify(payload.object_class)}`);
    }
    // 3. object_kind must be a non-empty string (catalog membership enforced at the route/registry).
    if (typeof payload.object_kind !== 'string' || payload.object_kind.length === 0) {
        throw new TypeError(`appendZoningInteriorExtended: object_kind must be a non-empty string, got ${JSON.stringify(payload.object_kind)}`);
    }
    // 4. Regex: parcel_id (slug address).
    if (typeof payload.parcel_id !== 'string' || !PARCEL_ID_RE.test(payload.parcel_id)) {
        throw new TypeError(`appendZoningInteriorExtended: parcel_id must match PARCEL_ID_RE, got ${JSON.stringify(payload.parcel_id)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningInteriorExtended: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendZoningInteriorExtended: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        object_class: payload.object_class,
        object_kind: payload.object_kind,
        parcel_id: payload.parcel_id,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendZoningInteriorExtended: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = parcel_id (owner already audited via #84).
    return audit.append('zoning.interior_extended', payload.parcel_id, cleanPayload);
}
