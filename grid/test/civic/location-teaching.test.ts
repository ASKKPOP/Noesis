/**
 * Phase 61 HOUSE-4 · Wave 2 — location-aware teaching (structures become schools / D-61-04 / R-61-06).
 *
 * Un-skipped from the Wave-0 stub. grid/src/civic/location-teaching.ts now exists.
 *
 * Contract under test:
 *   - teachHere(parcel_id, teacherDid, skill_hash, parent_hash, tick, deps) selects the learner
 *     set from the Nous PRESENT in the parcel's structure (the Phase 58 in-memory occupant map) —
 *     a `workshop` becomes a school.
 *   - it REUSES the existing appendSkillTaught producer verbatim (one skill.taught per present
 *     learner); the skill.taught 5-tuple {learner_did, parent_hash, skill_hash, teacher_did, tick}
 *     is UNCHANGED (NO new payload key; parcel_id is a Grid-side selector, OFF the chain).
 *   - a present human (did:civic:noesis:human:*) is NEVER a learner.
 */
import { describe, it, expect } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { teachHere, type TeachHereDeps } from '../../src/civic/location-teaching.js';

const PARCEL = 'genesis:business:0001';
// Learners self-report via appendSkillTaught (learner_did === actorDid), so they MUST match
// the project DID_RE (did:noesis:*) and must NOT be human DIDs.
const TEACHER = 'did:noesis:alice';
const PRESENT_A = 'did:noesis:bob';
const PRESENT_B = 'did:noesis:carol';
const ABSENT = 'did:noesis:dave';
const HUMAN = 'did:civic:noesis:human:eve';
const SKILL_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);

const SKILL_TAUGHT_KEYS = ['learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick'];

/** A registry with PARCEL owned by TEACHER, an OPEN workshop built, and present occupants joined. */
function workshopWith(present: string[]): ParcelRegistry {
    const reg = new ParcelRegistry('genesis');
    reg.seedZone({ zoneId: 'business', count: 1, priceWei: 900, ring: 2 });
    reg.purchase(PARCEL, TEACHER, 900);
    reg.build(PARCEL, TEACHER, { name: 'Workshop', type: 'workshop', visibility: 'open' }, 1);
    for (const did of present) reg.join(PARCEL, did);
    return reg;
}

describe('Phase 61 HOUSE-4 — teachHere diffuses to the PRESENT Nous (occupant map)', () => {
    it('a skill taught in a workshop diffuses to the Nous PRESENT in that structure', () => {
        const reg = workshopWith([PRESENT_A, PRESENT_B]); // ABSENT not joined
        const deps: TeachHereDeps = { registry: reg, teach: () => {} };
        const learners = teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, deps);
        expect(learners).toContain(PRESENT_A);
        expect(learners).toContain(PRESENT_B);
    });

    it('an ABSENT Nous (not in the occupant map) is NOT a learner', () => {
        const reg = workshopWith([PRESENT_A, PRESENT_B]);
        const deps: TeachHereDeps = { registry: reg, teach: () => {} };
        const learners = teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, deps);
        expect(learners).not.toContain(ABSENT);
    });
});

describe('Phase 61 HOUSE-4 — reuses appendSkillTaught; skill.taught 5-tuple UNCHANGED', () => {
    it('emits one skill.taught per present learner via the EXISTING producer (no new event)', () => {
        const reg = workshopWith([PRESENT_A, PRESENT_B]);
        const audit = new AuditChain();
        teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, { registry: reg, audit });
        const taught = audit.all().filter((e) => e.eventType === 'skill.taught');
        expect(taught.length).toBe(2); // one per present learner, via appendSkillTaught
    });

    it('the skill.taught payload keys are the UNCHANGED 5-tuple — parcel_id is OFF the chain', () => {
        const reg = workshopWith([PRESENT_A]);
        const audit = new AuditChain();
        teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, { registry: reg, audit });
        const taught = audit.all().find((e) => e.eventType === 'skill.taught');
        expect(Object.keys(taught?.payload as object).sort()).toEqual(SKILL_TAUGHT_KEYS);
        expect(taught?.payload).not.toHaveProperty('parcel_id'); // selector stays Grid-side
    });
});

describe('Phase 61 HOUSE-4 — a present human is NEVER a learner (VOTE-05 / D-NH-07)', () => {
    it('excludes a did:civic:noesis:human:* occupant from the learner set', () => {
        const reg = workshopWith([PRESENT_A, HUMAN]); // a human is present in the workshop
        const deps: TeachHereDeps = { registry: reg, teach: () => {} };
        const learners = teachHere(PARCEL, TEACHER, SKILL_HASH, PARENT_HASH, 1, deps);
        expect(learners).toContain(PRESENT_A);
        expect(learners).not.toContain(HUMAN);
    });
});
