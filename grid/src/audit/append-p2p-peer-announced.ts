/**
 * appendP2pPeerAnnounced — SOLE producer boundary for `p2p.peer_announced` audit events.
 *
 * Phase 42 / P2P-05 — sole producer for p2p.peer_announced.
 * Allowlist position: 65 (Phase 42 D-42-07). Closed-tuple 3-key payload.
 * Fires when a Brain announces P2P presence heartbeat to the Grid.
 *
 * D-42-02: endpoint_hash = sha256('online') — static sentinel (no IP/port leakage).
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Regex guard: civic_did_hash (HEX64_RE).
 *   2b. Regex guard: endpoint_hash (HEX64_RE).
 *   3. Non-negative integer guard: tick.
 *   4. (No closed-enum — all fields are format-validated.)
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'p2p.peer_announced'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

/** Closed 3-key payload for p2p.peer_announced. Keys ALPHABETICAL. */
export interface P2pPeerAnnouncedPayload {
    readonly civic_did_hash: string;   // sha256(civicDid) — 64 hex chars
    readonly endpoint_hash: string;    // sha256('online') — static sentinel
    readonly tick: number;             // non-negative integer
}

/** The 3 keys a p2p.peer_announced payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['civic_did_hash', 'endpoint_hash', 'tick'] as const;

/**
 * Sole producer path for p2p.peer_announced audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendP2pPeerAnnounced(
    audit: AuditChain,
    payload: P2pPeerAnnouncedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendP2pPeerAnnounced: payload must be a plain object`);
    }
    // 2. Regex guard: civic_did_hash.
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(
            `appendP2pPeerAnnounced: civic_did_hash must match HEX64 (64 lowercase hex chars), got ${JSON.stringify(payload.civic_did_hash)}`,
        );
    }
    // 2b. Regex guard: endpoint_hash.
    if (typeof payload.endpoint_hash !== 'string' || !HEX64_RE.test(payload.endpoint_hash)) {
        throw new TypeError(
            `appendP2pPeerAnnounced: endpoint_hash must match HEX64 (64 lowercase hex chars), got ${JSON.stringify(payload.endpoint_hash)}`,
        );
    }
    // 3. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendP2pPeerAnnounced: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendP2pPeerAnnounced: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        civic_did_hash: payload.civic_did_hash,
        endpoint_hash: payload.endpoint_hash,
        tick: payload.tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendP2pPeerAnnounced: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain. actorDid is civic_did_hash (the announcing party).
    return audit.append('p2p.peer_announced', payload.civic_did_hash, cleanPayload);
}
