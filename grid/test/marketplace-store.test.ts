import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { MarketplaceStore } from '../src/marketplace/marketplace-store.js';

/**
 * Phase 44 Plan 02 — MarketplaceStore unit tests (MKT-01..05)
 *
 * Uses mock Pool (vi.fn()) — no live DB harness in this project.
 * All 10 methods tested. D-44-02 price guard, IRS FLOOR, acceptBid balance check verified.
 */

function makeMockPool(responses: Array<[unknown[], unknown]> = []): Pool {
    let callIndex = 0;
    const mockQuery = vi.fn().mockImplementation(() => {
        const response = responses[callIndex++] ?? [[], {}];
        return Promise.resolve(response);
    });
    const mockConn: PoolConnection = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query: mockQuery,
    } as unknown as PoolConnection;
    return {
        query: mockQuery,
        getConnection: vi.fn().mockResolvedValue(mockConn),
    } as unknown as Pool;
}

// ── createListing (MKT-01) ────────────────────────────────────────────────────

describe('marketplace store — createListing (MKT-01)', () => {
    it('returns a UUID listing_id', async () => {
        const pool = makeMockPool();
        const store = new MarketplaceStore(pool);
        const id = await store.createListing({
            gridName: 'genesis', sellerCivicDid: 'did:test:1', sellerBusinessDid: 'did:biz:1',
            title: 'Widget', description: 'A widget', priceBios: 100n,
            category: 'tools', createdAtTick: 1, expiresAtTick: 100,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        expect(pool.query).toHaveBeenCalled();
    });

    it('throws price_too_low for priceBios < 50n (D-44-02)', async () => {
        const pool = makeMockPool();
        const store = new MarketplaceStore(pool);
        await expect(store.createListing({
            gridName: 'genesis', sellerCivicDid: 'did:test:1', sellerBusinessDid: 'did:biz:1',
            title: 'Widget', description: 'A widget', priceBios: 49n,
            category: 'tools', createdAtTick: 1, expiresAtTick: 100,
        })).rejects.toThrow('price_too_low');
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts priceBios = 50n (boundary — D-44-02 minimum)', async () => {
        const pool = makeMockPool();
        const store = new MarketplaceStore(pool);
        const id = await store.createListing({
            gridName: 'genesis', sellerCivicDid: 'did:test:1', sellerBusinessDid: 'did:biz:1',
            title: 'Cheap Widget', description: 'Minimum price', priceBios: 50n,
            category: 'tools', createdAtTick: 1, expiresAtTick: 100,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });
});

// ── getListing ────────────────────────────────────────────────────────────────

describe('marketplace store — getListing', () => {
    it('returns the listing row when found', async () => {
        const listingRow = { listing_id: 'lst-1', grid_name: 'genesis', status: 'active' };
        const pool = makeMockPool([[[listingRow], null]]);
        const store = new MarketplaceStore(pool);
        const result = await store.getListing('lst-1');
        expect(result).not.toBeNull();
        expect(result!.listing_id).toBe('lst-1');
    });

    it('returns null when listing not found', async () => {
        const pool = makeMockPool([[[], null]]);
        const store = new MarketplaceStore(pool);
        const result = await store.getListing('nonexistent');
        expect(result).toBeNull();
    });
});

// ── browseListings ────────────────────────────────────────────────────────────

describe('marketplace store — browseListings (MKT-01)', () => {
    it('maps reputation_score as Number (not string)', async () => {
        const listingRow = {
            listing_id: 'lst-1', grid_name: 'genesis', status: 'active',
            reputation_score: '0.95',
        };
        const pool = makeMockPool([[[listingRow], null]]);
        const store = new MarketplaceStore(pool);
        const results = await store.browseListings({
            gridName: 'genesis', currentTick: 10, limit: 10, offset: 0,
        });
        expect(results).toHaveLength(1);
        expect(typeof results[0].reputation_score).toBe('number');
        expect(results[0].reputation_score).toBeCloseTo(0.95);
    });

    it('returns empty array when no matching listings', async () => {
        const pool = makeMockPool([[[], null]]);
        const store = new MarketplaceStore(pool);
        const results = await store.browseListings({
            gridName: 'genesis', currentTick: 10, limit: 10, offset: 0,
        });
        expect(results).toHaveLength(0);
    });
});

// ── placeBid (MKT-02) ────────────────────────────────────────────────────────

describe('marketplace store — placeBid (MKT-02)', () => {
    it('returns a UUID bid_id', async () => {
        const pool = makeMockPool();
        const store = new MarketplaceStore(pool);
        const id = await store.placeBid({
            listingId: 'lst-1', gridName: 'genesis', bidderCivicDid: 'did:buyer:1',
            offerPriceBios: 80n, placedAtTick: 5,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        expect(pool.query).toHaveBeenCalled();
    });
});

// ── acceptBid ────────────────────────────────────────────────────────────────

describe('marketplace store — acceptBid', () => {
    it('throws insufficient_bios when buyer ousia < bid amount', async () => {
        const bidRow = {
            bid_id: 'bid-1', listing_id: 'lst-1', grid_name: 'genesis',
            bidder_civic_did: 'did:buyer:1', offer_price_bios: '100', status: 'pending',
            listing_seller: 'did:seller:1', listing_status: 'active',
        };
        const buyerRow = { ousia: '50' }; // balance too low

        let qCall = 0;
        const mockConn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn().mockImplementation(() => {
                qCall++;
                if (qCall === 1) return Promise.resolve([[bidRow], null]);
                if (qCall === 2) return Promise.resolve([[buyerRow], null]);
                return Promise.resolve([[{}], null]);
            }),
        } as unknown as PoolConnection;

        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        await expect(store.acceptBid({
            listingId: 'lst-1', bidId: 'bid-1', gridName: 'genesis',
            sellerCivicDid: 'did:seller:1', currentTick: 5,
        })).rejects.toThrow('insufficient_bios');
    });

    it('returns escrowId + amounts when buyer has sufficient ousia', async () => {
        const bidRow = {
            bid_id: 'bid-1', listing_id: 'lst-1', grid_name: 'genesis',
            bidder_civic_did: 'did:buyer:1', offer_price_bios: '100', status: 'pending',
            listing_seller: 'did:seller:1', listing_status: 'active',
        };
        const buyerRow = { ousia: '500' }; // sufficient

        let qCall = 0;
        const mockConn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn().mockImplementation(() => {
                qCall++;
                if (qCall === 1) return Promise.resolve([[bidRow], null]);
                if (qCall === 2) return Promise.resolve([[buyerRow], null]);
                return Promise.resolve([[{}], null]);
            }),
        } as unknown as PoolConnection;

        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.acceptBid({
            listingId: 'lst-1', bidId: 'bid-1', gridName: 'genesis',
            sellerCivicDid: 'did:seller:1', currentTick: 5,
        });
        expect(result.escrowId).toMatch(/^[0-9a-f-]{36}$/);
        expect(result.amountBios).toBe(100n);
        expect(result.buyerCivicDid).toBe('did:buyer:1');
        expect(result.sellerCivicDid).toBe('did:seller:1');
    });
});

// ── confirmSettlement (MKT-03) ────────────────────────────────────────────────

describe('marketplace store — confirmSettlement (MKT-03)', () => {
    it('returns {bothConfirmed: false} when only buyer confirms', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_bios: '100', escrow_status: 'held',
            buyer_confirmed: 0, seller_confirmed: 0,
            accepted_at_tick: 1, settled_at_tick: null,
        };

        const mockConn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn()
                .mockResolvedValueOnce([[escrowRow], null]) // SELECT escrow
                .mockResolvedValueOnce([[{}], null]),       // UPDATE buyer_confirmed
        } as unknown as PoolConnection;

        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.confirmSettlement({
            listingId: 'lst-1', civicDid: 'did:buyer:1', party: 'buyer',
        });
        expect(result.bothConfirmed).toBe(false);
    });

    it('returns {bothConfirmed: true} when seller confirms after buyer already confirmed', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_bios: '100', escrow_status: 'held',
            buyer_confirmed: 1, seller_confirmed: 0, // buyer already confirmed
            accepted_at_tick: 1, settled_at_tick: null,
        };

        const mockConn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn()
                .mockResolvedValueOnce([[escrowRow], null])
                .mockResolvedValueOnce([[{}], null]),
        } as unknown as PoolConnection;

        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.confirmSettlement({
            listingId: 'lst-1', civicDid: 'did:seller:1', party: 'seller',
        });
        expect(result.bothConfirmed).toBe(true);
    });
});

// ── settle (MKT-03) ──────────────────────────────────────────────────────────

describe('marketplace store — settle (MKT-03 IRS fee)', () => {
    function makeSettleMockConn(escrowRow: object): PoolConnection {
        const treasuryRow = { balance_bios: '2' };
        let qCall = 0;
        return {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn().mockImplementation(() => {
                qCall++;
                if (qCall === 1) return Promise.resolve([[escrowRow], null]); // SELECT escrow FOR UPDATE
                if (qCall === 2) return Promise.resolve([[{}], null]);         // UPDATE nous_registry (seller credit)
                if (qCall === 3) return Promise.resolve([[{}], null]);         // INSERT civic_treasury upsert
                if (qCall === 4) return Promise.resolve([[{}], null]);         // UPDATE escrow status
                if (qCall === 5) return Promise.resolve([[{}], null]);         // UPDATE listing status
                if (qCall === 6) return Promise.resolve([[treasuryRow], null]); // SELECT treasury balance
                return Promise.resolve([[{}], null]);
            }),
        } as unknown as PoolConnection;
    }

    it('computes irsFee = FLOOR(amount * rate) for 100 * 0.02 = 2', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1', bid_id: 'bid-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_bios: '100', escrow_status: 'held',
            buyer_confirmed: 1, seller_confirmed: 1,
            seller_business_did: 'did:biz:1', accepted_at_tick: 1, settled_at_tick: null,
        };

        const mockConn = makeSettleMockConn(escrowRow);
        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });
        expect(result.irsFee).toBe(2n);
        expect(result.sellerPayout).toBe(98n);
    });

    it('computes irsFee = FLOOR(101 * 0.02) = 2 (not 2.02 — floor)', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1', bid_id: 'bid-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_bios: '101', escrow_status: 'held',
            buyer_confirmed: 1, seller_confirmed: 1,
            seller_business_did: 'did:biz:1', accepted_at_tick: 1, settled_at_tick: null,
        };

        const mockConn = makeSettleMockConn(escrowRow);
        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });
        expect(result.irsFee).toBe(2n); // FLOOR(2.02) = 2
        expect(result.sellerPayout).toBe(99n);
    });

    it('returns seller/buyer DIDs and priceBios', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1', bid_id: 'bid-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_bios: '200', escrow_status: 'held',
            buyer_confirmed: 1, seller_confirmed: 1,
            seller_business_did: 'did:biz:1', accepted_at_tick: 1, settled_at_tick: null,
        };

        const mockConn = makeSettleMockConn(escrowRow);
        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });
        expect(result.sellerCivicDid).toBe('did:seller:1');
        expect(result.buyerCivicDid).toBe('did:buyer:1');
        expect(result.priceBios).toBe(200n);
        expect(result.sellerBusinessDid).toBe('did:biz:1');
    });
});

// ── dispute (MKT-04) ─────────────────────────────────────────────────────────

describe('marketplace store — dispute (MKT-04)', () => {
    it('returns disputeId (UUID), sellerCivicDid, buyerCivicDid', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            escrow_status: 'held',
        };

        let qCall = 0;
        const mockConn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn().mockImplementation(() => {
                qCall++;
                if (qCall === 1) return Promise.resolve([[escrowRow], null]); // SELECT escrow FOR UPDATE
                if (qCall === 2) return Promise.resolve([[{}], null]);         // UPDATE escrow frozen
                if (qCall === 3) return Promise.resolve([[{}], null]);         // INSERT dispute row
                return Promise.resolve([[{}], null]);
            }),
        } as unknown as PoolConnection;

        const pool = { getConnection: vi.fn().mockResolvedValue(mockConn) } as unknown as Pool;
        const store = new MarketplaceStore(pool);

        const result = await store.dispute({
            gridName: 'genesis', listingId: 'lst-1',
            complainantCivicDid: 'did:buyer:1', currentTick: 8,
        });
        expect(result.disputeId).toMatch(/^[0-9a-f-]{36}$/);
        expect(result.sellerCivicDid).toBe('did:seller:1');
        expect(result.buyerCivicDid).toBe('did:buyer:1');
    });
});

// ── getConfigValue ────────────────────────────────────────────────────────────

describe('marketplace store — getConfigValue', () => {
    it('returns null when config key not found', async () => {
        const pool = makeMockPool([[[], null]]);
        const store = new MarketplaceStore(pool);
        const val = await store.getConfigValue('genesis', 'nonexistent_key');
        expect(val).toBeNull();
    });

    it('returns string value when row found', async () => {
        const configRow = { config_value: '0.02' };
        const pool = makeMockPool([[[configRow], null]]);
        const store = new MarketplaceStore(pool);
        const val = await store.getConfigValue('genesis', 'irs_fee_rate');
        expect(val).toBe('0.02');
    });
});

// ── listExpiredEscrows ────────────────────────────────────────────────────────

describe('marketplace store — listExpiredEscrows', () => {
    it('returns matching rows as listingId/buyerCivicDid/sellerCivicDid', async () => {
        const row1 = { listing_id: 'lst-1', buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1' };
        const row2 = { listing_id: 'lst-2', buyer_civic_did: 'did:buyer:2', seller_civic_did: 'did:seller:2' };
        const pool = makeMockPool([[[row1, row2], null]]);
        const store = new MarketplaceStore(pool);

        const results = await store.listExpiredEscrows({
            gridName: 'genesis', currentTick: 20, timeoutTicks: 7,
        });
        expect(results).toHaveLength(2);
        expect(results[0].listingId).toBe('lst-1');
        expect(results[0].buyerCivicDid).toBe('did:buyer:1');
        expect(results[0].sellerCivicDid).toBe('did:seller:1');
        expect(results[1].listingId).toBe('lst-2');
    });

    it('returns empty array when no expired escrows', async () => {
        const pool = makeMockPool([[[], null]]);
        const store = new MarketplaceStore(pool);
        const results = await store.listExpiredEscrows({
            gridName: 'genesis', currentTick: 5, timeoutTicks: 7,
        });
        expect(results).toHaveLength(0);
    });
});
