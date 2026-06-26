/**
 * Phase 53 (PORTAL-03) — Sole-producer for portal.grid_creation_approved.
 *
 * Emitted when the Portal reviewer panel approves a Grid creation request (majority). DID hashed.
 * actorDid = reviewer_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PortalGridCreationApprovedPayload, PORTAL_GRID_CREATION_APPROVED_KEYS } from '../portal-workflows/grid-approval-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPortalGridCreationApproved(audit: AuditChain, payload: PortalGridCreationApprovedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalGridCreationApproved: payload must be a plain object`);
    }
    if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
        throw new TypeError(`appendPortalGridCreationApproved: request_id must be a non-empty string`);
    }
    if (typeof payload.reviewer_did_hash !== 'string' || !HEX64_RE.test(payload.reviewer_did_hash)) {
        throw new TypeError(`appendPortalGridCreationApproved: reviewer_did_hash must match HEX64, got ${JSON.stringify(payload.reviewer_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalGridCreationApproved: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== PORTAL_GRID_CREATION_APPROVED_KEYS.length || !actualKeys.every((k, i) => k === PORTAL_GRID_CREATION_APPROVED_KEYS[i])) {
        throw new TypeError(`appendPortalGridCreationApproved: closed-tuple violation — expected ${JSON.stringify(PORTAL_GRID_CREATION_APPROVED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { request_id: payload.request_id, reviewer_did_hash: payload.reviewer_did_hash, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPortalGridCreationApproved: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('portal.grid_creation_approved', payload.reviewer_did_hash, cleanPayload);
}
