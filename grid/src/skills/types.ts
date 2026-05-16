/**
 * Skill Grid types — Phase 18 D-18-09.
 * Payload interfaces and EXPECTED_KEYS tuples for all 3 skill.* sole-producer emitters.
 *
 * 3-keys-not-5 invariant: Brain metadata carries 1-3 keys;
 * Grid injects learner_did + tick at emit time. Field name is 'learner_did'.
 *
 * Closed-tuple: EXPECTED_KEYS are alphabetically sorted to match Object.keys(payload).sort().
 */

export interface SkillTaughtPayload {
    learner_did: string;
    parent_hash: string;
    skill_hash: string;
    teacher_did: string;
    tick: number;
}

export interface SkillInferredPayload {
    learner_did: string;
    skill_hash: string;
    source_event_hash: string;
    tick: number;
}

export interface SkillRejectedPayload {
    learner_did: string;
    rejection_reason: string;  // ∈ {low_trust, structural_invalid, quota_exceeded}
    tick: number;
}

/** Alphabetically sorted key tuples — locked by D-18-09. */
export const SKILL_TAUGHT_KEYS = [
    'learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick',
] as const;

export const SKILL_INFERRED_KEYS = [
    'learner_did', 'skill_hash', 'source_event_hash', 'tick',
] as const;

export const SKILL_REJECTED_KEYS = [
    'learner_did', 'rejection_reason', 'tick',
] as const;

/** Valid rejection reasons — closed enum enforced at appendSkillRejected boundary (Pitfall 3). */
export const VALID_REJECTION_REASONS = new Set([
    'low_trust',
    'structural_invalid',
    'quota_exceeded',
] as const);
