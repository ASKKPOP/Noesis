/**
 * Phase 62.5-03 — treasury reconciliation (Issue #9).
 *
 * Proves the live gap is closed: after Phase 62.5-02 moved civic spend onto the unified
 * in-DB ledger, land + community revenue lands in `civic_treasury` (Ledger A) — the exact
 * table `GET /api/v1/irs/treasury` reads — so the IRS is no longer blind to it. Before the
 * migration a land sale credited the legacy nous_registry treasury record and the IRS showed
 * 0 (Track-C live finding). Here the parcel-purchase + community-found routes and the IRS
 * route share ONE stateful fake accounts pool, so a real HTTP purchase/found flows through to
 * a real HTTP /irs/treasury read — end-to-end, hermetically.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { registerCommunityRoutes } from '../../src/api/routes/community.js';
import { registerIrsRoutes } from '../../src/api/routes/irs.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import { FOUND_WEI_COST } from '../../src/community/types.js';
import { makeAccountsPool } from '../helpers/accounts-pool.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';

const BUYER = 'did:civic:noesis:reconcile-buyer';
const FOUNDER = 'did:civic:noesis:reconcile-founder';
const PARCEL = 'genesis:residential:0001';
const CHARTER = { membership: 'open', subgovernance: 'founder_led', conduct_rules: 'be kind', exit_terms: 'leave anytime' };

async function buildApp(): Promise<{ app: FastifyInstance; setCtx: (c: DIDContext | null) => void }> {
    const audit = new AuditChain();
    const parcelRegistry = new ParcelRegistry('genesis');
    parcelRegistry.seedZone({ zoneId: 'residential', count: 2, priceWei: 400, ring: 3 });

    // One shared ledger pool backs BOTH the spend routes (credit civic_treasury) and the IRS
    // read (SELECT balance_wei FROM civic_treasury) — that shared table IS the reconciliation.
    const accts = makeAccountsPool({ otherQuery: () => [[], {}] });
    accts.seedAccount(BUYER, 10_000);
    accts.seedAccount(FOUNDER, 10_000);

    const nousRegistry = new NousRegistry(); // requireCivicWriter 503 guard only
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);

    const store = { persistPurchase: vi.fn(async () => {}) } as unknown as ParcelStore;

    let ctx: DIDContext | null = null;
    const services = {
        audit,
        gridName: 'genesis',
        currentTick: () => 100,
        registry: nousRegistry,
        pool: accts.pool,
        parcels: { registry: parcelRegistry, store },
    } as unknown as GridServices;

    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerCivicParcelRoutes(app, services);
    registerCommunityRoutes(app, services);
    await registerIrsRoutes(app, services);
    await app.ready();
    return { app, setCtx: (c) => { ctx = c; } };
}

describe('Phase 62.5-03 — treasury reconciliation (Issue #9): IRS sees civic revenue', () => {
    it('GET /irs/treasury starts at 0, then reflects land + community revenue after real purchases', async () => {
        const { app, setCtx } = await buildApp();

        // The pre-condition of the live bug: an empty treasury reads 0.
        const before = await app.inject({ method: 'GET', url: '/api/v1/irs/treasury' });
        expect(before.statusCode).toBe(200);
        expect(before.json().balance_wei).toBe('0');

        // A Nous buys land for 400 — the exact flow that left the IRS blind pre-migration.
        setCtx({ did: BUYER, tier: 'civic_member' });
        const buy = await app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${PARCEL}/purchase` });
        expect(buy.statusCode).toBe(201);

        const afterLand = await app.inject({ method: 'GET', url: '/api/v1/irs/treasury' });
        expect(afterLand.json().balance_wei).toBe('400'); // land revenue now visible to the IRS

        // A community is founded for FOUND_WEI_COST — revenue accrues to the SAME treasury.
        setCtx({ did: FOUNDER, tier: 'civic_member' });
        const found = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Reconcilers', purpose: 'prove the IRS sees us', charter: CHARTER },
        });
        expect(found.statusCode).toBe(201);

        const afterCommunity = await app.inject({ method: 'GET', url: '/api/v1/irs/treasury' });
        expect(afterCommunity.json().balance_wei).toBe(String(400 + FOUND_WEI_COST));

        await app.close();
    });
});
