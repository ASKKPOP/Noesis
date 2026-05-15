/**
 * appendIrisPriorSeeded — SOLE producer boundary for `iris.prior_seeded`.
 *
 * Phase 17 D-17-08. Structural clone of grid/src/bios/appendBiosBirth.ts.
 *
 * Fires when a Nous forms its first belief about a peer (prior seeding from relationship graph).
 * seed_event_hash = full sha256 hexdigest of the source event in elicit.py.
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.nous_did
 *   3. Self-report invariant: payload.nous_did === actorDid
 *   4. Tick: non-negative integer
 *   5. DID regex: payload.target_did
 *   6. Hash format: payload.seed_event_hash (64-char hex, HEX64_RE — full sha256 hexdigest)
 *   7. Closed-tuple: Object.keys(payload).sort() === IRIS_PRIOR_SEEDED_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. Privacy gate: payloadPrivacyCheck belt-and-suspenders (D-17-17)
 *  10. Commit to chain.
 *
 * Wall-clock free per D-17-14 — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { IRIS_PRIOR_SEEDED_KEYS, type IrisPriorSeededPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). */
const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex (full sha256 hexdigest — Brain emits full hash, Grid stores as-is). */
const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendIrisPriorSeeded(
    audit: AuditChain,
    actorDid: string,
    payload: IrisPriorSeededPayload,
): AuditEntry {
    // 1. DID regex: actorDid
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendIrisPriorSeeded: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. DID regex: payload.nous_did
    if (typeof payload?.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(`appendIrisPriorSeeded: invalid payload.nous_did (DID_RE failed)`);
    }
    // 3. Self-report invariant
    if (payload.nous_did !== actorDid) {
        throw new TypeError(
            `appendIrisPriorSeeded: payload.nous_did must equal actorDid (self-report invariant)`,
        );
    }
    // 4. Tick: non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendIrisPriorSeeded: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. DID regex: payload.target_did
    if (typeof payload.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendIrisPriorSeeded: invalid payload.target_did (DID_RE failed)`);
    }
    // 6. Hash format: seed_event_hash (64-char lowercase hex — full sha256 hexdigest from elicit.py)
    if (typeof payload.seed_event_hash !== 'string' || !HEX64_RE.test(payload.seed_event_hash)) {
        throw new TypeError(
            `appendIrisPriorSeeded: invalid seed_event_hash (expected 64-char lowercase hex sha256)`,
        );
    }
    // 7. Closed-tuple check
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== IRIS_PRIOR_SEEDED_KEYS.length ||
        !actualKeys.every((k, i) => k === IRIS_PRIOR_SEEDED_KEYS[i])
    ) {
        throw new TypeError(
            `appendIrisPriorSeeded: unexpected key set — expected ${JSON.stringify(IRIS_PRIOR_SEEDED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        nous_did: payload.nous_did,
        tick: payload.tick,
        target_did: payload.target_did,
        seed_event_hash: payload.seed_event_hash,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrisPriorSeeded: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit to chain (sole producer).
    return audit.append('iris.prior_seeded', actorDid, cleanPayload);
}
