/**
 * appendSkillRejected — Phase 18 sole producer for skill.rejected (pos 39).
 *
 * Closed-tuple: {learner_did, rejection_reason, tick} — 3 keys (D-18-09).
 * 3-keys-not-5: Brain sends {rejection_reason}; Grid injects learner_did + tick.
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.learner_did
 *   3. Self-report invariant: payload.learner_did === actorDid
 *   4. Tick: non-negative integer
 *   5. rejection_reason ∈ VALID_REJECTION_REASONS (enum check, NOT hash/DID)
 *   6. Closed-tuple: Object.keys(payload).sort() === SKILL_REJECTED_KEYS
 *   7. Explicit reconstruction (prototype-pollution defense)
 *   8. Privacy gate: payloadPrivacyCheck (D-18-08)
 *   9. Commit to chain (sole producer).
 *
 * Wall-clock free — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { SKILL_REJECTED_KEYS, VALID_REJECTION_REASONS, type SkillRejectedPayload } from './types.js';
import { DID_RE } from './appendSkillTaught.js';

export function appendSkillRejected(
    audit: AuditChain,
    actorDid: string,
    payload: SkillRejectedPayload,
): AuditEntry {
    // 1. actorDid format
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendSkillRejected: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. learner_did format
    if (typeof payload?.learner_did !== 'string' || !DID_RE.test(payload.learner_did)) {
        throw new TypeError(
            `appendSkillRejected: invalid learner_did ${JSON.stringify(payload?.learner_did)} (DID_RE failed)`,
        );
    }
    // 3. Self-report invariant
    if (payload.learner_did !== actorDid) {
        throw new TypeError(
            `appendSkillRejected: self-report violation — learner_did ${payload.learner_did} !== actorDid ${actorDid}`,
        );
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendSkillRejected: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. rejection_reason enum check (NOT a hash — closed enum only)
    if (!VALID_REJECTION_REASONS.has(payload.rejection_reason as any)) {
        throw new TypeError(
            `appendSkillRejected: invalid rejection_reason ${JSON.stringify(payload.rejection_reason)} — ` +
            `must be one of ${[...VALID_REJECTION_REASONS].join(', ')}`,
        );
    }
    // 6. Closed-tuple enforcement
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== SKILL_REJECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === SKILL_REJECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendSkillRejected: closed-tuple violation — expected keys ${JSON.stringify(SKILL_REJECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 7. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        learner_did: payload.learner_did,
        rejection_reason: payload.rejection_reason,
        tick: payload.tick,
    };
    // 8. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendSkillRejected: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit to chain (sole producer)
    return audit.append('skill.rejected', actorDid, cleanPayload);
}
