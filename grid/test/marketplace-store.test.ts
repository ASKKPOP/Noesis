import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { MarketplaceStore } from '../src/marketplace/marketplace-store.js';
import { makeAccountsPool } from './helpers/accounts-pool.js';

/**
 * Phase 44 Plan 02 — MarketplaceStore unit tests (MKT-01..05)
 *
 * Phase 62.6-01: the money legs (acceptBid buyer-debit, settle seller-credit) now move on
 * Ledger A (`nous_accounts` + `civic_treasury`). Those two describes assert *conservation* on
 * the unified ledger via the `makeAccountsPool()` fake (buyer debited, seller credited, IRS fee
 * in civic_treasury, totals conserved) — replacing the old hand-counted legacy-registry qCall
 * mocks. The non-money methods keep the lightweight `makeMockPool` fixture.
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
            title: 'Widget', description: 'A widget', priceWei: 100n,
            category: 'tools', createdAtTick: 1, expiresAtTick: 100,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        expect(pool.query).toHaveBeenCalled();
    });

    it('throws price_too_low for priceWei < 50n (D-44-02)', async () => {
        const pool = makeMockPool();
        const store = new MarketplaceStore(pool);
        await expect(store.createListing({
            gridName: 'genesis', sellerCivicDid: 'did:test:1', sellerBusinessDid: 'did:biz:1',
            title: 'Widget', description: 'A widget', priceWei: 49n,
            category: 'tools', createdAtTick: 1, expiresAtTick: 100,
        })).rejects.toThrow('price_too_low');
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('accepts priceWei = 50n (boundary — D-44-02 minimum)', async () => {
        const pool = makeMockPool();
        const store = new MarketplaceStore(pool);
        const id = await store.createListing({
            gridName: 'genesis', sellerCivicDid: 'did:test:1', sellerBusinessDid: 'did:biz:1',
            title: 'Cheap Widget', description: 'Minimum price', priceWei: 50n,
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
            offerPriceWei: 80n, placedAtTick: 5,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        expect(pool.query).toHaveBeenCalled();
    });
});

// ── acceptBid — Ledger A buyer-debit (Phase 62.6-01) ──────────────────────────

describe('marketplace store — acceptBid (nous_accounts buyer-debit)', () => {
    const bidRow = {
        bid_id: 'bid-1', listing_id: 'lst-1', grid_name: 'genesis',
        bidder_civic_did: 'did:buyer:1', offer_price_wei: '100', status: 'pending',
        listing_seller: 'did:seller:1', listing_status: 'active',
    };

    /** Accounts-pool where the bid+listing lock SELECT resolves to bidRow; all other
     *  non-money SQL (escrow INSERT, listing/bid status UPDATEs) is empty success. */
    function acceptPool(seedBuyerWei: bigint | null) {
        const ap = makeAccountsPool({
            otherQuery: (sql) => {
                if (/marketplace_bids/i.test(sql)) return [[bidRow], {}];
                return [[], {}];
            },
        });
        if (seedBuyerWei !== null) ap.seedAccount('did:buyer:1', seedBuyerWei);
        return ap;
    }

    it('debits the buyer on nous_accounts (500 → 400) and returns the escrow', async () => {
        const ap = acceptPool(500n);
        const store = new MarketplaceStore(ap.pool);
        const result = await store.acceptBid({
            listingId: 'lst-1', bidId: 'bid-1', gridName: 'genesis',
            sellerCivicDid: 'did:seller:1', currentTick: 5,
        });
        expect(result.escrowId).toMatch(/^[0-9a-f-]{36}$/);
        expect(result.amountWei).toBe(100n);
        expect(result.buyerCivicDid).toBe('did:buyer:1');
        expect(result.sellerCivicDid).toBe('did:seller:1');
        // Buyer debited 100 on the unified ledger.
        expect(ap.balanceOf('did:buyer:1')).toBe(400n);
    });

    it('throws insufficient_wei and rolls back when the buyer is underfunded (50 < 100)', async () => {
        const ap = acceptPool(50n);
        const store = new MarketplaceStore(ap.pool);
        await expect(store.acceptBid({
            listingId: 'lst-1', bidId: 'bid-1', gridName: 'genesis',
            sellerCivicDid: 'did:seller:1', currentTick: 5,
        })).rejects.toThrow('insufficient_wei');
        // Rolled back — no funds moved (escrow tx aborted).
        expect(ap.balanceOf('did:buyer:1')).toBe(50n);
    });

    it('throws insufficient_wei when the buyer has no account row (absent → 0, was buyer_not_found)', async () => {
        const ap = acceptPool(null);
        const store = new MarketplaceStore(ap.pool);
        await expect(store.acceptBid({
            listingId: 'lst-1', bidId: 'bid-1', gridName: 'genesis',
            sellerCivicDid: 'did:seller:1', currentTick: 5,
        })).rejects.toThrow('insufficient_wei');
    });
});

// ── confirmSettlement (MKT-03) ────────────────────────────────────────────────

describe('marketplace store — confirmSettlement (MKT-03)', () => {
    it('returns {bothConfirmed: false} when only buyer confirms', async () => {
        const escrowRow = {
            escrow_id: 'esc-1', listing_id: 'lst-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_wei: '100', escrow_status: 'held',
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
            amount_wei: '100', escrow_status: 'held',
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

// ── settle — Ledger A seller-credit + civic_treasury IRS fee (Phase 62.6-01) ──

describe('marketplace store — settle (nous_accounts credit + civic_treasury conservation)', () => {
    function escrowRow(amountWei: string) {
        return {
            escrow_id: 'esc-1', listing_id: 'lst-1', bid_id: 'bid-1', grid_name: 'genesis',
            buyer_civic_did: 'did:buyer:1', seller_civic_did: 'did:seller:1',
            amount_wei: amountWei, escrow_status: 'held',
            buyer_confirmed: 1, seller_confirmed: 1,
            seller_business_did: 'did:biz:1', accepted_at_tick: 1, settled_at_tick: null,
        };
    }

    /** Accounts-pool where the escrow lock SELECT resolves to the held escrow. */
    function settlePool(amountWei: string) {
        return makeAccountsPool({
            otherQuery: (sql) => {
                if (/marketplace_escrow/i.test(sql) && /FOR UPDATE/i.test(sql)) return [[escrowRow(amountWei)], {}];
                return [[], {}];
            },
        });
    }

    it('credits the seller sellerPayout on nous_accounts and the IRS fee to civic_treasury (100 * 0.02 = 2)', async () => {
        const ap = settlePool('100');
        ap.seedAccount('did:seller:1', 0n);
        ap.seedTreasury(0n);
        const store = new MarketplaceStore(ap.pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });
        expect(result.irsFee).toBe(2n);
        expect(result.sellerPayout).toBe(98n);
        // Ledger A conservation: seller gets 98, treasury gets 2, total == price 100.
        expect(ap.balanceOf('did:seller:1')).toBe(98n);
        expect(ap.treasuryOf()).toBe(2n);
        expect(ap.balanceOf('did:seller:1') + ap.treasuryOf()).toBe(100n);
        expect(result.totalTreasuryAfter).toBe(2n);
    });

    it('floors the IRS fee: FLOOR(101 * 0.02) = 2, seller credited 99', async () => {
        const ap = settlePool('101');
        ap.seedAccount('did:seller:1', 0n);
        ap.seedTreasury(0n);
        const store = new MarketplaceStore(ap.pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });
        expect(result.irsFee).toBe(2n); // FLOOR(2.02) = 2
        expect(result.sellerPayout).toBe(99n);
        expect(ap.balanceOf('did:seller:1')).toBe(99n);
        expect(ap.treasuryOf()).toBe(2n);
    });

    it('adds the fee to a pre-existing treasury balance and reports totalTreasuryAfter', async () => {
        const ap = settlePool('200');
        ap.seedAccount('did:seller:1', 0n);
        ap.seedTreasury(5n);
        const store = new MarketplaceStore(ap.pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });
        expect(result.irsFee).toBe(4n); // FLOOR(200 * 0.02)
        expect(result.sellerPayout).toBe(196n);
        expect(ap.treasuryOf()).toBe(9n); // 5 + 4
        expect(result.totalTreasuryAfter).toBe(9n);
        expect(result.sellerCivicDid).toBe('did:seller:1');
        expect(result.buyerCivicDid).toBe('did:buyer:1');
        expect(result.sellerBusinessDid).toBe('did:biz:1');
        expect(result.priceWei).toBe(200n);
    });

    it('WR-04: keeps full precision at true-wei magnitude (>1e18) — BigInt bps, no Number coercion', async () => {
        // 3 ETH in wei — far above 2^53, where Number(amountWei) would round and skew the split.
        const amountWei = 3_000_000_000_000_000_000n; // 3e18
        const ap = settlePool(amountWei.toString());
        ap.seedAccount('did:seller:1', 0n);
        ap.seedTreasury(0n);
        const store = new MarketplaceStore(ap.pool);

        const result = await store.settle({ gridName: 'genesis', listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10 });

        // Fee must equal the exact basis-point cut: FLOOR(amount * 200bps / 10000).
        const expectedFee = (amountWei * 200n) / 10000n; // 60_000_000_000_000_000n (0.06 ETH)
        expect(result.irsFee).toBe(expectedFee);
        expect(result.sellerPayout).toBe(amountWei - expectedFee);
        // Conservation is EXACT at this magnitude: seller + treasury == the full price, to the wei.
        expect(result.sellerPayout + result.irsFee).toBe(amountWei);
        expect(ap.balanceOf('did:seller:1') + ap.treasuryOf()).toBe(amountWei);
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
