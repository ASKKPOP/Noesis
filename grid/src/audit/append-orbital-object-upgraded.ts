/**
 * W-C3 — Sole-producer for orbital.object_upgraded.
 *
 * Emitted when a settled procurement contract UPGRADES an existing orbital object
 * (OrbitalObjectStore.upgradeFromContract): built things are not create-once — a
 * Nous that has LEARNED a matching skill can extend/change what it built. The
 * upgrade is RFP-funded (a settled contract), skill-gated (the builder holds the
 * skill), and physics re-gated (the new spec re-passes the physics gate).
 * builder_did_hash is SHA-256 of the builder's Civic DID — raw DID NEVER crosses
 * the audit boundary.
 *
 * Closed 7-key payload (alphabetical): { builder_did_hash, contract_id, new_level,
 * new_output_rate, object_id, skill_hash, tick }.
 * actorDid = builder_did_hash (HEX64).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^[0-9]+$/;

/** Closed 7-key payload. Keys ALPHABETICAL. */
export interface OrbitalObjectUpgradedPayload {
    readonly builder_did_hash: string; // HEX64_RE — sha256 of builder Civic DID
    readonly contract_id: string;      // UUID_RE — the funding (upgrade) contract
    readonly new_level: number;        // integer >= 2 (upgrades start at level 2)
    readonly new_output_rate: string;  // decimal digit string (/^[0-9]+$/)
    readonly object_id: string;        // UUID_RE — the object being upgraded
    readonly skill_hash: string;       // non-empty — the skill that gated the upgrade
    readonly tick: number;             // non-negative integer
}

const EXPECTED_KEYS = ['builder_did_hash', 'contract_id', 'new_level', 'new_output_rate', 'object_id', 'skill_hash', 'tick'] as const;

export function appendOrbitalObjectUpgraded(
    audit: AuditChain,
    payload: OrbitalObjectUpgradedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOrbitalObjectUpgraded: payload must be a plain object`);
    }
    // 2. Regex: builder_did_hash (HEX64).
    if (typeof payload.builder_did_hash !== 'string' || !HEX64_RE.test(payload.builder_did_hash)) {
        throw new TypeError(`appendOrbitalObjectUpgraded: builder_did_hash must match HEX64_RE, got ${JSON.stringify(payload.builder_did_hash)}`);
    }
    // 3. Regex: contract_id (UUID).
    if (typeof payload.contract_id !== 'string' || !UUID_RE.test(payload.contract_id)) {
        throw new TypeError(`appendOrbitalObjectUpgraded: contract_id must match UUID_RE, got ${JSON.stringify(payload.contract_id)}`);
    }
    // 4. Integer >= 2: new_level (an upgrade lands the object at level 2 or higher).
    if (!Number.isInteger(payload.new_level) || payload.new_level < 2) {
        throw new TypeError(`appendOrbitalObjectUpgraded: new_level must be an integer >= 2, got ${JSON.stringify(payload.new_level)}`);
    }
    // 5. Decimal string: new_output_rate.
    if (typeof payload.new_output_rate !== 'string' || !DECIMAL_RE.test(payload.new_output_rate)) {
        throw new TypeError(`appendOrbitalObjectUpgraded: new_output_rate must match /^[0-9]+$/, got ${JSON.stringify(payload.new_output_rate)}`);
    }
    // 6. Regex: object_id (UUID).
    if (typeof payload.object_id !== 'string' || !UUID_RE.test(payload.object_id)) {
        throw new TypeError(`appendOrbitalObjectUpgraded: object_id must match UUID_RE, got ${JSON.stringify(payload.object_id)}`);
    }
    // 7. Non-empty string: skill_hash.
    if (typeof payload.skill_hash !== 'string' || payload.skill_hash.length === 0) {
        throw new TypeError(`appendOrbitalObjectUpgraded: skill_hash must be a non-empty string, got ${JSON.stringify(payload.skill_hash)}`);
    }
    // 8. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendOrbitalObjectUpgraded: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 9. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendOrbitalObjectUpgraded: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 10. Explicit reconstruction — no spread.
    const cleanPayload = {
        builder_did_hash: payload.builder_did_hash,
        contract_id: payload.contract_id,
        new_level: payload.new_level,
        new_output_rate: payload.new_output_rate,
        object_id: payload.object_id,
        skill_hash: payload.skill_hash,
        tick: payload.tick,
    };
    // 11. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendOrbitalObjectUpgraded: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 12. Commit. actorDid = builder_did_hash.
    return audit.append('orbital.object_upgraded', payload.builder_did_hash, cleanPayload);
}
