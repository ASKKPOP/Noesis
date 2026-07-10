/**
 * Phase 61 HOUSE-4 · Wave 2 — the build executor (A10 BUILD lifecycle phase / D-61-02 / R-61-04).
 *
 * Un-skipped from the Wave-0 stub. buildFromBlueprint now lives in grid/src/civic/blueprint.ts.
 *
 * Contract under test:
 *   - buildFromBlueprint(addr, builderDid, blueprint_hash, tick, deps):
 *       (1) confirms skill-held (else skill_not_held);
 *       (2) debits material_cost_wei from the builder's Ousia → TREASURY_DID via transferWei
 *           (insufficient → 402 insufficient_funds);
 *       (3) applies the recipe by replaying ParcelRegistry.extendInterior(addr, ownerDid,
 *           {area, kind}) for each recipe object (the executor is the SINGLE caller).
 *   - the builder is the owner OR a staff Nous in an active co-build session; an unauthorized
 *     Nous → 403.
 *   - a did:civic:noesis:human:* builder → REJECTED (VOTE-05 / D-NH-07).
 *   - a successful build constructs the skill.blueprint_executed payload (hashed builder, no
 *     recipe body) and calls the emit seam ONCE (Wave 3 attaches the real producer).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import {
    buildFromBlueprint,
    storeBlueprint,
    _resetBlueprints,
    type BlueprintRecipe,
    type BuildDeps,
    type BlueprintExecutedPayload,
} from '../../src/civic/blueprint.js';

const ADDR = 'genesis:residential:0001';
const BLUEPRINT_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);
const OWNER = 'did:noesis:alice';
const STAFF = 'did:noesis:bob';
const STRANGER = 'did:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';

/** A recipe in the closed Phase 59 furniture catalog (mirror kinds are valid in a home). */
const recipe = (): BlueprintRecipe => ({
    blueprint_hash: BLUEPRINT_HASH,
    objects: [
        { kind: 'bed', area: 'hall' },
        { kind: 'shelf', area: 'hall' },
    ],
    arrangement: [
        { node_id: 'n1', objects: [{ kind: 'bed', area: 'hall' }], depends_on: [], weight: 1 },
        { node_id: 'n2', objects: [{ kind: 'shelf', area: 'hall' }], depends_on: ['n1'], weight: 1 },
    ],
    material_cost_wei: 50,
});

/** A registry with ADDR owned by OWNER + a built home structure, so roleOf(ADDR, OWNER) === 'owner'. */
function ownedRegistry(): ParcelRegistry {
    const reg = new ParcelRegistry('genesis');
    reg.seedZone({ zoneId: 'residential', count: 1, priceWei: 400, ring: 3 });
    reg.purchase(ADDR, OWNER, 400);
    reg.build(ADDR, OWNER, { name: 'Home', type: 'home', visibility: 'open' }, 1);
    return reg;
}

/** An audit chain holding a skill.taught with learner_did === holder for BLUEPRINT_HASH. */
function chainHolding(holder: string): AuditChain {
    const audit = new AuditChain();
    // The blueprint hash IS the skill hash; the build executor confirms a matching event exists.
    audit.append('skill.taught', holder, {
        learner_did: holder,
        parent_hash: PARENT_HASH,
        skill_hash: BLUEPRINT_HASH,
        teacher_did: STRANGER,
        tick: 1,
    });
    return audit;
}

/** Build the executor deps: funded chargeMaterial, the skill-held chain, optional co-build staff. */
function makeDeps(opts: {
    registry: ParcelRegistry;
    audit: AuditChain;
    funded?: boolean;
    coBuildStaff?: string;
    emitted?: BlueprintExecutedPayload[];
    charges?: Array<[string, number]>;
}): BuildDeps {
    return {
        registry: opts.registry,
        audit: opts.audit,
        // Phase 62.5-02: material cost debits the builder's ledger account → civic_treasury.
        // funded:false models an insufficient balance (chargeToTreasury throws → {success:false}).
        chargeMaterial: async (builderDid, amount) => {
            opts.charges?.push([builderDid, amount]);
            return { success: opts.funded !== false };
        },
        coBuildStaffOf: (addr, did) => addr === ADDR && did === opts.coBuildStaff,
        emitBlueprintExecuted: (p) => { opts.emitted?.push(p); },
    };
}

beforeEach(() => { _resetBlueprints(); });

describe('Phase 61 HOUSE-4 — buildFromBlueprint skill-held gate', () => {
    it('rejects with skill_not_held when the builder does not hold the blueprint skill', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        const audit = new AuditChain(); // empty — no skill.taught for OWNER
        await expect(buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, makeDeps({ registry: reg, audit })))
            .rejects.toThrow(/skill_not_held/);
    });

    it('rejects with blueprint_not_found when the recipe is absent', async () => {
        const reg = ownedRegistry();
        const audit = chainHolding(OWNER);
        await expect(buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, makeDeps({ registry: reg, audit })))
            .rejects.toThrow(/blueprint_not_found/);
    });
});

describe('Phase 61 HOUSE-4 — material debit → civic_treasury via chargeMaterial', () => {
    it('debits material_cost_wei from the builder ledger to civic_treasury on a successful build', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        const charges: Array<[string, number]> = [];
        const structure = await buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(OWNER), funded: true, charges }));
        expect(structure).toBeDefined();
        expect(charges).toHaveLength(1);
        expect(charges[0]).toEqual([OWNER, 50]);
    });

    it('rejects with insufficient_funds (402) when the builder cannot cover material_cost_wei', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        await expect(buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(OWNER), funded: false })))
            .rejects.toThrow(/insufficient_funds/);
    });
});

describe('Phase 61 HOUSE-4 — recipe applied via extendInterior (the SINGLE caller)', () => {
    it('replays ParcelRegistry.extendInterior(addr, ownerDid, {area, kind}) for each recipe object', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        const structure = await buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(OWNER), funded: true }));
        // each recipe object became one extendInterior call — both objects landed in the 'hall' area.
        const hall = structure.interior?.areas.find((a) => a.name === 'hall');
        expect(hall?.objects.map((o) => o.kind).sort()).toEqual(['bed', 'shelf']);
    });

    it('emits skill.blueprint_executed exactly ONCE per executed build (hashed builder, no recipe body)', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        const emitted: BlueprintExecutedPayload[] = [];
        await buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 7,
            makeDeps({ registry: reg, audit: chainHolding(OWNER), funded: true, emitted }));
        expect(emitted).toHaveLength(1);
        expect(Object.keys(emitted[0]).sort()).toEqual(['blueprint_hash', 'builder_civic_did_hash', 'parcel_id', 'tick']);
        expect(emitted[0].builder_civic_did_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(emitted[0].builder_civic_did_hash).not.toBe(OWNER); // builder DID is HASHED
        expect(emitted[0].parcel_id).toBe(ADDR);
        expect(emitted[0].tick).toBe(7);
        expect(emitted[0]).not.toHaveProperty('objects'); // no recipe body on the payload
    });
});

describe('Phase 61 HOUSE-4 — authorization: owner OR co-build staff only', () => {
    it('allows the parcel owner to build', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        expect(await buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(OWNER), funded: true }))).toBeDefined();
    });

    it('allows a staff Nous in an active co-build session to build', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        // STAFF is not the owner, but is a staff Nous in an active co-build session for ADDR.
        expect(await buildFromBlueprint(ADDR, STAFF, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(STAFF), funded: true, coBuildStaff: STAFF }))).toBeDefined();
    });

    it('rejects an unauthorized Nous (not owner, not co-build staff) with 403', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        await expect(buildFromBlueprint(ADDR, STRANGER, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(STRANGER), funded: true })))
            .rejects.toThrow(/not_authorized|403/);
    });
});

describe('Phase 61 HOUSE-4 — humans NEVER build (VOTE-05 / D-NH-07)', () => {
    it('rejects a did:civic:noesis:human:* builder', async () => {
        storeBlueprint(recipe());
        const reg = ownedRegistry();
        await expect(buildFromBlueprint(ADDR, HUMAN, BLUEPRINT_HASH, 1,
            makeDeps({ registry: reg, audit: chainHolding(HUMAN), funded: true })))
            .rejects.toThrow(/human|forbidden|not_authorized/i);
    });
});
