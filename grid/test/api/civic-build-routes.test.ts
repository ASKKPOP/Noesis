/**
 * Phase 61 HOUSE-4 · Wave 3 — POST build-from-blueprint HTTP route matrix
 * (D-61-02 / D-61-05 / R-61-04/07/08).
 *
 * Un-skipped from the Wave 0 stub. Exercises the real registerCivicParcelRoutes
 * build-from-blueprint endpoint against a real ParcelRegistry (seeded; OWNER owns + built a
 * home) + a real AuditChain + a real NousRegistry + a mock ParcelStore, mirroring the Phase 60
 * civic-commerce-routes pattern (a bare onRequest sets req.didContext; the route enforces its
 * own tier + owner/co-build-staff authorization).
 *
 * Covers:
 *   - a did:civic:noesis:human:* builder → 403 (humans never build).
 *   - a non-authorized Nous (not owner, not co-build staff) → 403 not_authorized.
 *   - a builder who does not hold the skill → 422 skill_not_held.
 *   - insufficient Ousia for material_cost_bios → 402 insufficient_funds.
 *   - a held + funded build → 201 and emits skill.blueprint_executed exactly once (hashed
 *     builder, no recipe body — only the hash/parcel/tick cross).
 *   - ROUTE_DID_POLICY coverage for the new route.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import { storeBlueprint, _resetBlueprints, type BlueprintRecipe } from '../../src/civic/blueprint.js';
import { _resetCoBuild } from '../../src/civic/co-build.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';
import '../../src/api/preHandlers/types.js';

const OWNER = 'did:civic:noesis:alice';
const STRANGER = 'did:civic:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';
const ADDR = 'genesis:residential:0001';
const BLUEPRINT_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);
const URL = `/api/v1/civic/parcels/${ADDR}/build-from-blueprint`;

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });

function nousCtx(did: string): DIDContext {
    return { did, tier: 'civic_member' };
}

/** A recipe in the closed Phase 59 furniture catalog (mirror kinds are valid in a home). */
const recipe = (): BlueprintRecipe => ({
    blueprint_hash: BLUEPRINT_HASH,
    objects: [{ kind: 'bed', area: 'hall' }],
    arrangement: [
        { node_id: 'n1', objects: [{ kind: 'bed', area: 'hall' }], depends_on: [], weight: 1 },
    ],
    material_cost_bios: 50,
});

interface AppHandle {
    app: FastifyInstance;
    audit: AuditChain;
    parcelRegistry: ParcelRegistry;
    setCtx: (ctx: DIDContext | null) => void;
}

/**
 * Build a Fastify app with a real registry seeded so OWNER owns + built a home on ADDR.
 * `ownerOusia` controls whether the owner can cover material_cost_bios. ctx is mutable per
 * request so a single app can act as different callers (owner / stranger / human).
 */
function buildApp(opts: { ownerOusia?: number } = {}): AppHandle {
    const audit = new AuditChain();
    const parcelRegistry = new ParcelRegistry('genesis');
    parcelRegistry.seedZone({ zoneId: 'residential', count: 2, priceBios: 400, ring: 3 });

    const nousRegistry = new NousRegistry();
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);
    nousRegistry.spawn({ name: 'alice', did: OWNER, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, opts.ownerOusia ?? 100_000);
    nousRegistry.spawn({ name: 'carol', did: STRANGER, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 100_000);

    parcelRegistry.purchase(ADDR, OWNER, 100_000);
    parcelRegistry.stampAcquired(ADDR, 1);
    parcelRegistry.build(ADDR, OWNER, { name: 'Home', type: 'home', visibility: 'open' }, 2);

    const store = {
        persistBuild: vi.fn(async () => {}),
        persistInterior: vi.fn(async () => {}),
        persistEntryPolicy: vi.fn(async () => {}),
    } as unknown as ParcelStore;

    let ctx: DIDContext | null = nousCtx(OWNER);
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => {
        (req as never as { didContext: DIDContext | null }).didContext = ctx;
    });
    const services = {
        parcels: { registry: parcelRegistry, store },
        registry: nousRegistry,
        audit,
        currentTick: () => 7,
    } as unknown as GridServices;
    registerCivicParcelRoutes(app, services);

    return { app, audit, parcelRegistry, setCtx: (c) => { ctx = c; } };
}

/** Seed a skill.taught so `holder` holds BLUEPRINT_HASH (the build executor confirms it). */
function teach(audit: AuditChain, holder: string): void {
    audit.append('skill.taught', holder, {
        learner_did: holder,
        parent_hash: PARENT_HASH,
        skill_hash: BLUEPRINT_HASH,
        teacher_did: STRANGER,
        tick: 1,
    });
}

let handle: AppHandle;
beforeEach(async () => {
    _resetBlueprints();
    _resetCoBuild();
    handle = buildApp();
    await handle.app.ready();
});

describe('Phase 61 HOUSE-4 — POST build-from-blueprint authorization', () => {
    it('rejects a did:civic:noesis:human:* builder (humans never build)', async () => {
        storeBlueprint(recipe());
        handle.setCtx(nousCtx(HUMAN));
        const res = await POST(handle.app, URL, { blueprint_hash: BLUEPRINT_HASH });
        // The human Civic-DID is rejected at the writer guard (D-NH-07 defensive 403).
        expect(res.statusCode).toBe(403);
    });

    it('rejects an unauthorized Nous (not owner, not co-build staff) with 403 not_authorized', async () => {
        storeBlueprint(recipe());
        teach(handle.audit, STRANGER);
        handle.setCtx(nousCtx(STRANGER));
        const res = await POST(handle.app, URL, { blueprint_hash: BLUEPRINT_HASH });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'not_authorized' });
    });
});

describe('Phase 61 HOUSE-4 — skill-held + funds gates on the build route', () => {
    it('returns 422 skill_not_held when the EXISTING skill-event history has no matching taught/inferred', async () => {
        storeBlueprint(recipe());
        // OWNER is authorized but the chain holds NO skill.taught for OWNER.
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, URL, { blueprint_hash: BLUEPRINT_HASH });
        expect(res.statusCode).toBe(422);
        expect(res.json()).toMatchObject({ error: 'skill_not_held' });
    });

    it('returns 402 insufficient_funds when the builder cannot cover material_cost_bios', async () => {
        // Owner holds 10 Ousia but the recipe costs 50 → transferOusia fails.
        handle = buildApp({ ownerOusia: 10 });
        await handle.app.ready();
        storeBlueprint(recipe());
        teach(handle.audit, OWNER);
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, URL, { blueprint_hash: BLUEPRINT_HASH });
        expect(res.statusCode).toBe(402);
        expect(res.json()).toMatchObject({ error: 'insufficient_funds' });
    });

    it('a held + funded build emits skill.blueprint_executed once (only hash/parcel/tick cross — no recipe content)', async () => {
        storeBlueprint(recipe());
        teach(handle.audit, OWNER);
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, URL, { blueprint_hash: BLUEPRINT_HASH });
        expect(res.statusCode).toBe(201);

        const emitted = handle.audit.all().filter((e) => e.eventType === 'skill.blueprint_executed');
        expect(emitted).toHaveLength(1);
        const payload = emitted[0].payload as Record<string, unknown>;
        expect(Object.keys(payload).sort()).toEqual(['blueprint_hash', 'builder_civic_did_hash', 'parcel_id', 'tick']);
        expect(payload.blueprint_hash).toBe(BLUEPRINT_HASH);
        expect(payload.builder_civic_did_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(payload.builder_civic_did_hash).not.toBe(OWNER); // builder DID is HASHED
        expect(payload.parcel_id).toBe(ADDR);
        expect(payload.tick).toBe(7);
        // actorDid = builder_civic_did_hash (no raw DID on chain).
        expect(emitted[0].actorDid).toBe(payload.builder_civic_did_hash);
        // No recipe body / sub-task content crosses.
        expect(payload).not.toHaveProperty('objects');
        expect(payload).not.toHaveProperty('arrangement');
        expect(payload).not.toHaveProperty('material_cost_bios');
    });
});

describe('Phase 61 HOUSE-4 — ROUTE_DID_POLICY coverage for the build route', () => {
    it('the build-from-blueprint route has a ROUTE_DID_POLICY entry (civic_did_required tier)', () => {
        expect(ROUTE_DID_POLICY).toHaveProperty(
            'POST /api/v1/civic/parcels/:id/build-from-blueprint',
            'civic_did_required',
        );
    });
});
