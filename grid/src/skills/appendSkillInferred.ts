/**
 * appendSkillInferred — Phase 18 sole producer for skill.inferred (pos 38).
 *
 * Closed-tuple: {learner_did, skill_hash, source_event_hash, tick} — 4 keys (D-18-09).
 * 3-keys-not-5: Brain sends {skill_hash, source_event_hash}; Grid injects learner_did + tick.
 *
 * Validation discipline (ordering deliberate — matches appendIrisBeliefRevised template):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.learner_did
 *   3. Self-report invariant: payload.learner_did === actorDid
 *   4. Tick: non-negative integer
 *   5. Hash format: payload.skill_hash (64-char hex, HEX64_RE)
 *   6. Hash format: payload.source_event_hash (64-char hex, HEX64_RE)
 *   7. Closed-tuple: Object.keys(payload).sort() === SKILL_INFERRED_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. Privacy gate: payloadPrivacyCheck (D-18-08)
 *  10. Commit to chain (sole producer).
 *
 * Wall-clock free — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { SKILL_INFERRED_KEYS, type SkillInferredPayload } from './types.js';
import { DID_RE, HEX64_RE } from './appendSkillTaught.js';

export function appendSkillInferred(
    audit: AuditChain,
    actorDid: string,
    payload: SkillInferredPayload,
): AuditEntry {
    // 1. actorDid format
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendSkillInferred: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. learner_did format
    if (typeof payload?.learner_did !== 'string' || !DID_RE.test(payload.learner_did)) {
        throw new TypeError(
            `appendSkillInferred: invalid learner_did ${JSON.stringify(payload?.learner_did)} (DID_RE failed)`,
        );
    }
    // 3. Self-report invariant
    if (payload.learner_did !== actorDid) {
        throw new TypeError(
            `appendSkillInferred: self-report violation — learner_did ${payload.learner_did} !== actorDid ${actorDid}`,
        );
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendSkillInferred: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. skill_hash 64-char hex
    if (typeof payload.skill_hash !== 'string' || !HEX64_RE.test(payload.skill_hash)) {
        throw new TypeError(`appendSkillInferred: invalid skill_hash (must be 64-char lowercase hex)`);
    }
    // 6. source_event_hash 64-char hex
    if (typeof payload.source_event_hash !== 'string' || !HEX64_RE.test(payload.source_event_hash)) {
        throw new TypeError(`appendSkillInferred: invalid source_event_hash (must be 64-char lowercase hex)`);
    }
    // 7. Closed-tuple enforcement
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== SKILL_INFERRED_KEYS.length ||
        !actualKeys.every((k, i) => k === SKILL_INFERRED_KEYS[i])
    ) {
        throw new TypeError(
            `appendSkillInferred: closed-tuple violation — expected keys ${JSON.stringify(SKILL_INFERRED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        learner_did: payload.learner_did,
        skill_hash: payload.skill_hash,
        source_event_hash: payload.source_event_hash,
        tick: payload.tick,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendSkillInferred: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit to chain (sole producer)
    return audit.append('skill.inferred', actorDid, cleanPayload);
}
