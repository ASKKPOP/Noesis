/**
 * Phase 45b (TYPE-B-03) — Sole-producer for treasury.stipend_paid.
 *
 * Emitted when the daily infrastructure (compute) stipend is deducted from a Type B treasury.
 * DID hashed. actorDid = type_b_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type TreasuryStipendPaidPayload, TREASURY_STIPEND_PAID_KEYS } from '../typeb/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendTreasuryStipendPaid(audit: AuditChain, payload: TreasuryStipendPaidPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryStipendPaid: payload must be a plain object`);
    }
    if (!Number.isFinite(payload.stipend_amount) || payload.stipend_amount < 0) {
        throw new TypeError(`appendTreasuryStipendPaid: stipend_amount must be a non-negative number, got ${JSON.stringify(payload.stipend_amount)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryStipendPaid: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendTreasuryStipendPaid: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== TREASURY_STIPEND_PAID_KEYS.length || !actualKeys.every((k, i) => k === TREASURY_STIPEND_PAID_KEYS[i])) {
        throw new TypeError(`appendTreasuryStipendPaid: closed-tuple violation — expected ${JSON.stringify(TREASURY_STIPEND_PAID_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { stipend_amount: payload.stipend_amount, tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendTreasuryStipendPaid: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('treasury.stipend_paid', payload.type_b_did_hash, cleanPayload);
}
