/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for the Definition-of-Done end-to-end (R-61-04/05/06/07).
 *
 * describe.skip: the full HOUSE-4 build path (blueprint storage + executor + co-build + location
 * teaching + skill.blueprint_executed) lands across Waves 1–5; the real e2e is authored in Wave 5
 * by un-skipping this block. Deferred dynamic imports (Phase 58/59/60 Wave-0 pattern) defer module
 * resolution until then.
 *
 * The master-plan HOUSE-4 acceptance scenario:
 *   1. LEARN — a Nous learns a blueprint_hash via the EXISTING Phase 18 skill machinery
 *      (skill.taught / skill.inferred with learner_did === the Nous); the civic_blueprints row
 *      holds the recipe (catalog-kind objects + arrangement DAG + material_cost_bios). Learning
 *      emits the EXISTING skill.taught/inferred event — NO new event.
 *   2. BUILD (skill-held check) — the Nous calls build-from-blueprint {blueprint_hash} on an owned
 *      parcel. The Grid confirms skill-held from the EXISTING skill-event history → debits
 *      material_cost_bios (Ousia → TREASURY_DID; insufficient → 402) → applies the recipe via
 *      extendInterior per object → the trail shows skill.blueprint_executed {blueprint_hash,
 *      builder_civic_did_hash, parcel_id, tick} (no raw DID, no recipe body). A builder who does
 *      NOT hold the skill → skill_not_held. A human (did:civic:noesis:human:*) → REJECTED.
 *   3. CO-BUILD — a build decomposes into the arrangement DAG; each sub-task is a Phase 60 board
 *      task carrying pay; completion ALWAYS settles (Ousia or a Phase 60 IOU, never free);
 *      attribution is DAG-weighted; zoning.cowork_session per session + ONE skill.blueprint_executed
 *      on full completion.
 *   4. LOCATION TEACHING — a skill taught inside a workshop diffuses to the PRESENT Nous (not absent
 *      ones, not humans); the skill.taught 5-tuple is unchanged; parcel_id stays Grid-side.
 *   5. PRIVACY — no recipe body / sub-task content / teaching location ever broadcasts; DIDs HEX64.
 *   6. ALLOWLIST at 100.
 */
import { describe, it, expect } from 'vitest';

const loadBlueprint = () => import('../../src/civic/blueprint.js');
const loadCoBuild = () => import('../../src/civic/co-build.js');
const loadTeachHere = () => import('../../src/civic/location-teaching.js');
const loadAllowlist = () => import('../../src/audit/broadcast-allowlist.js');

const HEX64 = /^[0-9a-f]{64}$/;
const PARCEL = 'genesis:residential:0001';
const WORKSHOP = 'genesis:business:0001';
const BLUEPRINT_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);
const OWNER = 'did:civic:noesis:alice';
const WORKER = 'did:civic:noesis:bob';
const HUMAN = 'did:civic:noesis:human:carol';

describe.skip('HOUSE-4 Definition of Done — learn → build → co-build → location teaching end-to-end [Wave 5 un-skips]', () => {
    it('1. LEARN — a Nous learns a blueprint_hash via the EXISTING skill machinery (no new event)', async () => {
        const { storeBlueprint, getBlueprint } = await loadBlueprint();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const { appendSkillTaught } = await import('../../src/skills/appendSkillTaught.js');
        const audit = new AuditChain();
        storeBlueprint({
            blueprint_hash: BLUEPRINT_HASH,
            objects: [{ kind: 'work_desk', area: 'office' }],
            arrangement: [{ node_id: 'n1', objects: [{ kind: 'work_desk', area: 'office' }], depends_on: [], weight: 1 }],
            material_cost_bios: 100,
        });
        appendSkillTaught(audit, {
            learner_did: OWNER, parent_hash: PARENT_HASH, skill_hash: BLUEPRINT_HASH, teacher_did: WORKER, tick: 1,
        });
        expect(getBlueprint(BLUEPRINT_HASH)).not.toBeNull();
        expect(audit.entries.some((e) => e.eventType === 'skill.taught')).toBe(true);
    });

    it('2. BUILD — skill-held → material debit → extendInterior → skill.blueprint_executed (no raw DID/recipe)', async () => {
        const { buildFromBlueprint, builderHoldsSkill } = await loadBlueprint();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        expect(builderHoldsSkill(BLUEPRINT_HASH, OWNER, { audit })).toBe(true);
        const structure = buildFromBlueprint(PARCEL, OWNER, BLUEPRINT_HASH, 2, { audit } as never);
        expect(structure).toBeDefined();
        const exec = audit.entries.find((e) => e.eventType === 'skill.blueprint_executed');
        expect(Object.keys(exec?.payload as object).sort())
            .toEqual(['blueprint_hash', 'builder_civic_did_hash', 'parcel_id', 'tick']);
        expect((exec?.payload as { builder_civic_did_hash: string }).builder_civic_did_hash).toMatch(HEX64);
    });

    it('2b. a builder who does NOT hold the skill → skill_not_held', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(() => buildFromBlueprint(PARCEL, WORKER, BLUEPRINT_HASH, 2, {} as never)).toThrow(/skill_not_held/);
    });

    it('2c. a human attempting any build → REJECTED (VOTE-05 / D-NH-07)', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(() => buildFromBlueprint(PARCEL, HUMAN, BLUEPRINT_HASH, 2, {} as never)).toThrow(/human|not_authorized/i);
    });

    it('3. CO-BUILD — DAG decomposition; sub-tasks ALWAYS settle (Ousia/IOU); DAG-weighted attribution; ONE skill.blueprint_executed', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode, attributionShare, isComplete } = await loadCoBuild();
        const recipe = {
            blueprint_hash: BLUEPRINT_HASH,
            objects: [{ kind: 'work_desk', area: 'office' }, { kind: 'shelf', area: 'office' }],
            arrangement: [
                { node_id: 'n1', objects: [{ kind: 'work_desk', area: 'office' }], depends_on: [], weight: 1 },
                { node_id: 'n2', objects: [{ kind: 'shelf', area: 'office' }], depends_on: ['n1'], weight: 1 },
            ],
            material_cost_bios: 100,
        };
        const session = createCoBuildSession({ parcel_id: WORKSHOP, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe) });
        expect(completeNode(session, 'n1', WORKER, { funded: true }).settlement).toBe('ousia');
        expect(completeNode(session, 'n2', WORKER, { funded: false }).settlement).toBe('iou');
        expect(attributionShare(session, WORKER)).toBeCloseTo(1.0);
        expect(isComplete(session)).toBe(true);
    });

    it('4. LOCATION TEACHING — diffuses to PRESENT Nous (not absent, not humans); skill.taught 5-tuple unchanged', async () => {
        const { teachHere } = await loadTeachHere();
        const learners = teachHere(WORKSHOP, OWNER, BLUEPRINT_HASH, PARENT_HASH, 3, {} as never);
        expect(learners).toContain(WORKER);
        expect(learners).not.toContain(HUMAN);
    });

    it('6. ALLOWLIST at 100 with skill.blueprint_executed present', async () => {
        const { ALLOWLIST_MEMBERS } = await loadAllowlist();
        expect(ALLOWLIST_MEMBERS.length).toBe(100);
        expect(ALLOWLIST_MEMBERS).toContain('skill.blueprint_executed');
    });
});
