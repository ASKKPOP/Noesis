/**
 * Phase 62.6-05 (D-12) — marketplace atomic-rollback proof.
 *
 * A failing money leg inside the escrow/settle transaction must leave NO partial state:
 * no phantom debit, no phantom seller credit, no phantom treasury credit, no escrow row.
 * Both legs run via the connection-scoped `*OnConn` wei rails on the store's OWN escrow
 * connection (O4), so a throw anywhere in the transaction triggers `conn.rollback()` and
 * the stateful `makeAccountsPool()` fake restores its begin-transaction snapshot — mirroring
 * the real rails' atomicity.
 */
import { describe, it, expect } from 'vitest';
import { MarketplaceStore } from '../src/marketplace/marketplace-store.js';
import { makeAccountsPool } from './helpers/accounts-pool.js';

const GRID = 'genesis';
const BUYER = 'did:civic:noesis:buyer';
const SELLER = 'did:civic:noesis:seller';

describe('Phase 62.6-05 — marketplace acceptBid atomic rollback (underfunded buyer)', () => {
    const bidRow = {
        bid_id: 'bid-1', listing_id: 'lst-1', grid_name: GRID,
        bidder_civic_did: BUYER, offer_price_wei: '100', status: 'pending',
        listing_seller: SELLER, listing_status: 'active',
    };

    it('throws insufficient_wei, does NOT insert an escrow row, and leaves the buyer balance unchanged', async () => {
        let escrowInsertSeen = false;
        const ap = makeAccountsPool({
            otherQuery: (sql) => {
                if (/INSERT INTO marketplace_escrow/i.test(sql)) escrowInsertSeen = true;
                if (/marketplace_bids/i.test(sql)) return [[bidRow], {}];
                return [[], {}];
            },
        });
        // Buyer seeded BELOW the 100-wei bid → the debit rail throws insufficient_balance.
        ap.seedAccount(BUYER, 40n);
        const store = new MarketplaceStore(ap.pool);

        await expect(store.acceptBid({
            listingId: 'lst-1', bidId: 'bid-1', gridName: GRID,
            sellerCivicDid: SELLER, currentTick: 5,
        })).rejects.toThrow('insufficient_wei');

        // No phantom debit — full rollback restored the pre-transaction snapshot.
        expect(ap.balanceOf(BUYER)).toBe(40n);
        // No phantom escrow row — the debit threw BEFORE the escrow INSERT.
        expect(escrowInsertSeen).toBe(false);
    });
});

describe('Phase 62.6-05 — marketplace settle atomic rollback (forced failure after the seller credit)', () => {
    const escrowRow = {
        escrow_id: 'esc-1', listing_id: 'lst-1', bid_id: 'bid-1', grid_name: GRID,
        buyer_civic_did: BUYER, seller_civic_did: SELLER,
        amount_wei: '100', escrow_status: 'held',
        buyer_confirmed: 1, seller_confirmed: 1,
        seller_business_did: 'did:biz:1', accepted_at_tick: 1, settled_at_tick: null,
    };

    it('a throw on the escrow-status UPDATE rolls back the seller credit AND the treasury credit', async () => {
        const ap = makeAccountsPool({
            otherQuery: (sql) => {
                // The escrow lock SELECT returns the held escrow…
                if (/marketplace_escrow/i.test(sql) && /FOR UPDATE/i.test(sql)) return [[escrowRow], {}];
                // …but the escrow-status UPDATE (which runs AFTER the seller credit + treasury
                // credit) fails, forcing the whole settle transaction to roll back.
                if (/UPDATE marketplace_escrow SET escrow_status/i.test(sql)) throw new Error('db_write_failed');
                return [[], {}];
            },
        });
        ap.seedAccount(SELLER, 0n);
        ap.seedTreasury(0n);
        const store = new MarketplaceStore(ap.pool);

        await expect(store.settle({
            gridName: GRID, listingId: 'lst-1', irsFeeRate: 0.02, currentTick: 10,
        })).rejects.toThrow('db_write_failed');

        // Full rollback — neither the seller credit (98) nor the treasury fee (2) survived.
        expect(ap.balanceOf(SELLER)).toBe(0n);
        expect(ap.treasuryOf()).toBe(0n);
    });
});
