/**
 * W4 (D-MONEY-09) — Sole-producer for portal.account_endowed.
 *
 * Emitted when the operator endows a member account with model-first wei (the
 * bounded, ledgered, temporary bend of D-MONEY-01 "no internal mint"). DID is
 * hashed (HEX64) like due.* / market.* / gov.*; endowment_id is a UUID; amount_wei
 * is a decimal string; source is a fixed enum.
 *
 * Closed 5-key payload (alphabetical): { amount_wei, civic_did_hash, endowment_id,
 * source, tick }. reason + operator_did are deliberately NOT on the chain (they live
 * only in the account_endowments ledger). actorDid = civic_did_hash (the recipient).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;
const SOURCE_VALUES = new Set(['model_first'] as const);

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface PortalAccountEndowedPayload {
    readonly amount_wei: string;       // DECIMAL_RE — wei as decimal string
    readonly civic_did_hash: string;   // HEX64_RE — recipient civicDid sha256
    readonly endowment_id: string;     // UUID_RE
    readonly source: 'model_first';    // enum
    readonly tick: number;             // non-negative integer
}

const EXPECTED_KEYS = ['amount_wei', 'civic_did_hash', 'endowment_id', 'source', 'tick'] as const;

export function appendPortalAccountEndowed(
    audit: AuditChain,
    payload: PortalAccountEndowedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalAccountEndowed: payload must be a plain object`);
    }
    // 2. Decimal string: amount_wei (positive).
    if (typeof payload.amount_wei !== 'string' || !DECIMAL_RE.test(payload.amount_wei) || payload.amount_wei === '0') {
        throw new TypeError(`appendPortalAccountEndowed: amount_wei must be a positive decimal string, got ${JSON.stringify(payload.amount_wei)}`);
    }
    // 3. Regex: civic_did_hash (HEX64).
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendPortalAccountEndowed: civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    // 4. Regex: endowment_id (UUID).
    if (typeof payload.endowment_id !== 'string' || !UUID_RE.test(payload.endowment_id)) {
        throw new TypeError(`appendPortalAccountEndowed: endowment_id must match UUID_RE, got ${JSON.stringify(payload.endowment_id)}`);
    }
    // 5. Enum: source ∈ {'model_first'}.
    if (typeof payload.source !== 'string' || !SOURCE_VALUES.has(payload.source as 'model_first')) {
        throw new TypeError(`appendPortalAccountEndowed: source must be 'model_first', got ${JSON.stringify(payload.source)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalAccountEndowed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendPortalAccountEndowed: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_wei: payload.amount_wei,
        civic_did_hash: payload.civic_did_hash,
        endowment_id: payload.endowment_id,
        source: payload.source,
        tick: payload.tick,
    };
    // 9. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalAccountEndowed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit. actorDid = civic_did_hash (the recipient).
    return audit.append('portal.account_endowed', payload.civic_did_hash, cleanPayload);
}
