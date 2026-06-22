/**
 * L1b (D-MONEY-08) — Sole-producer for due.paid.
 *
 * Emitted when a member pays their civic due (in wei or in labor).
 * DID is hashed (HEX64) like market.* / gov.*; due_id is a UUID;
 * paid_in ∈ {'wei','labor'}.
 *
 * Closed 4-key payload (alphabetical): { civic_did_hash, due_id, paid_in, tick }.
 * actorDid = civic_did_hash (the member who paid).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_IN_VALUES = new Set(['wei', 'labor'] as const);

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface DuePaidPayload {
    readonly civic_did_hash: string;   // HEX64_RE — member civicDid sha256
    readonly due_id: string;           // UUID_RE
    readonly paid_in: 'wei' | 'labor'; // enum: 'wei' | 'labor'
    readonly tick: number;             // non-negative integer
}

const EXPECTED_KEYS = ['civic_did_hash', 'due_id', 'paid_in', 'tick'] as const;

export function appendDuePaid(
    audit: AuditChain,
    payload: DuePaidPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendDuePaid: payload must be a plain object`);
    }
    // 2. Regex: civic_did_hash (HEX64).
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendDuePaid: civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    // 3. Regex: due_id (UUID).
    if (typeof payload.due_id !== 'string' || !UUID_RE.test(payload.due_id)) {
        throw new TypeError(`appendDuePaid: due_id must match UUID_RE, got ${JSON.stringify(payload.due_id)}`);
    }
    // 4. Enum: paid_in ∈ {'wei','labor'}.
    if (typeof payload.paid_in !== 'string' || !PAID_IN_VALUES.has(payload.paid_in as 'wei' | 'labor')) {
        throw new TypeError(`appendDuePaid: paid_in must be 'wei' or 'labor', got ${JSON.stringify(payload.paid_in)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendDuePaid: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendDuePaid: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        civic_did_hash: payload.civic_did_hash,
        due_id: payload.due_id,
        paid_in: payload.paid_in,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendDuePaid: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = civic_did_hash.
    return audit.append('due.paid', payload.civic_did_hash, cleanPayload);
}
