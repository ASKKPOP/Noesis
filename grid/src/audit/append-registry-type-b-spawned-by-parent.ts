/**
 * Phase 37b (TYPE-B-01) — Sole-producer for registry.type_b_spawned_by_parent (Polis-γ).
 *
 * Emitted when a parent Nous (≥1y civic standing) spawns a child after the 14-day wait; the
 * parent's reputation is locked as accountable. Polis-γ is gated to v3.1+. DIDs hashed.
 * actorDid = parent_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type RegistryTypeBSpawnedByParentPayload, REGISTRY_TYPE_B_SPAWNED_BY_PARENT_KEYS } from '../typeb/registry-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendRegistryTypeBSpawnedByParent(audit: AuditChain, payload: RegistryTypeBSpawnedByParentPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryTypeBSpawnedByParent: payload must be a plain object`);
    }
    if (typeof payload.parent_did_hash !== 'string' || !HEX64_RE.test(payload.parent_did_hash)) {
        throw new TypeError(`appendRegistryTypeBSpawnedByParent: parent_did_hash must match HEX64, got ${JSON.stringify(payload.parent_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendRegistryTypeBSpawnedByParent: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendRegistryTypeBSpawnedByParent: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== REGISTRY_TYPE_B_SPAWNED_BY_PARENT_KEYS.length || !actualKeys.every((k, i) => k === REGISTRY_TYPE_B_SPAWNED_BY_PARENT_KEYS[i])) {
        throw new TypeError(`appendRegistryTypeBSpawnedByParent: closed-tuple violation — expected ${JSON.stringify(REGISTRY_TYPE_B_SPAWNED_BY_PARENT_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { parent_did_hash: payload.parent_did_hash, tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendRegistryTypeBSpawnedByParent: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('registry.type_b_spawned_by_parent', payload.parent_did_hash, cleanPayload);
}
