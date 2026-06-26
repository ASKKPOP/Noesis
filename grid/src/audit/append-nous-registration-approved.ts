/**
 * Phase 54 (PORTAL-05) — Sole-producer for nous.registration_approved.
 *
 * Emitted when a target-Grid Polis approves a Nous registration (charter compatible); Civic-DID
 * + residence follow. DID hashed. actorDid = registrant_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type NousRegistrationApprovedPayload, NOUS_REGISTRATION_APPROVED_KEYS } from '../portal-workflows/nous-registration-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendNousRegistrationApproved(audit: AuditChain, payload: NousRegistrationApprovedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendNousRegistrationApproved: payload must be a plain object`);
    }
    if (typeof payload.registrant_did_hash !== 'string' || !HEX64_RE.test(payload.registrant_did_hash)) {
        throw new TypeError(`appendNousRegistrationApproved: registrant_did_hash must match HEX64, got ${JSON.stringify(payload.registrant_did_hash)}`);
    }
    if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
        throw new TypeError(`appendNousRegistrationApproved: request_id must be a non-empty string`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendNousRegistrationApproved: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== NOUS_REGISTRATION_APPROVED_KEYS.length || !actualKeys.every((k, i) => k === NOUS_REGISTRATION_APPROVED_KEYS[i])) {
        throw new TypeError(`appendNousRegistrationApproved: closed-tuple violation — expected ${JSON.stringify(NOUS_REGISTRATION_APPROVED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { registrant_did_hash: payload.registrant_did_hash, request_id: payload.request_id, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendNousRegistrationApproved: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('nous.registration_approved', payload.registrant_did_hash, cleanPayload);
}
