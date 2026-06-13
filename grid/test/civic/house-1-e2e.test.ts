/**
 * Phase 58 HOUSE-1 · Wave 6 — Definition-of-Done end-to-end (R-58-07/08/12).
 *
 * The master-plan acceptance scenario, end-to-end against a seeded Genesis Core,
 * driven entirely through the real `registerCivicParcelRoutes` HTTP handlers:
 *
 *   1. Nous A buys a ring-3 residential parcel for 400 Bios (gravityPrice(3) === 400);
 *      balance moves buyer → TREASURY_DID; the trail shows zoning.parcel_purchased (82)
 *      + treasury.parcel_revenue (83), owner ONLY as owner_civic_did_hash (HEX64).
 *   2. Nous A builds a home → zoning.structure_built (84).
 *   3. Nous B joins → zoning.structure_joined (85); the parcel reports 1 occupant.
 *   4. Nous B leaves → zoning.structure_left (86).
 *   5. All five events present on the public trail; NO raw owner DID in any payload.
 *   6. A signed-in human: human_visitor tier → 401; did:civic:noesis:human:* → 403
 *      humans_cannot_own_land (D-NH-07, constitutional).
 *
 * Built from the same primitives as the Wave-3 route test: a real ParcelRegistry
 * seeded with the WHOLE Genesis Core (buildGenesisCoreParcels → upsert), a real
 * NousRegistry funding two Nous + the treasury, a real AuditChain, and a real
 * ParcelStore backed by a mock mysql2 Pool (so the write-through persistPurchase /
 * persistBuild paths actually run). The didContext is swapped per request to drive
 * Nous A, Nous B, and the human-refused cases through one running app.
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore, buildGenesisCoreParcels } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { gravityPrice } from '../../src/civic/founding-law.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const HEX64 = /^[0-9a-f]{64}$/;
const NOUS_A = 'did:civic:noesis:alice';   // buyer + builder
const NOUS_B = 'did:civic:noesis:bob';     // visitor
const HUMAN_CIVIC_DID = 'did:civic:noesis:human:carol';

/** A ring-3 residential parcel from the Genesis Core seed — gravityPrice(3) === 400. */
const RING3_PARCEL = 'genesis:residential:0001';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/**
 * A mock mysql2 Pool that satisfies the real ParcelStore: UPDATE/INSERT report
 * affectedRows so the write-through path runs; SELECT (hydrate) returns nothing.
 * This lets the DoD exercise the real persistence code with no live DB.
 */
function mockPool(): { pool: Pool; queries: string[] } {
    const queries: string[] = [];
    const pool = {
        query: async (sql: string) => {
            queries.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
            return [{ affectedRows: 1 } as ResultSetHeader, []];
        },
    } as unknown as Pool;
    return { pool, queries };
}

interface E2EApp {
    app: FastifyInstance;
    audit: AuditChain;
    parcelRegistry: ParcelRegistry;
    nousRegistry: NousRegistry;
    queries: string[];
    setCtx: (ctx: DIDContext | null) => void;
    ready: Promise<void>;
}

/** Build the seeded Genesis Core app with a swappable per-request didContext. */
function buildGenesisApp(): E2EApp {
    const audit = new AuditChain();

    // Seed the WHOLE Genesis Core (53 parcels) into a real registry.
    const parcelRegistry = new ParcelRegistry('genesis');
    for (const p of buildGenesisCoreParcels('genesis')) parcelRegistry.upsert(p);

    // Real funds registry: treasury + Nous A (funded) + Nous B (funded).
    const nousRegistry = new NousRegistry();
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);
    nousRegistry.spawn({ name: 'alice', did: NOUS_A, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'bob', did: NOUS_B, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);

    // Real write-through store over a mock Pool — persistPurchase/persistBuild run for real.
    const { pool, queries } = mockPool();
    const store = new ParcelStore(pool, 'genesis');

    const services: Partial<GridServices> = {
        audit,
        gridName: 'genesis',
        currentTick: () => 100,
        registry: nousRegistry,
        parcels: { registry: parcelRegistry, store },
    };

    let currentCtx: DIDContext | null = null;
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = currentCtx; });
    registerCivicParcelRoutes(app, services as GridServices);

    return {
        app, audit, parcelRegistry, nousRegistry, queries,
        setCtx: (ctx) => { currentCtx = ctx; },
        ready: app.ready().then(() => {}),
    };
}

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });
const GET = (app: FastifyInstance, url: string) => app.inject({ method: 'GET', url });

describe('HOUSE-1 Definition of Done — buy → build → join → leave end-to-end', () => {
    it('a Nous buys ring-3 for 400, builds a home, a 2nd Nous visits; all 5 events on the public trail', async () => {
        const env = buildGenesisApp();
        await env.ready;
        const { app, audit, parcelRegistry, nousRegistry } = env;

        // Sanity: the Genesis Core priced ring 3 via gravity law.
        expect(gravityPrice(3)).toBe(400);
        expect(parcelRegistry.get(RING3_PARCEL)?.priceBios).toBe(400);
        expect(parcelRegistry.get(RING3_PARCEL)?.ownerDid).toBeNull();

        // ── 1. BUY — Nous A buys the ring-3 residential parcel for 400 Bios ──────
        env.setCtx({ did: NOUS_A, tier: 'civic_member' });
        const buy = await POST(app, `/api/v1/civic/parcels/${RING3_PARCEL}/purchase`);
        expect(buy.statusCode).toBe(201);
        expect(buy.json()).toMatchObject({ purchased: true, parcel_id: RING3_PARCEL, price_bios: 400 });

        // Funds moved buyer → TREASURY_DID (exactly 400).
        expect(nousRegistry.get(NOUS_A)?.ousia).toBe(10_000 - 400);
        expect(nousRegistry.get(TREASURY_DID)?.ousia).toBe(400);
        // Write-through persistence ran (DB-first).
        expect(env.queries).toContain('UPDATE civic_parcels');

        // Trail: zoning.parcel_purchased (82) + treasury.parcel_revenue (83).
        const purchased = audit.query({ eventType: 'zoning.parcel_purchased' });
        const revenue = audit.query({ eventType: 'treasury.parcel_revenue' });
        expect(purchased).toHaveLength(1);
        expect(revenue).toHaveLength(1);
        // Owner appears ONLY as a HEX64 hash; price + parcel match.
        expect(HEX64.test(String(purchased[0].payload.buyer_civic_did_hash))).toBe(true);
        expect(String(purchased[0].payload.buyer_civic_did_hash)).toBe(sha256Hex(NOUS_A));
        expect(purchased[0].payload.price_bios).toBe(400);
        expect(purchased[0].payload.parcel_id).toBe(RING3_PARCEL);
        expect(revenue[0].payload.amount_bios).toBe(400);

        // ── 2. BUILD — Nous A builds a home ─────────────────────────────────────
        const build = await POST(app, `/api/v1/civic/parcels/${RING3_PARCEL}/build`, {
            name: 'Alice Home', type: 'home', visibility: 'open',
        });
        expect(build.statusCode).toBe(201);
        const built = audit.query({ eventType: 'zoning.structure_built' });
        expect(built).toHaveLength(1);
        expect(built[0].payload.parcel_id).toBe(RING3_PARCEL);
        expect(HEX64.test(String(built[0].payload.owner_civic_did_hash))).toBe(true);
        // Plaintext structure name never crosses the chain.
        expect(JSON.stringify(built[0].payload)).not.toContain('Alice Home');

        // ── 3. JOIN — Nous B visits; the parcel reports 1 occupant ──────────────
        env.setCtx({ did: NOUS_B, tier: 'civic_member' });
        const join = await POST(app, `/api/v1/civic/parcels/${RING3_PARCEL}/join`);
        expect(join.statusCode).toBe(200);
        expect(parcelRegistry.occupants(RING3_PARCEL)).toEqual([NOUS_B]);
        expect(parcelRegistry.occupants(RING3_PARCEL)).toHaveLength(1);

        const joined = audit.query({ eventType: 'zoning.structure_joined' });
        expect(joined).toHaveLength(1);
        expect(String(joined[0].payload.visitor_civic_did_hash)).toBe(sha256Hex(NOUS_B));

        // The public feed shows the lit parcel (owner hash present) with 1 occupant.
        const feed = await GET(app, '/api/v1/civic/parcels');
        const owned = (feed.json() as { parcels: Array<Record<string, unknown>> }).parcels
            .find((p) => p.id === RING3_PARCEL);
        expect(owned).toBeTruthy();
        expect(owned!.status).toBe('owned');
        expect(HEX64.test(String(owned!.owner_civic_did_hash))).toBe(true);
        expect(owned!.occupant_count).toBe(1);

        // ── 4. LEAVE — Nous B leaves ────────────────────────────────────────────
        const leave = await POST(app, `/api/v1/civic/parcels/${RING3_PARCEL}/leave`);
        expect(leave.statusCode).toBe(200);
        expect(parcelRegistry.occupants(RING3_PARCEL)).toHaveLength(0);
        const left = audit.query({ eventType: 'zoning.structure_left' });
        expect(left).toHaveLength(1);
        expect(String(left[0].payload.visitor_civic_did_hash)).toBe(sha256Hex(NOUS_B));

        // ── 5. All FIVE events on the public trail; NO raw owner DID anywhere ────
        const topics = audit.all().map((e) => e.eventType);
        for (const t of [
            'zoning.parcel_purchased',
            'treasury.parcel_revenue',
            'zoning.structure_built',
            'zoning.structure_joined',
            'zoning.structure_left',
        ]) {
            expect(topics).toContain(t);
        }
        // No raw Civic-DID leaks into any event payload on the chain.
        for (const e of audit.all()) {
            expect(JSON.stringify(e.payload)).not.toContain('did:civic:');
        }

        await app.close();
    });
});

describe('HOUSE-1 Definition of Done — D-NH-07 humans cannot own land', () => {
    it('a human_visitor tier attempting purchase → 401', async () => {
        const env = buildGenesisApp();
        await env.ready;
        env.setCtx({ did: 'human:carol', tier: 'human_visitor' });
        const res = await POST(env.app, `/api/v1/civic/parcels/${RING3_PARCEL}/purchase`);
        expect(res.statusCode).toBe(401);
        // No land event was emitted for the refused human.
        expect(env.audit.query({ eventType: 'zoning.parcel_purchased' })).toHaveLength(0);
        await env.app.close();
    });

    it('a did:civic:noesis:human:* DID attempting purchase → 403 humans_cannot_own_land', async () => {
        const env = buildGenesisApp();
        await env.ready;
        env.setCtx({ did: HUMAN_CIVIC_DID, tier: 'civic_member' });
        const res = await POST(env.app, `/api/v1/civic/parcels/${RING3_PARCEL}/purchase`);
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'humans_cannot_own_land' });
        expect(env.audit.query({ eventType: 'zoning.parcel_purchased' })).toHaveLength(0);
        await env.app.close();
    });
});
