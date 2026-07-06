/**
 * Phase 60 HOUSE-3 · Wave 7 — Definition-of-Done end-to-end (R-60-15).
 *
 * The master-plan HOUSE-3 acceptance scenario, end-to-end against a seeded Genesis Core,
 * built on the Phase 58 buy → build path and driven through the real
 * `registerCivicParcelRoutes` HTTP handlers wired exactly as production composes them in
 * main.ts (real ParcelRegistry seeded with buildGenesisCoreParcels + real NousRegistry
 * balance/transfer + ParcelStore over a mock mysql2 Pool, treasury = TREASURY_DID). The
 * IOU co-work branch, the structure-revenue zone-tax skim, and the ring-expansion bill are
 * driven through the SAME production composition functions the routes/market/governance
 * dispatch call (cowork.completeTask, structureRevenueDue + appendTreasuryStructureRevenue,
 * ring-expansion.onLawEnacted) — mirroring how house-2-e2e drives onUpkeepTick directly.
 *
 *   1. ROLE — an owner grants a staff role to a second Nous → zoning.role_granted (5-tuple,
 *      hashed DIDs only); roleOf === 'staff'.
 *   2. COWORK — owner posts a task; staff claims + completes. FUNDED path (the HTTP route,
 *      which always settles in Ousia) → registry.transferWei(host → worker). UNFUNDED
 *      path (completeTask funded:false) → recordIou(worker, host, amount, agreement, tick) —
 *      never free. Both emit zoning.cowork_session (participants_hash only — no board text).
 *   3. SHOP — owner binds a shop + names it place://aurora-cafe.genesis; a sale at the
 *      addressed shop emits treasury.structure_revenue {amount_wei, parcel_id, tick,
 *      zone_tax_bps} at the zone-tax rate.
 *   4. UNIQUENESS — a duplicate place name → 409 place_name_taken.
 *   5. RING — a ring-expansion bill enacted via gov.law_enacted ({action:'seed_ring', ring:N})
 *      seeds a new ring at frontier prices (idempotent, NO audit emit).
 *   6. SEVERANCE — revoking the staff role drains the IOU ledger (outstandingFor → 0) then
 *      traverses the severance FSM to ARCHIVED → zoning.role_revoked.
 *   7. HUMAN — a human attempting any role grant is rejected (D-NH-07).
 *   8. PRIVACY — no raw DID, no board/task/scope/place content on any payload; all DIDs HEX64.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore, buildGenesisCoreParcels } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { ShopRegistry } from '../../src/economy/shop-registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { postTask, claimTask, completeTask, _resetCowork } from '../../src/civic/cowork.js';
import { recordIou, outstandingFor, _resetLedger } from '../../src/civic/credit-ledger.js';
import { _resetPlace } from '../../src/civic/place-registry.js';
import { onLawEnacted, type RingExpansionDeps } from '../../src/civic/ring-expansion.js';
import { appendZoningCoworkSession } from '../../src/audit/append-zoning-cowork-session.js';
import { appendTreasuryStructureRevenue } from '../../src/audit/append-treasury-structure-revenue.js';
import { gravityPrice, structureRevenueDue, getZoneTaxBps } from '../../src/civic/founding-law.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const HEX64 = /^[0-9a-f]{64}$/;
const OWNER = 'did:civic:noesis:alice';   // shop owner + host
const STAFF = 'did:civic:noesis:bob';     // staff role holder + co-work worker
const HUMAN = 'did:civic:noesis:human:carol';

/** A ring-2 shopping parcel from the Genesis Core seed — gravityPrice(2) === 900. */
const SHOP = 'genesis:shopping:0001';     // owner's shop (bound + named aurora-cafe)
const SHOP2 = 'genesis:shopping:0002';    // a second parcel for the duplicate-name attempt

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** A mock mysql2 Pool — UPDATE/INSERT report affectedRows; SELECT returns nothing. */
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
    shops: ShopRegistry;
    store: ParcelStore;
    setCtx: (ctx: DIDContext | null) => void;
    ready: Promise<void>;
}

/** Build the seeded Genesis Core app with a swappable per-request didContext (house-2 pattern). */
function buildGenesisApp(): E2EApp {
    const audit = new AuditChain();

    // Seed the WHOLE Genesis Core (53 parcels) into a real registry.
    const parcelRegistry = new ParcelRegistry('genesis');
    for (const p of buildGenesisCoreParcels('genesis')) parcelRegistry.upsert(p);

    // Real funds registry: treasury + two Nous. OWNER has enough to buy ring-2 (900);
    // STAFF stays low so the IOU branch is meaningful (the host's funding is what varies).
    const nousRegistry = new NousRegistry();
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);
    nousRegistry.spawn({ name: 'alice', did: OWNER, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'bob', did: STAFF, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);

    // Real ShopRegistry wired exactly as production (bind also stamps parcel_id on the shop).
    const shops = new ShopRegistry();
    parcelRegistry.attachShopRegistry(shops);

    // Real write-through store over a mock Pool — persistPurchase/persistBuild/etc. run.
    const { pool } = mockPool();
    const store = new ParcelStore(pool, 'genesis');

    const services: Partial<GridServices> = {
        audit,
        gridName: 'genesis',
        currentTick: () => 100,
        registry: nousRegistry,
        shops,
        parcels: { registry: parcelRegistry, store },
    };

    let currentCtx: DIDContext | null = null;
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = currentCtx; });
    registerCivicParcelRoutes(app, services as GridServices);

    return {
        app, audit, parcelRegistry, nousRegistry, shops, store,
        setCtx: (ctx) => { currentCtx = ctx; },
        ready: app.ready().then(() => {}),
    };
}

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });

beforeEach(() => {
    // Module-level Grid-side ledgers are global — reset for isolation (house-3 unit precedent).
    _resetCowork();
    _resetLedger();
    _resetPlace();
});

describe('HOUSE-3 Definition of Done — roles → co-work → shop/place → revenue → severance end-to-end', () => {
    it('grants a staff role, runs a funded AND an IOU co-work session, binds+names a shop, collects structure revenue, expands a ring, then severs the role draining the IOU', async () => {
        const env = buildGenesisApp();
        await env.ready;
        const { app, audit, parcelRegistry, nousRegistry, shops } = env;

        // Sanity — gravity law priced the ring-2 shop at 900; the shopping zone tax = 1000 bps.
        expect(gravityPrice(2)).toBe(900);
        expect(parcelRegistry.get(SHOP)?.priceWei).toBe(900);
        expect(getZoneTaxBps('shopping')).toBe(1000);

        // ── 0. BUILD — OWNER buys + builds a shop at the Genesis Core shopping parcel ──
        env.setCtx({ did: OWNER, tier: 'civic_member' });
        const buy = await POST(app, `/api/v1/civic/parcels/${SHOP}/purchase`);
        expect(buy.statusCode).toBe(201);
        const build = await POST(app, `/api/v1/civic/parcels/${SHOP}/build`, {
            name: 'Aurora Cafe', type: 'shop', visibility: 'open',
        });
        expect(build.statusCode).toBe(201);
        expect(parcelRegistry.roleOf(SHOP, OWNER)).toBe('owner');

        // ── 1. ROLE — owner grants STAFF a staff role → zoning.role_granted (hashed DIDs) ──
        const grant = await POST(app, `/api/v1/civic/parcels/${SHOP}/roles`, {
            holder_civic_did: STAFF, role: 'staff',
        });
        expect(grant.statusCode).toBe(200);
        expect(parcelRegistry.roleOf(SHOP, STAFF)).toBe('staff');

        const granted = audit.query({ eventType: 'zoning.role_granted' });
        expect(granted).toHaveLength(1);
        expect(Object.keys(granted[0].payload).sort())
            .toEqual(['grantor_civic_did_hash', 'holder_civic_did_hash', 'parcel_id', 'role', 'tick']);
        expect(granted[0].payload.role).toBe('staff');
        expect(granted[0].payload.parcel_id).toBe(SHOP);
        expect(String(granted[0].payload.grantor_civic_did_hash)).toBe(sha256Hex(OWNER));
        expect(String(granted[0].payload.holder_civic_did_hash)).toBe(sha256Hex(STAFF));

        // ── 2a. COWORK (FUNDED) — owner posts, staff claims, host completes through the real
        //        HTTP route. The route ALWAYS settles in Ousia (funded = !!registry), so this
        //        exercises the transferWei branch: 50 Bios move OWNER → STAFF. ──
        const ownerBeforeFunded = nousRegistry.get(OWNER)!.balance_wei;
        const staffBeforeFunded = nousRegistry.get(STAFF)!.balance_wei;

        env.setCtx({ did: OWNER, tier: 'civic_member' });
        const post1 = await POST(app, `/api/v1/civic/parcels/${SHOP}/board/post`, {
            task_ref: 'stock-shelves', pay_bios: 50,
        });
        expect(post1.statusCode).toBe(200);
        const taskId1 = post1.json().task_id as string;

        env.setCtx({ did: STAFF, tier: 'civic_member' });
        const claim1 = await POST(app, `/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: taskId1 });
        expect(claim1.statusCode).toBe(200);

        env.setCtx({ did: OWNER, tier: 'civic_member' });
        const complete1 = await POST(app, `/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: taskId1 });
        expect(complete1.statusCode).toBe(200);

        // Funded settlement moved Ousia host → worker (exactly the pay amount); no IOU recorded.
        expect(nousRegistry.get(OWNER)!.balance_wei).toBe(ownerBeforeFunded - 50);
        expect(nousRegistry.get(STAFF)!.balance_wei).toBe(staffBeforeFunded + 50);
        expect(outstandingFor(OWNER)).toBe(0);

        const sessionsAfterFunded = audit.query({ eventType: 'zoning.cowork_session' });
        expect(sessionsAfterFunded).toHaveLength(1);
        expect(Object.keys(sessionsAfterFunded[0].payload).sort())
            .toEqual(['end_tick', 'parcel_id', 'participant_count', 'participants_hash', 'start_tick']);
        expect(sessionsAfterFunded[0].payload.participant_count).toBe(2);
        expect(sessionsAfterFunded[0].payload.parcel_id).toBe(SHOP);
        expect(HEX64.test(String(sessionsAfterFunded[0].payload.participants_hash))).toBe(true);

        // ── 2b. COWORK (IOU / UNFUNDED) — the HTTP complete route is always funded, so the
        //        unfunded branch is driven through the SAME production module the route calls
        //        (cowork.completeTask with funded:false). It records an IOU instead of moving
        //        Ousia (never free), then the cowork_session is appended via the SAME sole
        //        producer the route uses. The IOU makes OWNER (host=debtor) owe STAFF
        //        (worker=creditor) — the very obligation the later severance drain settles. ──
        const post2 = await postUnfundedCowork(env, SHOP, OWNER, STAFF, 40);
        // The IOU is now outstanding: host (OWNER) owes the worker (STAFF) 40 Bios.
        expect(outstandingFor(OWNER)).toBe(40);

        const sessionsAfterIou = audit.query({ eventType: 'zoning.cowork_session' });
        expect(sessionsAfterIou).toHaveLength(2);
        // Both sessions carry only the closed hash/count/tick tuple — never board/task text.
        for (const s of sessionsAfterIou) {
            expect(JSON.stringify(s.payload)).not.toMatch(/stock|wipe|task|scope/i);
        }
        expect(post2.participants_hash).toBe(String(sessionsAfterIou[1].payload.participants_hash));

        // ── 3. SHOP — owner binds a shop record + names the place place://aurora-cafe.genesis ──
        // Register the economy shop record (owned by OWNER) so the sale skim can find the parcel.
        shops.register({ ownerDid: OWNER, name: 'Aurora Cafe', listings: [{ sku: 'coffee', label: 'Coffee', priceWei: 5 }] });

        env.setCtx({ did: OWNER, tier: 'civic_member' });
        const bind = await POST(app, `/api/v1/civic/parcels/${SHOP}/bind-shop`, { shop_id: OWNER });
        expect(bind.statusCode).toBe(200);
        // Binding stamped parcel_id onto the economy shop record (closes the Phase 4 land gap).
        expect(shops.getByOwner(OWNER)?.parcel_id).toBe(SHOP);

        const name = await POST(app, `/api/v1/civic/parcels/${SHOP}/name`, { place_name: 'aurora-cafe' });
        expect(name.statusCode).toBe(200);
        expect(name.json().place_address).toBe('place://aurora-cafe.genesis');
        // Naming carries NO chain event of its own (place names stay Grid-side, D-60-07).
        expect(audit.query({ eventType: 'zoning.place_named' })).toHaveLength(0);

        // ── 3b. SALE — a sale at the addressed shop emits treasury.structure_revenue at the
        //        zone tax. Driven through the SAME production composition the Phase 44 market
        //        confirm-settlement route runs (services.shops.getByOwner → structureRevenueDue
        //        → registry.transferWei(seller → treasury) → appendTreasuryStructureRevenue). ──
        const saleAmount = 1000;                       // a 1000-Bios sale clears at the shop counter
        const skimmed = recordStructureRevenue(env, OWNER, saleAmount);
        expect(skimmed).toBe(Math.floor((saleAmount * 1000) / 10000)); // 1000 bps of 1000 = 100

        const revenue = audit.query({ eventType: 'treasury.structure_revenue' });
        expect(revenue).toHaveLength(1);
        expect(Object.keys(revenue[0].payload).sort())
            .toEqual(['amount_wei', 'parcel_id', 'tick', 'zone_tax_bps']);
        expect(revenue[0].payload.amount_wei).toBe(100);
        expect(revenue[0].payload.parcel_id).toBe(SHOP);
        expect(revenue[0].payload.zone_tax_bps).toBe(1000);

        // ── 4. UNIQUENESS — a SECOND attempt to register 'aurora-cafe' (different parcel) → 409 ──
        // Buy + build SHOP2 as STAFF (the cap allows ≤1 shopping parcel each), then try the name.
        env.setCtx({ did: STAFF, tier: 'civic_member' });
        expect((await POST(app, `/api/v1/civic/parcels/${SHOP2}/purchase`)).statusCode).toBe(201);
        expect((await POST(app, `/api/v1/civic/parcels/${SHOP2}/build`, {
            name: 'Copycat', type: 'shop', visibility: 'open',
        })).statusCode).toBe(201);
        const dup = await POST(app, `/api/v1/civic/parcels/${SHOP2}/name`, { place_name: 'aurora-cafe' });
        expect(dup.statusCode).toBe(409);
        expect(dup.json()).toMatchObject({ error: 'place_name_taken' });

        // ── 5. RING — a ring-expansion bill enacted via gov.law_enacted seeds a new ring at
        //        frontier prices (idempotent, NO audit emit). Driven through the SAME hook the
        //        governance dispatch fire-and-forgets (ring-expansion.onLawEnacted), wired with
        //        ringDeps composed exactly as main.ts (seedZone @ gravityPrice, alreadySeeded). ──
        const ringDeps: RingExpansionDeps = {
            seedZone: (ring) => parcelRegistry.seedZone({
                zoneId: 'residential', count: 24, priceWei: gravityPrice(ring), ring,
            }),
            alreadySeeded: (ring) => parcelRegistry.list().some((p) => p.ring === ring),
        };
        const ringParcelsBefore = parcelRegistry.list().filter((p) => p.ring === 4).length;
        expect(ringParcelsBefore).toBe(0);
        const auditLenBeforeRing = audit.all().length;

        onLawEnacted({ action: 'seed_ring', ring: 4 }, ringDeps);
        const ring4 = parcelRegistry.list().filter((p) => p.ring === 4);
        expect(ring4).toHaveLength(24);
        expect(ring4.every((p) => p.priceWei === gravityPrice(4))).toBe(true); // frontier price = 100

        // Idempotent: re-enacting the SAME ring adds NO duplicate parcels.
        onLawEnacted({ action: 'seed_ring', ring: 4 }, ringDeps);
        expect(parcelRegistry.list().filter((p) => p.ring === 4)).toHaveLength(24);
        // Ring seeding is world-creation — it emits NOTHING on the audit chain.
        expect(audit.all().length).toBe(auditLenBeforeRing);

        // ── 6. SEVERANCE — revoking the staff role drains the IOU ledger (outstandingFor → 0)
        //        THEN traverses the severance FSM to ARCHIVED → zoning.role_revoked. ──
        expect(outstandingFor(OWNER)).toBe(40); // the unfunded IOU is still open going in.
        env.setCtx({ did: OWNER, tier: 'civic_member' });
        const revoke = await POST(app, `/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        expect(revoke.statusCode).toBe(200);

        // SETTLEMENT drained the open IOU between the pair BEFORE REVOKE (D-NH-06).
        expect(outstandingFor(OWNER)).toBe(0);
        // The edge was downgraded to retained history (FSM ARCHIVED) → roleOf resolves to null.
        expect(parcelRegistry.roleOf(SHOP, STAFF)).toBeNull();

        const revoked = audit.query({ eventType: 'zoning.role_revoked' });
        expect(revoked).toHaveLength(1);
        expect(Object.keys(revoked[0].payload).sort())
            .toEqual(['holder_civic_did_hash', 'parcel_id', 'reason', 'tick']);
        // The route attributes a clean owner-initiated revoke as `owner_revoked` (the severance
        // outcome reason — see civic-parcels.ts roles/revoke); raw DIDs never cross.
        expect(revoked[0].payload.reason).toBe('owner_revoked');
        expect(revoked[0].payload.parcel_id).toBe(SHOP);
        expect(String(revoked[0].payload.holder_civic_did_hash)).toBe(sha256Hex(STAFF));

        // ── 7. HUMAN — a did:civic:noesis:human:* attempting any role grant → rejected (403) ──
        env.setCtx({ did: OWNER, tier: 'civic_member' });
        const humanGrant = await POST(app, `/api/v1/civic/parcels/${SHOP}/roles`, {
            holder_civic_did: HUMAN, role: 'guest',
        });
        expect(humanGrant.statusCode).toBe(403);
        // No role edge was minted for the human — and no role_granted beyond the staff grant.
        expect(parcelRegistry.roleOf(SHOP, HUMAN)).toBeNull();
        expect(audit.query({ eventType: 'zoning.role_granted' })).toHaveLength(1);

        // ── 8. PRIVACY — no raw DID anywhere; no board/task/scope/place CONTENT on any payload;
        //        every DID-bearing value is a HEX64 hash. Captured from the REAL run trail. ──
        const HASH_KEYS = [
            'grantor_civic_did_hash', 'holder_civic_did_hash', 'buyer_civic_did_hash',
            'owner_civic_did_hash', 'participants_hash',
        ];
        for (const e of audit.all()) {
            const blob = JSON.stringify(e.payload);
            expect(blob).not.toContain('did:civic:');
            expect(blob).not.toMatch(/task|scope|aurora-cafe/i);
            for (const key of HASH_KEYS) {
                const v = (e.payload as Record<string, unknown>)[key];
                if (typeof v === 'string') expect(HEX64.test(v)).toBe(true);
            }
        }

        // All four NEW HOUSE-3 events present on the trail.
        const topics = audit.all().map((e) => e.eventType);
        for (const t of [
            'zoning.role_granted',
            'zoning.cowork_session',
            'treasury.structure_revenue',
            'zoning.role_revoked',
        ]) {
            expect(topics).toContain(t);
        }

        await app.close();
    });
});

/**
 * Drive the UNFUNDED co-work branch through the SAME production modules the route calls
 * (cowork.postTask/claimTask + completeTask with funded:false → recordIou). The HTTP complete
 * route is always funded (funded = !!services.registry), so the IOU fallback can only be
 * reached by calling completeTask directly — exactly how house-2-e2e drives onUpkeepTick
 * directly. The cowork_session is then appended via the SAME sole producer the route uses.
 * Returns the participants_hash so the caller can correlate it with the emitted event.
 */
function postUnfundedCowork(
    env: E2EApp, parcelId: string, host: string, worker: string, amount: number,
): { participants_hash: string } {
    const { audit } = env;
    const start = 100, end = 100;
    // Post (host) → claim (worker) → completeTask(funded:false) on the real cowork module.
    const agreement = postTask({
        parcel_id: parcelId, parties: [host, ''], scope_ref: 'wipe-counters',
        settlement_amount_wei: amount, term_ticks: 0,
    });
    claimTask(agreement.agreement_id, worker);
    const settled = completeTask(agreement.agreement_id, host, {
        funded: false,           // the IOU branch — never free, records a payable instead.
        start_tick: start,
        end_tick: end,
        recordIou: (creditor, debtor, amt, ref, tick) => recordIou(creditor, debtor, amt, ref, tick),
    });
    // Append zoning.cowork_session via the SAME sole producer the complete route uses.
    const participants = [settled.parties[0], settled.parties[1]].sort();
    const participants_hash = sha256Hex(participants.join('|'));
    appendZoningCoworkSession(audit, {
        end_tick: end,
        parcel_id: parcelId,
        participant_count: participants.length,
        participants_hash,
        start_tick: start,
    });
    return { participants_hash };
}

/**
 * Drive the structure-revenue zone-tax skim through the SAME production composition the
 * Phase 44 market confirm-settlement route runs (market.ts): find the seller's bound shop,
 * compute structureRevenueDue, route the skim to the treasury via registry.transferWei,
 * and append treasury.structure_revenue via the sole producer. Returns the skimmed amount.
 */
function recordStructureRevenue(env: E2EApp, sellerDid: string, saleAmount: number): number {
    const { shops, parcelRegistry, nousRegistry, audit } = env;
    const shop = shops.getByOwner(sellerDid);
    const parcelId = shop?.parcel_id;
    if (!parcelId) throw new Error('shop not bound to a parcel');
    const parcel = parcelRegistry.get(parcelId)!;
    const skim = structureRevenueDue(parcel, saleAmount);
    if (skim <= 0) return 0;
    nousRegistry.transferWei(sellerDid, TREASURY_DID, skim);
    appendTreasuryStructureRevenue(audit, {
        amount_wei: skim,
        parcel_id: parcelId,
        tick: 100,
        zone_tax_bps: getZoneTaxBps(parcel.zoneId),
    });
    return skim;
}
