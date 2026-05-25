/**
 * appendPortalAuthRegister — SOLE producer boundary for `portal.auth.register` audit events.
 *
 * Phase 33 OBS-09 / D-33-B2: fires on SIWE first-connect (inside `if (!human)` block,
 * only when isNew === true) AND email signup. The producer for the portal-layer
 * "new human in this Grid" signal that the /users directory consumer reads.
 *
 * PII (IP, User-Agent, email plaintext, session token, JWT, cookie, password_hash,
 * nonce, signature, device_fingerprint) is permanently forbidden via the closed
 * 3-key payload + PORTAL_AUTH_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN (D-33-B3, D-33-B4).
 *
 * Discipline mirrors the login sibling file exactly (same 3-key shape):
 *   1. Type guard.
 *   2. Regex guard: human_did (DID_RE).
 *   3. Closed-enum guard: method ∈ REGISTER_METHOD_ENUM.
 *   4. Non-negative integer guard: tick.
 *   5. Closed 3-key payload tuple.
 *   6. Explicit reconstruction.
 *   7. payloadPrivacyCheck.
 *   8. audit.append('portal.auth.register', ...).
 *
 * Allowlist position: 55 (Phase 33 D-33-A1).
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/**
 * Closed enum for portal.auth.register method. Phase 33 v2.6 ships exactly two
 * values: 'siwe' (Sign-In With Ethereum) and 'email' (email/password). Future
 * expansion (e.g., 'passkey') requires a new CONTEXT.md decision + sole-producer
 * gate review. Alphabetical order matches the discipline used in other Phase 33
 * enum exports.
 */
export const REGISTER_METHOD_ENUM = ['email', 'siwe'] as const;
export type RegisterMethod = typeof REGISTER_METHOD_ENUM[number];

/** Closed 3-key payload for portal.auth.register. */
export interface PortalAuthRegisterPayload {
    readonly human_did: string;      // DID_RE
    readonly method: RegisterMethod; // closed enum: 'siwe' | 'email'
    readonly tick: number;           // non-negative integer
}

/** The 3 keys a portal.auth.register payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['human_did', 'method', 'tick'] as const;

/**
 * Sole producer path for portal.auth.register audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalAuthRegister(
    audit: AuditChain,
    payload: PortalAuthRegisterPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalAuthRegister: payload must be a plain object`);
    }

    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendPortalAuthRegister: human_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_did)}`,
        );
    }

    // 3. Closed-enum guard: method (Phase 33 NEW pattern — no Phase 22+ analog has an enum).
    if (!REGISTER_METHOD_ENUM.includes(payload.method as RegisterMethod)) {
        throw new TypeError(
            `appendPortalAuthRegister: method must be one of ${JSON.stringify(REGISTER_METHOD_ENUM)}, got ${JSON.stringify(payload.method)}`,
        );
    }

    // 4. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendPortalAuthRegister: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalAuthRegister: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        human_did: payload.human_did,
        method: payload.method,
        tick: payload.tick,
    };

    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalAuthRegister: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('portal.auth.register', payload.human_did, cleanPayload);
}
