/**
 * Groups & Holdings · Phase 63 / D-GROUP-01 — Sole-producer for group.member_left.
 *
 * Closed 4-key payload (keys ALPHABETICAL): {group_id, member_civic_did_hash, reason, tick}.
 * actorDid = member_civic_did_hash (the hashed member DID; raw DID NEVER crosses).
 *
 * reason ∈ {voluntary, removed}. Allowlist position 103.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const GROUP_ID_RE = /^[a-z0-9_-]+:group:[a-z]+$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const REASONS = ['voluntary', 'removed'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface GroupMemberLeftPayload {
    readonly group_id: string;               // GROUP_ID_RE
    readonly member_civic_did_hash: string;  // HEX64
    readonly reason: string;                 // voluntary | removed
    readonly tick: number;                   // non-negative integer
}

const EXPECTED_KEYS = ['group_id', 'member_civic_did_hash', 'reason', 'tick'] as const;

export function appendGroupMemberLeft(audit: AuditChain, payload: GroupMemberLeftPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGroupMemberLeft: payload must be a plain object`);
    }
    if (typeof payload.group_id !== 'string' || !GROUP_ID_RE.test(payload.group_id)) {
        throw new TypeError(`appendGroupMemberLeft: group_id must match GROUP_ID_RE, got ${JSON.stringify(payload.group_id)}`);
    }
    if (typeof payload.member_civic_did_hash !== 'string' || !HEX64_RE.test(payload.member_civic_did_hash)) {
        throw new TypeError(`appendGroupMemberLeft: member_civic_did_hash must be 64-char hex (HEX64), got ${JSON.stringify(payload.member_civic_did_hash)}`);
    }
    if (typeof payload.reason !== 'string' || !(REASONS as readonly string[]).includes(payload.reason)) {
        throw new TypeError(`appendGroupMemberLeft: reason must be one of ${JSON.stringify(REASONS)}, got ${JSON.stringify(payload.reason)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGroupMemberLeft: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendGroupMemberLeft: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        group_id: payload.group_id,
        member_civic_did_hash: payload.member_civic_did_hash,
        reason: payload.reason,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGroupMemberLeft: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('group.member_left', payload.member_civic_did_hash, cleanPayload);
}
