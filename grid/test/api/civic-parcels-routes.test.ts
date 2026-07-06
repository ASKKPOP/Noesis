/**
 * Phase 58 HOUSE-1 · Wave 3 — civic-parcels HTTP route auth matrix + funds path.
 *
 * Un-skipped from the Wave 0 stub. Exercises the real registerCivicParcelRoutes
 * against a real ParcelRegistry (seeded zone) + real NousRegistry (funds) + real
 * AuditChain + a mock ParcelStore. The global policy hook is NOT mounted here — the
 * route enforces civic_member tier itself (mirrors civic-message.ts), so a bare
 * onRequest setting req.didContext drives the auth matrix.
 *
 * Covers: R-58-06 (routes), R-58-07 (D-NH-07 Nous-only land — anon/human 401,
 *         human civic-DID 403 humans_cannot_own_land, Nous 201), R-58-08 (funds path
 *         → events 82/83, build 84, join/leave 85/86), R-58-09 (owner_civic_did_hash HEX64).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';
import '../../src/api/preHandlers/types.js';

const HEX64 = /^[0-9a-f]{64}$/;
const NOUS_DID = 'did:civic:noesis:buyer-alice';
const HUMAN_CIVIC_DID = 'did:civic:noesis:human:bob';

function nousCtx(did: string = NOUS_DID): DIDContext {
    return { did, tier: 'civic_member' };
}
function humanVisitorCtx(): DIDContext {
    return { did: 'human:bob', tier: 'human_visitor' };
}

interface AppOpts {
    ctx?: DIDContext | null;
    /** Ousia balance to seed the buyer Nous with (default plenty). */
    buyerWei?: number;
    /** Skip spawning the buyer Nous in the funds registry (→ 404 buyer_not_found). */
    noBuyer?: boolean;
}

function buildApp(opts: AppOpts = {}): {
    app: FastifyInstance;
    audit: AuditChain;
    parcelRegistry: ParcelRegistry;
    nousRegistry: NousRegistry;
    store: { persistPurchase: ReturnType<typeof vi.fn>; persistBuild: ReturnType<typeof vi.fn>; persistEntryPolicy: ReturnType<typeof vi.fn> };
    appReady: Promise<void>;
} {
    const audit = new AuditChain();

    // Real ParcelRegistry, seeded with one residential band (ring 3 = 400 Bios).
    const parcelRegistry = new ParcelRegistry('genesis');
    parcelRegistry.seedZone({ zoneId: 'residential', count: 4, priceWei: 400, ring: 3 });

    // Real NousRegistry — funds registry. Treasury must exist for transferWei.
    const nousRegistry = new NousRegistry();
    nousRegistry.spawn(
        { name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' },
        'genesis.local', 0, 0,
    );
    if (!opts.noBuyer) {
        nousRegistry.spawn(
            { name: 'alice', did: NOUS_DID, publicKey: 'pk', region: 'r0' },
            'genesis.local', 0, opts.buyerWei ?? 10_000,
        );
    }

    const store = {
        persistPurchase: vi.fn(async () => {}),
        persistBuild: vi.fn(async () => {}),
        persistEntryPolicy: vi.fn(async () => {}),
    };

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
    return { app, audit, parcelRegistry, nousRegistry, store, appReady: app.ready().then(() => {}) };
}

const ADDR = 'genesis:residential:0001';

// ── D-NH-07 Nous-only auth matrix (R-58-07) ──────────────────────────────────

describe('civic-parcels routes — D-NH-07 Nous-only auth matrix (R-58-07)', () => {
    it('anon (no auth) → 401 on POST :id/purchase', async () => {
        const { app, appReady } = buildApp({ ctx: null });
        await appReady;
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('human_visitor tier → 401 on POST :id/purchase', async () => {
        const { app, appReady } = buildApp({ ctx: humanVisitorCtx() });
        await appReady;
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('a did:civic:noesis:human:* DID → 403 humans_cannot_own_land (defensive)', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(HUMAN_CIVIC_DID) });
        await appReady;
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'humans_cannot_own_land' });
        await app.close();
    });

    it('a Nous civic_member → 201 on a valid purchase', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx() });
        await appReady;
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(201);
        expect(res.json()).toMatchObject({ purchased: true, parcel_id: ADDR, price_wei: 400 });
        await app.close();
    });

    it('operators are read-only on land — operator/government tier cannot purchase', async () => {
        const { app, appReady } = buildApp({ ctx: { did: 'did:noesis:system:gov', tier: 'government' } });
        await appReady;
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});

// ── Funds + failure codes (R-58-08) ──────────────────────────────────────────

describe('civic-parcels routes — funds + failure codes (R-58-08)', () => {
    it('insufficient balance → 402 insufficient_funds', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx(), buyerWei: 10 });
        await appReady;
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(402);
        expect(res.json()).toMatchObject({ error: 'insufficient_funds' });
        await app.close();
    });

    it('a successful purchase moves funds buyer → TREASURY_DID then emits events 82 + 83', async () => {
        const { app, appReady, audit, nousRegistry, store } = buildApp({ ctx: nousCtx() });
        await appReady;
        const appendSpy = vi.spyOn(audit, 'append');
        const res = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        expect(res.statusCode).toBe(201);

        // Funds moved on the NOUS registry (not the parcel registry).
        expect(nousRegistry.get(NOUS_DID)?.balance_wei).toBe(10_000 - 400);
        expect(nousRegistry.get(TREASURY_DID)?.balance_wei).toBe(400);
        expect(store.persistPurchase).toHaveBeenCalledOnce();

        const purchased = appendSpy.mock.calls.find((c) => c[0] === 'zoning.parcel_purchased');
        const revenue = appendSpy.mock.calls.find((c) => c[0] === 'treasury.parcel_revenue');
        expect(purchased).toBeTruthy();
        expect(revenue).toBeTruthy();
        // Owner DID hashed HEX64 in the event payload — never raw.
        const payload = purchased![2] as Record<string, unknown>;
        expect(HEX64.test(String(payload.buyer_civic_did_hash))).toBe(true);
        expect(JSON.stringify(payload)).not.toContain('did:civic:');
        await app.close();
    });

    it('build emits zoning.structure_built (84); join/leave emit joined/left (85/86)', async () => {
        const { app, appReady, audit } = buildApp({ ctx: nousCtx() });
        await appReady;
        // Purchase then build on an owned parcel.
        await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        const appendSpy = vi.spyOn(audit, 'append');

        const built = await app.inject({
            method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/build`,
            payload: { name: 'Alice Home', type: 'home', visibility: 'open' },
        });
        expect(built.statusCode).toBe(201);
        expect(appendSpy.mock.calls.some((c) => c[0] === 'zoning.structure_built')).toBe(true);
        // Structure plaintext name must not cross the chain.
        const builtCall = appendSpy.mock.calls.find((c) => c[0] === 'zoning.structure_built');
        expect(JSON.stringify(builtCall![2])).not.toContain('Alice Home');

        const joined = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/join` });
        expect(joined.statusCode).toBe(200);
        expect(appendSpy.mock.calls.some((c) => c[0] === 'zoning.structure_joined')).toBe(true);

        const left = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/leave` });
        expect(left.statusCode).toBe(200);
        expect(appendSpy.mock.calls.some((c) => c[0] === 'zoning.structure_left')).toBe(true);
        await app.close();
    });

    it('entry-policy toggle (open <-> allowlist) on an owned, built parcel returns 200', async () => {
        const { app, appReady, store } = buildApp({ ctx: nousCtx() });
        await appReady;
        await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });
        await app.inject({
            method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/build`,
            payload: { name: 'Alice Home', type: 'home', visibility: 'private' },
        });

        const toAllowlist = await app.inject({
            method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/entry-policy`,
            payload: { policy: 'allowlist', allowlist: ['did:civic:noesis:friend'] },
        });
        expect(toAllowlist.statusCode).toBe(200);
        expect(toAllowlist.json()).toMatchObject({ updated: true, policy: 'allowlist' });

        const toOpen = await app.inject({
            method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/entry-policy`,
            payload: { policy: 'open', allowlist: [] },
        });
        expect(toOpen.statusCode).toBe(200);
        expect(toOpen.json()).toMatchObject({ updated: true, policy: 'open' });
        expect(store.persistEntryPolicy).toHaveBeenCalledTimes(2);
        await app.close();
    });
});

// ── Public feed privacy (R-58-09 / D-58-08) ──────────────────────────────────

describe('civic-parcels routes — public feed privacy (R-58-09 / D-58-08)', () => {
    it('GET /api/v1/civic/parcels exposes owner_civic_did_hash as HEX64 and no raw owner DID', async () => {
        const { app, appReady } = buildApp({ ctx: nousCtx() });
        await appReady;
        await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${ADDR}/purchase` });

        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/parcels' });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { parcels: Array<{ id: string; owner_civic_did_hash: string | null }> };
        const owned = body.parcels.find((p) => p.id === ADDR);
        expect(owned).toBeTruthy();
        expect(HEX64.test(String(owned!.owner_civic_did_hash))).toBe(true);
        // The feed NEVER carries a raw owner DID.
        expect(JSON.stringify(body)).not.toContain('did:civic:');
        await app.close();
    });

    it('the public feed is reachable without auth (no didContext hook)', async () => {
        const { app, appReady } = buildApp({}); // no onRequest hook at all
        await appReady;
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/parcels' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ parcels: expect.any(Array) });
        await app.close();
    });
});
