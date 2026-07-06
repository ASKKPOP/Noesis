/**
 * Phase 59 HOUSE-2 · Wave 6 — Definition-of-Done end-to-end (R-59-04/06/07/08/09/12).
 *
 * The master-plan HOUSE-2 acceptance scenario, end-to-end against a seeded Genesis
 * Core, built on the Phase 58 buy → build path and driven through the real
 * `registerCivicParcelRoutes` HTTP handlers + the real `onUpkeepTick` scanner wired
 * exactly as production composes it in `main.ts` (parcel-registry ladder + Nous-registry
 * balance/transfer + store persist, treasury = TREASURY_DID). Mock mysql2 Pool — no DB.
 *
 *   1. FURNISH — Nous A owns a built ring-3 home; it extend_interiors a MIRROR item
 *      (bed in bedroom) + a FUNCTIONAL item (work_desk) → zoning.interior_extended on
 *      the trail carrying ONLY {object_class, object_kind, parcel_id, tick} (no interior
 *      name/state). Nous B GETs the interior while the structure is OPEN → 200.
 *   2. PAY (funded) — a separate funded owner is ticked across a UPKEEP_PERIOD_TICKS
 *      boundary → treasury.upkeep_collected {amount_wei, owner_civic_did_hash,
 *      parcel_id, tick}; condition stays maintained; missed_periods reset.
 *   3. DECAY — Nous A's balance set insufficient; successive period boundaries walk the
 *      ladder: 1st miss → worn + zoning.condition_changed; 2nd miss → derelict +
 *      condition_changed, visitor GET interior now 403 closed_to_visitors.
 *   4. RECLAIM — 3rd miss → ownership → TREASURY_DID, structure+interior razed,
 *      occupants ejected, zoning.parcel_reclaimed {reason:'upkeep_default'}; the parcel
 *      is back in the treasury for resale.
 *   5. COMMONS — a Polis Commons parcel (rings 0–1, owner NULL) ticked across the same
 *      boundaries is NEVER debited and NEVER decays.
 *   6. PRIVACY — no raw owner DID in any payload (all HEX64); NO interior name/state on
 *      any payload across the whole run.
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
import { onUpkeepTick, type UpkeepScannerDeps } from '../../src/civic/upkeep-scanner.js';
import { gravityPrice, upkeepDue, UPKEEP_PERIOD_TICKS } from '../../src/civic/founding-law.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const HEX64 = /^[0-9a-f]{64}$/;
const NOUS_A = 'did:civic:noesis:alice';   // home owner who furnishes then defaults to reclaim
const NOUS_B = 'did:civic:noesis:bob';     // visitor
const NOUS_C = 'did:civic:noesis:carol';   // funded owner whose upkeep is collected

/** Ring-3 residential parcels from the Genesis Core seed — gravityPrice(3) === 400. */
const HOME_A = 'genesis:residential:0001'; // Nous A's home (furnish → decay → reclaim)
const HOME_C = 'genesis:residential:0002'; // Nous C's home (funded upkeep collected)
/** A Polis Commons parcel — ring 1 infrastructure, pre-built open venue, owner NULL. */
const COMMONS = 'genesis:infrastructure:0001';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** A mock mysql2 Pool — UPDATE/INSERT report affectedRows; SELECT (hydrate) returns nothing. */
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
    store: ParcelStore;
    upkeepDeps: UpkeepScannerDeps;
    queries: string[];
    setCtx: (ctx: DIDContext | null) => void;
    ready: Promise<void>;
}

/**
 * Build the seeded Genesis Core app with a swappable per-request didContext AND the
 * upkeep-scanner deps composed EXACTLY as production does in main.ts (parcel-registry
 * ladder + Nous-registry balance/transfer + store persist; treasury = TREASURY_DID).
 */
function buildGenesisApp(): E2EApp {
    const audit = new AuditChain();

    // Seed the WHOLE Genesis Core (53 parcels) into a real registry.
    const parcelRegistry = new ParcelRegistry('genesis');
    for (const p of buildGenesisCoreParcels('genesis')) parcelRegistry.upsert(p);

    // Real funds registry: treasury + three Nous.
    const nousRegistry = new NousRegistry();
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);
    nousRegistry.spawn({ name: 'alice', did: NOUS_A, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'bob', did: NOUS_B, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'carol', did: NOUS_C, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);

    // Real write-through store over a mock Pool — persistPurchase/persistBuild/etc. run.
    const { pool, queries } = mockPool();
    const store = new ParcelStore(pool, 'genesis');

    const services: Partial<GridServices> = {
        audit,
        gridName: 'genesis',
        currentTick: () => 100,
        registry: nousRegistry,
        parcels: { registry: parcelRegistry, store },
    };

    // Upkeep deps composed EXACTLY as production (main.ts lines 228–240).
    const upkeepDeps: UpkeepScannerDeps = {
        registry: {
            list: (filter) => parcelRegistry.list(filter),
            get: (did) => nousRegistry.get(did),
            transferWei: (from, to, amount) => nousRegistry.transferWei(from, to, amount),
            advanceCondition: (address) => parcelRegistry.advanceCondition(address),
            resetCondition: (address) => parcelRegistry.resetCondition(address),
            persistUpkeep: (parcel) => store.persistUpkeep(parcel),
            persistReclaim: (parcel) => store.persistReclaim(parcel),
        },
        audit,
        treasuryDid: TREASURY_DID,
    };

    let currentCtx: DIDContext | null = null;
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = currentCtx; });
    registerCivicParcelRoutes(app, services as GridServices);

    return {
        app, audit, parcelRegistry, nousRegistry, store, upkeepDeps, queries,
        setCtx: (ctx) => { currentCtx = ctx; },
        ready: app.ready().then(() => {}),
    };
}

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });
const GET = (app: FastifyInstance, url: string) => app.inject({ method: 'GET', url });

/** Buy + build a ring-3 home as the given Nous through the real HTTP routes. */
async function buyAndBuild(env: E2EApp, did: string, parcelId: string): Promise<void> {
    env.setCtx({ did, tier: 'civic_member' });
    const buy = await POST(env.app, `/api/v1/civic/parcels/${parcelId}/purchase`);
    expect(buy.statusCode).toBe(201);
    const build = await POST(env.app, `/api/v1/civic/parcels/${parcelId}/build`, {
        name: `${did} home`, type: 'home', visibility: 'open',
    });
    expect(build.statusCode).toBe(201);
}

describe('HOUSE-2 Definition of Done — furnish → view-gated → upkeep → reclaim end-to-end', () => {
    it('extends an interior, collects funded upkeep, decays an unfunded home to reclaim, exempts commons', async () => {
        const env = buildGenesisApp();
        await env.ready;
        const { app, audit, parcelRegistry, nousRegistry, upkeepDeps } = env;

        // Sanity — gravity law priced ring 3 at 400; upkeepDue = 2% = 8 Bios/period.
        expect(gravityPrice(3)).toBe(400);
        expect(parcelRegistry.get(HOME_A)?.priceWei).toBe(400);
        expect(upkeepDue(parcelRegistry.get(HOME_A)!)).toBe(8);

        // ── 1. FURNISH — Nous A buys + builds a home, then extends its interior ──────
        await buyAndBuild(env, NOUS_A, HOME_A);

        env.setCtx({ did: NOUS_A, tier: 'civic_member' });
        const bed = await POST(app, `/api/v1/civic/parcels/${HOME_A}/interior/extend`, { area: 'bedroom', kind: 'bed' });
        const desk = await POST(app, `/api/v1/civic/parcels/${HOME_A}/interior/extend`, { area: 'study', kind: 'work_desk' });
        expect(bed.statusCode).toBe(200);
        expect(desk.statusCode).toBe(200);

        // zoning.interior_extended on the trail — closed 4-tuple, catalog enums only.
        const extended = audit.query({ eventType: 'zoning.interior_extended' });
        expect(extended).toHaveLength(2);
        for (const e of extended) {
            expect(Object.keys(e.payload).sort()).toEqual(['object_class', 'object_kind', 'parcel_id', 'tick']);
            expect(e.payload.parcel_id).toBe(HOME_A);
        }
        const mirrorEvent = extended.find((e) => e.payload.object_class === 'mirror');
        const functionalEvent = extended.find((e) => e.payload.object_class === 'functional');
        expect(mirrorEvent?.payload.object_kind).toBe('bed');
        expect(functionalEvent?.payload.object_kind).toBe('work_desk');
        // NO interior name/state crossed: 'bedroom' / 'study' never appear on the payload.
        for (const e of extended) {
            expect(JSON.stringify(e.payload)).not.toMatch(/bedroom|study|areas|state/i);
        }

        // ── 1b. VIEW (open) — Nous B GETs the interior while the structure is open ──
        env.setCtx({ did: NOUS_B, tier: 'civic_member' });
        const viewOpen = await GET(app, `/api/v1/civic/parcels/${HOME_A}/interior`);
        expect(viewOpen.statusCode).toBe(200);
        // A visitor joins the structure so the reclaim ejection is observable later.
        const join = await POST(app, `/api/v1/civic/parcels/${HOME_A}/join`);
        expect(join.statusCode).toBe(200);
        expect(parcelRegistry.occupants(HOME_A)).toEqual([NOUS_B]);

        // ── 2. PAY (funded) — Nous C buys + builds, then a funded period is collected ──
        await buyAndBuild(env, NOUS_C, HOME_C);
        const carolBefore = nousRegistry.get(NOUS_C)!.balance_wei;
        const treasuryBeforeUpkeep = nousRegistry.get(TREASURY_DID)!.balance_wei;

        // Tick across a full UPKEEP_PERIOD_TICKS boundary (lastUpkeepTick is null → due).
        await onUpkeepTick(UPKEEP_PERIOD_TICKS, upkeepDeps);

        const collected = audit.query({ eventType: 'treasury.upkeep_collected' });
        // Both owned homes are due this first sweep; assert Nous C's funded collection.
        const carolCollect = collected.find((e) => e.payload.parcel_id === HOME_C);
        expect(carolCollect).toBeTruthy();
        expect(Object.keys(carolCollect!.payload).sort()).toEqual(['amount_wei', 'owner_civic_did_hash', 'parcel_id', 'tick']);
        expect(carolCollect!.payload.amount_wei).toBe(8);
        expect(String(carolCollect!.payload.owner_civic_did_hash)).toBe(sha256Hex(NOUS_C));
        // Funds moved Nous C → treasury (exactly 8); condition stays maintained.
        expect(nousRegistry.get(NOUS_C)!.balance_wei).toBe(carolBefore - 8);
        expect(parcelRegistry.get(HOME_C)!.condition).toBe('maintained');
        expect(parcelRegistry.get(HOME_C)!.missedPeriods).toBe(0);

        // Nous A was ALSO funded on this first sweep (balance 10000-400=9600 ≥ 8) → maintained.
        expect(parcelRegistry.get(HOME_A)!.condition).toBe('maintained');
        const aliceFundedBalance = nousRegistry.get(NOUS_A)!.balance_wei;
        expect(aliceFundedBalance).toBe(10_000 - 400 - 8);

        // ── 3. DECAY — drain Nous A's balance, then walk the ladder across boundaries ──
        // Move Alice's funds away so she cannot pay (transfer to treasury → balance 0).
        nousRegistry.transferWei(NOUS_A, TREASURY_DID, aliceFundedBalance);
        expect(nousRegistry.get(NOUS_A)!.balance_wei).toBe(0);

        // 1st missed period → worn + zoning.condition_changed.
        await onUpkeepTick(UPKEEP_PERIOD_TICKS * 2, upkeepDeps);
        expect(parcelRegistry.get(HOME_A)!.condition).toBe('worn');
        let conditionEvents = audit.query({ eventType: 'zoning.condition_changed' })
            .filter((e) => e.payload.parcel_id === HOME_A);
        expect(conditionEvents.at(-1)!.payload.condition).toBe('worn');
        expect(Object.keys(conditionEvents.at(-1)!.payload).sort())
            .toEqual(['condition', 'owner_civic_did_hash', 'parcel_id', 'tick']);
        expect(String(conditionEvents.at(-1)!.payload.owner_civic_did_hash)).toBe(sha256Hex(NOUS_A));

        // 2nd missed period → derelict + condition_changed; visitor GET now 403.
        await onUpkeepTick(UPKEEP_PERIOD_TICKS * 3, upkeepDeps);
        expect(parcelRegistry.get(HOME_A)!.condition).toBe('derelict');
        conditionEvents = audit.query({ eventType: 'zoning.condition_changed' })
            .filter((e) => e.payload.parcel_id === HOME_A);
        expect(conditionEvents.at(-1)!.payload.condition).toBe('derelict');

        env.setCtx({ did: NOUS_B, tier: 'civic_member' });
        const viewDerelict = await GET(app, `/api/v1/civic/parcels/${HOME_A}/interior`);
        expect(viewDerelict.statusCode).toBe(403);
        expect(viewDerelict.json()).toMatchObject({ error: 'closed_to_visitors' });

        // ── 4. RECLAIM — 3rd missed period → reclaim to treasury, raze, eject ──────
        await onUpkeepTick(UPKEEP_PERIOD_TICKS * 4, upkeepDeps);
        const reclaimed = audit.query({ eventType: 'zoning.parcel_reclaimed' })
            .filter((e) => e.payload.parcel_id === HOME_A);
        expect(reclaimed).toHaveLength(1);
        expect(Object.keys(reclaimed[0].payload).sort())
            .toEqual(['former_owner_civic_did_hash', 'parcel_id', 'reason', 'tick']);
        expect(reclaimed[0].payload.reason).toBe('upkeep_default');
        expect(String(reclaimed[0].payload.former_owner_civic_did_hash)).toBe(sha256Hex(NOUS_A));

        // Ownership → treasury; structure + interior razed; occupants ejected; parcel resale-ready.
        const reclaimedParcel = parcelRegistry.get(HOME_A)!;
        expect(reclaimedParcel.ownerDid).toBe(TREASURY_DID);
        expect(reclaimedParcel.structure == null).toBe(true);
        expect(reclaimedParcel.condition).toBe('maintained');
        expect(reclaimedParcel.missedPeriods).toBe(0);
        expect(parcelRegistry.occupants(HOME_A)).toEqual([]);
        // Back in the treasury inventory for resale.
        expect(parcelRegistry.list({ ownerDid: TREASURY_DID }).some((p) => p.id === HOME_A)).toBe(true);

        // ── 5. COMMONS — the Polis Commons parcel was ticked every sweep, never touched ──
        const commonsParcel = parcelRegistry.get(COMMONS)!;
        expect(commonsParcel.ownerDid).toBeNull();
        expect(commonsParcel.condition).toBe('maintained');
        expect(commonsParcel.missedPeriods).toBe(0);
        // No event of any kind references the commons parcel.
        for (const e of audit.all()) {
            expect(e.payload.parcel_id).not.toBe(COMMONS);
        }

        // ── 6. PRIVACY — no raw DID anywhere; no interior name/state on any payload ──
        for (const e of audit.all()) {
            const blob = JSON.stringify(e.payload);
            expect(blob).not.toContain('did:civic:');
            expect(blob).not.toMatch(/bedroom|study|areas|"state"/i);
            // Every DID-bearing key is a HEX64 hash.
            for (const key of ['owner_civic_did_hash', 'former_owner_civic_did_hash', 'buyer_civic_did_hash', 'visitor_civic_did_hash']) {
                const v = (e.payload as Record<string, unknown>)[key];
                if (typeof v === 'string') expect(HEX64.test(v)).toBe(true);
            }
        }

        // All four NEW HOUSE-2 events present on the trail.
        const topics = audit.all().map((e) => e.eventType);
        for (const t of [
            'zoning.interior_extended',
            'treasury.upkeep_collected',
            'zoning.condition_changed',
            'zoning.parcel_reclaimed',
        ]) {
            expect(topics).toContain(t);
        }

        await app.close();
    });
});
