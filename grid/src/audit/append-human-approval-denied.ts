/**
 * O2b — Sole-producer for human.approval_denied.
 *
 * Emitted when a human rejects a pending Nous action
 * (ApprovalStore.resolve → 'rejected'). Closes the approval lifecycle negatively.
 * human_did_hash is SHA-256 of the human's DID — raw DID NEVER crosses the audit boundary.
 * The held action payload NEVER crosses the audit boundary.
 *
 * Closed 3-key payload (alphabetical): { approval_id, human_did_hash, tick }.
 * actorDid = human_did_hash (the human denying approval).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface HumanApprovalDeniedPayload {
    readonly approval_id: string;    // UUID_RE
    readonly human_did_hash: string; // HEX64_RE — sha256 of human DID
    readonly tick: number;           // non-negative integer
}

const EXPECTED_KEYS = ['approval_id', 'human_did_hash', 'tick'] as const;

export function appendHumanApprovalDenied(
    audit: AuditChain,
    payload: HumanApprovalDeniedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanApprovalDenied: payload must be a plain object`);
    }
    // 2. Regex: approval_id (UUID).
    if (typeof payload.approval_id !== 'string' || !UUID_RE.test(payload.approval_id)) {
        throw new TypeError(`appendHumanApprovalDenied: approval_id must match UUID_RE, got ${JSON.stringify(payload.approval_id)}`);
    }
    // 3. Regex: human_did_hash (HEX64).
    if (typeof payload.human_did_hash !== 'string' || !HEX64_RE.test(payload.human_did_hash)) {
        throw new TypeError(`appendHumanApprovalDenied: human_did_hash must match HEX64_RE, got ${JSON.stringify(payload.human_did_hash)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendHumanApprovalDenied: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendHumanApprovalDenied: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        approval_id: payload.approval_id,
        human_did_hash: payload.human_did_hash,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanApprovalDenied: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = human_did_hash (the human denying).
    return audit.append('human.approval_denied', payload.human_did_hash, cleanPayload);
}
