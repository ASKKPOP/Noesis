/**
 * Phase 49 (COMM-03) — Sole-producer for community.joined.
 *
 * Emitted when a Civic-DID holder joins a community (the charter was satisfied).
 * Member DID hashed. actorDid = member_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type CommunityJoinedPayload, COMMUNITY_JOINED_KEYS } from '../community/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendCommunityJoined(audit: AuditChain, payload: CommunityJoinedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendCommunityJoined: payload must be a plain object`);
    }
    if (typeof payload.community_id !== 'string' || !UUID_RE.test(payload.community_id)) {
        throw new TypeError(`appendCommunityJoined: community_id must be a UUID, got ${JSON.stringify(payload.community_id)}`);
    }
    if (typeof payload.member_did_hash !== 'string' || !HEX64_RE.test(payload.member_did_hash)) {
        throw new TypeError(`appendCommunityJoined: member_did_hash must match HEX64, got ${JSON.stringify(payload.member_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendCommunityJoined: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== COMMUNITY_JOINED_KEYS.length || !actualKeys.every((k, i) => k === COMMUNITY_JOINED_KEYS[i])) {
        throw new TypeError(`appendCommunityJoined: closed-tuple violation — expected ${JSON.stringify(COMMUNITY_JOINED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        community_id: payload.community_id,
        member_did_hash: payload.member_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendCommunityJoined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('community.joined', payload.member_did_hash, cleanPayload);
}
