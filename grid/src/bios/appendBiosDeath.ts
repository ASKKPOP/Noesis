/**
 * appendBiosDeath — SOLE producer boundary for `bios.death`.
 *
 * Phase 10b BIOS-03 + BIOS-04. Structural clone of
 * grid/src/ananke/append-drive-crossed.ts with CAUSE literal-guard
 * (pattern from grid/src/audit/append-nous-deleted.ts).
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex guards (actorDid + payload.did).
 *   2. Self-report invariant — payload.did MUST equal actorDid.
 *   3. Tick — non-negative integer.
 *   4. final_state_hash — 64-char lowercase hex (HEX64_RE).
 *   5. Closed-enum cause — assertCause literal-guard (3 members).
 *   6. Closed-tuple — exactly 4 keys, alphabetical sort equality.
 *   7. Tombstone gate (BIOS-04) — registry.isTombstoned(payload.did) MUST be false.
 *      Prevents double-death emission. Caller (delete-nous.ts for H5;
 *      starvation handler for natural death) MUST tombstone BEFORE
 *      invoking appendBiosDeath per locked D-30 ORDER. The function
 *      itself does NOT tombstone (single responsibility, B6 fix).
 *   8. Explicit reconstruction + privacy gate + commit.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'bios.death' fails the producer-boundary invariant test.
 *
 * Wall-clock free per D-10b-09 — tick MUST be supplied by caller.
 *
 * See: 10b-CONTEXT.md D-10b-01, D-10b-04, D-10b-09, D-10b-10.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { BIOS_DEATH_KEYS, CAUSE_VALUES, assertCause, type BiosDeathPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex digest (SHA-256). */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/** Re-export the closed-enum so test suites can import from the emitter directly. */
export { CAUSE_VALUES };

/**
 * Tombstone-check dependency. The minimal slice of NousRegistry surface
 * appendBiosDeath needs (BIOS-04). Production callers pass the live registry;
 * tests pass a vi.fn mock.
 */
export interface TombstoneCheck {
    isTombstoned(did: string): boolean;
}

/**
 * Sole producer path for bios.death audit events.
 *
 * @throws TypeError on any validation failure — regex, tick shape, hash format,
 *   cause-enum violation, tuple, self-report, tombstone breach, or privacy regression.
 */
export function appendBiosDeath(
    audit: AuditChain,
    actorDid: string,
    payload: BiosDeathPayload,
    registry?: TombstoneCheck,
): AuditEntry {
    // 1. DID regex guards.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendBiosDeath: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(
            `appendBiosDeath: invalid payload.did (DID_RE failed)`,
        );
    }

    // 2. Self-report invariant.
    if (payload.did !== actorDid) {
        throw new TypeError(
            `appendBiosDeath: payload.did must equal actorDid (self-report invariant)`,
        );
    }

    // 3. Tick — non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendBiosDeath: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 4. final_state_hash — 64-char lowercase hex.
    if (typeof payload.final_state_hash !== 'string' || !HEX64_RE.test(payload.final_state_hash)) {
        throw new TypeError(
            `appendBiosDeath: invalid final_state_hash (expected 64-char lowercase hex)`,
        );
    }

    // 5. Closed-tuple — exactly 4 keys, alphabetical. Catches missing/extra
    //    keys BEFORE the cause-enum check so a missing-cause case yields the
    //    structural "unexpected key set" diagnostic rather than a misleading
    //    "invalid cause: undefined" error.
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== BIOS_DEATH_KEYS.length ||
        !actualKeys.every((k, i) => k === BIOS_DEATH_KEYS[i])
    ) {
        throw new TypeError(
            `appendBiosDeath: unexpected key set — expected ${JSON.stringify(BIOS_DEATH_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Closed-enum cause — literal-guard (BIOS-03). Throws TypeError
    //    "invalid cause: ..." which matches the test regex
    //    /unknown cause|invalid cause/.
    assertCause(payload.cause);

    // 7. Tombstone gate (BIOS-04) — refuse to emit if DID already tombstoned.
    //    Caller-provided registry; absent => skipped (legitimate for unit tests
    //    of validation-only paths that pre-assert no-double-death by construction).
    if (registry !== undefined && registry.isTombstoned(payload.did)) {
        throw new TypeError(
            `appendBiosDeath: ${payload.did} is already tombstoned (post-death emission rejected)`,
        );
    }

    // 8a. Explicit reconstruction — alphabetical insertion order matches
    //     BIOS_DEATH_KEYS for stable JSON serialization.
    const cleanPayload = {
        cause: payload.cause,
        did: payload.did,
        final_state_hash: payload.final_state_hash,
        tick: payload.tick,
    };

    // 8b. Privacy gate — belt-and-suspenders (D-10b-10).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendBiosDeath: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8c. Commit to the chain (sole producer).
    return audit.append('bios.death', actorDid, cleanPayload);
}
