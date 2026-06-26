/**
 * Phase 55 (PORTAL-06) — Sole-producer for portal.cross_grid_action_mediated.
 *
 * DORMANT in v3.0: this producer exists for v3.1 but is UNREACHABLE while only Genesis is
 * active (no reachable route calls it; check-cross-grid-dormant.mjs enforces that). DID hashed.
 * actorDid = account_did_hash. Closed 5-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PortalCrossGridActionMediatedPayload, PORTAL_CROSS_GRID_ACTION_MEDIATED_KEYS } from '../portal-workflows/cross-grid-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPortalCrossGridActionMediated(audit: AuditChain, payload: PortalCrossGridActionMediatedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalCrossGridActionMediated: payload must be a plain object`);
    }
    if (typeof payload.account_did_hash !== 'string' || !HEX64_RE.test(payload.account_did_hash)) {
        throw new TypeError(`appendPortalCrossGridActionMediated: account_did_hash must match HEX64, got ${JSON.stringify(payload.account_did_hash)}`);
    }
    if (typeof payload.action_id !== 'string' || payload.action_id.length === 0) {
        throw new TypeError(`appendPortalCrossGridActionMediated: action_id must be a non-empty string`);
    }
    if (typeof payload.source_grid !== 'string' || payload.source_grid.length === 0) {
        throw new TypeError(`appendPortalCrossGridActionMediated: source_grid must be a non-empty string`);
    }
    if (typeof payload.target_grid !== 'string' || payload.target_grid.length === 0) {
        throw new TypeError(`appendPortalCrossGridActionMediated: target_grid must be a non-empty string`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalCrossGridActionMediated: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== PORTAL_CROSS_GRID_ACTION_MEDIATED_KEYS.length || !actualKeys.every((k, i) => k === PORTAL_CROSS_GRID_ACTION_MEDIATED_KEYS[i])) {
        throw new TypeError(`appendPortalCrossGridActionMediated: closed-tuple violation — expected ${JSON.stringify(PORTAL_CROSS_GRID_ACTION_MEDIATED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { account_did_hash: payload.account_did_hash, action_id: payload.action_id, source_grid: payload.source_grid, target_grid: payload.target_grid, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPortalCrossGridActionMediated: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('portal.cross_grid_action_mediated', payload.account_did_hash, cleanPayload);
}
