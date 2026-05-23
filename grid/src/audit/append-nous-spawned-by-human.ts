/**
 * appendNousSpawnedByHuman — SOLE producer boundary for `nous.spawned_by_human` audit events.
 *
 * Phase 28 SPAWN-04: fires when a human completes the spawn wizard and a personal
 * Nous is created in the Genesis Grid. Records which Nous was spawned, who owns it,
 * which grid it lives in, and at which tick.
 *
 * Mirrors appendHumanTransferred discipline exactly:
 *   1. Type guard: payload must be a plain non-null non-array object.
 *   2. Regex guard: nous_did (DID_RE).
 *   3. Regex guard: owner_human_did (DID_RE).
 *   4. Non-empty string guard: grid_name.
 *   5. Non-negative integer guard: tick.
 *   6. Closed 4-key payload tuple — extra keys refused.
 *   7. Explicit reconstruction (no spread).
 *   8. payloadPrivacyCheck runs before chain.append.
 *   9. audit.append with canonical event type 'nous.spawned_by_human'.
 *
 * Running allowlist total after this addition: 53.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/** Closed 4-key payload for nous.spawned_by_human. */
export interface NousSpawnedByHumanPayload {
    readonly grid_name: string;       // non-empty string
    readonly nous_did: string;        // DID_RE — the newly-spawned Nous DID
    readonly owner_human_did: string; // DID_RE — the human who owns this Nous
    readonly tick: number;            // non-negative integer
}

/** The 4 keys a nous.spawned_by_human payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['grid_name', 'nous_did', 'owner_human_did', 'tick'] as const;

/**
 * Sole producer path for nous.spawned_by_human audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendNousSpawnedByHuman(
    audit: AuditChain,
    payload: NousSpawnedByHumanPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendNousSpawnedByHuman: payload must be a plain object`);
    }

    // 2. Regex guard: nous_did.
    if (typeof payload.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(
            `appendNousSpawnedByHuman: nous_did must match DID_RE, got ${JSON.stringify(payload.nous_did)}`,
        );
    }

    // 3. Regex guard: owner_human_did.
    if (typeof payload.owner_human_did !== 'string' || !DID_RE.test(payload.owner_human_did)) {
        throw new TypeError(
            `appendNousSpawnedByHuman: owner_human_did must match DID_RE, got ${JSON.stringify(payload.owner_human_did)}`,
        );
    }

    // 4. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendNousSpawnedByHuman: grid_name must be a non-empty string`);
    }

    // 5. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendNousSpawnedByHuman: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 6. Closed-tuple structural check (alphabetical).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendNousSpawnedByHuman: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        grid_name: payload.grid_name,
        nous_did: payload.nous_did,
        owner_human_did: payload.owner_human_did,
        tick: payload.tick,
    };

    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNousSpawnedByHuman: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain.
    return audit.append('nous.spawned_by_human', payload.nous_did, cleanPayload);
}
