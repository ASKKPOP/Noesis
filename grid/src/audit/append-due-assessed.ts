/**
 * L1b (D-MONEY-08) — Sole-producer for due.assessed.
 *
 * Emitted when the Polis assesses a recurring civic due on a member.
 * DID is hashed (HEX64) like market.* / gov.*; due_id is a UUID;
 * amounts are decimal digit strings (bigint.toString()).
 *
 * Closed 6-key payload (alphabetical): { amount_credit, amount_wei,
 * civic_did_hash, due_id, period, tick }.
 * actorDid = civic_did_hash (the member who owes the due).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;

/** Closed 6-key payload. Keys ALPHABETICAL. */
export interface DueAssessedPayload {
    readonly amount_credit: string;    // decimal digit string (/^[0-9]+$/)
    readonly amount_wei: string;       // decimal digit string (/^[0-9]+$/)
    readonly civic_did_hash: string;   // HEX64_RE — member civicDid sha256
    readonly due_id: string;           // UUID_RE
    readonly period: string;           // non-empty string (e.g. '2026-06')
    readonly tick: number;             // non-negative integer
}

const EXPECTED_KEYS = ['amount_credit', 'amount_wei', 'civic_did_hash', 'due_id', 'period', 'tick'] as const;

export function appendDueAssessed(
    audit: AuditChain,
    payload: DueAssessedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendDueAssessed: payload must be a plain object`);
    }
    // 2. Regex: civic_did_hash (HEX64).
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendDueAssessed: civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    // 3. Regex: due_id (UUID).
    if (typeof payload.due_id !== 'string' || !UUID_RE.test(payload.due_id)) {
        throw new TypeError(`appendDueAssessed: due_id must match UUID_RE, got ${JSON.stringify(payload.due_id)}`);
    }
    // 4. Decimal string: amount_wei.
    if (typeof payload.amount_wei !== 'string' || !DECIMAL_RE.test(payload.amount_wei)) {
        throw new TypeError(`appendDueAssessed: amount_wei must match /^[0-9]+$/, got ${JSON.stringify(payload.amount_wei)}`);
    }
    // 5. Decimal string: amount_credit.
    if (typeof payload.amount_credit !== 'string' || !DECIMAL_RE.test(payload.amount_credit)) {
        throw new TypeError(`appendDueAssessed: amount_credit must match /^[0-9]+$/, got ${JSON.stringify(payload.amount_credit)}`);
    }
    // 6. Non-empty string: period.
    if (typeof payload.period !== 'string' || payload.period.length === 0) {
        throw new TypeError(`appendDueAssessed: period must be a non-empty string, got ${JSON.stringify(payload.period)}`);
    }
    // 7. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendDueAssessed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 8. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendDueAssessed: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 9. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_credit: payload.amount_credit,
        amount_wei: payload.amount_wei,
        civic_did_hash: payload.civic_did_hash,
        due_id: payload.due_id,
        period: payload.period,
        tick: payload.tick,
    };
    // 10. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendDueAssessed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 11. Commit. actorDid = civic_did_hash.
    return audit.append('due.assessed', payload.civic_did_hash, cleanPayload);
}
