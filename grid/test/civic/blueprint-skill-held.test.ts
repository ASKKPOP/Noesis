/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for the skill-held verification via the EXISTING
 * skill-event history (D-61-02 / R-61-03).
 *
 * describe.skip: builderHoldsSkill lands in Wave 1 (grid/src/civic/blueprint.ts). Deferred
 * dynamic import (Phase 58/59/60 Wave-0 pattern) defers module resolution until un-skipped.
 *
 * Contract under test:
 *   - builderHoldsSkill(blueprint_hash, builderDid, deps) returns true when a skill.taught
 *     OR skill.inferred with learner_did === builderDid for blueprint_hash exists in the
 *     EXISTING audit-chain history (the same lineage query culture.ts uses) — the Brain
 *     attests, the Grid confirms.
 *   - it returns false (and the build route maps to skill_not_held) when no such event exists.
 *   - NO new skill store is created — the check reads the existing skill-event history only.
 */
import { describe, it, expect } from 'vitest';

const loadBlueprint = () => import('../../src/civic/blueprint.js');
const loadChain = () => import('../../src/audit/chain.js');
const loadSkillTaught = () => import('../../src/skills/appendSkillTaught.js');

const BLUEPRINT_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);
const BUILDER = 'did:civic:noesis:alice';
const OTHER = 'did:civic:noesis:bob';

describe.skip('Phase 61 HOUSE-4 — builderHoldsSkill via EXISTING skill-event history [Wave 1 un-skips]', () => {
    it('returns true when a skill.taught with learner_did === builder for blueprint_hash exists', async () => {
        const { builderHoldsSkill } = await loadBlueprint();
        const { AuditChain } = await loadChain();
        const { appendSkillTaught } = await loadSkillTaught();
        const audit = new AuditChain();
        appendSkillTaught(audit, {
            learner_did: BUILDER, parent_hash: PARENT_HASH, skill_hash: BLUEPRINT_HASH,
            teacher_did: OTHER, tick: 1,
        });
        expect(builderHoldsSkill(BLUEPRINT_HASH, BUILDER, { audit })).toBe(true);
    });

    it('returns true when a skill.inferred (not just taught) attests the learner holds it', async () => {
        const { builderHoldsSkill } = await loadBlueprint();
        const { AuditChain } = await loadChain();
        const { appendSkillInferred } = await import('../../src/skills/appendSkillInferred.js');
        const audit = new AuditChain();
        appendSkillInferred(audit, {
            learner_did: BUILDER, skill_hash: BLUEPRINT_HASH, tick: 1,
        });
        expect(builderHoldsSkill(BLUEPRINT_HASH, BUILDER, { audit })).toBe(true);
    });

    it('returns false (→ skill_not_held) when no skill.taught/inferred for the builder exists', async () => {
        const { builderHoldsSkill } = await loadBlueprint();
        const { AuditChain } = await loadChain();
        const audit = new AuditChain();
        expect(builderHoldsSkill(BLUEPRINT_HASH, BUILDER, { audit })).toBe(false);
    });

    it('returns false when the skill was taught to a DIFFERENT learner (learner_did mismatch)', async () => {
        const { builderHoldsSkill } = await loadBlueprint();
        const { AuditChain } = await loadChain();
        const { appendSkillTaught } = await loadSkillTaught();
        const audit = new AuditChain();
        appendSkillTaught(audit, {
            learner_did: OTHER, parent_hash: PARENT_HASH, skill_hash: BLUEPRINT_HASH,
            teacher_did: BUILDER, tick: 1,
        });
        expect(builderHoldsSkill(BLUEPRINT_HASH, BUILDER, { audit })).toBe(false);
    });
});

describe.skip('Phase 61 HOUSE-4 — NO new skill store; reads the existing history only [Wave 1 un-skips]', () => {
    it('the blueprint module does NOT introduce a new skill store (reads the audit chain)', async () => {
        const mod = await loadBlueprint();
        expect(mod).not.toHaveProperty('SkillStore');
        expect(mod).not.toHaveProperty('recordSkillHeld');
    });
});
