/**
 * appendAnankeDriveCrossed — SOLE producer boundary for `ananke.drive_crossed`.
 *
 * Phase 10a DRIVE-03, DRIVE-05. Structural clone of the Phase 7 sole-producer
 * template (grid/src/audit/append-telos-refined.ts).
 *
 * Validation discipline (ordering deliberate):
 *   1. Regex-guard every string input (DID_RE).
 *   2. Self-report invariant — payload.did MUST equal actorDid.
 *   3. Tick — non-negative integer.
 *   4. Closed-enum gates — drive / level / direction must be enum members.
 *      (Enum checks run BEFORE the tuple check so common mistakes yield
 *       informative errors. The tuple check catches structural violations
 *       the enum checks cannot express — missing / extra keys.)
 *   5. Closed-tuple — exactly 5 keys, alphabetical sort equality.
 *   6. Explicit object reconstruction (prototype-pollution defense).
 *   7. Privacy gate — payloadPrivacyCheck belt-and-suspenders. D-10a-07 says
 *      the 5 closed keys are natively clean; the gate is the regression fence.
 *   8. Commit to chain.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'ananke.drive_crossed' fails the producer-boundary invariant test
 * (grid/test/ananke/drive-crossed-producer-boundary.test.ts).
 *
 * See: 10a-CONTEXT.md D-10a-03, D-10a-04, D-10a-07, D-10a-08.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import {
    ANANKE_DIRECTIONS,
    ANANKE_DRIVE_LEVELS,
    ANANKE_DRIVE_NAMES,
    type AnankeDriveCrossedPayload,
} from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). Phase 10a is the 5th entry point. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

const DRIVE_NAME_SET: ReadonlySet<string> = new Set(ANANKE_DRIVE_NAMES);
const DRIVE_LEVEL_SET: ReadonlySet<string> = new Set(ANANKE_DRIVE_LEVELS);
const DIRECTION_SET: ReadonlySet<string> = new Set(ANANKE_DIRECTIONS);

/** The 5 keys an ananke.drive_crossed payload must carry — ALPHABETICAL for sort-equality. */
const EXPECTED_KEYS = ['did', 'direction', 'drive', 'level', 'tick'] as const;

/**
 * Sole producer path for ananke.drive_crossed audit events.
 *
 * @throws TypeError on any validation failure — regex, enum, tuple, self-report,
 *   tick shape, or privacy regression.
 */
export function appendAnankeDriveCrossed(
    audit: AuditChain,
    actorDid: string,
    payload: AnankeDriveCrossedPayload,
): AuditEntry {
    // 1. DID regex guards — reject malformed inputs before ANY side effect.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendAnankeDriveCrossed: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(
            `appendAnankeDriveCrossed: invalid payload.did (DID_RE failed)`,
        );
    }
    // 2. Self-report invariant — a Nous cannot announce someone else's crossing.
    if (payload.did !== actorDid) {
        throw new TypeError(
            `appendAnankeDriveCrossed: payload.did must equal actorDid (self-report invariant)`,
        );
    }

    // 3. Tick — non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendAnankeDriveCrossed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 4. Closed-enum validation — drive / level / direction must be members.
    if (!DRIVE_NAME_SET.has(payload.drive)) {
        throw new TypeError(
            `appendAnankeDriveCrossed: unknown drive ${JSON.stringify(payload.drive)}`,
        );
    }
    if (!DRIVE_LEVEL_SET.has(payload.level)) {
        throw new TypeError(
            `appendAnankeDriveCrossed: unknown level ${JSON.stringify(payload.level)} (expected low|med|high)`,
        );
    }
    if (!DIRECTION_SET.has(payload.direction)) {
        throw new TypeError(
            `appendAnankeDriveCrossed: unknown direction ${JSON.stringify(payload.direction)} (expected rising|falling)`,
        );
    }

    // 5. Closed-tuple — exactly 5 keys, alphabetical. Catches missing / extra keys.
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendAnankeDriveCrossed: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — guarantees no prototype pollution / inherited keys.
    //    Insertion order matches the payload interface declaration order
    //    ({did, tick, drive, level, direction}) for stable JSON serialization.
    const cleanPayload = {
        did: payload.did,
        tick: payload.tick,
        drive: payload.drive,
        level: payload.level,
        direction: payload.direction,
    };

    // 7. Privacy gate — belt-and-suspenders (D-10a-07). The 5 closed keys are
    //    natively clean; this gate is the regression fence for future edits.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendAnankeDriveCrossed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to the chain.
    return audit.append('ananke.drive_crossed', actorDid, cleanPayload);
}
