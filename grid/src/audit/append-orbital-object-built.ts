/**
 * L3b (D-MONEY-08 / L3b) — Sole-producer for orbital.object_built.
 *
 * Emitted when a settled procurement contract realizes a physical orbital object
 * (OrbitalObjectStore.createFromContract). Completes the Economic Reality Loop audit chain.
 * builder_did_hash is SHA-256 of the builder's Civic DID —
 * raw DID NEVER crosses the audit boundary.
 *
 * Closed 7-key payload (alphabetical): { build_cost_wei, builder_did_hash, contract_id,
 * function_type, object_id, output_rate, tick }.
 * actorDid = builder_did_hash (HEX64).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;

/** Closed 7-key payload. Keys ALPHABETICAL. */
export interface OrbitalObjectBuiltPayload {
    readonly build_cost_wei: string;   // decimal digit string (/^[0-9]+$/)
    readonly builder_did_hash: string; // HEX64_RE — sha256 of builder Civic DID
    readonly contract_id: string;      // UUID_RE
    readonly function_type: string;    // non-empty string
    readonly object_id: string;        // UUID_RE
    readonly output_rate: string;      // decimal digit string (/^[0-9]+$/)
    readonly tick: number;             // non-negative integer
}

const EXPECTED_KEYS = ['build_cost_wei', 'builder_did_hash', 'contract_id', 'function_type', 'object_id', 'output_rate', 'tick'] as const;

export function appendOrbitalObjectBuilt(
    audit: AuditChain,
    payload: OrbitalObjectBuiltPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOrbitalObjectBuilt: payload must be a plain object`);
    }
    // 2. Regex: builder_did_hash (HEX64).
    if (typeof payload.builder_did_hash !== 'string' || !HEX64_RE.test(payload.builder_did_hash)) {
        throw new TypeError(`appendOrbitalObjectBuilt: builder_did_hash must match HEX64_RE, got ${JSON.stringify(payload.builder_did_hash)}`);
    }
    // 3. Regex: contract_id (UUID).
    if (typeof payload.contract_id !== 'string' || !UUID_RE.test(payload.contract_id)) {
        throw new TypeError(`appendOrbitalObjectBuilt: contract_id must match UUID_RE, got ${JSON.stringify(payload.contract_id)}`);
    }
    // 4. Non-empty string: function_type.
    if (typeof payload.function_type !== 'string' || payload.function_type.length === 0) {
        throw new TypeError(`appendOrbitalObjectBuilt: function_type must be a non-empty string, got ${JSON.stringify(payload.function_type)}`);
    }
    // 5. Regex: object_id (UUID).
    if (typeof payload.object_id !== 'string' || !UUID_RE.test(payload.object_id)) {
        throw new TypeError(`appendOrbitalObjectBuilt: object_id must match UUID_RE, got ${JSON.stringify(payload.object_id)}`);
    }
    // 6. Decimal string: build_cost_wei.
    if (typeof payload.build_cost_wei !== 'string' || !DECIMAL_RE.test(payload.build_cost_wei)) {
        throw new TypeError(`appendOrbitalObjectBuilt: build_cost_wei must match /^[0-9]+$/, got ${JSON.stringify(payload.build_cost_wei)}`);
    }
    // 7. Decimal string: output_rate.
    if (typeof payload.output_rate !== 'string' || !DECIMAL_RE.test(payload.output_rate)) {
        throw new TypeError(`appendOrbitalObjectBuilt: output_rate must match /^[0-9]+$/, got ${JSON.stringify(payload.output_rate)}`);
    }
    // 8. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendOrbitalObjectBuilt: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 9. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendOrbitalObjectBuilt: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 10. Explicit reconstruction — no spread.
    const cleanPayload = {
        build_cost_wei: payload.build_cost_wei,
        builder_did_hash: payload.builder_did_hash,
        contract_id: payload.contract_id,
        function_type: payload.function_type,
        object_id: payload.object_id,
        output_rate: payload.output_rate,
        tick: payload.tick,
    };
    // 11. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendOrbitalObjectBuilt: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 12. Commit. actorDid = builder_did_hash.
    return audit.append('orbital.object_built', payload.builder_did_hash, cleanPayload);
}
