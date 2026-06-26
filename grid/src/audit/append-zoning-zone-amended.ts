/**
 * Phase 57 (ZONE-01) — Sole-producer for zoning.zone_amended.
 *
 * Emitted when Polis legislation amends a zone's tax modifier (the 6 zone TYPES are immutable —
 * only sizes/rules change, D-V3-32). DID hashed. actorDid = amended_by_did_hash. 4-key (alpha).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type ZoningZoneAmendedPayload, ZONING_ZONE_AMENDED_KEYS, isZoneType } from '../zoning/zone-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendZoningZoneAmended(audit: AuditChain, payload: ZoningZoneAmendedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningZoneAmended: payload must be a plain object`);
    }
    if (typeof payload.amended_by_did_hash !== 'string' || !HEX64_RE.test(payload.amended_by_did_hash)) {
        throw new TypeError(`appendZoningZoneAmended: amended_by_did_hash must match HEX64, got ${JSON.stringify(payload.amended_by_did_hash)}`);
    }
    if (!Number.isInteger(payload.tax_modifier_bps) || payload.tax_modifier_bps < 0 || payload.tax_modifier_bps > 10000) {
        throw new TypeError(`appendZoningZoneAmended: tax_modifier_bps must be an integer in [0,10000], got ${JSON.stringify(payload.tax_modifier_bps)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningZoneAmended: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (!isZoneType(payload.zone_id)) {
        throw new TypeError(`appendZoningZoneAmended: zone_id must be a canonical zone type, got ${JSON.stringify(payload.zone_id)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== ZONING_ZONE_AMENDED_KEYS.length || !actualKeys.every((k, i) => k === ZONING_ZONE_AMENDED_KEYS[i])) {
        throw new TypeError(`appendZoningZoneAmended: closed-tuple violation — expected ${JSON.stringify(ZONING_ZONE_AMENDED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { amended_by_did_hash: payload.amended_by_did_hash, tax_modifier_bps: payload.tax_modifier_bps, tick: payload.tick, zone_id: payload.zone_id };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendZoningZoneAmended: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('zoning.zone_amended', payload.amended_by_did_hash, cleanPayload);
}
