/**
 * L2b (D-MONEY-08 / L2b) — Sole-producer for procurement.cancelled.
 *
 * Emitted when an open procurement notice is withdrawn before any award.
 * notice_id is a UUID and serves directly as actorDid (mirrors treasury.parcel_revenue
 * and similar events that use an id as the actor rather than a DID hash).
 *
 * Closed 3-key payload (alphabetical): { notice_id, reason, tick }.
 * actorDid = notice_id (UUID).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface ProcurementCancelledPayload {
    readonly notice_id: string;  // UUID_RE
    readonly reason: string;     // non-empty string (e.g. 'withdrawn', 'budget_withdrawn')
    readonly tick: number;       // non-negative integer
}

const EXPECTED_KEYS = ['notice_id', 'reason', 'tick'] as const;

export function appendProcurementCancelled(
    audit: AuditChain,
    payload: ProcurementCancelledPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendProcurementCancelled: payload must be a plain object`);
    }
    // 2. Regex: notice_id (UUID).
    if (typeof payload.notice_id !== 'string' || !UUID_RE.test(payload.notice_id)) {
        throw new TypeError(`appendProcurementCancelled: notice_id must match UUID_RE, got ${JSON.stringify(payload.notice_id)}`);
    }
    // 3. Non-empty string: reason.
    if (typeof payload.reason !== 'string' || payload.reason.length === 0) {
        throw new TypeError(`appendProcurementCancelled: reason must be a non-empty string, got ${JSON.stringify(payload.reason)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendProcurementCancelled: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendProcurementCancelled: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        notice_id: payload.notice_id,
        reason: payload.reason,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendProcurementCancelled: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = notice_id.
    return audit.append('procurement.cancelled', payload.notice_id, cleanPayload);
}
