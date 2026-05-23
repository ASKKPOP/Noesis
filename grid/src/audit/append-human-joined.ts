/**
 * appendHumanJoined — SOLE producer boundary for `human.joined` audit events.
 *
 * Phase 22 WEB3-04: ETH address is SHA-256 hashed before entering the audit
 * chain — raw address NEVER appears as a payload key.
 *
 * Mirrors append-nous-deleted.ts discipline exactly:
 *   1. Regex guards: human_did (DID_RE), eth_address_hash (HEX64_RE).
 *   2. Non-empty string guard: grid_name.
 *   3. Non-negative integer guard: tick.
 *   4. Closed 4-key payload tuple — extra keys refused.
 *   5. Explicit reconstruction (no spread).
 *   6. payloadPrivacyCheck runs before chain.append.
 *   7. audit.append with canonical event type 'human.joined'.
 *
 * See: 22-02-PLAN.md WEB3-04, WEB3-06.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** 64-hex SHA-256 — matches grid/src/audit/state-hash.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * DID regex for human_did — WEB3-05 base pattern.
 * Updated Phase 28: allows colons in sub-segments to support did:noesis:human:* and
 * did:noesis:human-nous:* DID schemes introduced by the personal Nous spawn flow.
 */
export const DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

/** Closed 4-key payload for human.joined (WEB3-04). */
export interface HumanJoinedPayload {
    readonly human_did: string;         // DID_RE
    readonly eth_address_hash: string;  // HEX64_RE — SHA-256 of lowercased ETH address
    readonly grid_name: string;         // non-empty string
    readonly tick: number;              // non-negative integer
}

/** The 4 keys a human.joined payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['eth_address_hash', 'grid_name', 'human_did', 'tick'] as const;

/**
 * Sole producer path for human.joined audit events.
 *
 * @throws TypeError if regex guards fail, the payload carries an unexpected
 *   key, or payloadPrivacyCheck rejects the payload.
 */
export function appendHumanJoined(
    audit: AuditChain,
    payload: HumanJoinedPayload,
): AuditEntry {
    // 1. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanJoined: payload must be a plain object`);
    }

    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendHumanJoined: human_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_did)}`,
        );
    }

    // 3. Regex guard: eth_address_hash (64-hex SHA-256 of lowercased ETH address).
    if (typeof payload.eth_address_hash !== 'string' || !HEX64_RE.test(payload.eth_address_hash)) {
        throw new TypeError(
            `appendHumanJoined: eth_address_hash must be 64 hex chars (SHA-256), got ${JSON.stringify(payload.eth_address_hash)}`,
        );
    }

    // 4. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendHumanJoined: grid_name must be a non-empty string`,
        );
    }

    // 5. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendHumanJoined: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 6. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendHumanJoined: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        eth_address_hash: payload.eth_address_hash,
        grid_name: payload.grid_name,
        human_did: payload.human_did,
        tick: payload.tick,
    };

    // 8. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanJoined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain.
    return audit.append('human.joined', payload.human_did, cleanPayload);
}
