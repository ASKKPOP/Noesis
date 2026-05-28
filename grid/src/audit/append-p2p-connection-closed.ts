/**
 * appendP2pConnectionClosed — SOLE producer boundary for `p2p.connection_closed` audit events.
 *
 * Phase 42 / P2P-05 — sole producer for p2p.connection_closed.
 * Allowlist position: 67 (Phase 42 D-42-07). Closed-tuple 4-key payload.
 * Fires when a P2P WebRTC connection is terminated between two Brains.
 *
 * close_reason ∈ {'completed', 'timeout', 'error', 'initiated'} — closed enum, validated.
 *
 * 8-step discipline mirrors appendAnankeDriveCrossed (closed-enum gate) +
 * appendRegistryCivicDidIssued (base pattern):
 *   1. Type guard (plain non-null non-array object).
 *   2. Closed-enum guard: close_reason ∈ CLOSE_REASONS.
 *   2b. Regex guard: connection_id (UUID_RE).
 *   3a. Non-negative integer guard: duration_ticks.
 *   3b. Non-negative integer guard: tick.
 *   4. (close_reason already validated in step 2.)
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'p2p.connection_closed'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valid close reasons for p2p.connection_closed events — closed enum. */
export type P2pCloseReason = 'completed' | 'timeout' | 'error' | 'initiated';

const CLOSE_REASONS = new Set<string>(['completed', 'timeout', 'error', 'initiated']);

/** Closed 4-key payload for p2p.connection_closed. Keys ALPHABETICAL. */
export interface P2pConnectionClosedPayload {
    readonly close_reason: P2pCloseReason;  // closed enum: completed|timeout|error|initiated
    readonly connection_id: string;          // UUID v4 — correlates with p2p.connection_opened
    readonly duration_ticks: number;         // non-negative integer — ticks connection was active
    readonly tick: number;                   // non-negative integer — tick at close time
}

/** The 4 keys a p2p.connection_closed payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['close_reason', 'connection_id', 'duration_ticks', 'tick'] as const;

/**
 * Sole producer path for p2p.connection_closed audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendP2pConnectionClosed(
    audit: AuditChain,
    payload: P2pConnectionClosedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendP2pConnectionClosed: payload must be a plain object`);
    }
    // 2. Closed-enum gate: close_reason.
    if (typeof payload.close_reason !== 'string' || !CLOSE_REASONS.has(payload.close_reason)) {
        throw new TypeError(
            `appendP2pConnectionClosed: unknown close_reason ${JSON.stringify(payload.close_reason)} — expected one of ${JSON.stringify([...CLOSE_REASONS])}`,
        );
    }
    // 2b. Regex guard: connection_id (UUID v4 format).
    if (typeof payload.connection_id !== 'string' || !UUID_RE.test(payload.connection_id)) {
        throw new TypeError(
            `appendP2pConnectionClosed: connection_id must be UUID v4 format, got ${JSON.stringify(payload.connection_id)}`,
        );
    }
    // 3a. Non-negative integer guard: duration_ticks.
    if (!Number.isInteger(payload.duration_ticks) || payload.duration_ticks < 0) {
        throw new TypeError(
            `appendP2pConnectionClosed: duration_ticks must be a non-negative integer, got ${JSON.stringify(payload.duration_ticks)}`,
        );
    }
    // 3b. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendP2pConnectionClosed: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendP2pConnectionClosed: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        close_reason: payload.close_reason,
        connection_id: payload.connection_id,
        duration_ticks: payload.duration_ticks,
        tick: payload.tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendP2pConnectionClosed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain. actorDid: use connection_id (no party-specific actor for close).
    return audit.append('p2p.connection_closed', payload.connection_id, cleanPayload);
}
