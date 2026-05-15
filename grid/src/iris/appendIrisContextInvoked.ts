/**
 * appendIrisContextInvoked — SOLE producer boundary for `iris.context_invoked`.
 *
 * Phase 17 D-17-08. Structural clone of grid/src/bios/appendBiosBirth.ts.
 *
 * Fires once per tick when Theory of Mind beliefs are injected into the prompt.
 * belief_count = total beliefs injected across all peers in that tick (D-17-13).
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.nous_did
 *   3. Self-report invariant: payload.nous_did === actorDid
 *   4. Tick: non-negative integer
 *   5. belief_count: non-negative integer
 *   6. Closed-tuple: Object.keys(payload).sort() === IRIS_CONTEXT_INVOKED_KEYS
 *   7. Explicit reconstruction (prototype-pollution defense)
 *   8. Privacy gate: payloadPrivacyCheck belt-and-suspenders (D-17-17)
 *   9. Commit to chain.
 *
 * Wall-clock free per D-17-14 — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { IRIS_CONTEXT_INVOKED_KEYS, type IrisContextInvokedPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). */
const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

export function appendIrisContextInvoked(
    audit: AuditChain,
    actorDid: string,
    payload: IrisContextInvokedPayload,
): AuditEntry {
    // 1. DID regex: actorDid
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendIrisContextInvoked: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. DID regex: payload.nous_did
    if (typeof payload?.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(`appendIrisContextInvoked: invalid payload.nous_did (DID_RE failed)`);
    }
    // 3. Self-report invariant
    if (payload.nous_did !== actorDid) {
        throw new TypeError(
            `appendIrisContextInvoked: payload.nous_did must equal actorDid (self-report invariant)`,
        );
    }
    // 4. Tick: non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendIrisContextInvoked: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. belief_count: non-negative integer
    if (!Number.isInteger(payload.belief_count) || payload.belief_count < 0) {
        throw new TypeError(
            `appendIrisContextInvoked: belief_count must be non-negative integer, got ${JSON.stringify(payload.belief_count)}`,
        );
    }
    // 6. Closed-tuple check
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== IRIS_CONTEXT_INVOKED_KEYS.length ||
        !actualKeys.every((k, i) => k === IRIS_CONTEXT_INVOKED_KEYS[i])
    ) {
        throw new TypeError(
            `appendIrisContextInvoked: unexpected key set — expected ${JSON.stringify(IRIS_CONTEXT_INVOKED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 7. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        nous_did: payload.nous_did,
        tick: payload.tick,
        belief_count: payload.belief_count,
    };
    // 8. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrisContextInvoked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit to chain (sole producer).
    return audit.append('iris.context_invoked', actorDid, cleanPayload);
}
