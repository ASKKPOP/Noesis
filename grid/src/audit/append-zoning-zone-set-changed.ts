/**
 * D-V3-40 (free zones) — Sole-producer for zoning.zone_set_changed.
 *
 * Emitted when Polis legislation adds, relabels or removes a zone of its Grid. DID hashed;
 * the label stays Grid-side (only label_hash crosses). actorDid = changed_by_did_hash.
 * 5-key closed tuple (alpha).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type ZoningZoneSetChangedPayload, ZONING_ZONE_SET_CHANGED_KEYS, ZONE_SET_ACTIONS, ZONE_ID_RE } from '../zoning/zone-types.js';
import { HEX64_RE } from '../util/id-patterns.js';

export function appendZoningZoneSetChanged(audit: AuditChain, payload: ZoningZoneSetChangedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendZoningZoneSetChanged: payload must be a plain object`);
    }
    if (!(ZONE_SET_ACTIONS as readonly string[]).includes(payload.action)) {
        throw new TypeError(`appendZoningZoneSetChanged: action must be one of ${JSON.stringify(ZONE_SET_ACTIONS)}, got ${JSON.stringify(payload.action)}`);
    }
    if (typeof payload.changed_by_did_hash !== 'string' || !HEX64_RE.test(payload.changed_by_did_hash)) {
        throw new TypeError(`appendZoningZoneSetChanged: changed_by_did_hash must match HEX64, got ${JSON.stringify(payload.changed_by_did_hash)}`);
    }
    if (typeof payload.label_hash !== 'string' || !HEX64_RE.test(payload.label_hash)) {
        throw new TypeError(`appendZoningZoneSetChanged: label_hash must match HEX64, got ${JSON.stringify(payload.label_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendZoningZoneSetChanged: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.zone_id !== 'string' || !ZONE_ID_RE.test(payload.zone_id)) {
        throw new TypeError(`appendZoningZoneSetChanged: zone_id must be a zone id, got ${JSON.stringify(payload.zone_id)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== ZONING_ZONE_SET_CHANGED_KEYS.length || !actualKeys.every((k, i) => k === ZONING_ZONE_SET_CHANGED_KEYS[i])) {
        throw new TypeError(`appendZoningZoneSetChanged: closed-tuple violation — expected ${JSON.stringify(ZONING_ZONE_SET_CHANGED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { action: payload.action, changed_by_did_hash: payload.changed_by_did_hash, label_hash: payload.label_hash, tick: payload.tick, zone_id: payload.zone_id };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendZoningZoneSetChanged: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('zoning.zone_set_changed', payload.changed_by_did_hash, cleanPayload);
}
