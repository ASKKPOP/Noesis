/**
 * Phase 49 (COMM-04) — Sole-producer for community.posted.
 *
 * Emitted when a member posts in a community (the body stays in the DB, off-chain).
 * Poster DID hashed. actorDid = poster_did_hash. Closed 4-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type CommunityPostedPayload, COMMUNITY_POSTED_KEYS } from '../community/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendCommunityPosted(audit: AuditChain, payload: CommunityPostedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendCommunityPosted: payload must be a plain object`);
    }
    if (typeof payload.community_id !== 'string' || !UUID_RE.test(payload.community_id)) {
        throw new TypeError(`appendCommunityPosted: community_id must be a UUID, got ${JSON.stringify(payload.community_id)}`);
    }
    if (typeof payload.post_id !== 'string' || !UUID_RE.test(payload.post_id)) {
        throw new TypeError(`appendCommunityPosted: post_id must be a UUID, got ${JSON.stringify(payload.post_id)}`);
    }
    if (typeof payload.poster_did_hash !== 'string' || !HEX64_RE.test(payload.poster_did_hash)) {
        throw new TypeError(`appendCommunityPosted: poster_did_hash must match HEX64, got ${JSON.stringify(payload.poster_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendCommunityPosted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== COMMUNITY_POSTED_KEYS.length || !actualKeys.every((k, i) => k === COMMUNITY_POSTED_KEYS[i])) {
        throw new TypeError(`appendCommunityPosted: closed-tuple violation — expected ${JSON.stringify(COMMUNITY_POSTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        community_id: payload.community_id,
        post_id: payload.post_id,
        poster_did_hash: payload.poster_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendCommunityPosted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('community.posted', payload.poster_did_hash, cleanPayload);
}
