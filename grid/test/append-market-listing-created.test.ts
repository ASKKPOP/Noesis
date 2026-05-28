/**
 * Phase 44 MKT-06 — append-market-listing-created sole-producer test stub.
 *
 * Event: market.listing_created
 * Keys (alphabetical): category, listing_id, price_bios, seller_business_did_hash, tick
 * Sole producer: grid/src/audit/append-market-listing-created.ts (Plan 03 creates)
 *
 * Wave 0 stub: skipped until Plan 03 implementation lands.
 * Plan 03 will remove `.skip` to un-skip these tests when the producer files exist.
 * At that point, also add:
 *   import { appendMarketListingCreated, type MarketListingCreatedPayload }
 *       from '../src/audit/append-market-listing-created.js';
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Wave 0 stub: skipped until Plan 03 implementation lands.
describe.skip('appendMarketListingCreated — 9-step guard discipline (market.listing_created)', () => {
    // Plan 03 un-skips this block and populates these via dynamic import.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appendMarketListingCreated: (audit: any, payload: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAudit: () => any;

    beforeAll(async () => {
        const mod = await import('../src/audit/append-market-listing-created.js');
        appendMarketListingCreated = mod.appendMarketListingCreated;
        mockAudit = () => {
            const entry = { id: 1n, tick: 0, event_type: 'market.listing_created', actor_did: 'x', payload: {}, prev_hash: '', this_hash: '' };
            return { append: vi.fn(() => entry) };
        };
    });

    const validPayload = {
        category: 'tools',
        listing_id: '550e8400-e29b-41d4-a716-446655440000',
        price_bios: 100,
        seller_business_did_hash: 'a'.repeat(64),
        tick: 1,
    };

    it('rejects non-object payload', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, null)).toThrow(TypeError);
        expect(() => appendMarketListingCreated(audit, [])).toThrow(TypeError);
    });

    it('rejects payload with extra key (closed-tuple violation)', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, extra: 'oops' })).toThrow(/closed-tuple/i);
    });

    it('rejects payload with missing key (closed-tuple violation)', () => {
        const audit = mockAudit();
        const { tick: _omit, ...partial } = validPayload;
        expect(() => appendMarketListingCreated(audit, partial)).toThrow(TypeError);
    });

    it('rejects invalid UUID for listing_id', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, listing_id: 'not-a-uuid' })).toThrow(/listing_id/i);
    });

    it('rejects invalid hex64 for seller_business_did_hash', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, seller_business_did_hash: 'short' })).toThrow(/seller_business_did_hash/i);
    });

    it('rejects empty category', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, category: '' })).toThrow(/category/i);
    });

    it('rejects non-positive price_bios', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, price_bios: 0 })).toThrow(/price_bios/i);
        expect(() => appendMarketListingCreated(audit, { ...validPayload, price_bios: -1 })).toThrow(/price_bios/i);
    });

    it('rejects negative tick', () => {
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, tick: -1 })).toThrow(/tick/i);
    });

    it('rejects payload with description key (closed-tuple or privacy violation — D-44 Pitfall 3)', () => {
        // description matches FORBIDDEN_KEY_PATTERN AND is an extra closed-tuple key.
        // The closed-tuple gate fires before the privacy gate, so either message matches.
        const audit = mockAudit();
        expect(() => appendMarketListingCreated(audit, { ...validPayload, description: 'leak' })).toThrow(/closed-tuple|description|privacy/i);
    });

    it('appends valid payload to chain with event_type "market.listing_created"', () => {
        const audit = mockAudit();
        const result = appendMarketListingCreated(audit, validPayload);
        expect(audit.append).toHaveBeenCalledWith(
            'market.listing_created',
            validPayload.seller_business_did_hash,
            expect.objectContaining(validPayload),
        );
        expect(result).toBeDefined();
    });

    it('payload reaches chain.append with exactly the closed tuple (alphabetical keys)', () => {
        const audit = mockAudit();
        appendMarketListingCreated(audit, validPayload);
        const EXPECTED_KEYS = ['category', 'listing_id', 'price_bios', 'seller_business_did_hash', 'tick'];
        const passedPayload = audit.append.mock.calls[0][2] as Record<string, unknown>;
        expect(Object.keys(passedPayload).sort()).toEqual(EXPECTED_KEYS);
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = mockAudit();
        expect(appendMarketListingCreated(audit, { ...validPayload, tick: 0 })).toBeDefined();
    });
});
