/**
 * Phase 49 (COMM-01) — Sole-producer for community.founded.
 *
 * Emitted when a Civic-DID holder founds a community (after paying the Bios sybil cost).
 * Founder DID hashed (HEX64). actorDid = founder_did_hash. Closed 6-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type CommunityFoundedPayload, COMMUNITY_FOUNDED_KEYS } from '../community/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendCommunityFounded(audit: AuditChain, payload: CommunityFoundedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendCommunityFounded: payload must be a plain object`);
    }
    if (!Number.isInteger(payload.wei_paid) || payload.wei_paid < 0) {
        throw new TypeError(`appendCommunityFounded: wei_paid must be non-negative integer, got ${JSON.stringify(payload.wei_paid)}`);
    }
    if (typeof payload.charter_hash !== 'string' || !HEX64_RE.test(payload.charter_hash)) {
        throw new TypeError(`appendCommunityFounded: charter_hash must match HEX64, got ${JSON.stringify(payload.charter_hash)}`);
    }
    if (typeof payload.community_id !== 'string' || !UUID_RE.test(payload.community_id)) {
        throw new TypeError(`appendCommunityFounded: community_id must be a UUID, got ${JSON.stringify(payload.community_id)}`);
    }
    if (typeof payload.founder_did_hash !== 'string' || !HEX64_RE.test(payload.founder_did_hash)) {
        throw new TypeError(`appendCommunityFounded: founder_did_hash must match HEX64, got ${JSON.stringify(payload.founder_did_hash)}`);
    }
    if (typeof payload.name_hash !== 'string' || !HEX64_RE.test(payload.name_hash)) {
        throw new TypeError(`appendCommunityFounded: name_hash must match HEX64, got ${JSON.stringify(payload.name_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendCommunityFounded: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== COMMUNITY_FOUNDED_KEYS.length || !actualKeys.every((k, i) => k === COMMUNITY_FOUNDED_KEYS[i])) {
        throw new TypeError(`appendCommunityFounded: closed-tuple violation — expected ${JSON.stringify(COMMUNITY_FOUNDED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        wei_paid: payload.wei_paid,
        charter_hash: payload.charter_hash,
        community_id: payload.community_id,
        founder_did_hash: payload.founder_did_hash,
        name_hash: payload.name_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendCommunityFounded: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('community.founded', payload.founder_did_hash, cleanPayload);
}
