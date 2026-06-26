/**
 * Phase 57 (ZONE-04) — Sole-producer for zoning.residence_assigned.
 *
 * Emitted when a new Civic-DID is auto-assigned a slot in the Residential zone (Phase 54 wires
 * this on issuance). DID hashed. actorDid = civic_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type ZoningResidenceAssignedPayload, ZONING_RESIDENCE_ASSIGNED_KEYS } from '../zoning/zone-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendZoningResidenceAssigned(audit: AuditChain, payload: ZoningResidenceAssignedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningResidenceAssigned: payload must be a plain object`);
    }
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendZoningResidenceAssigned: civic_did_hash must match HEX64, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    if (typeof payload.residence_id !== 'string' || payload.residence_id.length === 0) {
        throw new TypeError(`appendZoningResidenceAssigned: residence_id must be a non-empty string`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningResidenceAssigned: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== ZONING_RESIDENCE_ASSIGNED_KEYS.length || !actualKeys.every((k, i) => k === ZONING_RESIDENCE_ASSIGNED_KEYS[i])) {
        throw new TypeError(`appendZoningResidenceAssigned: closed-tuple violation — expected ${JSON.stringify(ZONING_RESIDENCE_ASSIGNED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { civic_did_hash: payload.civic_did_hash, residence_id: payload.residence_id, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendZoningResidenceAssigned: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('zoning.residence_assigned', payload.civic_did_hash, cleanPayload);
}
