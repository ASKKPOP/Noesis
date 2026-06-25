/**
 * Phase 47 (POL-02) — Sole-producer for police.investigation_opened.
 *
 * Emitted when Police open an investigation from a complaint or a marketplace dispute.
 * complaint_id / dispute_id are nullable but ALWAYS present (closed tuple): exactly one
 * is non-null. actorDid = investigation_id (a civic act). Closed 4-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PoliceInvestigationOpenedPayload, POLICE_INVESTIGATION_OPENED_KEYS } from '../police/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appendPoliceInvestigationOpened(
    audit: AuditChain,
    payload: PoliceInvestigationOpenedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPoliceInvestigationOpened: payload must be a plain object`);
    }
    // 2. Nullable UUID: complaint_id.
    if (payload.complaint_id !== null && (typeof payload.complaint_id !== 'string' || !UUID_RE.test(payload.complaint_id))) {
        throw new TypeError(`appendPoliceInvestigationOpened: complaint_id must be a UUID or null, got ${JSON.stringify(payload.complaint_id)}`);
    }
    // 3. Nullable UUID: dispute_id.
    if (payload.dispute_id !== null && (typeof payload.dispute_id !== 'string' || !UUID_RE.test(payload.dispute_id))) {
        throw new TypeError(`appendPoliceInvestigationOpened: dispute_id must be a UUID or null, got ${JSON.stringify(payload.dispute_id)}`);
    }
    // 4. Exactly one source present (a complaint OR a dispute, never neither/both).
    if ((payload.complaint_id === null) === (payload.dispute_id === null)) {
        throw new TypeError(`appendPoliceInvestigationOpened: exactly one of complaint_id / dispute_id must be non-null`);
    }
    // 5. Regex: investigation_id (UUID).
    if (typeof payload.investigation_id !== 'string' || !UUID_RE.test(payload.investigation_id)) {
        throw new TypeError(`appendPoliceInvestigationOpened: investigation_id must be a UUID, got ${JSON.stringify(payload.investigation_id)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPoliceInvestigationOpened: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== POLICE_INVESTIGATION_OPENED_KEYS.length
        || !actualKeys.every((k, i) => k === POLICE_INVESTIGATION_OPENED_KEYS[i])) {
        throw new TypeError(`appendPoliceInvestigationOpened: closed-tuple violation — expected ${JSON.stringify(POLICE_INVESTIGATION_OPENED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        complaint_id: payload.complaint_id,
        dispute_id: payload.dispute_id,
        investigation_id: payload.investigation_id,
        tick: payload.tick,
    };
    // 9. Privacy gate + audit.append. actorDid = investigation_id.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPoliceInvestigationOpened: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('police.investigation_opened', payload.investigation_id, cleanPayload);
}
