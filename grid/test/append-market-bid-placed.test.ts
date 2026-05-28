/**
 * Phase 44 MKT-06 — append-market-bid-placed sole-producer test stub.
 *
 * Event: market.bid_placed
 * Keys (alphabetical): bidder_civic_did_hash, listing_id, offer_price_bios, tick
 * Sole producer: grid/src/audit/append-market-bid-placed.ts (Plan 03 creates)
 *
 * Wave 0 stub: skipped until Plan 03 implementation lands.
 * Plan 03 will remove `.skip` to un-skip these tests when the producer files exist.
 * At that point, also add:
 *   import { appendMarketBidPlaced, type MarketBidPlacedPayload }
 *       from '../src/audit/append-market-bid-placed.js';
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Wave 0 stub: skipped until Plan 03 implementation lands.
describe.skip('appendMarketBidPlaced — 9-step guard discipline (market.bid_placed)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appendMarketBidPlaced: (audit: any, payload: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAudit: () => any;

    beforeAll(async () => {
        const mod = await import('../src/audit/append-market-bid-placed.js');
        appendMarketBidPlaced = mod.appendMarketBidPlaced;
        mockAudit = () => {
            const entry = { id: 2n, tick: 0, event_type: 'market.bid_placed', actor_did: 'x', payload: {}, prev_hash: '', this_hash: '' };
            return { append: vi.fn(() => entry) };
        };
    });

    const VALID_HEX64 = 'a'.repeat(64);
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

    const validPayload = {
        bidder_civic_did_hash: VALID_HEX64,
        listing_id: VALID_UUID,
        offer_price_bios: 50,
        tick: 2,
    };

    it('rejects non-object payload', () => {
        const audit = mockAudit();
        expect(() => appendMarketBidPlaced(audit, null)).toThrow(TypeError);
        expect(() => appendMarketBidPlaced(audit, [])).toThrow(TypeError);
    });

    it('rejects payload with extra key (closed-tuple violation)', () => {
        const audit = mockAudit();
        expect(() => appendMarketBidPlaced(audit, { ...validPayload, extra: 'oops' })).toThrow(/closed-tuple/i);
    });

    it('rejects payload with missing key (closed-tuple violation)', () => {
        const audit = mockAudit();
        const { tick: _omit, ...partial } = validPayload;
        expect(() => appendMarketBidPlaced(audit, partial)).toThrow(TypeError);
    });

    it('rejects invalid UUID for listing_id', () => {
        const audit = mockAudit();
        expect(() => appendMarketBidPlaced(audit, { ...validPayload, listing_id: 'not-a-uuid' })).toThrow(/listing_id/i);
    });

    it('rejects invalid hex64 for bidder_civic_did_hash', () => {
        const audit = mockAudit();
        expect(() => appendMarketBidPlaced(audit, { ...validPayload, bidder_civic_did_hash: 'short' })).toThrow(/bidder_civic_did_hash/i);
    });

    it('rejects non-positive offer_price_bios', () => {
        const audit = mockAudit();
        expect(() => appendMarketBidPlaced(audit, { ...validPayload, offer_price_bios: 0 })).toThrow(/offer_price_bios/i);
        expect(() => appendMarketBidPlaced(audit, { ...validPayload, offer_price_bios: -1 })).toThrow(/offer_price_bios/i);
    });

    it('rejects negative tick', () => {
        const audit = mockAudit();
        expect(() => appendMarketBidPlaced(audit, { ...validPayload, tick: -1 })).toThrow(/tick/i);
    });

    it('appends valid payload to chain with event_type "market.bid_placed"', () => {
        const audit = mockAudit();
        const result = appendMarketBidPlaced(audit, validPayload);
        expect(audit.append).toHaveBeenCalledWith(
            'market.bid_placed',
            validPayload.bidder_civic_did_hash,
            expect.objectContaining(validPayload),
        );
        expect(result).toBeDefined();
    });

    it('payload reaches chain.append with exactly the closed tuple (alphabetical keys)', () => {
        const audit = mockAudit();
        appendMarketBidPlaced(audit, validPayload);
        const EXPECTED_KEYS = ['bidder_civic_did_hash', 'listing_id', 'offer_price_bios', 'tick'];
        const passedPayload = audit.append.mock.calls[0][2] as Record<string, unknown>;
        expect(Object.keys(passedPayload).sort()).toEqual(EXPECTED_KEYS);
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = mockAudit();
        expect(appendMarketBidPlaced(audit, { ...validPayload, tick: 0 })).toBeDefined();
    });
});
