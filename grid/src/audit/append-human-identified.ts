/**
 * appendHumanIdentified — SOLE producer boundary for `human.identified` audit events.
 *
 * Phase 33 OBS-08b / D-33-A1 / D-33-A2 / D-33-A3: universal identity-stamp event
 * covering both SIWE and email auth paths. Coexists with Phase 22 `human.joined`
 * (which remains SIWE-only with its 4-key payload — preserved unmodified per
 * PHILOSOPHY §1 first-life promise + chain.ts:181 Merkle invariant).
 *
 *   SIWE first-connect order: human.joined → human.identified → portal.auth.register → portal.auth.login
 *   Email signup order:                       human.identified → portal.auth.register → portal.auth.login
 *
 *   identity_hash for SIWE = sha256(ethAddress.toLowerCase())
 *     (byte-identical to Phase 22 eth_address_hash for correlation across the two events)
 *   identity_hash for email = sha256(email.toLowerCase().trim())
 *     (new privacy-preserved identifier; no Phase 22 analog)
 *
 * Closed 5-key payload {grid_name, human_did, identity_hash, identity_method, tick}.
 * PII (raw eth_address, raw email, IP, UA, session, JWT, cookie, password, nonce,
 * signature, device fingerprint) NEVER crosses the wire — enforced by closed-tuple
 * structural check + PORTAL_AUTH_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN (D-33-B3, D-33-B4).
 *
 * Discipline mirrors appendHumanJoined exactly, with one inserted step:
 *   1. Type guard.
 *   2. Regex guard: human_did (DID_RE).
 *   3. Regex guard: identity_hash (HEX64_RE — SHA-256 of lowercased ETH address OR normalized email).
 *   4. Closed-enum guard: identity_method ∈ IDENTITY_METHOD_ENUM (Phase 33 NEW step).
 *   5. Non-empty string guard: grid_name.
 *   6. Non-negative integer guard: tick.
 *   7. Closed 5-key payload tuple.
 *   8. Explicit reconstruction (no spread).
 *   9. payloadPrivacyCheck.
 *  10. audit.append('human.identified', ...).
 *
 * Allowlist position: 56 (Phase 33 D-33-A1).
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE, HEX64_RE } from './append-human-joined.js';

/**
 * Closed enum for identity_method. Phase 33 v2.6 ships exactly two values:
 * 'siwe' (Sign-In With Ethereum) and 'email' (email/password). Future expansion
 * (e.g., 'passkey' / WebAuthn in v2.7+) requires a new CONTEXT.md decision and
 * is caught by the sole-producer gate at structural check time. Alphabetical order.
 */
export const IDENTITY_METHOD_ENUM = ['email', 'siwe'] as const;
export type IdentityMethod = typeof IDENTITY_METHOD_ENUM[number];

/** Closed 5-key payload for human.identified. */
export interface HumanIdentifiedPayload {
    readonly grid_name: string;            // non-empty string
    readonly human_did: string;            // DID_RE
    readonly identity_hash: string;        // HEX64_RE — SHA-256 of lowercased ETH addr OR normalized email
    readonly identity_method: IdentityMethod; // closed enum: 'siwe' | 'email'
    readonly tick: number;                 // non-negative integer
}

/** The 5 keys a human.identified payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['grid_name', 'human_did', 'identity_hash', 'identity_method', 'tick'] as const;

/**
 * Sole producer path for human.identified audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendHumanIdentified(
    audit: AuditChain,
    payload: HumanIdentifiedPayload,
): AuditEntry {
    // 1. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanIdentified: payload must be a plain object`);
    }

    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendHumanIdentified: human_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_did)}`,
        );
    }

    // 3. Regex guard: identity_hash (64-hex SHA-256).
    if (typeof payload.identity_hash !== 'string' || !HEX64_RE.test(payload.identity_hash)) {
        throw new TypeError(
            `appendHumanIdentified: identity_hash must be 64 hex chars (SHA-256), got ${JSON.stringify(payload.identity_hash)}`,
        );
    }

    // 4. Closed-enum guard: identity_method (Phase 33 NEW pattern — first sole-producer with enum check).
    if (!IDENTITY_METHOD_ENUM.includes(payload.identity_method as IdentityMethod)) {
        throw new TypeError(
            `appendHumanIdentified: identity_method must be one of ${JSON.stringify(IDENTITY_METHOD_ENUM)}, got ${JSON.stringify(payload.identity_method)}`,
        );
    }

    // 5. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendHumanIdentified: grid_name must be a non-empty string`,
        );
    }

    // 6. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendHumanIdentified: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 7. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendHumanIdentified: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 8. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        grid_name: payload.grid_name,
        human_did: payload.human_did,
        identity_hash: payload.identity_hash,
        identity_method: payload.identity_method,
        tick: payload.tick,
    };

    // 9. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanIdentified: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 10. Commit to chain.
    return audit.append('human.identified', payload.human_did, cleanPayload);
}
