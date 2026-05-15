/**
 * appendIrisContradictionDetected — SOLE producer boundary for `iris.contradiction_detected`.
 *
 * Phase 17 D-17-08. Structural clone of grid/src/bios/appendBiosBirth.ts.
 *
 * Fires when confidence delta between old and new belief exceeds IRIS_CONTRADICTION_THRESHOLD=0.3.
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.nous_did
 *   3. Self-report invariant: payload.nous_did === actorDid
 *   4. Tick: non-negative integer
 *   5. DID regex: payload.target_did
 *   6. Hash format: payload.contradiction_hash (64-char hex, HEX64_RE — full sha256 hexdigest)
 *   7. Closed-tuple: Object.keys(payload).sort() === IRIS_CONTRADICTION_DETECTED_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. Privacy gate: payloadPrivacyCheck belt-and-suspenders (D-17-17)
 *  10. Commit to chain.
 *
 * Wall-clock free per D-17-14 — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { IRIS_CONTRADICTION_DETECTED_KEYS, type IrisContradictionDetectedPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). */
const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex (full sha256 hexdigest — Brain emits full hash, Grid stores as-is). */
const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendIrisContradictionDetected(
    audit: AuditChain,
    actorDid: string,
    payload: IrisContradictionDetectedPayload,
): AuditEntry {
    // 1. DID regex: actorDid
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendIrisContradictionDetected: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. DID regex: payload.nous_did
    if (typeof payload?.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(`appendIrisContradictionDetected: invalid payload.nous_did (DID_RE failed)`);
    }
    // 3. Self-report invariant
    if (payload.nous_did !== actorDid) {
        throw new TypeError(
            `appendIrisContradictionDetected: payload.nous_did must equal actorDid (self-report invariant)`,
        );
    }
    // 4. Tick: non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendIrisContradictionDetected: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. DID regex: payload.target_did
    if (typeof payload.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendIrisContradictionDetected: invalid payload.target_did (DID_RE failed)`);
    }
    // 6. Hash format: contradiction_hash (64-char lowercase hex — full sha256 hexdigest)
    if (typeof payload.contradiction_hash !== 'string' || !HEX64_RE.test(payload.contradiction_hash)) {
        throw new TypeError(
            `appendIrisContradictionDetected: invalid contradiction_hash (expected 64-char lowercase hex sha256)`,
        );
    }
    // 7. Closed-tuple check
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== IRIS_CONTRADICTION_DETECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === IRIS_CONTRADICTION_DETECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendIrisContradictionDetected: unexpected key set — expected ${JSON.stringify(IRIS_CONTRADICTION_DETECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        nous_did: payload.nous_did,
        tick: payload.tick,
        target_did: payload.target_did,
        contradiction_hash: payload.contradiction_hash,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrisContradictionDetected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit to chain (sole producer).
    return audit.append('iris.contradiction_detected', actorDid, cleanPayload);
}
