/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for the build-from-blueprint route (D-61-02 / R-61-04/08).
 *
 * describe.skip: the POST /api/v1/civic/parcels/:id/build-from-blueprint route lands in Wave 3
 * (extends grid/src/api/routes/civic-parcels.ts). Deferred dynamic import (Phase 58/59/60
 * Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - POST .../build-from-blueprint {blueprint_hash}: the builder is the owner OR a staff Nous in
 *     an active co-build session; an unauthorized Nous → 403 not_authorized; a
 *     did:civic:noesis:human:* builder → rejected (humans never build).
 *   - the builder must HOLD the skill → skill_not_held (403/422) when the EXISTING skill-event
 *     history has no matching skill.taught/skill.inferred.
 *   - insufficient Ousia for material_cost_bios → 402 insufficient_funds.
 *   - a successful build emits skill.blueprint_executed (participants/recipe content never cross —
 *     only the hash/parcel/tick).
 *   - the route has a ROUTE_DID_POLICY entry (scripts/check-did-policy-coverage.mjs asserts
 *     coverage in Wave 3).
 */
import { describe, it, expect } from 'vitest';

const loadRoutes = () => import('../../src/api/routes/civic-parcels.js');
const loadPolicy = () => import('../../src/api/policy.js');

const PARCEL = 'genesis:residential:0001';
const BLUEPRINT_HASH = 'a'.repeat(64);
const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const STRANGER = 'did:civic:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';
const ROUTE = `POST /api/v1/civic/parcels/${PARCEL}/build-from-blueprint`;

describe.skip('Phase 61 HOUSE-4 — POST build-from-blueprint authorization [Wave 3 un-skips]', () => {
    it('allows the owner to build-from-blueprint {blueprint_hash}', async () => {
        await loadRoutes();
        expect(OWNER).toMatch(/^did:civic:noesis:/);
    });

    it('allows a staff Nous in an active co-build session to build', async () => {
        await loadRoutes();
        expect(STAFF).toMatch(/^did:civic:noesis:/);
    });

    it('rejects an unauthorized Nous with 403 not_authorized', async () => {
        await loadRoutes();
        expect(STRANGER).toMatch(/^did:civic:noesis:/);
    });

    it('rejects a did:civic:noesis:human:* builder (humans never build)', async () => {
        await loadRoutes();
        expect(HUMAN).toMatch(/^did:civic:noesis:human:/);
    });
});

describe.skip('Phase 61 HOUSE-4 — skill-held + funds gates on the build route [Wave 3 un-skips]', () => {
    it('returns skill_not_held when the EXISTING skill-event history has no matching taught/inferred', async () => {
        await loadRoutes();
        expect(BLUEPRINT_HASH).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns 402 insufficient_funds when the builder cannot cover material_cost_bios', async () => {
        await loadRoutes();
        expect(true).toBe(true);
    });

    it('a successful build emits skill.blueprint_executed (only hash/parcel/tick cross — no recipe content)', async () => {
        await loadRoutes();
        expect(true).toBe(true);
    });
});

describe.skip('Phase 61 HOUSE-4 — ROUTE_DID_POLICY coverage for the build route [Wave 3 un-skips]', () => {
    it('the build-from-blueprint route has a ROUTE_DID_POLICY entry (civic_did_required tier)', async () => {
        const { ROUTE_DID_POLICY } = await loadPolicy();
        expect(ROUTE_DID_POLICY).toHaveProperty(ROUTE);
    });
});
