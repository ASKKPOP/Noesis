/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for location-aware teaching (structures become schools /
 * D-61-04 / R-61-06).
 *
 * describe.skip: grid/src/civic/location-teaching.ts lands in Wave 2. Deferred dynamic import
 * (Phase 58/59/60 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - teachHere(parcel_id, teacherDid, skill_hash, parent_hash, tick, deps) selects the learner
 *     set from the Nous PRESENT in the parcel's structure (the Phase 58 in-memory occupant map) —
 *     a `workshop` becomes a school.
 *   - it REUSES the existing appendSkillTaught / appendSkillInferred producers verbatim (one
 *     skill.taught per present learner); the skill.taught 5-tuple {learner_did, parent_hash,
 *     skill_hash, teacher_did, tick} is UNCHANGED (NO new payload key; parcel_id is a Grid-side
 *     selector, OFF the chain).
 *   - a present human (did:civic:noesis:human:*) is NEVER a learner.
 */
import { describe, it, expect } from 'vitest';

const loadTeachHere = () => import('../../src/civic/location-teaching.js');

const PARCEL = 'genesis:business:0001';
const TEACHER = 'did:civic:noesis:alice';
const PRESENT_A = 'did:civic:noesis:bob';
const PRESENT_B = 'did:civic:noesis:carol';
const ABSENT = 'did:civic:noesis:dave';
const HUMAN = 'did:civic:noesis:human:eve';
const SKILL_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);

const SKILL_TAUGHT_KEYS = ['learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick'];

describe.skip('Phase 61 HOUSE-4 — teachHere diffuses to the PRESENT Nous (occupant map) [Wave 2 un-skips]', () => {
    it('a skill taught in a workshop diffuses to the Nous PRESENT in that structure', async () => {
        const { teachHere } = await loadTeachHere();
        // deps wires the Phase 58 occupant map: PRESENT_A + PRESENT_B present, ABSENT not present.
        const learners = teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, {} as never);
        expect(learners).toContain(PRESENT_A);
        expect(learners).toContain(PRESENT_B);
    });

    it('an ABSENT Nous (not in the occupant map) is NOT a learner', async () => {
        const { teachHere } = await loadTeachHere();
        const learners = teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, {} as never);
        expect(learners).not.toContain(ABSENT);
    });
});

describe.skip('Phase 61 HOUSE-4 — reuses appendSkillTaught/Inferred; skill.taught 5-tuple UNCHANGED [Wave 2 un-skips]', () => {
    it('emits one skill.taught per present learner via the EXISTING producer (no new event)', async () => {
        const { teachHere } = await loadTeachHere();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, { audit } as never);
        const taught = audit.entries.filter((e) => e.eventType === 'skill.taught');
        expect(taught.length).toBeGreaterThanOrEqual(1);
    });

    it('the skill.taught payload keys are the UNCHANGED 5-tuple — parcel_id is OFF the chain', async () => {
        const { teachHere } = await loadTeachHere();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, { audit } as never);
        const taught = audit.entries.find((e) => e.eventType === 'skill.taught');
        expect(Object.keys(taught?.payload as object).sort()).toEqual(SKILL_TAUGHT_KEYS);
        expect(taught?.payload).not.toHaveProperty('parcel_id'); // selector stays Grid-side
    });
});

describe.skip('Phase 61 HOUSE-4 — a present human is NEVER a learner (VOTE-05 / D-NH-07) [Wave 2 un-skips]', () => {
    it('excludes a did:civic:noesis:human:* occupant from the learner set', async () => {
        const { teachHere } = await loadTeachHere();
        const learners = teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, {} as never);
        expect(learners).not.toContain(HUMAN);
    });
});
