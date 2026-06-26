/**
 * Phase 54 (PORTAL-05) — Sole-producer for nous.registration_rejected.
 *
 * Emitted when the Portal pre-screen OR the Polis charter review rejects a Nous registration
 * (closed-enum reason — no free text on the chain). actorDid = request_id. Closed 3-key.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type NousRegistrationRejectedPayload, NOUS_REGISTRATION_REJECTED_KEYS, NOUS_REJECT_REASONS } from '../portal-workflows/nous-registration-types.js';

export function appendNousRegistrationRejected(audit: AuditChain, payload: NousRegistrationRejectedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendNousRegistrationRejected: payload must be a plain object`);
    }
    if (!NOUS_REJECT_REASONS.includes(payload.reason_code)) {
        throw new TypeError(`appendNousRegistrationRejected: reason_code must be one of ${JSON.stringify(NOUS_REJECT_REASONS)}, got ${JSON.stringify(payload.reason_code)}`);
    }
    if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
        throw new TypeError(`appendNousRegistrationRejected: request_id must be a non-empty string`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendNousRegistrationRejected: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== NOUS_REGISTRATION_REJECTED_KEYS.length || !actualKeys.every((k, i) => k === NOUS_REGISTRATION_REJECTED_KEYS[i])) {
        throw new TypeError(`appendNousRegistrationRejected: closed-tuple violation — expected ${JSON.stringify(NOUS_REGISTRATION_REJECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { reason_code: payload.reason_code, request_id: payload.request_id, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendNousRegistrationRejected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('nous.registration_rejected', payload.request_id, cleanPayload);
}
