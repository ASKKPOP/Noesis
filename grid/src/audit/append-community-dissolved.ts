/**
 * Phase 49 (COMM-05) — Sole-producer for community.dissolved.
 *
 * Emitted when a community is wound down (the founding Bios stays in the treasury —
 * no founder refund, D-V3-09). Dissolver DID hashed. actorDid = dissolved_by_did_hash.
 * Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type CommunityDissolvedPayload, COMMUNITY_DISSOLVED_KEYS } from '../community/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendCommunityDissolved(audit: AuditChain, payload: CommunityDissolvedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendCommunityDissolved: payload must be a plain object`);
    }
    if (typeof payload.community_id !== 'string' || !UUID_RE.test(payload.community_id)) {
        throw new TypeError(`appendCommunityDissolved: community_id must be a UUID, got ${JSON.stringify(payload.community_id)}`);
    }
    if (typeof payload.dissolved_by_did_hash !== 'string' || !HEX64_RE.test(payload.dissolved_by_did_hash)) {
        throw new TypeError(`appendCommunityDissolved: dissolved_by_did_hash must match HEX64, got ${JSON.stringify(payload.dissolved_by_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendCommunityDissolved: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== COMMUNITY_DISSOLVED_KEYS.length || !actualKeys.every((k, i) => k === COMMUNITY_DISSOLVED_KEYS[i])) {
        throw new TypeError(`appendCommunityDissolved: closed-tuple violation — expected ${JSON.stringify(COMMUNITY_DISSOLVED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        community_id: payload.community_id,
        dissolved_by_did_hash: payload.dissolved_by_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendCommunityDissolved: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('community.dissolved', payload.dissolved_by_did_hash, cleanPayload);
}
