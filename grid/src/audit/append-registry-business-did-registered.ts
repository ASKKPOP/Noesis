/**
 * appendRegistryBusinessDidRegistered — SOLE producer boundary for `registry.business_did_registered` audit events.
 *
 * Phase 37 / REG-06 — sole producer for registry.business_did_registered.
 * Allowlist position: 63 (Phase 37 D-V3-33). Closed-tuple 4-key payload.
 * Fires when a Nous registers a new Business-DID in the Grid Registry.
 *
 * PRIVACY INVARIANT: business_name and category are NOT in audit payload
 * (privacy — DB only). Those fields live in business_did_registry table only.
 *
 * 8-step discipline mirrors appendGridRecognitionGranted:
 *   1. Type guard (plain non-null non-array object).
 *   2. Regex guard: business_did (BIZ_DID_RE).
 *   2b. Regex guard: civic_did (CIVIC_DID_RE — owner).
 *   3. Non-empty string guard: grid_name.
 *   4. Non-negative integer guard: registered_at_tick.
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'registry.business_did_registered'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

// Phase 37 introduces did:biz:* and did:civic:* — DID_RE only covers did:noesis:*.
// Local regex constants required (do NOT import DID_RE).
const BIZ_DID_RE = /^did:biz:noesis:[a-z0-9_:\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

/** Closed 4-key payload for registry.business_did_registered. */
export interface RegistryBusinessDidRegisteredPayload {
    readonly business_did: string;        // BIZ_DID_RE
    readonly civic_did: string;           // CIVIC_DID_RE — owner
    readonly grid_name: string;           // non-empty string
    readonly registered_at_tick: number;  // non-negative integer
}

/** The 4 keys a registry.business_did_registered payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['business_did', 'civic_did', 'grid_name', 'registered_at_tick'] as const;

/**
 * Sole producer path for registry.business_did_registered audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendRegistryBusinessDidRegistered(
    audit: AuditChain,
    payload: RegistryBusinessDidRegisteredPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryBusinessDidRegistered: payload must be a plain object`);
    }
    // 2. Regex guard: business_did.
    if (typeof payload.business_did !== 'string' || !BIZ_DID_RE.test(payload.business_did)) {
        throw new TypeError(
            `appendRegistryBusinessDidRegistered: business_did must match BIZ_DID_RE, got ${JSON.stringify(payload.business_did)}`,
        );
    }
    // 2b. Regex guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(
            `appendRegistryBusinessDidRegistered: civic_did must match CIVIC_DID_RE, got ${JSON.stringify(payload.civic_did)}`,
        );
    }
    // 3. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendRegistryBusinessDidRegistered: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // 4. Non-negative integer guard: registered_at_tick.
    if (!Number.isInteger(payload.registered_at_tick) || payload.registered_at_tick < 0) {
        throw new TypeError(
            `appendRegistryBusinessDidRegistered: registered_at_tick must be a non-negative integer, got ${JSON.stringify(payload.registered_at_tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendRegistryBusinessDidRegistered: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        business_did: payload.business_did,
        civic_did: payload.civic_did,
        grid_name: payload.grid_name,
        registered_at_tick: payload.registered_at_tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendRegistryBusinessDidRegistered: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('registry.business_did_registered', payload.business_did, cleanPayload);
}
