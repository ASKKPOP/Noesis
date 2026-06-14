/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for blueprint skills + Grid-side recipe storage
 * (Voyager Lesson 5 / D-NH-06 core loop / D-61-01 / R-61-02).
 *
 * describe.skip: grid/src/civic/blueprint.ts lands in Wave 1/2. Deferred dynamic import
 * (Phase 58/59/60 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - a `blueprint_hash` IS a Phase 18 skill hash (HEX64); the Grid-side recipe body
 *     {objects:[{kind, area}], arrangement (the sub-task DAG), material_cost_bios} lives in a
 *     NEW civic_blueprints table (migration v41) keyed by blueprint_hash.
 *   - storeBlueprint(recipe) write-through stores the recipe; getBlueprint(hash) reads it back.
 *   - recipe `kind`s are restricted to the Phase 59 closed furniture catalog (furniture.ts);
 *     a recipe object with a non-catalog kind is REJECTED by the existing validation gate.
 *   - the civic_blueprints row write emits NOTHING on chain (Grid-side recipe storage,
 *     mirroring the Phase 58 world-creation discipline).
 *   - diffusion is ZERO new code: blueprints diffuse via the EXISTING skill.taught /
 *     skill.inferred machinery — the blueprint module imports NO new diffusion producer.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const loadBlueprint = () => import('../../src/civic/blueprint.js');
const loadFurniture = () => import('../../src/civic/furniture.js');

const HEX64 = /^[0-9a-f]{64}$/;
const BLUEPRINT_HASH = 'a'.repeat(64); // a Phase 18 skill hash (HEX64)

/** A valid recipe — catalog kinds only, an arrangement DAG, a positive material cost. */
const recipe = () => ({
    blueprint_hash: BLUEPRINT_HASH,
    objects: [
        { kind: 'work_desk', area: 'office' },
        { kind: 'shelf', area: 'office' },
    ],
    arrangement: [
        { node_id: 'n1', objects: [{ kind: 'work_desk', area: 'office' }], depends_on: [], weight: 1 },
        { node_id: 'n2', objects: [{ kind: 'shelf', area: 'office' }], depends_on: ['n1'], weight: 1 },
    ],
    material_cost_bios: 200,
});

beforeEach(async () => {
    const { _resetBlueprints } = await loadBlueprint();
    _resetBlueprints();
});

describe('Phase 61 HOUSE-4 — blueprint_hash IS a Phase 18 skill hash [Wave 1 un-skips]', () => {
    it('a blueprint_hash is a 64-char hex skill hash (HEX64)', () => {
        expect(BLUEPRINT_HASH).toMatch(HEX64);
    });
});

describe('Phase 61 HOUSE-4 — civic_blueprints recipe storage [Wave 1 un-skips]', () => {
    it('storeBlueprint(recipe) write-through stores the recipe; getBlueprint reads it back', async () => {
        const { storeBlueprint, getBlueprint } = await loadBlueprint();
        storeBlueprint(recipe());
        const stored = getBlueprint(BLUEPRINT_HASH);
        expect(stored).not.toBeNull();
        expect(stored?.material_cost_bios).toBe(200);
        expect(stored?.objects.map((o) => o.kind)).toEqual(['work_desk', 'shelf']);
        expect(stored?.arrangement).toHaveLength(2);
    });

    it('getBlueprint returns null for an unknown blueprint_hash', async () => {
        const { getBlueprint } = await loadBlueprint();
        expect(getBlueprint('b'.repeat(64))).toBeNull();
    });
});

describe('Phase 61 HOUSE-4 — recipe kinds restricted to the Phase 59 furniture catalog [Wave 1 un-skips]', () => {
    it('a recipe object referencing a non-catalog kind is REJECTED by the existing furniture gate', async () => {
        const { storeBlueprint } = await loadBlueprint();
        const bad = recipe();
        bad.objects.push({ kind: 'teleporter', area: 'office' }); // not in the closed catalog
        expect(() => storeBlueprint(bad)).toThrow(/kind|furniture|catalog/i);
    });

    it('every catalog kind in the recipe passes isValidFurniture (the SINGLE validation gate)', async () => {
        const { isValidFurniture } = await loadFurniture();
        for (const o of recipe().objects) {
            // The recipe mixes a functional kind (work_desk — valid anywhere) and a mirror
            // kind (shelf — home-only). A 'home' structure accepts both classes, so every
            // catalog kind in the recipe passes the SINGLE validation gate there.
            expect(isValidFurniture(o.kind, 'home')).toBe(true);
        }
    });
});

describe('Phase 61 HOUSE-4 — civic_blueprints row write emits NO chain event [Wave 1 un-skips]', () => {
    it('storing a blueprint recipe does NOT append any audit-chain event (Grid-side storage)', async () => {
        const { storeBlueprint } = await loadBlueprint();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const before = audit.length;
        storeBlueprint(recipe());
        expect(audit.length).toBe(before); // nothing on chain — recipe body stays Grid-side
    });
});

describe('Phase 61 HOUSE-4 — diffusion reuses EXISTING skill machinery, ZERO new diffusion code [Wave 1 un-skips]', () => {
    it('blueprints diffuse via the EXISTING skill.taught / skill.inferred producers (no new diffusion module)', async () => {
        // The blueprint module exposes recipe storage only; it does NOT export a new diffusion producer.
        const mod = await loadBlueprint();
        expect(mod).not.toHaveProperty('appendBlueprintDiffused');
        expect(mod).not.toHaveProperty('diffuseBlueprint');
    });
});
