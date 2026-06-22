/**
 * L1b (D-MONEY-08) — Sole-producer for due.delinquent.
 *
 * Emitted when a civic due is flagged as delinquent (unpaid past due_tick).
 * Sanction is downstream (Police / L-layer). DID is hashed (HEX64) like
 * market.* / gov.*; due_id is a UUID.
 *
 * Closed 3-key payload (alphabetical): { civic_did_hash, due_id, tick }.
 * actorDid = civic_did_hash (the member who is delinquent).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface DueDelinquentPayload {
    readonly civic_did_hash: string;   // HEX64_RE — member civicDid sha256
    readonly due_id: string;           // UUID_RE
    readonly tick: number;             // non-negative integer
}

const EXPECTED_KEYS = ['civic_did_hash', 'due_id', 'tick'] as const;

export function appendDueDelinquent(
    audit: AuditChain,
    payload: DueDelinquentPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendDueDelinquent: payload must be a plain object`);
    }
    // 2. Regex: civic_did_hash (HEX64).
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendDueDelinquent: civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    // 3. Regex: due_id (UUID).
    if (typeof payload.due_id !== 'string' || !UUID_RE.test(payload.due_id)) {
        throw new TypeError(`appendDueDelinquent: due_id must match UUID_RE, got ${JSON.stringify(payload.due_id)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendDueDelinquent: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendDueDelinquent: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        civic_did_hash: payload.civic_did_hash,
        due_id: payload.due_id,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendDueDelinquent: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = civic_did_hash.
    return audit.append('due.delinquent', payload.civic_did_hash, cleanPayload);
}
