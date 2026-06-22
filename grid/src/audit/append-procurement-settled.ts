/**
 * L2b (D-MONEY-08 / L2b) — Sole-producer for procurement.settled.
 *
 * Emitted when the escrow is released to the builder after oracle attestation.
 * winner_did_hash is SHA-256 of the winner's Civic DID —
 * raw DID NEVER crosses the audit boundary.
 *
 * Closed 4-key payload (alphabetical): { award_wei, contract_id, tick,
 * winner_did_hash }.
 * actorDid = winner_did_hash (HEX64).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface ProcurementSettledPayload {
    readonly award_wei: string;         // decimal digit string (/^[0-9]+$/)
    readonly contract_id: string;       // UUID_RE
    readonly tick: number;              // non-negative integer
    readonly winner_did_hash: string;   // HEX64_RE — sha256 of winner Civic DID
}

const EXPECTED_KEYS = ['award_wei', 'contract_id', 'tick', 'winner_did_hash'] as const;

export function appendProcurementSettled(
    audit: AuditChain,
    payload: ProcurementSettledPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendProcurementSettled: payload must be a plain object`);
    }
    // 2. Regex: winner_did_hash (HEX64).
    if (typeof payload.winner_did_hash !== 'string' || !HEX64_RE.test(payload.winner_did_hash)) {
        throw new TypeError(`appendProcurementSettled: winner_did_hash must match HEX64_RE, got ${JSON.stringify(payload.winner_did_hash)}`);
    }
    // 3. Regex: contract_id (UUID).
    if (typeof payload.contract_id !== 'string' || !UUID_RE.test(payload.contract_id)) {
        throw new TypeError(`appendProcurementSettled: contract_id must match UUID_RE, got ${JSON.stringify(payload.contract_id)}`);
    }
    // 4. Decimal string: award_wei.
    if (typeof payload.award_wei !== 'string' || !DECIMAL_RE.test(payload.award_wei)) {
        throw new TypeError(`appendProcurementSettled: award_wei must match /^[0-9]+$/, got ${JSON.stringify(payload.award_wei)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendProcurementSettled: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendProcurementSettled: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        award_wei: payload.award_wei,
        contract_id: payload.contract_id,
        tick: payload.tick,
        winner_did_hash: payload.winner_did_hash,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendProcurementSettled: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = winner_did_hash.
    return audit.append('procurement.settled', payload.winner_did_hash, cleanPayload);
}
