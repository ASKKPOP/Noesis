/**
 * appendSkillTaught — Phase 18 sole producer for skill.taught (pos 37).
 *
 * Closed-tuple: {learner_did, parent_hash, skill_hash, teacher_did, tick} — 5 keys (D-18-09).
 * 3-keys-not-5: Brain sends {skill_hash, teacher_did, parent_hash}; Grid injects learner_did + tick.
 *
 * Validation discipline (ordering deliberate — matches appendIrisBeliefRevised template):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.learner_did
 *   3. Self-report invariant: payload.learner_did === actorDid
 *   4. Tick: non-negative integer
 *   5. DID regex: payload.teacher_did
 *   6. Hash format: payload.skill_hash (64-char hex, HEX64_RE)
 *   6b. Hash format: payload.parent_hash (64-char hex, HEX64_RE)
 *   7. Closed-tuple: Object.keys(payload).sort() === SKILL_TAUGHT_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. Privacy gate: payloadPrivacyCheck (D-18-08)
 *  10. Commit to chain (sole producer).
 *
 * Wall-clock free — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { SKILL_TAUGHT_KEYS, type SkillTaughtPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). Re-exported as canonical definition. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex (full sha256 hexdigest). */
export const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendSkillTaught(
    audit: AuditChain,
    actorDid: string,
    payload: SkillTaughtPayload,
): AuditEntry {
    // 1. actorDid format
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendSkillTaught: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. learner_did format
    if (typeof payload?.learner_did !== 'string' || !DID_RE.test(payload.learner_did)) {
        throw new TypeError(
            `appendSkillTaught: invalid learner_did ${JSON.stringify(payload?.learner_did)} (DID_RE failed)`,
        );
    }
    // 3. Self-report invariant
    if (payload.learner_did !== actorDid) {
        throw new TypeError(
            `appendSkillTaught: self-report violation — learner_did ${payload.learner_did} !== actorDid ${actorDid}`,
        );
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendSkillTaught: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. teacher_did DID format
    if (typeof payload.teacher_did !== 'string' || !DID_RE.test(payload.teacher_did)) {
        throw new TypeError(
            `appendSkillTaught: invalid teacher_did ${JSON.stringify(payload.teacher_did)} (DID_RE failed)`,
        );
    }
    // 6. skill_hash 64-char hex
    if (typeof payload.skill_hash !== 'string' || !HEX64_RE.test(payload.skill_hash)) {
        throw new TypeError(`appendSkillTaught: invalid skill_hash (must be 64-char lowercase hex)`);
    }
    // 6b. parent_hash 64-char hex
    if (typeof payload.parent_hash !== 'string' || !HEX64_RE.test(payload.parent_hash)) {
        throw new TypeError(`appendSkillTaught: invalid parent_hash (must be 64-char lowercase hex)`);
    }
    // 7. Closed-tuple enforcement
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== SKILL_TAUGHT_KEYS.length ||
        !actualKeys.every((k, i) => k === SKILL_TAUGHT_KEYS[i])
    ) {
        throw new TypeError(
            `appendSkillTaught: closed-tuple violation — expected keys ${JSON.stringify(SKILL_TAUGHT_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        learner_did: payload.learner_did,
        parent_hash: payload.parent_hash,
        skill_hash: payload.skill_hash,
        teacher_did: payload.teacher_did,
        tick: payload.tick,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendSkillTaught: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit to chain (sole producer)
    return audit.append('skill.taught', actorDid, cleanPayload);
}
