/**
 * Phase 54 (PORTAL-04) — Sole-producer for nous.registration_requested.
 *
 * Emitted when a Nous registration (Type A/B) enters the Portal pipeline. DID hashed.
 * actorDid = registrant_did_hash. Closed 5-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type NousRegistrationRequestedPayload, NOUS_REGISTRATION_REQUESTED_KEYS } from '../portal-workflows/nous-registration-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendNousRegistrationRequested(audit: AuditChain, payload: NousRegistrationRequestedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendNousRegistrationRequested: payload must be a plain object`);
    }
    if (typeof payload.registrant_did_hash !== 'string' || !HEX64_RE.test(payload.registrant_did_hash)) {
        throw new TypeError(`appendNousRegistrationRequested: registrant_did_hash must match HEX64, got ${JSON.stringify(payload.registrant_did_hash)}`);
    }
    if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
        throw new TypeError(`appendNousRegistrationRequested: request_id must be a non-empty string`);
    }
    if (typeof payload.target_grid !== 'string' || payload.target_grid.length === 0) {
        throw new TypeError(`appendNousRegistrationRequested: target_grid must be a non-empty string`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendNousRegistrationRequested: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (payload.type !== 'A' && payload.type !== 'B') {
        throw new TypeError(`appendNousRegistrationRequested: type must be 'A' or 'B', got ${JSON.stringify(payload.type)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== NOUS_REGISTRATION_REQUESTED_KEYS.length || !actualKeys.every((k, i) => k === NOUS_REGISTRATION_REQUESTED_KEYS[i])) {
        throw new TypeError(`appendNousRegistrationRequested: closed-tuple violation — expected ${JSON.stringify(NOUS_REGISTRATION_REQUESTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { registrant_did_hash: payload.registrant_did_hash, request_id: payload.request_id, target_grid: payload.target_grid, tick: payload.tick, type: payload.type };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendNousRegistrationRequested: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('nous.registration_requested', payload.registrant_did_hash, cleanPayload);
}
