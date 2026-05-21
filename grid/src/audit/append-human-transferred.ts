/**
 * appendHumanTransferred — SOLE producer boundary for `human.transferred` audit events.
 *
 * Phase 23 gap / Phase 24 fix: fires when a human completes an on-chain Cyber Coin
 * transfer. The raw recipient address and amount are NEVER stored — the event records
 * only who transferred, which asset, in which grid, at which tick.
 *
 * Mirrors appendHumanJoined discipline exactly:
 *   1. Regex guard: human_did (DID_RE).
 *   2. Enum guard: asset must be 'ETH' or 'USDT'.
 *   3. Non-empty string guard: grid_name.
 *   4. Non-negative integer guard: tick.
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'human.transferred'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/** Allowed Cyber Coin asset types (Phase 23 scope). */
const ALLOWED_ASSETS = new Set<string>(['ETH', 'USDT']);

/** Closed 4-key payload for human.transferred. */
export interface HumanTransferredPayload {
    readonly human_did: string;  // DID_RE
    readonly asset: string;      // 'ETH' | 'USDT'
    readonly grid_name: string;  // non-empty string
    readonly tick: number;       // non-negative integer
}

/** The 4 keys a human.transferred payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['asset', 'grid_name', 'human_did', 'tick'] as const;

/**
 * Sole producer path for human.transferred audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendHumanTransferred(
    audit: AuditChain,
    payload: HumanTransferredPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanTransferred: payload must be a plain object`);
    }

    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendHumanTransferred: human_did must match DID_RE, got ${JSON.stringify(payload.human_did)}`,
        );
    }

    // 3. Enum guard: asset.
    if (typeof payload.asset !== 'string' || !ALLOWED_ASSETS.has(payload.asset)) {
        throw new TypeError(
            `appendHumanTransferred: asset must be 'ETH' or 'USDT', got ${JSON.stringify(payload.asset)}`,
        );
    }

    // 4. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendHumanTransferred: grid_name must be a non-empty string`);
    }

    // 5. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendHumanTransferred: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 6. Closed-tuple structural check (alphabetical).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendHumanTransferred: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        asset: payload.asset,
        grid_name: payload.grid_name,
        human_did: payload.human_did,
        tick: payload.tick,
    };

    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanTransferred: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain.
    return audit.append('human.transferred', payload.human_did, cleanPayload);
}
