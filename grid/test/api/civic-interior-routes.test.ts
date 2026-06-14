/**
 * Phase 59 HOUSE-2 · Wave 2 — interior HTTP route auth + gating matrix (R-59-04 / R-59-09).
 *
 * Un-skipped from the Wave 0 stub. Exercises the real registerCivicParcelRoutes
 * interior endpoints against a real ParcelRegistry (seeded + built home) + a mock
 * ParcelStore + a real AuditChain, mirroring the Phase 58 civic-parcels-routes
 * pattern (bare onRequest sets req.didContext; the route enforces its own tier).
 *
 * Covers:
 *   - POST interior/extend — non-owner 403 not_owner; bad kind 422 invalid_furniture;
 *     owner + valid mirror-in-home 200 (tree mutated). The Wave-4 emit SEAM carries
 *     ONLY the closed 4-tuple {object_class, object_kind, parcel_id, tick} (no actual
 *     emission until the allowlist member lands in Wave 4).
 *   - GET interior — owner always; visitor on an OPEN non-derelict structure 200;
 *     visitor on a derelict structure 403 closed_to_visitors; a human cookie session
 *     on a PRIVATE interior refused (D-NH-07).
 *   - GET parcels feed exposes `condition` but NEVER the interior tree.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { NousRegistry } from '../../src/registry/registry.js';
import {
    registerCivicParcelRoutes,
    INTERIOR_EXTEND_EMIT_SEAM,
} from '../../src/api/routes/civic-parcels.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';
import '../../src/api/preHandlers/types.js';

const OWNER = 'did:civic:noesis:alice';
const OTHER = 'did:civic:noesis:bob';
const HOME = 'genesis:residential:0001';

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });
const GET = (app: FastifyInstance, url: string) => app.inject({ method: 'GET', url });

function nousCtx(did: string): DIDContext {
    return { did, tier: 'civic_member' };
}
function humanVisitorCtx(): DIDContext {
    return { did: 'human:carol', tier: 'human_visitor' };
}

interface AppOpts {
    ctx?: DIDContext | null;
    /** Structure visibility for the built home (default 'open'). */
    visibility?: 'open' | 'private';
    /** Force the parcel condition (default 'maintained'). */
    condition?: 'maintained' | 'worn' | 'derelict';
}

/**
 * Build a Fastify app with a real registry seeded so that OWNER owns + has built a
 * home on HOME. The store is mocked. Condition/visibility are set post-build.
 */
function buildApp(opts: AppOpts = {}): {
    app: FastifyInstance;
    audit: AuditChain;
    parcelRegistry: ParcelRegistry;
    store: { persistInterior: ReturnType<typeof vi.fn> };
    appReady: Promise<void>;
} {
    const audit = new AuditChain();

    const parcelRegistry = new ParcelRegistry('genesis');
    parcelRegistry.seedZone({ zoneId: 'residential', count: 4, priceBios: 400, ring: 3 });

    const nousRegistry = new NousRegistry();
    nousRegistry.spawn(
        { name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' },
        'genesis.local', 0, 0,
    );
    nousRegistry.spawn(
        { name: 'alice', did: OWNER, publicKey: 'pk', region: 'r0' },
        'genesis.local', 0, 10_000,
    );

    // OWNER purchases + builds a home so the interior routes have a real structure.
    parcelRegistry.purchase(HOME, OWNER, 10_000);
    parcelRegistry.stampAcquired(HOME, 1);
    parcelRegistry.build(
        HOME,
        OWNER,
        { name: 'Alice Home', type: 'home', visibility: opts.visibility ?? 'open' },
        2,
    );
    if (opts.condition) {
        // Reach into the registry's clone-on-read by upserting a copy with the condition.
        const p = parcelRegistry.get(HOME)!;
        p.condition = opts.condition;
        parcelRegistry.upsert(p);
    }

    const store = { persistInterior: vi.fn(async () => {}) };

    const services: Partial<GridServices> = {
        audit,
        gridName: 'genesis',
        currentTick: () => 100,
        registry: nousRegistry,
        parcels: {
            registry: parcelRegistry,
            store: store as unknown as ParcelStore,
        },
    };

    const app = Fastify({ logger: false });
    if (opts.ctx !== undefined) {
        app.addHook('onRequest', async (req) => { req.didContext = opts.ctx; });
    }
    registerCivicParcelRoutes(app, services as GridServices);
    return { app, audit, parcelRegistry, store, appReady: app.ready().then(() => {}) };
}

// ── POST interior/extend (owner-only, catalog-validated) ──────────────────────

describe('civic interior routes — POST interior/extend (R-59-04)', () => {
    it('a non-owner extending an interior → 403 not_owner', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OTHER) });
        await appReady;
        const res = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'bed' });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'not_owner' });
        await app.close();
    });

    it('an unknown / mismatched furniture kind → 422 invalid_furniture', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OWNER) });
        await appReady;
        const res = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'throne' });
        expect(res.statusCode).toBe(422);
        expect(res.json()).toMatchObject({ error: 'invalid_furniture' });
        await app.close();
    });

    it('the owner extending a valid mirror-in-home kind → 200, the tree mutates, store mirrored', async () => {
        const { app, appReady, parcelRegistry, store } = buildApp({ ctx: nousCtx(OWNER) });
        await appReady;
        const res = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'bed' });
        expect(res.statusCode).toBe(200);
        // The registry tree mutated.
        const interior = parcelRegistry.get(HOME)!.structure!.interior;
        expect(interior?.areas.find((a) => a.name === 'bedroom')?.objects[0]).toMatchObject({ kind: 'bed', class: 'mirror' });
        // DB-first persistence mirrored.
        expect(store.persistInterior).toHaveBeenCalledOnce();
        await app.close();
    });

    it('the extend emit SEAM carries ONLY the closed 4-tuple {object_class, object_kind, parcel_id, tick}', () => {
        // Until Wave 4 lands appendZoningInteriorExtended, the seam is a typed helper
        // that returns the exact payload shape — no interior names/state, no actual emit.
        const seam = INTERIOR_EXTEND_EMIT_SEAM({
            objectClass: 'mirror',
            objectKind: 'bed',
            parcelId: HOME,
            tick: 100,
        });
        expect(Object.keys(seam).sort()).toEqual(['object_class', 'object_kind', 'parcel_id', 'tick']);
        expect(seam).toEqual({ object_class: 'mirror', object_kind: 'bed', parcel_id: HOME, tick: 100 });
        // No interior names/state ever leak into the seam.
        expect(JSON.stringify(seam)).not.toContain('bedroom');
    });
});

// ── GET interior (entry-policy + derelict gating) ─────────────────────────────

describe('civic interior routes — GET interior (R-59-04)', () => {
    it('the owner can always GET their own interior tree', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OWNER) });
        await appReady;
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ interior: expect.any(Object) });
        await app.close();
    });

    it('a visitor to an OPEN, non-derelict structure → 200', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OTHER), visibility: 'open' });
        await appReady;
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a visitor to a derelict structure → 403 closed_to_visitors', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OTHER), visibility: 'open', condition: 'derelict' });
        await appReady;
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'closed_to_visitors' });
        await app.close();
    });

    it('the owner can still view their own derelict interior', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OWNER), condition: 'derelict' });
        await appReady;
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a human cookie session on a PRIVATE interior is refused (D-NH-07)', async () => {
        const { app, appReady } = buildApp({ ctx: humanVisitorCtx(), visibility: 'private' });
        await appReady;
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect([401, 403]).toContain(res.statusCode);
        await app.close();
    });
});

// ── Public feed never leaks the interior tree ─────────────────────────────────

describe('civic interior routes — feed exposes condition but never the interior tree (R-59-09)', () => {
    it('GET /api/v1/civic/parcels exposes `condition` and has NO interior/areas key', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(OWNER) });
        await appReady;
        // Furnish first so the registry actually holds an interior tree.
        await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'bed' });

        const res = await GET(app, '/api/v1/civic/parcels');
        expect(res.statusCode).toBe(200);
        const body = res.json() as { parcels: Array<Record<string, unknown>> };
        const owned = body.parcels.find((p) => p.id === HOME)!;
        expect(owned).toBeTruthy();
        // condition IS exposed on the public feed.
        expect(owned.condition).toBe('maintained');
        // the interior tree is NEVER serialized.
        const raw = JSON.stringify(body);
        expect(raw).not.toContain('interior');
        expect(raw).not.toContain('areas');
        expect(raw).not.toContain('bedroom');
        await app.close();
    });
});
