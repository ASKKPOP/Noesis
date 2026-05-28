/**
 * appendP2pConnectionOpened — SOLE producer boundary for `p2p.connection_opened` audit events.
 *
 * Phase 42 / P2P-05 — sole producer for p2p.connection_opened.
 * Allowlist position: 66 (Phase 42 D-42-07). Closed-tuple 4-key payload.
 * Fires when a P2P WebRTC connection is established between two Brains.
 * Grid mints connection_id UUID on the first SDP relay (D-42-05).
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Regex guard: connection_id (UUID_RE).
 *   2b. Regex guard: from_did_hash (HEX64_RE).
 *   2c. Regex guard: to_did_hash (HEX64_RE).
 *   3. Non-negative integer guard: tick.
 *   4. (No closed-enum — all fields are format-validated.)
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'p2p.connection_opened'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 4-key payload for p2p.connection_opened. Keys ALPHABETICAL. */
export interface P2pConnectionOpenedPayload {
    readonly connection_id: string;    // UUID v4 format — minted by Grid on first SDP relay
    readonly from_did_hash: string;    // sha256(fromCivicDid) — 64 hex chars
    readonly tick: number;             // non-negative integer
    readonly to_did_hash: string;      // sha256(toCivicDid) — 64 hex chars
}

/** The 4 keys a p2p.connection_opened payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['connection_id', 'from_did_hash', 'tick', 'to_did_hash'] as const;

/**
 * Sole producer path for p2p.connection_opened audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendP2pConnectionOpened(
    audit: AuditChain,
    payload: P2pConnectionOpenedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendP2pConnectionOpened: payload must be a plain object`);
    }
    // 2. Regex guard: connection_id (UUID v4 format).
    if (typeof payload.connection_id !== 'string' || !UUID_RE.test(payload.connection_id)) {
        throw new TypeError(
            `appendP2pConnectionOpened: connection_id must be UUID v4 format, got ${JSON.stringify(payload.connection_id)}`,
        );
    }
    // 2b. Regex guard: from_did_hash.
    if (typeof payload.from_did_hash !== 'string' || !HEX64_RE.test(payload.from_did_hash)) {
        throw new TypeError(
            `appendP2pConnectionOpened: from_did_hash must match HEX64 (64 lowercase hex chars), got ${JSON.stringify(payload.from_did_hash)}`,
        );
    }
    // 2c. Regex guard: to_did_hash.
    if (typeof payload.to_did_hash !== 'string' || !HEX64_RE.test(payload.to_did_hash)) {
        throw new TypeError(
            `appendP2pConnectionOpened: to_did_hash must match HEX64 (64 lowercase hex chars), got ${JSON.stringify(payload.to_did_hash)}`,
        );
    }
    // 3. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendP2pConnectionOpened: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendP2pConnectionOpened: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        connection_id: payload.connection_id,
        from_did_hash: payload.from_did_hash,
        tick: payload.tick,
        to_did_hash: payload.to_did_hash,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendP2pConnectionOpened: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain. actorDid is from_did_hash (the initiating party).
    return audit.append('p2p.connection_opened', payload.from_did_hash, cleanPayload);
}
