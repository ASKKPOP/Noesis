/**
 * O2b — Sole-producer for human.approval_requested.
 *
 * Emitted when a Nous requests human approval for a big-decision action
 * (ApprovalStore.requestApproval). Opens the human-in-the-loop approval lifecycle.
 * nous_did_hash is SHA-256 of the Nous's DID — raw DID NEVER crosses the audit boundary.
 * human_did_hash is SHA-256 of the human's DID — raw DID NEVER crosses the audit boundary.
 * The held action payload and summary NEVER cross the audit boundary.
 *
 * Closed 5-key payload (alphabetical): { approval_id, human_did_hash, kind, nous_did_hash, tick }.
 * actorDid = nous_did_hash (the Nous requesting approval).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface HumanApprovalRequestedPayload {
    readonly approval_id: string;    // UUID_RE
    readonly human_did_hash: string; // HEX64_RE — sha256 of human DID
    readonly kind: string;           // non-empty string
    readonly nous_did_hash: string;  // HEX64_RE — sha256 of Nous DID
    readonly tick: number;           // non-negative integer
}

const EXPECTED_KEYS = ['approval_id', 'human_did_hash', 'kind', 'nous_did_hash', 'tick'] as const;

export function appendHumanApprovalRequested(
    audit: AuditChain,
    payload: HumanApprovalRequestedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanApprovalRequested: payload must be a plain object`);
    }
    // 2. Regex: approval_id (UUID).
    if (typeof payload.approval_id !== 'string' || !UUID_RE.test(payload.approval_id)) {
        throw new TypeError(`appendHumanApprovalRequested: approval_id must match UUID_RE, got ${JSON.stringify(payload.approval_id)}`);
    }
    // 3. Regex: human_did_hash (HEX64).
    if (typeof payload.human_did_hash !== 'string' || !HEX64_RE.test(payload.human_did_hash)) {
        throw new TypeError(`appendHumanApprovalRequested: human_did_hash must match HEX64_RE, got ${JSON.stringify(payload.human_did_hash)}`);
    }
    // 4. Non-empty string: kind.
    if (typeof payload.kind !== 'string' || payload.kind.length === 0) {
        throw new TypeError(`appendHumanApprovalRequested: kind must be a non-empty string, got ${JSON.stringify(payload.kind)}`);
    }
    // 5. Regex: nous_did_hash (HEX64).
    if (typeof payload.nous_did_hash !== 'string' || !HEX64_RE.test(payload.nous_did_hash)) {
        throw new TypeError(`appendHumanApprovalRequested: nous_did_hash must match HEX64_RE, got ${JSON.stringify(payload.nous_did_hash)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendHumanApprovalRequested: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendHumanApprovalRequested: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        approval_id: payload.approval_id,
        human_did_hash: payload.human_did_hash,
        kind: payload.kind,
        nous_did_hash: payload.nous_did_hash,
        tick: payload.tick,
    };
    // 9. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanApprovalRequested: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit. actorDid = nous_did_hash (the Nous requesting).
    return audit.append('human.approval_requested', payload.nous_did_hash, cleanPayload);
}
