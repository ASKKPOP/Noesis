/**
 * Phase 44 MKT-01..05 — MarketplaceStore
 *
 * CRUD + transactional operations for civic marketplace listings, bids, escrow, disputes.
 * Atomic settle transaction: buyer debit + seller credit + IRS fee + escrow status in one BEGIN/COMMIT.
 * Money moves on Ledger A (Phase 62.6-01): buyer/seller balances live in `nous_accounts` (per civic-DID),
 * civic revenue in `civic_treasury`. Debit/credit run via the connection-scoped `*OnConn` wei rails on the
 * store's OWN escrow/settle connection so each money leg stays inside the escrow BEGIN/COMMIT (O4/D-12).
 *
 * D-44-02 minimum-price guard: createListing rejects priceWei < 50n. This guarantees the IRS
 * fee FLOOR(priceWei * 0.02) >= 1 for any settled listing — preventing the "zero-fee" branch
 * at settle time (which would otherwise force the route to skip appendIrsTaxCollected).
 */
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { randomUUID, createHash } from 'node:crypto';
import { debitAccountOnConn, creditAccountOnConn } from '../economy/wei-ops.js';

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/** D-44-02 minimum price — ensures FLOOR(priceWei * 0.02) >= 1 for any settled listing. */
export const MIN_LISTING_PRICE_WEI = 50n;

// ── Row type interfaces ────────────────────────────────────────────────────────────

export interface ListingRow extends RowDataPacket {
    listing_id: string;
    grid_name: string;
    seller_civic_did: string;
    seller_business_did: string;
    title: string;
    description: string;
    price_wei: string | number;  // mysql2 may return BIGINT UNSIGNED as string
    category: string;
    status: 'active' | 'accepted' | 'settled' | 'expired' | 'cancelled';
    created_at_tick: number;
    expires_at_tick: number;
}

export interface BrowseListingRow extends ListingRow {
    reputation_score: number;
}

export interface EscrowRow extends RowDataPacket {
    escrow_id: string;
    listing_id: string;
    bid_id: string;
    grid_name: string;
    buyer_civic_did: string;
    seller_civic_did: string;
    amount_wei: string | number;
    escrow_status: 'held' | 'frozen' | 'settled' | 'refunded';
    buyer_confirmed: 0 | 1;
    seller_confirmed: 0 | 1;
    accepted_at_tick: number;
    settled_at_tick: number | null;
}

// ── MarketplaceStore ───────────────────────────────────────────────────────────────

export class MarketplaceStore {
    constructor(private readonly pool: Pool) {}

    // ── Config ──────────────────────────────────────────────────────────────────────

    /**
     * Read a config value from grid_config.
     * Called OUTSIDE transactions to avoid deadlock on config table (Pitfall 1 from RESEARCH.md).
     */
    async getConfigValue(gridName: string, key: string): Promise<string | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = ?`,
            [gridName, key],
        );
        return rows[0] ? String(rows[0].config_value) : null;
    }

    // ── Listings ─────────────────────────────────────────────────────────────────────

    /**
     * Create a new active marketplace listing.
     * D-44-02: Rejects priceWei < 50n — ensures FLOOR(price * 0.02) >= 1 always.
     * Returns the new listing_id UUID.
     */
    async createListing(params: {
        gridName: string;
        sellerCivicDid: string;
        sellerBusinessDid: string;
        title: string;
        description: string;
        priceWei: bigint;
        category: string;
        createdAtTick: number;
        expiresAtTick: number;
    }): Promise<string> {
        // D-44-02 minimum-price guard: FLOOR(priceWei * 0.02) must be >= 1.
        // At irs_fee_rate=0.02, priceWei=50 → fee=1. Any lower → fee=0 → skipped IRS emission.
        // Reject up-front so no listing is created whose settle would drop the IRS event.
        if (params.priceWei < MIN_LISTING_PRICE_WEI) {
            throw new Error('price_too_low');
        }
        const listingId = randomUUID();
        await this.pool.query(
            `INSERT INTO marketplace_listings
                (listing_id, grid_name, seller_civic_did, seller_business_did, title, description, price_wei, category, status, created_at_tick, expires_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
            [listingId, params.gridName, params.sellerCivicDid, params.sellerBusinessDid,
             params.title, params.description, params.priceWei.toString(), params.category,
             params.createdAtTick, params.expiresAtTick],
        );
        return listingId;
    }

    /**
     * Get a single listing by ID. Returns null if not found.
     */
    async getListing(listingId: string): Promise<ListingRow | null> {
        const [rows] = await this.pool.query<ListingRow[]>(
            `SELECT * FROM marketplace_listings WHERE listing_id = ?`,
            [listingId],
        );
        return rows[0] ?? null;
    }

    /**
     * Browse active listings with optional category/price filters.
     * Returns reputation_score per row (D-44-06/D-44-07).
     * New sellers with no history default to reputation_score=1.0 (COALESCE ... 1.0).
     */
    async browseListings(params: {
        gridName: string;
        category?: string;
        maxPriceWei?: bigint;
        currentTick: number;
        limit: number;
        offset: number;
    }): Promise<BrowseListingRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT l.*,
                COALESCE(
                    rs.settled_count / NULLIF(rs.settled_count + rs.disputed_count, 0),
                    1.0
                ) AS reputation_score
             FROM marketplace_listings l
             LEFT JOIN (
                 SELECT e.seller_civic_did,
                     SUM(CASE WHEN e.escrow_status = 'settled' THEN 1 ELSE 0 END) AS settled_count,
                     SUM(CASE WHEN e.escrow_status = 'frozen'  THEN 1 ELSE 0 END) AS disputed_count
                 FROM marketplace_escrow e WHERE e.grid_name = ? GROUP BY e.seller_civic_did
             ) rs ON rs.seller_civic_did = l.seller_civic_did
             WHERE l.grid_name = ? AND l.status = 'active'
               AND (? IS NULL OR l.category = ?)
               AND (? IS NULL OR l.price_wei <= ?)
               AND l.expires_at_tick > ?
             ORDER BY l.created_at_tick DESC, l.listing_id ASC
             LIMIT ? OFFSET ?`,
            [params.gridName,
             params.gridName,
             params.category ?? null, params.category ?? null,
             params.maxPriceWei != null ? params.maxPriceWei.toString() : null,
             params.maxPriceWei != null ? params.maxPriceWei.toString() : null,
             params.currentTick,
             params.limit, params.offset],
        );
        return rows.map(r => ({ ...r, reputation_score: Number(r.reputation_score) })) as BrowseListingRow[];
    }

    // ── Bids ─────────────────────────────────────────────────────────────────────────

    /**
     * Place a bid on a listing.
     * D-44-10: No Bios movement at bid time — escrow is funded at accept time.
     * Returns the new bid_id UUID.
     */
    async placeBid(params: {
        listingId: string;
        gridName: string;
        bidderCivicDid: string;
        offerPriceWei: bigint;
        bidMessage?: string;
        placedAtTick: number;
    }): Promise<string> {
        const bidId = randomUUID();
        await this.pool.query(
            `INSERT INTO marketplace_bids
                (bid_id, listing_id, grid_name, bidder_civic_did, offer_price_wei, bid_message, status, placed_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [bidId, params.listingId, params.gridName, params.bidderCivicDid,
             params.offerPriceWei.toString(), params.bidMessage ?? null, params.placedAtTick],
        );
        return bidId;
    }

    /**
     * Accept a bid.
     * Inside a transaction: locks bid + listing, checks buyer balance_wei >= price,
     * deducts from buyer, creates escrow row, marks listing+bid accepted.
     * D-44-10: Buyer Bios checked at accept time, not bid time (Pitfall 6).
     * Throws 'insufficient_wei' if buyer balance is too low.
     * Returns {escrowId, amountWei, buyerCivicDid, sellerCivicDid}.
     */
    async acceptBid(params: {
        listingId: string;
        bidId: string;
        gridName: string;
        sellerCivicDid: string;
        currentTick: number;
    }): Promise<{ escrowId: string; amountWei: bigint; buyerCivicDid: string; sellerCivicDid: string }> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            // Lock bid + listing in single query
            const [bidRows] = await conn.query<RowDataPacket[]>(
                `SELECT b.*, l.seller_civic_did AS listing_seller, l.status AS listing_status
                 FROM marketplace_bids b
                 JOIN marketplace_listings l ON l.listing_id = b.listing_id
                 WHERE b.bid_id = ? AND b.listing_id = ? AND b.grid_name = ?
                 FOR UPDATE`,
                [params.bidId, params.listingId, params.gridName],
            );
            if (!bidRows[0]) { await conn.rollback(); throw new Error('bid_not_found'); }
            const bid = bidRows[0];
            if (bid.status !== 'pending') { await conn.rollback(); throw new Error('bid_not_pending'); }
            if (bid.listing_status !== 'active') { await conn.rollback(); throw new Error('listing_not_active'); }
            if (bid.listing_seller !== params.sellerCivicDid) { await conn.rollback(); throw new Error('not_seller'); }
            const amountWei = BigInt(bid.offer_price_wei);
            // Buyer debit on nous_accounts (Ledger A) — on the store's OWN escrow connection so it
            // stays inside this beginTransaction (O4/D-12). debitAccountOnConn does the SELECT ... FOR
            // UPDATE + throws 'insufficient_balance' when the account cannot cover; an unfunded civic-DID
            // has a 0-balance/absent row → insufficient_balance → insufficient_wei. buyer_not_found is now
            // unreachable, mirroring the 62.5-02 buyer_not_found→402 retirement.
            try {
                await debitAccountOnConn(conn, {
                    gridName: params.gridName,
                    civicDid: bid.bidder_civic_did,
                    amountWei,
                    currentTick: params.currentTick,
                });
            } catch (e) {
                await conn.rollback();
                if (e instanceof Error && e.message === 'insufficient_balance') throw new Error('insufficient_wei');
                throw e;
            }
            // Create escrow row
            const escrowId = randomUUID();
            await conn.query(
                `INSERT INTO marketplace_escrow
                    (escrow_id, listing_id, bid_id, grid_name, buyer_civic_did, seller_civic_did,
                     amount_wei, escrow_status, buyer_confirmed, seller_confirmed, accepted_at_tick)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'held', 0, 0, ?)`,
                [escrowId, params.listingId, params.bidId, params.gridName,
                 bid.bidder_civic_did, bid.listing_seller, amountWei.toString(), params.currentTick],
            );
            // Mark listing + bid accepted
            await conn.query(`UPDATE marketplace_listings SET status='accepted' WHERE listing_id=?`, [params.listingId]);
            await conn.query(`UPDATE marketplace_bids SET status='accepted' WHERE bid_id=?`, [params.bidId]);
            await conn.commit();
            return { escrowId, amountWei, buyerCivicDid: bid.bidder_civic_did, sellerCivicDid: bid.listing_seller };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    // ── Settlement ───────────────────────────────────────────────────────────────────

    /**
     * Record buyer or seller confirmation.
     * Returns {bothConfirmed} — caller proceeds to settle() when true.
     * Throws 'not_party' if civicDid doesn't match the party's recorded DID.
     */
    async confirmSettlement(params: {
        listingId: string;
        civicDid: string;
        party: 'buyer' | 'seller';
    }): Promise<{ bothConfirmed: boolean }> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<EscrowRow[]>(
                `SELECT * FROM marketplace_escrow WHERE listing_id = ? AND escrow_status = 'held' FOR UPDATE`,
                [params.listingId],
            );
            if (!rows[0]) { await conn.rollback(); throw new Error('escrow_not_found'); }
            const escrow = rows[0];
            if (params.party === 'buyer' && escrow.buyer_civic_did !== params.civicDid) {
                await conn.rollback(); throw new Error('not_party');
            }
            if (params.party === 'seller' && escrow.seller_civic_did !== params.civicDid) {
                await conn.rollback(); throw new Error('not_party');
            }
            const column = params.party === 'buyer' ? 'buyer_confirmed' : 'seller_confirmed';
            await conn.query(
                `UPDATE marketplace_escrow SET ${column} = 1 WHERE escrow_id = ?`,
                [escrow.escrow_id],
            );
            const buyerConfirmed = params.party === 'buyer' ? true : Boolean(escrow.buyer_confirmed);
            const sellerConfirmed = params.party === 'seller' ? true : Boolean(escrow.seller_confirmed);
            await conn.commit();
            return { bothConfirmed: buyerConfirmed && sellerConfirmed };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Atomically settle an escrow.
     * T-44-02-01 mitigation: single BEGIN/COMMIT with FOR UPDATE row lock.
     * Steps: lock escrow, verify both confirmed, compute IRS fee via FLOOR,
     *   credit seller, credit treasury (INSERT...ON DUPLICATE KEY UPDATE),
     *   update escrow+listing status, read treasury balance, commit.
     *
     * irsFeeRate is passed in by the caller (read via getConfigValue OUTSIDE this tx — Pitfall 1).
     * IRS fee: FLOOR(amountWei * irsFeeRate) — favors seller per Bios integer math.
     */
    async settle(params: {
        gridName: string;
        listingId: string;
        irsFeeRate: number;
        currentTick: number;
    }): Promise<{
        sellerPayout: bigint;
        irsFee: bigint;
        sellerCivicDid: string;
        buyerCivicDid: string;
        sellerBusinessDid: string;
        priceWei: bigint;
        totalTreasuryAfter: bigint;
    }> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            // Step 1: Lock escrow row (T-44-02-01)
            const [escrowRows] = await conn.query<EscrowRow[]>(
                `SELECT e.*, l.seller_business_did
                 FROM marketplace_escrow e
                 JOIN marketplace_listings l ON l.listing_id = e.listing_id
                 WHERE e.listing_id = ? AND e.escrow_status = 'held'
                 FOR UPDATE`,
                [params.listingId],
            );
            if (!escrowRows[0]) { await conn.rollback(); throw new Error('escrow_not_found'); }
            const escrow = escrowRows[0] as EscrowRow & { seller_business_did: string };
            // Step 2: Verify both parties confirmed
            if (!escrow.buyer_confirmed || !escrow.seller_confirmed) {
                await conn.rollback(); throw new Error('not_both_confirmed');
            }
            // Step 3: Compute fee (outside tx per Pitfall 1 — fee rate passed in as param)
            const amountWei = BigInt(escrow.amount_wei);
            const irsFee = BigInt(Math.floor(Number(amountWei) * params.irsFeeRate));
            const sellerPayout = amountWei - irsFee;
            // Step 4: Credit seller on nous_accounts (Ledger A), on the store's OWN settle connection so
            // it stays inside this beginTransaction (O4/D-12). creditAccountOnConn upserts the account row.
            await creditAccountOnConn(conn, {
                gridName: params.gridName,
                civicDid: escrow.seller_civic_did,
                amountWei: sellerPayout,
                currentTick: params.currentTick,
            });
            // Step 5: Credit treasury (upsert — D-44-03)
            await conn.query(
                `INSERT INTO civic_treasury (grid_name, balance_wei, last_updated_tick)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     balance_wei = balance_wei + VALUES(balance_wei),
                     last_updated_tick = VALUES(last_updated_tick)`,
                [params.gridName, irsFee.toString(), params.currentTick],
            );
            // Step 6: Update escrow + listing status
            await conn.query(
                `UPDATE marketplace_escrow SET escrow_status='settled', settled_at_tick=? WHERE escrow_id=?`,
                [params.currentTick, escrow.escrow_id],
            );
            await conn.query(
                `UPDATE marketplace_listings SET status='settled' WHERE listing_id=?`,
                [params.listingId],
            );
            // Read treasury after credit (inside tx for consistency)
            const [treasuryRows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM civic_treasury WHERE grid_name = ?`, [params.gridName],
            );
            const totalTreasuryAfter = BigInt(treasuryRows[0]?.balance_wei ?? 0);
            await conn.commit();
            return {
                sellerPayout, irsFee,
                sellerCivicDid: escrow.seller_civic_did,
                buyerCivicDid: escrow.buyer_civic_did,
                sellerBusinessDid: escrow.seller_business_did,
                priceWei: amountWei,
                totalTreasuryAfter,
            };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    // ── Disputes ─────────────────────────────────────────────────────────────────────

    /**
     * Freeze escrow and create dispute row atomically (Pitfall 4 from RESEARCH.md).
     * DB writes committed BEFORE the caller emits the audit event.
     * Returns {disputeId, sellerCivicDid, buyerCivicDid} for the caller's audit emission.
     */
    async dispute(params: {
        gridName: string;
        listingId: string;
        complainantCivicDid: string;
        currentTick: number;
    }): Promise<{ disputeId: string; sellerCivicDid: string; buyerCivicDid: string }> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            // Lock escrow row
            const [escrowRows] = await conn.query<EscrowRow[]>(
                `SELECT escrow_id, buyer_civic_did, seller_civic_did, escrow_status
                 FROM marketplace_escrow WHERE listing_id = ? FOR UPDATE`,
                [params.listingId],
            );
            if (!escrowRows[0]) { await conn.rollback(); throw new Error('escrow_not_found'); }
            const escrow = escrowRows[0];
            if (escrow.escrow_status !== 'held') {
                await conn.rollback(); throw new Error('escrow_not_disputable');
            }
            // Freeze escrow
            await conn.query(
                `UPDATE marketplace_escrow SET escrow_status='frozen' WHERE escrow_id=?`,
                [escrow.escrow_id],
            );
            // Insert dispute row — complainant DID stored as sha256 hash (T-44-02-05 mitigation)
            const disputeId = randomUUID();
            await conn.query(
                `INSERT INTO marketplace_disputes
                    (dispute_id, listing_id, grid_name, complainant_civic_did_hash, dispute_status, created_at_tick)
                 VALUES (?, ?, ?, ?, 'pending_police', ?)`,
                [disputeId, params.listingId, params.gridName,
                 sha256Hex(params.complainantCivicDid), params.currentTick],
            );
            await conn.commit();
            return { disputeId, sellerCivicDid: escrow.seller_civic_did, buyerCivicDid: escrow.buyer_civic_did };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    // ── Settlement Timeout (Plan 04 consumer) ────────────────────────────────────────

    /**
     * List held escrows whose acceptance has timed out.
     * Used by Plan 04's settlement-timeout.ts helper (wave 2 consumer).
     * Escrow is expired when: accepted_at_tick + timeoutTicks < currentTick.
     */
    async listExpiredEscrows(params: {
        gridName: string;
        currentTick: number;
        timeoutTicks: number;
    }): Promise<Array<{ listingId: string; buyerCivicDid: string; sellerCivicDid: string }>> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT listing_id, buyer_civic_did, seller_civic_did
             FROM marketplace_escrow
             WHERE grid_name = ? AND escrow_status = 'held'
               AND accepted_at_tick + ? < ?`,
            [params.gridName, params.timeoutTicks, params.currentTick],
        );
        return rows.map(r => ({
            listingId: String(r.listing_id),
            buyerCivicDid: String(r.buyer_civic_did),
            sellerCivicDid: String(r.seller_civic_did),
        }));
    }
}
