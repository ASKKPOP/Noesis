/**
 * Phase 37b (TYPE-B-02) — Sole-producer for registry.type_b_sponsored (Polis-β).
 *
 * Emitted when a Polis-β sponsorship's 7-day public-comment window closes with no objection;
 * the Civic-DID is issued. DIDs hashed. actorDid = type_b_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type RegistryTypeBSponsoredPayload, REGISTRY_TYPE_B_SPONSORED_KEYS } from '../typeb/registry-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendRegistryTypeBSponsored(audit: AuditChain, payload: RegistryTypeBSponsoredPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryTypeBSponsored: payload must be a plain object`);
    }
    if (typeof payload.sponsor_did_hash !== 'string' || !HEX64_RE.test(payload.sponsor_did_hash)) {
        throw new TypeError(`appendRegistryTypeBSponsored: sponsor_did_hash must match HEX64, got ${JSON.stringify(payload.sponsor_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendRegistryTypeBSponsored: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendRegistryTypeBSponsored: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== REGISTRY_TYPE_B_SPONSORED_KEYS.length || !actualKeys.every((k, i) => k === REGISTRY_TYPE_B_SPONSORED_KEYS[i])) {
        throw new TypeError(`appendRegistryTypeBSponsored: closed-tuple violation — expected ${JSON.stringify(REGISTRY_TYPE_B_SPONSORED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { sponsor_did_hash: payload.sponsor_did_hash, tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendRegistryTypeBSponsored: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('registry.type_b_sponsored', payload.type_b_did_hash, cleanPayload);
}
