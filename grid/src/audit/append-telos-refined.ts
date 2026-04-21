/**
 * appendTelosRefined — SOLE producer boundary for `telos.refined` audit events.
 *
 * Mirrors Phase 6's appendOperatorEvent discipline (07-CONTEXT D-31):
 *   1. Regex-guard every string input (DID_RE, HEX64_RE, DIALOGUE_ID_RE).
 *   2. Close the payload tuple — exactly 4 keys, explicit destructure, no spread.
 *   3. Run payloadPrivacyCheck before chain.append (belt-and-suspenders — the
 *      4 closed keys are natively privacy-clean per D-21, but the gate still
 *      runs so future edits cannot regress).
 *   4. Call audit.append with the canonical event type 'telos.refined'.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'telos.refined' fails the producer-boundary invariant test
 * (grid/test/audit/telos-refined-producer-boundary.test.ts).
 *
 * See: 07-CONTEXT.md D-17, D-18, D-19, D-20, D-31.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** 64-hex SHA-256 digest — matches grid/src/api/operator/_validation.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/** 16-hex dialogue_id — truncated SHA-256 (first 16 chars). */
export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

/** DID regex — locked at 3 entry points project-wide; Phase 7 is the 4th. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** Closed 4-key payload tuple for telos.refined (D-20). */
export interface TelosRefinedPayload {
    readonly did: string;
    readonly before_goal_hash: string;
    readonly after_goal_hash: string;
    readonly triggered_by_dialogue_id: string;
}

/** The 4 keys a telos.refined payload must carry — nothing more, nothing less. */
const EXPECTED_KEYS = ['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id'] as const;

/**
 * Sole producer path for telos.refined audit events.
 *
 * @throws TypeError if any regex guard fails, if the payload carries an
 *   unexpected key, or if payloadPrivacyCheck rejects the payload.
 */
export function appendTelosRefined(
    audit: AuditChain,
    actorDid: string,
    payload: TelosRefinedPayload,
): AuditEntry {
    // 1. Regex guards — reject malformed inputs before ANY side effect.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendTelosRefined: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(`appendTelosRefined: invalid payload.did (DID_RE failed)`);
    }
    if (payload.did !== actorDid) {
        // Self-reporting only — a Nous cannot announce someone else's refinement.
        throw new TypeError(`appendTelosRefined: payload.did must equal actorDid (self-report invariant)`);
    }
    if (typeof payload.before_goal_hash !== 'string' || !HEX64_RE.test(payload.before_goal_hash)) {
        throw new TypeError(`appendTelosRefined: before_goal_hash must match HEX64_RE`);
    }
    if (typeof payload.after_goal_hash !== 'string' || !HEX64_RE.test(payload.after_goal_hash)) {
        throw new TypeError(`appendTelosRefined: after_goal_hash must match HEX64_RE`);
    }
    if (typeof payload.triggered_by_dialogue_id !== 'string' || !DIALOGUE_ID_RE.test(payload.triggered_by_dialogue_id)) {
        throw new TypeError(`appendTelosRefined: triggered_by_dialogue_id must match DIALOGUE_ID_RE (hex16)`);
    }

    // 2. Closed-tuple check — any extra key = contract drift, refuse to emit.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendTelosRefined: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 3. Explicit object reconstruction — guarantees no prototype pollution
    //    or accidental inheritance from a caller's object literal.
    const cleanPayload = {
        did: payload.did,
        before_goal_hash: payload.before_goal_hash,
        after_goal_hash: payload.after_goal_hash,
        triggered_by_dialogue_id: payload.triggered_by_dialogue_id,
    };

    // 4. Privacy gate — belt-and-suspenders (D-21: the 4 keys are natively
    //    clean; this check is the regression gate, not the primary defense).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendTelosRefined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 5. Commit to the chain.
    return audit.append('telos.refined', actorDid, cleanPayload);
}
