/**
 * appendRegistryBusinessDidDissolved — SOLE producer boundary for `registry.business_did_dissolved` audit events.
 *
 * Phase 37 / REG-06 — sole producer for registry.business_did_dissolved.
 * Allowlist position: 64 (Phase 37 D-V3-33). Closed-tuple 4-key payload.
 * Fires when a Business-DID is dissolved in the Grid Registry.
 *
 * 8-step discipline mirrors appendGridRecognitionGranted:
 *   1. Type guard (plain non-null non-array object).
 *   2. Regex guard: business_did (BIZ_DID_RE).
 *   2b. Regex guard: civic_did (CIVIC_DID_RE — owner).
 *   3. Non-negative integer guard: dissolved_at_tick.
 *   4. Non-empty string guard: grid_name.
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'registry.business_did_dissolved'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

// Phase 37 introduces did:biz:* and did:civic:* — DID_RE only covers did:noesis:*.
// Local regex constants required (do NOT import DID_RE).
const BIZ_DID_RE = /^did:biz:noesis:[a-z0-9_:\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

/** Closed 4-key payload for registry.business_did_dissolved. */
export interface RegistryBusinessDidDissolvedPayload {
    readonly business_did: string;       // BIZ_DID_RE
    readonly civic_did: string;          // CIVIC_DID_RE — owner
    readonly dissolved_at_tick: number;  // non-negative integer
    readonly grid_name: string;          // non-empty string
}

/** The 4 keys a registry.business_did_dissolved payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['business_did', 'civic_did', 'dissolved_at_tick', 'grid_name'] as const;

/**
 * Sole producer path for registry.business_did_dissolved audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendRegistryBusinessDidDissolved(
    audit: AuditChain,
    payload: RegistryBusinessDidDissolvedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryBusinessDidDissolved: payload must be a plain object`);
    }
    // 2. Regex guard: business_did.
    if (typeof payload.business_did !== 'string' || !BIZ_DID_RE.test(payload.business_did)) {
        throw new TypeError(
            `appendRegistryBusinessDidDissolved: business_did must match BIZ_DID_RE, got ${JSON.stringify(payload.business_did)}`,
        );
    }
    // 2b. Regex guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(
            `appendRegistryBusinessDidDissolved: civic_did must match CIVIC_DID_RE, got ${JSON.stringify(payload.civic_did)}`,
        );
    }
    // 3. Non-negative integer guard: dissolved_at_tick.
    if (!Number.isInteger(payload.dissolved_at_tick) || payload.dissolved_at_tick < 0) {
        throw new TypeError(
            `appendRegistryBusinessDidDissolved: dissolved_at_tick must be a non-negative integer, got ${JSON.stringify(payload.dissolved_at_tick)}`,
        );
    }
    // 4. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendRegistryBusinessDidDissolved: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendRegistryBusinessDidDissolved: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        business_did: payload.business_did,
        civic_did: payload.civic_did,
        dissolved_at_tick: payload.dissolved_at_tick,
        grid_name: payload.grid_name,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendRegistryBusinessDidDissolved: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('registry.business_did_dissolved', payload.business_did, cleanPayload);
}
