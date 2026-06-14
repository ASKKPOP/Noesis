/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for the build executor (A10 BUILD lifecycle phase /
 * D-61-02 / R-61-04).
 *
 * describe.skip: buildFromBlueprint lands in Wave 2 (grid/src/civic/blueprint.ts). Deferred
 * dynamic import (Phase 58/59/60 Wave-0 pattern) defers module resolution until un-skipped.
 *
 * Contract under test:
 *   - buildFromBlueprint(addr, builderDid, blueprint_hash, tick, deps):
 *       (1) confirms skill-held (else skill_not_held);
 *       (2) debits material_cost_bios from the builder's Ousia → TREASURY_DID via transferOusia
 *           (insufficient → 402 insufficient_funds);
 *       (3) applies the recipe by replaying ParcelRegistry.extendInterior(addr, ownerDid,
 *           {area, kind}) for each recipe object (the executor is the SINGLE caller).
 *   - the builder is the owner OR a staff Nous in an active co-build session; an unauthorized
 *     Nous → 403.
 *   - a did:civic:noesis:human:* builder → REJECTED (VOTE-05 / D-NH-07).
 *   - a successful build emits skill.blueprint_executed ONCE (the producer is called once per
 *     executed build; wired in Wave 3 — here the stub names the contract).
 */
import { describe, it, expect } from 'vitest';

const loadBlueprint = () => import('../../src/civic/blueprint.js');

const ADDR = 'genesis:residential:0001';
const BLUEPRINT_HASH = 'a'.repeat(64);
const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const STRANGER = 'did:civic:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';

describe.skip('Phase 61 HOUSE-4 — buildFromBlueprint skill-held gate [Wave 2 un-skips]', () => {
    it('rejects with skill_not_held when the builder does not hold the blueprint skill', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(() => buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, {} as never))
            .toThrow(/skill_not_held/);
    });
});

describe.skip('Phase 61 HOUSE-4 — material debit → TREASURY_DID via transferOusia [Wave 2 un-skips]', () => {
    it('debits material_cost_bios from the builder Ousia to TREASURY_DID on a successful build', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        // deps wires a skill-held builder + a funded registry; the executor calls transferOusia(builder → TREASURY_DID, material_cost_bios)
        const structure = buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, {} as never);
        expect(structure).toBeDefined();
    });

    it('rejects with insufficient_funds (402) when the builder cannot cover material_cost_bios', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(() => buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, {} as never))
            .toThrow(/insufficient_funds/);
    });
});

describe.skip('Phase 61 HOUSE-4 — recipe applied via extendInterior (the SINGLE caller) [Wave 2 un-skips]', () => {
    it('replays ParcelRegistry.extendInterior(addr, ownerDid, {area, kind}) for each recipe object', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        const structure = buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, {} as never);
        // each recipe object becomes one extendInterior call — no chain event per object
        expect(structure).toBeDefined();
    });

    it('emits skill.blueprint_executed exactly ONCE per executed build', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, {} as never);
        // exactly one skill.blueprint_executed appended (the whole build, not per object)
        expect(true).toBe(true);
    });
});

describe.skip('Phase 61 HOUSE-4 — authorization: owner OR co-build staff only [Wave 2 un-skips]', () => {
    it('allows the parcel owner to build', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(buildFromBlueprint(ADDR, OWNER, BLUEPRINT_HASH, 1, {} as never)).toBeDefined();
    });

    it('allows a staff Nous in an active co-build session to build', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(buildFromBlueprint(ADDR, STAFF, BLUEPRINT_HASH, 1, {} as never)).toBeDefined();
    });

    it('rejects an unauthorized Nous (not owner, not co-build staff) with 403', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(() => buildFromBlueprint(ADDR, STRANGER, BLUEPRINT_HASH, 1, {} as never))
            .toThrow(/not_authorized|403/);
    });
});

describe.skip('Phase 61 HOUSE-4 — humans NEVER build (VOTE-05 / D-NH-07) [Wave 2 un-skips]', () => {
    it('rejects a did:civic:noesis:human:* builder', async () => {
        const { buildFromBlueprint } = await loadBlueprint();
        expect(() => buildFromBlueprint(ADDR, HUMAN, BLUEPRINT_HASH, 1, {} as never))
            .toThrow(/human|forbidden|not_authorized/i);
    });
});
