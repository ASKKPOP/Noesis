/**
 * Phase 55 (PORTAL-06) — Sole-producer for portal.cross_grid_identity_linked.
 *
 * DORMANT in v3.0: exists for v3.1, unreachable while only Genesis is active. DIDs hashed.
 * actorDid = account_did_hash. Closed 4-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PortalCrossGridIdentityLinkedPayload, PORTAL_CROSS_GRID_IDENTITY_LINKED_KEYS } from '../portal-workflows/cross-grid-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPortalCrossGridIdentityLinked(audit: AuditChain, payload: PortalCrossGridIdentityLinkedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: payload must be a plain object`);
    }
    if (typeof payload.account_did_hash !== 'string' || !HEX64_RE.test(payload.account_did_hash)) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: account_did_hash must match HEX64, got ${JSON.stringify(payload.account_did_hash)}`);
    }
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: civic_did_hash must match HEX64, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: grid_name must be a non-empty string`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== PORTAL_CROSS_GRID_IDENTITY_LINKED_KEYS.length || !actualKeys.every((k, i) => k === PORTAL_CROSS_GRID_IDENTITY_LINKED_KEYS[i])) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: closed-tuple violation — expected ${JSON.stringify(PORTAL_CROSS_GRID_IDENTITY_LINKED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { account_did_hash: payload.account_did_hash, civic_did_hash: payload.civic_did_hash, grid_name: payload.grid_name, tick: payload.tick };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPortalCrossGridIdentityLinked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('portal.cross_grid_identity_linked', payload.account_did_hash, cleanPayload);
}
