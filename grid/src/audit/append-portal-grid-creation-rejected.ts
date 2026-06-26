/**
 * Phase 53 (PORTAL-03) — Sole-producer for portal.grid_creation_rejected.
 *
 * Emitted when the Portal reviewer panel rejects a Grid creation request (closed-enum reason —
 * no free text on the chain). DID hashed. actorDid = reviewer_did_hash. Closed 4-key.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PortalGridCreationRejectedPayload, PORTAL_GRID_CREATION_REJECTED_KEYS, GRID_REJECT_REASONS } from '../portal-workflows/grid-approval-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPortalGridCreationRejected(audit: AuditChain, payload: PortalGridCreationRejectedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalGridCreationRejected: payload must be a plain object`);
    }
    if (!GRID_REJECT_REASONS.includes(payload.reason)) {
        throw new TypeError(`appendPortalGridCreationRejected: reason must be one of ${JSON.stringify(GRID_REJECT_REASONS)}, got ${JSON.stringify(payload.reason)}`);
    }
    if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
        throw new TypeError(`appendPortalGridCreationRejected: request_id must be a non-empty string`);
    }
    if (typeof payload.reviewer_did_hash !== 'string' || !HEX64_RE.test(payload.reviewer_did_hash)) {
        throw new TypeError(`appendPortalGridCreationRejected: reviewer_did_hash must match HEX64, got ${JSON.stringify(payload.reviewer_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalGridCreationRejected: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== PORTAL_GRID_CREATION_REJECTED_KEYS.length || !actualKeys.every((k, i) => k === PORTAL_GRID_CREATION_REJECTED_KEYS[i])) {
        throw new TypeError(`appendPortalGridCreationRejected: closed-tuple violation — expected ${JSON.stringify(PORTAL_GRID_CREATION_REJECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { reason: payload.reason, request_id: payload.request_id, reviewer_did_hash: payload.reviewer_did_hash, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPortalGridCreationRejected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('portal.grid_creation_rejected', payload.reviewer_did_hash, cleanPayload);
}
