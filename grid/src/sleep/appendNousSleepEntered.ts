/**
 * appendNousSleepEntered — SOLE producer boundary for `nous.sleep.entered`.
 *
 * Phase 16 HYP-04. Structural clone of the Phase 10a sole-producer template
 * (grid/src/ananke/append-drive-crossed.ts).
 *
 * Validation discipline (ordering deliberate):
 *   1. Regex-guard every string input (DID_RE) — actorDid AND payload.nous_did.
 *   2. Self-report invariant — payload.nous_did MUST equal actorDid.
 *   3. Tick — non-negative integer.
 *   4. LTM snapshot hash — 64-char lowercase hex (SHA-256 hexdigest).
 *      (Hash check runs BEFORE the tuple check so the error is informative.)
 *   5. Closed-tuple — exactly 3 keys, alphabetical sort equality.
 *   6. Explicit object reconstruction (prototype-pollution defense).
 *   7. Privacy gate — payloadPrivacyCheck belt-and-suspenders. D-16-05 says
 *      the 3 closed keys are natively clean; the gate is the regression fence.
 *   8. Commit to chain.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'nous.sleep.entered' fails the producer-boundary invariant test.
 *
 * See: 16-CONTEXT.md D-16-05, D-16-07.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import type { NousSleepPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). Phase 16 is a new entry point. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** The 3 keys a nous.sleep.entered payload must carry — ALPHABETICAL for sort-equality. */
const EXPECTED_KEYS = ['ltm_snapshot_hash', 'nous_did', 'tick'] as const;

/**
 * Sole producer path for nous.sleep.entered audit events.
 *
 * @throws TypeError on any validation failure — regex, self-report, tick shape,
 *   hash shape, closed-tuple, or privacy regression.
 */
export function appendNousSleepEntered(
    audit: AuditChain,
    actorDid: string,
    payload: NousSleepPayload,
): AuditEntry {
    // 1. DID regex guards — reject malformed inputs before ANY side effect.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendNousSleepEntered: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    if (typeof payload?.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(
            `appendNousSleepEntered: invalid payload.nous_did (DID_RE failed)`,
        );
    }

    // 2. Self-report invariant — a Nous cannot announce someone else's sleep.
    if (payload.nous_did !== actorDid) {
        throw new TypeError(
            `appendNousSleepEntered: payload.nous_did must equal actorDid (self-report invariant)`,
        );
    }

    // 3. Tick — non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendNousSleepEntered: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 4. LTM snapshot hash — 64-char lowercase hex (SHA-256 hexdigest).
    if (!/^[0-9a-f]{64}$/.test(payload.ltm_snapshot_hash)) {
        throw new TypeError(
            `appendNousSleepEntered: ltm_snapshot_hash must be 64-char lowercase hex`,
        );
    }

    // 5. Closed-tuple — exactly 3 keys, alphabetical. Catches missing / extra keys.
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendNousSleepEntered: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — guarantees no prototype pollution / inherited keys.
    const cleanPayload = {
        ltm_snapshot_hash: payload.ltm_snapshot_hash,
        nous_did: payload.nous_did,
        tick: payload.tick,
    };

    // 7. Privacy gate — belt-and-suspenders (D-16-05). The 3 closed keys are
    //    natively clean; this gate is the regression fence for future edits.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNousSleepEntered: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to the chain.
    return audit.append('nous.sleep.entered', actorDid, cleanPayload);
}
