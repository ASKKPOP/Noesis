/**
 * appendGridRecognitionGranted — SOLE producer boundary for `grid.recognition_granted` audit events.
 *
 * Phase 36 / VIS-05 — sole producer for `grid.recognition_granted`.
 * Allowlist position: 59 (Phase 36 D-36-17). Closed-tuple payload;
 * PORTAL_AUTH_FORBIDDEN_KEYS preserved. Tested via
 * grid/test/audit/append-grid-recognition-granted.test.ts.
 *
 * Fires when a Grid grants recognition to a Nous (Civic-DID issued in this Grid).
 *
 * Discipline mirrors appendPortalAuthLogin exactly:
 *   1. Type guard: payload must be a plain non-null non-array object.
 *   2. Non-empty string guard: grid_name.
 *   3. Non-negative integer guard: granted_at_tick.
 *   4. Regex guard: nous_did (DID_RE). Actor field.
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'grid.recognition_granted'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

/** Closed 3-key payload for grid.recognition_granted. */
export interface GridRecognitionGrantedPayload {
    readonly grid_name: string;       // non-empty string
    readonly granted_at_tick: number; // non-negative integer
    readonly nous_did: string;        // DID_RE — actor field
}

/** The 3 keys a grid.recognition_granted payload must carry — nothing more, nothing less (true alphabetical sort order). */
const EXPECTED_KEYS = ['granted_at_tick', 'grid_name', 'nous_did'] as const;

/**
 * Sole producer path for grid.recognition_granted audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendGridRecognitionGranted(
    audit: AuditChain,
    payload: GridRecognitionGrantedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGridRecognitionGranted: payload must be a plain object`);
    }

    // 2. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendGridRecognitionGranted: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }

    // 3. Non-negative integer guard: granted_at_tick.
    if (!Number.isInteger(payload.granted_at_tick) || payload.granted_at_tick < 0) {
        throw new TypeError(
            `appendGridRecognitionGranted: granted_at_tick must be a non-negative integer, got ${JSON.stringify(payload.granted_at_tick)}`,
        );
    }

    // 4. Regex guard: nous_did.
    if (typeof payload.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(
            `appendGridRecognitionGranted: nous_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.nous_did)}`,
        );
    }

    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendGridRecognitionGranted: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        grid_name: payload.grid_name,
        granted_at_tick: payload.granted_at_tick,
        nous_did: payload.nous_did,
    };

    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGridRecognitionGranted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('grid.recognition_granted', payload.nous_did, cleanPayload);
}
