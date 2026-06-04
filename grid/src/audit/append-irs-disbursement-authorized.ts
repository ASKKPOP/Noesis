/**
 * Phase 45 (IRS-03) — Sole-producer for irs.disbursement_authorized.
 *
 * Emitted at JWT-verification time (BEFORE the DB transaction in disburse route).
 * actorDid = authorized_by_civic_did_hash (Government Speaker civic-did sha256).
 * Closed 5-key payload (alphabetical): amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick.
 *
 * Pair: irs.disbursement_executed (pos 75) fires AFTER the DB commit with cause='government_disbursement'.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface IrsDisbursementAuthorizedPayload {
    readonly amount_bios: number;                        // positive integer (>0)
    readonly authorized_by_civic_did_hash: string;       // HEX64_RE — Government Speaker civic-did sha256
    readonly grid_name: string;                          // non-empty
    readonly legislation_ref_hash: string;               // HEX64_RE — sha256(legislation_ref plaintext)
    readonly tick: number;                               // non-negative integer
}

const EXPECTED_KEYS = [
    'amount_bios',
    'authorized_by_civic_did_hash',
    'grid_name',
    'legislation_ref_hash',
    'tick',
] as const;

export function appendIrsDisbursementAuthorized(
    audit: AuditChain,
    payload: IrsDisbursementAuthorizedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendIrsDisbursementAuthorized: payload must be a plain object`);
    }
    // 2. Regex: authorized_by_civic_did_hash (HEX64).
    if (typeof payload.authorized_by_civic_did_hash !== 'string' || !HEX64_RE.test(payload.authorized_by_civic_did_hash)) {
        throw new TypeError(`appendIrsDisbursementAuthorized: authorized_by_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.authorized_by_civic_did_hash)}`);
    }
    // 3. Regex: legislation_ref_hash (HEX64).
    if (typeof payload.legislation_ref_hash !== 'string' || !HEX64_RE.test(payload.legislation_ref_hash)) {
        throw new TypeError(`appendIrsDisbursementAuthorized: legislation_ref_hash must match HEX64_RE, got ${JSON.stringify(payload.legislation_ref_hash)}`);
    }
    // 4. Non-empty string: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendIrsDisbursementAuthorized: grid_name must be non-empty string, got ${JSON.stringify(payload.grid_name)}`);
    }
    // 5. Positive integer: amount_bios.
    if (!Number.isInteger(payload.amount_bios) || payload.amount_bios <= 0) {
        throw new TypeError(`appendIrsDisbursementAuthorized: amount_bios must be positive integer, got ${JSON.stringify(payload.amount_bios)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendIrsDisbursementAuthorized: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check (alphabetical order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendIrsDisbursementAuthorized: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_bios: payload.amount_bios,
        authorized_by_civic_did_hash: payload.authorized_by_civic_did_hash,
        grid_name: payload.grid_name,
        legislation_ref_hash: payload.legislation_ref_hash,
        tick: payload.tick,
    };
    // 9. Privacy gate + audit.append. actorDid = authorized_by_civic_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrsDisbursementAuthorized: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('irs.disbursement_authorized', payload.authorized_by_civic_did_hash, cleanPayload);
}
