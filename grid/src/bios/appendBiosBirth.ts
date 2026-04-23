/**
 * appendBiosBirth — SOLE producer boundary for `bios.birth`.
 *
 * Phase 10b BIOS-02. Structural clone of grid/src/ananke/append-drive-crossed.ts
 * (Phase 10a sole-producer template).
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex guards (actorDid + payload.did) — reject malformed before any side effect.
 *   2. Self-report invariant — payload.did MUST equal actorDid.
 *   3. Tick — non-negative integer.
 *   4. psyche_hash — 64-char lowercase hex (HEX64_RE).
 *   5. Closed-tuple — exactly 3 keys, alphabetical sort equality.
 *   6. Explicit object reconstruction (prototype-pollution defense).
 *   7. Privacy gate — payloadPrivacyCheck belt-and-suspenders.
 *      D-10b-10 guarantees the 3 closed keys are natively clean; the gate
 *      is the regression fence for future edits.
 *   8. Commit to chain.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'bios.birth' fails the producer-boundary invariant test
 * (grid/test/bios/bios-producer-boundary.test.ts).
 *
 * Wall-clock free per D-10b-09 — tick MUST be supplied by caller (system tick).
 *
 * See: 10b-CONTEXT.md D-10b-01, D-10b-03, D-10b-09, D-10b-10.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { BIOS_BIRTH_KEYS, type BiosBirthPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). Phase 10b is the 6th entry point. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex digest (SHA-256). Matches grid/src/audit/state-hash.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Sole producer path for bios.birth audit events.
 *
 * @throws TypeError on any validation failure — regex, tick shape, tuple,
 *   self-report, psyche_hash format, or privacy regression.
 */
export function appendBiosBirth(
    audit: AuditChain,
    actorDid: string,
    payload: BiosBirthPayload,
): AuditEntry {
    // 1. DID regex guards.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendBiosBirth: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(
            `appendBiosBirth: invalid payload.did (DID_RE failed)`,
        );
    }

    // 2. Self-report invariant — a Nous cannot announce someone else's birth.
    if (payload.did !== actorDid) {
        throw new TypeError(
            `appendBiosBirth: payload.did must equal actorDid (self-report invariant)`,
        );
    }

    // 3. Tick — non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendBiosBirth: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 4. Closed-tuple — exactly 3 keys, alphabetical. Catches missing/extra
    //    keys BEFORE the psyche_hash format check so a missing-psyche_hash
    //    case yields the structural "unexpected key set" diagnostic rather
    //    than a misleading "invalid psyche_hash" error.
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== BIOS_BIRTH_KEYS.length ||
        !actualKeys.every((k, i) => k === BIOS_BIRTH_KEYS[i])
    ) {
        throw new TypeError(
            `appendBiosBirth: unexpected key set — expected ${JSON.stringify(BIOS_BIRTH_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 5. psyche_hash — 64-char lowercase hex.
    if (typeof payload.psyche_hash !== 'string' || !HEX64_RE.test(payload.psyche_hash)) {
        throw new TypeError(
            `appendBiosBirth: invalid psyche_hash (expected 64-char lowercase hex)`,
        );
    }

    // 6. Explicit reconstruction — guarantees no prototype pollution / inherited keys.
    //    Insertion order matches the alphabetical key order for stable JSON serialization.
    const cleanPayload = {
        did: payload.did,
        psyche_hash: payload.psyche_hash,
        tick: payload.tick,
    };

    // 7. Privacy gate — belt-and-suspenders (D-10b-10).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendBiosBirth: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to the chain (sole producer).
    return audit.append('bios.birth', actorDid, cleanPayload);
}
