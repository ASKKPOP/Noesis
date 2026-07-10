/**
 * Phase 44 Plan 04 — Market route integration tests (MKT-01..06).
 *
 * Tests are mocked at the store layer: MarketplaceStore methods are vi.fn().
 * Follows the same Fastify inject() + preHandler pattern as p2p-routes.test.ts.
 *
 * Covers:
 *  - 403 business_did_required for non-business-DID callers on create
 *  - 400 price_too_low when price_wei < 50 (D-44-02 minimum-price guard)
 *  - 201 on successful create + audit event emission
 *  - 201 on bid placement + audit event emission
 *  - 402 insufficient_wei on accept
 *  - 409 listing_not_active on bid when listing not active
 *  - 200 settled=true on both-confirmed confirm-settlement
 *  - market.settled + irs.tax_collected both emitted on settle (D-44-03 unconditional)
 *  - 500 invalid_irs_fee_rate when irs_fee_rate out of [0.01, 0.03] (D-44-02 spec range)
 *  - market.disputed emitted on dispute
 *  - police_investigations row created on dispute
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../src/audit/chain.js';
import { registerMarketRoutes } from '../src/api/routes/market.js';
import { NousAccountStore } from '../src/economy/nous-account-store.js';
import { makeAccountsPool } from './helpers/accounts-pool.js';
import type { GridServices } from '../src/api/server.js';
import type { DIDContext } from '../src/api/preHandlers/types.js';
import '../src/api/preHandlers/types.js';

const ALICE_DID = 'did:civic:noesis:alice';
const LISTING_ID = '11111111-1111-1111-1111-111111111111';
const BID_ID = '22222222-2222-2222-2222-222222222222';
const ESCROW_ID = '33333333-3333-3333-3333-333333333333';
const DISPUTE_ID = '44444444-4444-4444-4444-444444444444';
const INVESTIGATION_ID = '55555555-5555-5555-5555-555555555555';

function makeAliceCtx(): DIDContext {
    return { did: ALICE_DID, tier: 'civic_member' };
}

/** Build a mini-Fastify app with market routes registered.
 *  Services use mock pool and mock stores. */
async function buildApp(opts: {
    authedCtx?: DIDContext | null;
    businessDid?: string | null;  // null = no active business DID
    mockStore?: Record<string, unknown>;
    poolQuery?: (...args: unknown[]) => Promise<unknown>;
    irsRate?: string;
}): Promise<{
    app: FastifyInstance;
    audit: AuditChain;
}> {
    const audit = new AuditChain();

    // Mock pool — returns configurable results
    const mockPoolQuery = opts.poolQuery ?? (async () => [[]] as unknown);
    const mockPool = {
        query: vi.fn(mockPoolQuery),
        getConnection: vi.fn(async () => ({
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async () => [[]]),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        })),
    };

    // Mock BusinessDidStore
    const bizDid = opts.businessDid !== undefined ? opts.businessDid : 'did:business:alice';
    const mockBizStore = {
        listByCivicDid: vi.fn(async () =>
            bizDid ? [{ businessDid: bizDid, status: 'active' }] : [],
        ),
    };

    const services: Partial<GridServices> = {
        audit,
        gridName: 'Genesis',
        currentTick: () => 100,
        pool: mockPool as unknown as import('mysql2/promise').Pool,
        businessDidStore: mockBizStore as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
    };

    const app = Fastify({ logger: false });
    if (opts.authedCtx !== undefined) {
        app.addHook('onRequest', async (req) => {
            req.didContext = opts.authedCtx;
        });
    }

    await registerMarketRoutes(app, services as GridServices);
    await app.ready();
    return { app, audit };
}

// ── GET /api/v1/market/listings ────────────────────────────────────────────

describe('GET /api/v1/market/listings (public browse)', () => {
    it('returns 200 with listings array', async () => {
        const { app } = await buildApp({
            poolQuery: async (sql: unknown) => {
                if (typeof sql === 'string' && sql.includes('marketplace_listings')) return [[{ listing_id: LISTING_ID, reputation_score: 1.0 }]];
                return [[]];
            },
        });
        const res = await app.inject({ method: 'GET', url: '/api/v1/market/listings' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ listings: expect.any(Array) });
        await app.close();
    });

    it('returns 200 without authentication (public route)', async () => {
        const { app } = await buildApp({ authedCtx: null });
        const res = await app.inject({ method: 'GET', url: '/api/v1/market/listings' });
        expect(res.statusCode).not.toBe(401);
        await app.close();
    });
});

// ── POST /api/v1/market/listing/create ────────────────────────────────────

describe('POST /api/v1/market/listing/create (business_did_required)', () => {
    const validBody = {
        title: 'Test Listing',
        description: 'A test listing description',
        price_wei: 100,
        category: 'goods',
        expires_in_ticks: 1000,
    };

    it('returns 401 without civic-DID token', async () => {
        const { app } = await buildApp({ authedCtx: null });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/market/listing/create',
            payload: validBody,
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('returns 403 business_did_required when caller has no active Business-DID', async () => {
        const { app } = await buildApp({ authedCtx: makeAliceCtx(), businessDid: null });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/market/listing/create',
            payload: validBody,
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'business_did_required' });
        await app.close();
    });

    it('returns 400 price_too_low when price_wei < 50 (D-44-02 minimum-price guard)', async () => {
        const { app } = await buildApp({ authedCtx: makeAliceCtx() });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/market/listing/create',
            payload: { ...validBody, price_wei: 49 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'price_too_low', minimum_price_wei: 50 });
        await app.close();
    });

    it('returns 400 price_too_low for exactly price_wei=1', async () => {
        const { app } = await buildApp({ authedCtx: makeAliceCtx() });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/market/listing/create',
            payload: { ...validBody, price_wei: 1 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'price_too_low' });
        await app.close();
    });

    it('returns 201 with listing_id on valid create + emits market.listing_created', async () => {
        const appendSpy = vi.fn((eventType: string) => ({ event_type: eventType, seq: 1 }));
        const audit = new AuditChain();
        vi.spyOn(audit, 'append').mockImplementation(appendSpy as unknown as typeof audit.append);

        const mockPool = {
            query: vi.fn(async (sql: unknown) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO marketplace_listings')) return [{ affectedRows: 1 }];
                return [[]];
            }),
            getConnection: vi.fn(async () => ({
                beginTransaction: vi.fn(), query: vi.fn(async () => [[]]),
                commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
            })),
        };
        const mockBizStore = {
            listByCivicDid: vi.fn(async () => [{ businessDid: 'did:business:alice', status: 'active' }]),
        };

        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit,
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: mockBizStore as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();

        const res = await app.inject({
            method: 'POST', url: '/api/v1/market/listing/create',
            payload: { ...validBody, price_wei: 100 },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json()).toMatchObject({ listing_id: expect.any(String) });
        const created = appendSpy.mock.calls.find((c) => c[0] === 'market.listing_created');
        expect(created).toBeTruthy();
        await app.close();
    });

    it('returns 400 invalid_title for empty title', async () => {
        const { app } = await buildApp({ authedCtx: makeAliceCtx() });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/market/listing/create',
            payload: { ...validBody, title: '' },
        });
        expect(res.statusCode).toBe(400);
        await app.close();
    });
});

// ── POST /api/v1/market/listing/:id/bid ────────────────────────────────────

describe('POST /api/v1/market/listing/:id/bid', () => {
    it('returns 401 without civic-DID', async () => {
        const { app } = await buildApp({ authedCtx: null });
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/bid`,
            payload: { offer_price_wei: 100 },
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('returns 201 with bid_id on valid bid + emits market.bid_placed', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');

        const mockPool = {
            query: vi.fn(async (sql: unknown) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO marketplace_bids')) return [{ affectedRows: 1 }];
                return [[]];
            }),
            getConnection: vi.fn(),
        };

        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit,
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();

        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/bid`,
            payload: { offer_price_wei: 100 },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json()).toMatchObject({ bid_id: expect.any(String) });
        expect(appendSpy).toHaveBeenCalledWith('market.bid_placed', expect.any(String), expect.objectContaining({ listing_id: LISTING_ID }));
        await app.close();
    });

    it('returns 409 listing_not_active when store throws listing_not_active', async () => {
        const mockPool = {
            query: vi.fn(async () => { throw new Error('listing_not_active'); }),
            getConnection: vi.fn(),
        };
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit: new AuditChain(),
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/bid`,
            payload: { offer_price_wei: 100 },
        });
        expect(res.statusCode).toBe(409);
        await app.close();
    });
});

// ── POST /api/v1/market/listing/:id/accept ─────────────────────────────────

describe('POST /api/v1/market/listing/:id/accept', () => {
    it('returns 402 insufficient_wei when the buyer nous_accounts balance is too low', async () => {
        // Ledger A (Phase 62.6-01): acceptBid debits nous_accounts. Buyer seeded 5 < bid 10000.
        const ap = makeAccountsPool({
            otherQuery: (sql) => {
                if (/marketplace_bids/i.test(sql)) {
                    return [[{
                        bid_id: BID_ID, listing_id: LISTING_ID,
                        listing_seller: ALICE_DID, listing_status: 'active',
                        offer_price_wei: '10000', bidder_civic_did: 'did:civic:noesis:buyer',
                        status: 'pending',
                    }], {}];
                }
                return [[], {}];
            },
        });
        ap.seedAccount('did:civic:noesis:buyer', 5n);
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit: new AuditChain(),
            gridName: 'genesis',
            currentTick: () => 100,
            pool: ap.pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/accept`,
            payload: { bid_id: BID_ID },
        });
        expect(res.statusCode).toBe(402);
        expect(res.json()).toMatchObject({ error: 'insufficient_wei' });
        // Rolled back — buyer's 5 wei untouched.
        expect(ap.balanceOf('did:civic:noesis:buyer')).toBe(5n);
        await app.close();
    });
});

// ── POST /api/v1/market/listing/:id/confirm-settlement ─────────────────────

describe('POST /api/v1/market/listing/:id/confirm-settlement', () => {
    it('returns 200 settled=false when only one party confirmed', async () => {
        const mockConn = {
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async () => [[{
                escrow_id: ESCROW_ID, buyer_civic_did: ALICE_DID, seller_civic_did: 'did:civic:noesis:seller',
                escrow_status: 'held', buyer_confirmed: 0, seller_confirmed: 0,
            }]]),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        };
        const mockPool = {
            query: vi.fn(async () => [[]]),
            getConnection: vi.fn(async () => mockConn),
        };
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit: new AuditChain(),
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/confirm-settlement`,
            payload: { party: 'buyer' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ settled: false, both_confirmed: false });
        await app.close();
    });

    it('returns 500 invalid_irs_fee_rate when grid_config.irs_fee_rate = 0.005 (D-44-02 spec range)', async () => {
        // confirmSettlement returns bothConfirmed=true, then getConfigValue returns 0.005 (below 0.01 min)
        const callCount = { n: 0 };
        const mockConn = {
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async () => {
                callCount.n++;
                return [[{
                    escrow_id: ESCROW_ID, buyer_civic_did: ALICE_DID, seller_civic_did: 'did:civic:noesis:seller',
                    escrow_status: 'held', buyer_confirmed: 1, seller_confirmed: 1,
                }]];
            }),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        };
        let configCallCount = 0;
        const mockPool = {
            query: vi.fn(async (sql: unknown) => {
                // getConfigValue query
                if (typeof sql === 'string' && sql.includes('grid_config')) {
                    configCallCount++;
                    return [[{ config_value: '0.005' }]];
                }
                return [[]];
            }),
            getConnection: vi.fn(async () => mockConn),
        };
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit: new AuditChain(),
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/confirm-settlement`,
            payload: { party: 'buyer' },
        });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toMatchObject({ error: 'invalid_irs_fee_rate' });
        await app.close();
    });

    it('returns 500 invalid_irs_fee_rate when irs_fee_rate = 0.05 (above 0.03 max)', async () => {
        const mockConn = {
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async () => [[{
                escrow_id: ESCROW_ID, buyer_civic_did: ALICE_DID, seller_civic_did: 'did:civic:noesis:seller',
                escrow_status: 'held', buyer_confirmed: 1, seller_confirmed: 1,
            }]]),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        };
        const mockPool = {
            query: vi.fn(async (sql: unknown) => {
                if (typeof sql === 'string' && sql.includes('grid_config')) {
                    return [[{ config_value: '0.05' }]];
                }
                return [[]];
            }),
            getConnection: vi.fn(async () => mockConn),
        };
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit: new AuditChain(),
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/confirm-settlement`,
            payload: { party: 'buyer' },
        });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toMatchObject({ error: 'invalid_irs_fee_rate' });
        await app.close();
    });

    it('returns 200 settled=true + emits market.settled AND irs.tax_collected + credits nous_accounts/civic_treasury (D-44-03, Ledger A)', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');

        // Ledger A (Phase 62.6-01): settle credits the seller on nous_accounts and the IRS fee
        // to civic_treasury via the accounts-pool fake. grid_config → 0.02; escrow both-confirmed.
        const ap = makeAccountsPool({
            otherQuery: (sql) => {
                if (/grid_config/i.test(sql)) return [[{ config_value: '0.02' }], {}];
                if (/marketplace_escrow/i.test(sql) && /FOR UPDATE/i.test(sql)) {
                    return [[{
                        escrow_id: ESCROW_ID,
                        listing_id: LISTING_ID,
                        buyer_civic_did: ALICE_DID,          // caller is buyer (ALICE_DID)
                        seller_civic_did: 'did:civic:noesis:seller',
                        seller_business_did: 'did:business:seller',
                        amount_wei: '100',
                        escrow_status: 'held',
                        buyer_confirmed: 1,
                        seller_confirmed: 1,
                    }], {}];
                }
                return [[], {}];
            },
        });
        ap.seedAccount('did:civic:noesis:seller', 0n);
        ap.seedTreasury(0n);

        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit,
            gridName: 'genesis',
            currentTick: () => 100,
            pool: ap.pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();

        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/confirm-settlement`,
            payload: { party: 'buyer' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ settled: true });

        const settledCalls = appendSpy.mock.calls.filter(c => c[0] === 'market.settled');
        const irsCalls = appendSpy.mock.calls.filter(c => c[0] === 'irs.tax_collected');
        expect(settledCalls.length).toBe(1);
        expect(irsCalls.length).toBe(1);

        // Verify order: market.settled emitted BEFORE irs.tax_collected
        const settledIdx = appendSpy.mock.calls.findIndex(c => c[0] === 'market.settled');
        const irsIdx = appendSpy.mock.calls.findIndex(c => c[0] === 'irs.tax_collected');
        expect(settledIdx).toBeLessThan(irsIdx);

        // Ledger A conservation: seller credited 98, IRS fee 2 in civic_treasury (no shop → no skim).
        expect(ap.balanceOf('did:civic:noesis:seller')).toBe(98n);
        expect(ap.treasuryOf()).toBe(2n);
        await app.close();
    });
});

// ── Structure-revenue skim (Phase 60 HOUSE-3 → Ledger A, Phase 62.6-01) ─────

describe('POST /api/v1/market/listing/:id/confirm-settlement — structure-revenue skim', () => {
    /** Wire a parcel-bound shop so the settle skims the per-zone structure tax. */
    function skimServices(ap: ReturnType<typeof makeAccountsPool>, audit: AuditChain): Partial<GridServices> {
        return {
            audit,
            gridName: 'genesis',
            currentTick: () => 100,
            pool: ap.pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as GridServices['businessDidStore'],
            // seller's shop is bound to a business-zone parcel → 1200 bps structure tax.
            shops: { getByOwner: vi.fn(() => ({ parcel_id: 'genesis:business:0001' })) } as unknown as GridServices['shops'],
            parcels: { registry: { get: vi.fn(() => ({ zoneId: 'business' })) } } as unknown as GridServices['parcels'],
            registry: {} as unknown as GridServices['registry'], // truthy — skim guard only checks presence
        };
    }

    function settleEscrowPool() {
        return makeAccountsPool({
            otherQuery: (sql) => {
                if (/grid_config/i.test(sql)) return [[{ config_value: '0.02' }], {}];
                if (/marketplace_escrow/i.test(sql) && /FOR UPDATE/i.test(sql)) {
                    return [[{
                        escrow_id: ESCROW_ID,
                        listing_id: LISTING_ID,
                        buyer_civic_did: ALICE_DID,
                        seller_civic_did: 'did:civic:noesis:seller',
                        seller_business_did: 'did:business:seller',
                        amount_wei: '100',
                        escrow_status: 'held',
                        buyer_confirmed: 1,
                        seller_confirmed: 1,
                    }], {}];
                }
                return [[], {}];
            },
        });
    }

    it('debits the seller and credits civic_treasury with the skim, emitting treasury.structure_revenue', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const ap = settleEscrowPool();
        ap.seedAccount('did:civic:noesis:seller', 0n);
        ap.seedTreasury(0n);

        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, skimServices(ap, audit) as GridServices);
        await app.ready();

        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/confirm-settlement`,
            payload: { party: 'buyer' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ settled: true });

        // price 100 → IRS fee 2 (seller +98), skim = floor(100 * 1200/10000) = 12 (seller -12 → 86).
        // treasury = IRS fee 2 + skim 12 = 14.
        expect(ap.balanceOf('did:civic:noesis:seller')).toBe(86n);
        expect(ap.treasuryOf()).toBe(14n);
        const skimCalls = appendSpy.mock.calls.filter(c => c[0] === 'treasury.structure_revenue');
        expect(skimCalls.length).toBe(1);
        await app.close();
    });

    it('never 500s the committed settle when the skim charge fails — returns 200, no structure_revenue emit', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        // Force the skim's chargeToTreasury to reject (underfunded), leaving the settle untouched.
        const chargeSpy = vi.spyOn(NousAccountStore.prototype, 'chargeToTreasury')
            .mockRejectedValueOnce(new Error('insufficient_balance'));
        const ap = settleEscrowPool();
        ap.seedAccount('did:civic:noesis:seller', 0n);
        ap.seedTreasury(0n);

        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, skimServices(ap, audit) as GridServices);
        await app.ready();

        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/confirm-settlement`,
            payload: { party: 'buyer' },
        });
        // Settle already committed (seller credited 98, IRS fee 2) — a skim failure must not 500 it.
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ settled: true });
        expect(chargeSpy).toHaveBeenCalledOnce();
        // No money moved by the failed skim; no phantom structure-revenue event.
        const skimCalls = appendSpy.mock.calls.filter(c => c[0] === 'treasury.structure_revenue');
        expect(skimCalls.length).toBe(0);
        expect(ap.balanceOf('did:civic:noesis:seller')).toBe(98n);
        expect(ap.treasuryOf()).toBe(2n);
        chargeSpy.mockRestore();
        await app.close();
    });
});

// ── POST /api/v1/market/listing/:id/dispute ────────────────────────────────

describe('POST /api/v1/market/listing/:id/dispute', () => {
    it('returns 401 without civic-DID', async () => {
        const { app } = await buildApp({ authedCtx: null });
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/dispute`,
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('returns 200 with dispute_id + emits market.disputed + creates police_investigations row', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');

        let investigationInserted = false;
        const mockConn = {
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async (sql: unknown) => {
                if (typeof sql === 'string' && sql.includes('marketplace_escrow') && sql.includes('FOR UPDATE')) {
                    return [[{
                        escrow_id: ESCROW_ID,
                        buyer_civic_did: ALICE_DID,
                        seller_civic_did: 'did:civic:noesis:seller',
                        escrow_status: 'held',
                    }]];
                }
                if (typeof sql === 'string' && sql.includes('marketplace_disputes')) {
                    return [{ affectedRows: 1 }];
                }
                return [[]];
            }),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        };
        const mockPool = {
            query: vi.fn(async (sql: unknown) => {
                // Pre-check for buyer/seller
                if (typeof sql === 'string' && sql.includes('marketplace_escrow') && !sql.includes('FOR UPDATE')) {
                    return [[{
                        buyer_civic_did: ALICE_DID,
                        seller_civic_did: 'did:civic:noesis:seller',
                    }]];
                }
                // police_investigations insert
                if (typeof sql === 'string' && sql.includes('police_investigations')) {
                    investigationInserted = true;
                    return [{ affectedRows: 1 }];
                }
                return [[]];
            }),
            getConnection: vi.fn(async () => mockConn),
        };

        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit,
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();

        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/dispute`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ dispute_id: expect.any(String), investigation_id: expect.any(String) });

        const disputedCalls = appendSpy.mock.calls.filter(c => c[0] === 'market.disputed');
        expect(disputedCalls.length).toBe(1);
        expect(investigationInserted).toBe(true);
        await app.close();
    });

    it('returns 403 not_party when caller is not buyer or seller', async () => {
        const mockPool = {
            query: vi.fn(async () => [[{
                buyer_civic_did: 'did:civic:noesis:other-buyer',
                seller_civic_did: 'did:civic:noesis:other-seller',
            }]]),
            getConnection: vi.fn(),
        };
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit: new AuditChain(),
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: `/api/v1/market/listing/${LISTING_ID}/dispute`,
        });
        expect(res.statusCode).toBe(403);
        await app.close();
    });
});
