/**
 * appendPortalAuthLogin — SOLE producer boundary for `portal.auth.login` audit events.
 *
 * Phase 33 OBS-08 / D-33-B1: fires on every SIWE verify success AND email signin
 * success (unconditional — regardless of isNew). The producer for the portal-layer
 * session-start signal that lights up `/users` and `/humans/[did]/history siwe_sessions`.
 *
 * PII (IP, User-Agent, email plaintext, session token, JWT, cookie, password_hash,
 * nonce, signature, device_fingerprint) is permanently forbidden via the closed
 * 3-key payload + PORTAL_AUTH_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN (D-33-B3, D-33-B4).
 *
 * Discipline mirrors appendNousSpawnedByHuman exactly, with one addition:
 *   1. Type guard: payload must be a plain non-null non-array object.
 *   2. Regex guard: human_did (DID_RE).
 *   3. Closed-enum guard: method ∈ LOGIN_METHOD_ENUM (NEW vs Phase 28 analog).
 *   4. Non-negative integer guard: tick.
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'portal.auth.login'.
 *
 * Allowlist position: 54 (Phase 33 D-33-A1).
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/**
 * Closed enum for portal.auth.login method. Phase 33 v2.6 ships exactly two
 * values: 'siwe' (Sign-In With Ethereum) and 'email' (email/password). Future
 * expansion (e.g., 'passkey') requires a new CONTEXT.md decision + sole-producer
 * gate review. Alphabetical order matches the discipline used in other Phase 33
 * enum exports.
 */
export const LOGIN_METHOD_ENUM = ['email', 'siwe'] as const;
export type LoginMethod = typeof LOGIN_METHOD_ENUM[number];

/** Closed 3-key payload for portal.auth.login. */
export interface PortalAuthLoginPayload {
    readonly human_did: string;    // DID_RE
    readonly method: LoginMethod;  // closed enum: 'siwe' | 'email'
    readonly tick: number;         // non-negative integer
}

/** The 3 keys a portal.auth.login payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['human_did', 'method', 'tick'] as const;

/**
 * Sole producer path for portal.auth.login audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalAuthLogin(
    audit: AuditChain,
    payload: PortalAuthLoginPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalAuthLogin: payload must be a plain object`);
    }

    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendPortalAuthLogin: human_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_did)}`,
        );
    }

    // 3. Closed-enum guard: method (Phase 33 NEW pattern — no Phase 22+ analog has an enum).
    if (!LOGIN_METHOD_ENUM.includes(payload.method as LoginMethod)) {
        throw new TypeError(
            `appendPortalAuthLogin: method must be one of ${JSON.stringify(LOGIN_METHOD_ENUM)}, got ${JSON.stringify(payload.method)}`,
        );
    }

    // 4. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendPortalAuthLogin: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalAuthLogin: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
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
            `appendPortalAuthLogin: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('portal.auth.login', payload.human_did, cleanPayload);
}
