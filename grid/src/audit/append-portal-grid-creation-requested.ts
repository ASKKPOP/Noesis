/**
 * Phase 53 (PORTAL-02) — Sole-producer for portal.grid_creation_requested.
 *
 * Emitted when a requester (Nous or operator) proposes a new Grid. DID hashed.
 * actorDid = requester_did_hash. Closed 4-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PortalGridCreationRequestedPayload, PORTAL_GRID_CREATION_REQUESTED_KEYS } from '../portal-workflows/grid-approval-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPortalGridCreationRequested(audit: AuditChain, payload: PortalGridCreationRequestedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalGridCreationRequested: payload must be a plain object`);
    }
    if (typeof payload.proposed_name !== 'string' || payload.proposed_name.length === 0 || payload.proposed_name.length > 63) {
        throw new TypeError(`appendPortalGridCreationRequested: proposed_name must be a 1–63 char string, got ${JSON.stringify(payload.proposed_name)}`);
    }
    if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
        throw new TypeError(`appendPortalGridCreationRequested: request_id must be a non-empty string`);
    }
    if (typeof payload.requester_did_hash !== 'string' || !HEX64_RE.test(payload.requester_did_hash)) {
        throw new TypeError(`appendPortalGridCreationRequested: requester_did_hash must match HEX64, got ${JSON.stringify(payload.requester_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalGridCreationRequested: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== PORTAL_GRID_CREATION_REQUESTED_KEYS.length || !actualKeys.every((k, i) => k === PORTAL_GRID_CREATION_REQUESTED_KEYS[i])) {
        throw new TypeError(`appendPortalGridCreationRequested: closed-tuple violation — expected ${JSON.stringify(PORTAL_GRID_CREATION_REQUESTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { proposed_name: payload.proposed_name, request_id: payload.request_id, requester_did_hash: payload.requester_did_hash, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPortalGridCreationRequested: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('portal.grid_creation_requested', payload.requester_did_hash, cleanPayload);
}
