/**
 * L2b (D-MONEY-08 / L2b) — Sole-producer for procurement.attested.
 *
 * Emitted when the Grid oracle attests that a procurement contract's work
 * is complete (before the escrow is released via procurement.settled).
 * attestation_ref_hash is SHA-256 of the attestation reference —
 * raw ref NEVER crosses the audit boundary.
 *
 * Closed 3-key payload (alphabetical): { attestation_ref_hash, contract_id, tick }.
 * actorDid = attestation_ref_hash (HEX64).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface ProcurementAttestedPayload {
    readonly attestation_ref_hash: string;  // HEX64_RE — sha256 of attestation ref
    readonly contract_id: string;           // UUID_RE
    readonly tick: number;                  // non-negative integer
}

const EXPECTED_KEYS = ['attestation_ref_hash', 'contract_id', 'tick'] as const;

export function appendProcurementAttested(
    audit: AuditChain,
    payload: ProcurementAttestedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendProcurementAttested: payload must be a plain object`);
    }
    // 2. Regex: attestation_ref_hash (HEX64).
    if (typeof payload.attestation_ref_hash !== 'string' || !HEX64_RE.test(payload.attestation_ref_hash)) {
        throw new TypeError(`appendProcurementAttested: attestation_ref_hash must match HEX64_RE, got ${JSON.stringify(payload.attestation_ref_hash)}`);
    }
    // 3. Regex: contract_id (UUID).
    if (typeof payload.contract_id !== 'string' || !UUID_RE.test(payload.contract_id)) {
        throw new TypeError(`appendProcurementAttested: contract_id must match UUID_RE, got ${JSON.stringify(payload.contract_id)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendProcurementAttested: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendProcurementAttested: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        attestation_ref_hash: payload.attestation_ref_hash,
        contract_id: payload.contract_id,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendProcurementAttested: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit. actorDid = attestation_ref_hash.
    return audit.append('procurement.attested', payload.attestation_ref_hash, cleanPayload);
}
