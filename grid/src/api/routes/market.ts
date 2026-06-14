/**
 * Phase 44 MKT-01..06 — Civic Marketplace routes.
 *
 * Replaces Phase 36 stub market-listings.ts. Ships 8 marketplace routes + 1 police stub.
 * All audit emissions happen AFTER DB transactions commit (Pitfall 4 — RESEARCH.md).
 *
 * D-44-02 invariants enforced at this layer:
 *  - create route rejects price_bios < 50 with 400 price_too_low (mirrors store guard for explicit error).
 *  - confirm-settlement validates grid_config.irs_fee_rate ∈ [0.01, 0.03] (D-44-02 spec range).
 *
 * Routes registered:
 *  1. GET  /api/v1/market/listings                         public
 *  2. POST /api/v1/market/listing/create                   business_did_required
 *  3. GET  /api/v1/market/listing/:id                      public
 *  4. POST /api/v1/market/listing/:id/bid                  civic_did_required
 *  5. POST /api/v1/market/listing/:id/accept               civic_did_required
 *  6. POST /api/v1/market/listing/:id/reject               civic_did_required
 *  7. POST /api/v1/market/listing/:id/confirm-settlement   civic_did_required
 *  8. POST /api/v1/market/listing/:id/dispute              civic_did_required
 *  9. POST /api/v1/police/investigate                      civic_did_required (D-44-05 stub)
 */
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise'; // used for pool.query<RowDataPacket[]> calls
import type { GridServices } from '../server.js';
import { createHash, randomUUID } from 'node:crypto';
import { appendMarketListingCreated } from '../../audit/append-market-listing-created.js';
import { appendMarketBidPlaced } from '../../audit/append-market-bid-placed.js';
import { appendMarketSettled } from '../../audit/append-market-settled.js';
import { appendMarketDisputed } from '../../audit/append-market-disputed.js';
import { appendIrsTaxCollected } from '../../audit/append-irs-tax-collected.js';
import { appendTreasuryStructureRevenue } from '../../audit/append-treasury-structure-revenue.js';
import { MarketplaceStore, MIN_LISTING_PRICE_BIOS } from '../../marketplace/marketplace-store.js';
import { structureRevenueDue, ZONE_TAX_BPS } from '../../civic/founding-law.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9-]+$/;

/**
 * The Polis treasury DID structure-revenue is skimmed to (D-60-04). Defined locally so the
 * market route never depends on the civic registry module (mirrors parcel-registry's copy).
 */
const TREASURY_DID = 'did:noesis:system:treasury';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_RE = /^[a-z0-9_-]{1,63}$/i;

/** D-44-02 spec range for IRS fee rate. Out-of-bounds → 500 invalid_irs_fee_rate. */
const IRS_FEE_RATE_MIN = 0.01;
const IRS_FEE_RATE_MAX = 0.03;

/** Maximum expiry: 90 days at 2 ticks/second */
const MAX_EXPIRY_TICKS = 90 * 24 * 60 * 60 * 2;

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

function extractCivicDid(req: { didContext?: { did?: string; tier?: string } | null }): string | null {
    const ctx = req.didContext;
    if (!ctx) return null;
    const did = ctx.did;
    if (typeof did !== 'string' || !CIVIC_DID_RE.test(did)) return null;
    if (ctx.tier !== 'civic_member') return null;
    return did;
}

export async function registerMarketRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {

    // ── GET /api/v1/market/listings (public — replaces Phase 36 stub) ──────────
    app.get<{ Querystring: { category?: string; max_price?: string; limit?: string; offset?: string } }>(
        '/api/v1/market/listings', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });
        const store = new MarketplaceStore(pool);
        const currentTick = tickFn();
        const { category, max_price, limit: limitStr, offset: offsetStr } = req.query;
        const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));
        const offset = Math.max(0, parseInt(offsetStr ?? '0', 10) || 0);
        let maxPriceBios: bigint | undefined;
        if (max_price) {
            try { maxPriceBios = BigInt(max_price); } catch { /* ignore invalid */ }
        }
        const listings = await store.browseListings({
            gridName: services.gridName,
            category,
            maxPriceBios,
            currentTick,
            limit,
            offset,
        });
        return reply.code(200).send({ listings });
    });

    // ── POST /api/v1/market/listing/create (business_did_required) ─────────────
    // D-44-02: rejects price_bios < 50 with 400 price_too_low.
    app.post<{ Body: { title?: unknown; description?: unknown; price_bios?: unknown; category?: unknown; expires_in_ticks?: unknown } }>(
        '/api/v1/market/listing/create', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        const audit = services.audit;
        const bizStore = services.businessDidStore;
        if (!pool || !tickFn || !audit || !bizStore) {
            return reply.code(503).send({ error: 'service_unavailable' });
        }

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });

        const businesses = await bizStore.listByCivicDid(services.gridName, civicDid);
        const activeBusiness = businesses.find(b => b.status === 'active');
        if (!activeBusiness) return reply.code(403).send({ error: 'business_did_required' });

        const body = req.body ?? {};
        const { title, description, price_bios, category, expires_in_ticks } = body;

        if (typeof title !== 'string' || title.length === 0 || title.length > 255) {
            return reply.code(400).send({ error: 'invalid_title' });
        }
        if (typeof description !== 'string' || description.length === 0 || description.length > 8192) {
            return reply.code(400).send({ error: 'invalid_description' });
        }
        if (typeof category !== 'string' || !CATEGORY_RE.test(category)) {
            return reply.code(400).send({ error: 'invalid_category' });
        }
        let priceBios: bigint;
        try { priceBios = BigInt(price_bios as string | number); } catch {
            return reply.code(400).send({ error: 'invalid_price' });
        }
        if (priceBios <= 0n) {
            return reply.code(400).send({ error: 'invalid_price' });
        }
        // D-44-02 minimum-price guard at HTTP layer (store enforces too — defense in depth).
        if (priceBios < MIN_LISTING_PRICE_BIOS) {
            return reply.code(400).send({
                error: 'price_too_low',
                minimum_price_bios: Number(MIN_LISTING_PRICE_BIOS),
            });
        }
        if (!Number.isInteger(expires_in_ticks) || (expires_in_ticks as number) <= 0 || (expires_in_ticks as number) > MAX_EXPIRY_TICKS) {
            return reply.code(400).send({ error: 'invalid_expiry' });
        }

        const currentTick = tickFn();
        const store = new MarketplaceStore(pool);
        let listingId: string;
        try {
            listingId = await store.createListing({
                gridName: services.gridName,
                sellerCivicDid: civicDid,
                sellerBusinessDid: activeBusiness.businessDid,
                title,
                description,
                priceBios,
                category,
                createdAtTick: currentTick,
                expiresAtTick: currentTick + (expires_in_ticks as number),
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'price_too_low') {
                return reply.code(400).send({
                    error: 'price_too_low',
                    minimum_price_bios: Number(MIN_LISTING_PRICE_BIOS),
                });
            }
            req.log.error({ err: msg }, 'create_listing_unhandled');
            return reply.code(500).send({ error: 'internal' });
        }
        // Emit AFTER DB write (Pitfall 4).
        appendMarketListingCreated(audit, {
            category,
            listing_id: listingId,
            price_bios: Number(priceBios),
            seller_business_did_hash: sha256Hex(activeBusiness.businessDid),
            tick: currentTick,
        });
        return reply.code(201).send({ listing_id: listingId });
    });

    // ── GET /api/v1/market/listing/:id (public) ────────────────────────────────
    app.get<{ Params: { id: string } }>(
        '/api/v1/market/listing/:id', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        if (!UUID_RE.test(req.params.id)) return reply.code(400).send({ error: 'invalid_listing_id' });
        const store = new MarketplaceStore(pool);
        const listing = await store.getListing(req.params.id);
        if (!listing) return reply.code(404).send({ error: 'listing_not_found' });
        return reply.code(200).send({ listing });
    });

    // ── POST /api/v1/market/listing/:id/bid (civic_did_required) ──────────────
    app.post<{ Params: { id: string }; Body: { offer_price_bios?: unknown; bid_message?: unknown } }>(
        '/api/v1/market/listing/:id/bid', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!pool || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });
        if (!UUID_RE.test(req.params.id)) return reply.code(400).send({ error: 'invalid_listing_id' });

        const body = req.body ?? {};
        let offerPriceBios: bigint;
        try { offerPriceBios = BigInt(body.offer_price_bios as string | number); } catch {
            return reply.code(400).send({ error: 'invalid_offer_price' });
        }
        if (offerPriceBios <= 0n) return reply.code(400).send({ error: 'invalid_offer_price' });
        const bidMessage = typeof body.bid_message === 'string' ? body.bid_message.slice(0, 512) : undefined;

        const currentTick = tickFn();
        const store = new MarketplaceStore(pool);
        let bidId: string;
        try {
            bidId = await store.placeBid({
                listingId: req.params.id,
                gridName: services.gridName,
                bidderCivicDid: civicDid,
                offerPriceBios,
                bidMessage,
                placedAtTick: currentTick,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'listing_not_active') return reply.code(409).send({ error: 'listing_not_active' });
            req.log.error({ err: msg }, 'place_bid_unhandled');
            return reply.code(500).send({ error: 'internal' });
        }
        // Emit AFTER DB write.
        appendMarketBidPlaced(audit, {
            bidder_civic_did_hash: sha256Hex(civicDid),
            listing_id: req.params.id,
            offer_price_bios: Number(offerPriceBios),
            tick: currentTick,
        });
        return reply.code(201).send({ bid_id: bidId });
    });

    // ── POST /api/v1/market/listing/:id/accept (civic_did_required) ────────────
    app.post<{ Params: { id: string }; Body: { bid_id?: unknown } }>(
        '/api/v1/market/listing/:id/accept', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        if (!pool || !tickFn) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });
        if (!UUID_RE.test(req.params.id)) return reply.code(400).send({ error: 'invalid_listing_id' });

        const bidId = req.body?.bid_id;
        if (typeof bidId !== 'string' || !UUID_RE.test(bidId)) {
            return reply.code(400).send({ error: 'invalid_bid_id' });
        }

        const currentTick = tickFn();
        const store = new MarketplaceStore(pool);
        try {
            const result = await store.acceptBid({
                listingId: req.params.id,
                bidId,
                gridName: services.gridName,
                sellerCivicDid: civicDid,
                currentTick,
            });
            return reply.code(200).send({ escrow_id: result.escrowId });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'insufficient_bios') return reply.code(402).send({ error: 'insufficient_bios' });
            if (msg === 'not_seller') return reply.code(403).send({ error: 'not_seller' });
            if (msg === 'bid_not_found') return reply.code(404).send({ error: 'bid_not_found' });
            if (msg === 'bid_not_pending') return reply.code(409).send({ error: 'bid_not_pending' });
            if (msg === 'listing_not_active') return reply.code(409).send({ error: 'listing_not_active' });
            req.log.error({ err: msg }, 'accept_bid_unhandled');
            return reply.code(500).send({ error: 'internal' });
        }
    });

    // ── POST /api/v1/market/listing/:id/reject (civic_did_required) ────────────
    app.post<{ Params: { id: string }; Body: { bid_id?: unknown } }>(
        '/api/v1/market/listing/:id/reject', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });
        if (!UUID_RE.test(req.params.id)) return reply.code(400).send({ error: 'invalid_listing_id' });

        const bidId = req.body?.bid_id;
        if (typeof bidId !== 'string' || !UUID_RE.test(bidId)) {
            return reply.code(400).send({ error: 'invalid_bid_id' });
        }

        // Verify caller is the listing seller before rejecting
        const [listingRows] = await pool.query<RowDataPacket[]>(
            `SELECT seller_civic_did FROM marketplace_listings WHERE listing_id = ? AND status = 'active'`,
            [req.params.id],
        );
        if (!listingRows[0]) return reply.code(404).send({ error: 'listing_not_found' });
        if (listingRows[0].seller_civic_did !== civicDid) {
            return reply.code(403).send({ error: 'not_seller' });
        }

        const [result] = await pool.query(
            `UPDATE marketplace_bids SET status='rejected'
             WHERE bid_id = ? AND listing_id = ? AND status = 'pending'`,
            [bidId, req.params.id],
        ) as unknown as [{ affectedRows: number }, unknown];
        if (result.affectedRows === 0) {
            return reply.code(409).send({ error: 'bid_not_pending' });
        }
        return reply.code(200).send({ rejected: true });
    });

    // ── POST /api/v1/market/listing/:id/confirm-settlement (civic_did_required) ─
    // D-44-02: validate grid_config.irs_fee_rate ∈ [0.01, 0.03].
    app.post<{ Params: { id: string }; Body: { party?: unknown } }>(
        '/api/v1/market/listing/:id/confirm-settlement', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!pool || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });
        if (!UUID_RE.test(req.params.id)) return reply.code(400).send({ error: 'invalid_listing_id' });

        const party = req.body?.party;
        if (party !== 'buyer' && party !== 'seller') {
            return reply.code(400).send({ error: 'invalid_party' });
        }

        const store = new MarketplaceStore(pool);
        let bothConfirmed: boolean;
        try {
            ({ bothConfirmed } = await store.confirmSettlement({
                listingId: req.params.id,
                civicDid,
                party: party as 'buyer' | 'seller',
            }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'not_party') return reply.code(403).send({ error: 'not_party' });
            if (msg === 'escrow_not_found') return reply.code(404).send({ error: 'escrow_not_found' });
            req.log.error({ err: msg }, 'confirm_settlement_error');
            return reply.code(500).send({ error: 'internal' });
        }

        if (!bothConfirmed) return reply.code(200).send({ settled: false, both_confirmed: false });

        // Both confirmed — read irs_fee_rate OUTSIDE the settle transaction (Pitfall 1).
        // D-44-02 spec range: irs_fee_rate ∈ [0.01, 0.03].
        const rawRate = await store.getConfigValue(services.gridName, 'irs_fee_rate');
        const irsFeeRate = rawRate !== null ? Number.parseFloat(rawRate) : 0.02;
        if (!Number.isFinite(irsFeeRate)) {
            req.log.error({ rawRate }, 'invalid_irs_fee_rate_not_finite');
            return reply.code(500).send({ error: 'invalid_irs_fee_rate' });
        }
        if (irsFeeRate < IRS_FEE_RATE_MIN || irsFeeRate > IRS_FEE_RATE_MAX) {
            req.log.error({
                rawRate, irsFeeRate, min: IRS_FEE_RATE_MIN, max: IRS_FEE_RATE_MAX,
            }, 'invalid_irs_fee_rate_out_of_range');
            return reply.code(500).send({
                error: 'invalid_irs_fee_rate',
                expected_range_inclusive: [IRS_FEE_RATE_MIN, IRS_FEE_RATE_MAX],
            });
        }

        const currentTick = tickFn();
        let settleResult: {
            sellerPayout: bigint;
            irsFee: bigint;
            sellerCivicDid: string;
            buyerCivicDid: string;
            sellerBusinessDid: string;
            priceBios: bigint;
            totalTreasuryAfter: bigint;
        };
        try {
            settleResult = await store.settle({
                gridName: services.gridName,
                listingId: req.params.id,
                irsFeeRate,
                currentTick,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'escrow_not_found') return reply.code(404).send({ error: 'escrow_not_found' });
            req.log.error({ err: msg }, 'settle_unhandled');
            return reply.code(500).send({ error: 'internal' });
        }

        // Emit market.settled THEN irs.tax_collected (D-44-03 order preserved).
        appendMarketSettled(audit, {
            buyer_civic_did_hash: sha256Hex(settleResult.buyerCivicDid),
            irs_fee_bios: Number(settleResult.irsFee),
            listing_id: req.params.id,
            price_bios: Number(settleResult.priceBios),
            seller_business_did_hash: sha256Hex(settleResult.sellerBusinessDid),
            tick: currentTick,
        });
        // D-44-02 invariant: min-price guard ensures irsFee >= 1n always.
        // Emit appendIrsTaxCollected unconditionally — amount_bios guard requires positive integer.
        appendIrsTaxCollected(audit, {
            amount_bios: Number(settleResult.irsFee),
            listing_id: req.params.id,
            payer_civic_did_hash: sha256Hex(settleResult.buyerCivicDid),
            tick: currentTick,
            total_treasury_after: Number(settleResult.totalTreasuryAfter),
        });
        // ── Phase 60 HOUSE-3 (D-60-04 / R-60-06): structure-revenue zone-tax skim ──
        // ADDITIVE — runs AFTER the existing trade settlement above, never altering it. If
        // the seller's shop is bound to a parcel, skim the per-zone tax to the treasury
        // (streaming, collected at settlement, never filed). Fully guarded: when the civic
        // services aren't wired or the shop is unbound, this is a no-op and the legacy
        // settlement behavior is unchanged.
        const shop = services.shops?.getByOwner(settleResult.sellerCivicDid);
        const parcelId = shop?.parcel_id;
        if (parcelId && services.parcels && services.registry) {
            const parcel = services.parcels.registry.get(parcelId);
            if (parcel) {
                const saleAmount = Number(settleResult.priceBios);
                const skim = structureRevenueDue(parcel, saleAmount);
                if (skim > 0) {
                    // Route the skim to TREASURY_DID (streaming). transferOusia is atomic and
                    // a no-op on failure (e.g. seller absent from the ousia registry), so the
                    // trade settlement above is never disturbed.
                    services.registry.transferOusia(settleResult.sellerCivicDid, TREASURY_DID, skim);
                    // ── Phase 60 Wave 4 EMIT POINT (treasury.structure_revenue #98) ─────
                    // Sole-producer append (allowlist 95→99). actorDid = parcel_id (mirrors
                    // #83 — NO buyer/seller DID on chain; identity already audited via the
                    // market.settled trade above). Only the skimmed tax + the per-zone bps.
                    appendTreasuryStructureRevenue(audit, {
                        amount_bios: skim,
                        parcel_id: parcelId,
                        tick: currentTick,
                        zone_tax_bps: ZONE_TAX_BPS[parcel.zoneId as keyof typeof ZONE_TAX_BPS],
                    });
                }
            }
        }

        return reply.code(200).send({
            settled: true,
            seller_payout_bios: settleResult.sellerPayout.toString(),
            irs_fee_bios: settleResult.irsFee.toString(),
        });
    });

    // ── POST /api/v1/market/listing/:id/dispute (civic_did_required) ───────────
    // D-44-04: DB transaction happens BEFORE audit event emission.
    // T-44-04-03: only buyer or seller of escrow may dispute.
    app.post<{ Params: { id: string } }>(
        '/api/v1/market/listing/:id/dispute', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!pool || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });
        if (!UUID_RE.test(req.params.id)) return reply.code(400).send({ error: 'invalid_listing_id' });

        // T-44-04-03: verify caller is buyer or seller of the escrow BEFORE dispute()
        const [escrowRows] = await pool.query<RowDataPacket[]>(
            `SELECT buyer_civic_did, seller_civic_did FROM marketplace_escrow
             WHERE listing_id = ? AND escrow_status = 'held'`,
            [req.params.id],
        );
        if (!escrowRows[0]) return reply.code(404).send({ error: 'escrow_not_found' });
        const escrow = escrowRows[0];
        if (escrow.buyer_civic_did !== civicDid && escrow.seller_civic_did !== civicDid) {
            return reply.code(403).send({ error: 'not_party' });
        }

        const currentTick = tickFn();
        const store = new MarketplaceStore(pool);
        let disputeId: string;
        let buyerCivicDid: string;
        try {
            ({ disputeId, buyerCivicDid } = await store.dispute({
                gridName: services.gridName,
                listingId: req.params.id,
                complainantCivicDid: civicDid,
                currentTick,
            }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'escrow_not_found') return reply.code(404).send({ error: 'escrow_not_found' });
            if (msg === 'escrow_not_disputable') return reply.code(409).send({ error: 'escrow_not_disputable' });
            req.log.error({ err: msg }, 'dispute_unhandled');
            return reply.code(500).send({ error: 'internal' });
        }

        // Insert police investigation row directly (T-44-04-08: no SSRF — direct DB insert).
        const investigationId = randomUUID();
        await pool.query(
            `INSERT INTO police_investigations
                (investigation_id, grid_name, source_type, source_ref, status, opened_at_tick)
             VALUES (?, ?, 'marketplace_dispute', ?, 'pending', ?)`,
            [investigationId, services.gridName, disputeId, currentTick],
        );

        // Emit market.disputed AFTER DB writes (Pitfall 4).
        appendMarketDisputed(audit, {
            complainant_civic_did_hash: sha256Hex(civicDid),
            dispute_id: disputeId,
            listing_id: req.params.id,
            tick: currentTick,
        });
        return reply.code(200).send({ dispute_id: disputeId, investigation_id: investigationId });
    });

    // ── POST /api/v1/police/investigate (civic_did_required — D-44-05 stub) ─────
    // Accepts marketplace disputes; inserts police_investigations row; returns 201 {investigation_id}.
    // Phase 47 activates full investigation logic.
    app.post<{ Body: { source_type?: unknown; source_ref?: unknown } }>(
        '/api/v1/police/investigate', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        if (!pool || !tickFn) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });

        const body = req.body ?? {};
        const { source_type, source_ref } = body;
        if (source_type !== 'marketplace_dispute') {
            return reply.code(400).send({ error: 'invalid_source' });
        }
        if (typeof source_ref !== 'string' || !UUID_RE.test(source_ref)) {
            return reply.code(400).send({ error: 'invalid_source' });
        }

        const investigationId = randomUUID();
        const tick = tickFn();
        await pool.query(
            `INSERT INTO police_investigations
                (investigation_id, grid_name, source_type, source_ref, status, opened_at_tick)
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [investigationId, services.gridName, source_type, source_ref, tick],
        );
        return reply.code(201).send({ investigation_id: investigationId });
    });
}
