/**
 * Groups & Holdings · Phase 63 / D-GROUP-01 — Sole-producer for group.member_joined.
 *
 * Closed 4-key payload (keys ALPHABETICAL): {group_id, member_civic_did_hash, role, tick}.
 * actorDid = member_civic_did_hash (the join is attributed to the hashed member DID —
 *   the raw Civic-DID NEVER crosses the audit boundary).
 *
 * role ∈ {founder, member, affiliate}. No plaintext name / charter crosses.
 * Allowlist position 102. Mirrors append-group-founded / append-zoning-role-granted.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const GROUP_ID_RE = /^[a-z0-9_-]+:group:[a-z]+$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const ROLES = ['founder', 'member', 'affiliate'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface GroupMemberJoinedPayload {
    readonly group_id: string;               // GROUP_ID_RE
    readonly member_civic_did_hash: string;  // HEX64 (the member DID is HASHED)
    readonly role: string;                   // founder | member | affiliate
    readonly tick: number;                   // non-negative integer
}

const EXPECTED_KEYS = ['group_id', 'member_civic_did_hash', 'role', 'tick'] as const;

export function appendGroupMemberJoined(audit: AuditChain, payload: GroupMemberJoinedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGroupMemberJoined: payload must be a plain object`);
    }
    if (typeof payload.group_id !== 'string' || !GROUP_ID_RE.test(payload.group_id)) {
        throw new TypeError(`appendGroupMemberJoined: group_id must match GROUP_ID_RE, got ${JSON.stringify(payload.group_id)}`);
    }
    if (typeof payload.member_civic_did_hash !== 'string' || !HEX64_RE.test(payload.member_civic_did_hash)) {
        throw new TypeError(`appendGroupMemberJoined: member_civic_did_hash must be 64-char hex (HEX64), got ${JSON.stringify(payload.member_civic_did_hash)}`);
    }
    if (typeof payload.role !== 'string' || !(ROLES as readonly string[]).includes(payload.role)) {
        throw new TypeError(`appendGroupMemberJoined: role must be one of ${JSON.stringify(ROLES)}, got ${JSON.stringify(payload.role)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGroupMemberJoined: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendGroupMemberJoined: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        group_id: payload.group_id,
        member_civic_did_hash: payload.member_civic_did_hash,
        role: payload.role,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGroupMemberJoined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('group.member_joined', payload.member_civic_did_hash, cleanPayload);
}
