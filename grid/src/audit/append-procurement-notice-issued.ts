/**
 * L2b (D-MONEY-08 / L2b) — Sole-producer for procurement.notice_issued.
 *
 * Emitted when the Polis posts an RFP (budget + spec) authorized by a VOTE-05
 * legislative act. polis_authorization_ref_hash is SHA-256 of the Polis auth ref —
 * raw ref NEVER crosses the audit boundary.
 *
 * Closed 6-key payload (alphabetical): { budget_wei, function_type, notice_id,
 * polis_authorization_ref_hash, tick, zone }.
 * actorDid = polis_authorization_ref_hash (HEX64).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;

/** Closed 6-key payload. Keys ALPHABETICAL. */
export interface ProcurementNoticeIssuedPayload {
    readonly budget_wei: string;                        // decimal digit string (/^[0-9]+$/)
    readonly function_type: string;                     // non-empty string
    readonly notice_id: string;                         // UUID_RE
    readonly polis_authorization_ref_hash: string;      // HEX64_RE — sha256 of Polis auth ref
    readonly tick: number;                              // non-negative integer
    readonly zone: string;                              // non-empty string
}

const EXPECTED_KEYS = ['budget_wei', 'function_type', 'notice_id', 'polis_authorization_ref_hash', 'tick', 'zone'] as const;

export function appendProcurementNoticeIssued(
    audit: AuditChain,
    payload: ProcurementNoticeIssuedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendProcurementNoticeIssued: payload must be a plain object`);
    }
    // 2. Regex: polis_authorization_ref_hash (HEX64).
    if (typeof payload.polis_authorization_ref_hash !== 'string' || !HEX64_RE.test(payload.polis_authorization_ref_hash)) {
        throw new TypeError(`appendProcurementNoticeIssued: polis_authorization_ref_hash must match HEX64_RE, got ${JSON.stringify(payload.polis_authorization_ref_hash)}`);
    }
    // 3. Regex: notice_id (UUID).
    if (typeof payload.notice_id !== 'string' || !UUID_RE.test(payload.notice_id)) {
        throw new TypeError(`appendProcurementNoticeIssued: notice_id must match UUID_RE, got ${JSON.stringify(payload.notice_id)}`);
    }
    // 4. Decimal string: budget_wei.
    if (typeof payload.budget_wei !== 'string' || !DECIMAL_RE.test(payload.budget_wei)) {
        throw new TypeError(`appendProcurementNoticeIssued: budget_wei must match /^[0-9]+$/, got ${JSON.stringify(payload.budget_wei)}`);
    }
    // 5. Non-empty string: function_type.
    if (typeof payload.function_type !== 'string' || payload.function_type.length === 0) {
        throw new TypeError(`appendProcurementNoticeIssued: function_type must be a non-empty string, got ${JSON.stringify(payload.function_type)}`);
    }
    // 6. Non-empty string: zone.
    if (typeof payload.zone !== 'string' || payload.zone.length === 0) {
        throw new TypeError(`appendProcurementNoticeIssued: zone must be a non-empty string, got ${JSON.stringify(payload.zone)}`);
    }
    // 7. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendProcurementNoticeIssued: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 8. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendProcurementNoticeIssued: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 9. Explicit reconstruction — no spread.
    const cleanPayload = {
        budget_wei: payload.budget_wei,
        function_type: payload.function_type,
        notice_id: payload.notice_id,
        polis_authorization_ref_hash: payload.polis_authorization_ref_hash,
        tick: payload.tick,
        zone: payload.zone,
    };
    // 10. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendProcurementNoticeIssued: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 11. Commit. actorDid = polis_authorization_ref_hash.
    return audit.append('procurement.notice_issued', payload.polis_authorization_ref_hash, cleanPayload);
}
