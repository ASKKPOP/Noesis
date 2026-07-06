/**
 * Phase 44 MKT-06 — append-market-settled sole-producer test stub.
 *
 * Event: market.settled
 * Keys (alphabetical): buyer_civic_did_hash, irs_fee_wei, listing_id, price_wei,
 *                      seller_business_did_hash, tick
 * Sole producer: grid/src/audit/append-market-settled.ts (Plan 03 creates)
 * Note: After emit, appendIrsTaxCollected fires audit-chain-only (NOT on allowlist until Phase 45).
 *
 * Wave 0 stub: skipped until Plan 03 implementation lands.
 * Plan 03 will remove `.skip` to un-skip these tests when the producer files exist.
 * At that point, also add:
 *   import { appendMarketSettled, type MarketSettledPayload }
 *       from '../src/audit/append-market-settled.js';
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Wave 0 stub: skipped until Plan 03 implementation lands.
describe('appendMarketSettled — 9-step guard discipline (market.settled)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appendMarketSettled: (audit: any, payload: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAudit: () => any;

    beforeAll(async () => {
        const mod = await import('../src/audit/append-market-settled.js');
        appendMarketSettled = mod.appendMarketSettled;
        mockAudit = () => {
            const entry = { id: 3n, tick: 0, event_type: 'market.settled', actor_did: 'x', payload: {}, prev_hash: '', this_hash: '' };
            return { append: vi.fn(() => entry) };
        };
    });

    const VALID_HEX64_A = 'a'.repeat(64);
    const VALID_HEX64_B = 'b'.repeat(64);
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

    const validPayload = {
        buyer_civic_did_hash: VALID_HEX64_A,
        irs_fee_wei: 2,
        listing_id: VALID_UUID,
        price_wei: 100,
        seller_business_did_hash: VALID_HEX64_B,
        tick: 10,
    };

    it('rejects non-object payload', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, null)).toThrow(TypeError);
        expect(() => appendMarketSettled(audit, [])).toThrow(TypeError);
    });

    it('rejects payload with extra key (closed-tuple violation)', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, extra: 'oops' })).toThrow(/closed-tuple/i);
    });

    it('rejects payload with missing key (closed-tuple violation)', () => {
        const audit = mockAudit();
        const { tick: _omit, ...partial } = validPayload;
        expect(() => appendMarketSettled(audit, partial)).toThrow(TypeError);
    });

    it('rejects invalid UUID for listing_id', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, listing_id: 'not-a-uuid' })).toThrow(/listing_id/i);
    });

    it('rejects invalid hex64 for buyer_civic_did_hash', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, buyer_civic_did_hash: 'short' })).toThrow(/buyer_civic_did_hash/i);
    });

    it('rejects invalid hex64 for seller_business_did_hash', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, seller_business_did_hash: 'short' })).toThrow(/seller_business_did_hash/i);
    });

    it('rejects non-positive price_wei', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, price_wei: 0 })).toThrow(/price_wei/i);
        expect(() => appendMarketSettled(audit, { ...validPayload, price_wei: -1 })).toThrow(/price_wei/i);
    });

    it('accepts irs_fee_wei=0 (valid: FLOOR(price * rate) may be 0 for tiny amounts)', () => {
        // irs_fee_wei is non-negative integer (0 is valid per D-44-02 FLOOR semantics)
        const audit = mockAudit();
        expect(appendMarketSettled(audit, { ...validPayload, irs_fee_wei: 0 })).toBeDefined();
    });

    it('rejects negative irs_fee_wei', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, irs_fee_wei: -1 })).toThrow(/irs_fee_wei/i);
    });

    it('rejects negative tick', () => {
        const audit = mockAudit();
        expect(() => appendMarketSettled(audit, { ...validPayload, tick: -1 })).toThrow(/tick/i);
    });

    it('appends valid payload to chain with event_type "market.settled" using buyer_civic_did_hash as actorDid', () => {
        const audit = mockAudit();
        const result = appendMarketSettled(audit, validPayload);
        expect(audit.append).toHaveBeenCalledWith(
            'market.settled',
            validPayload.buyer_civic_did_hash,
            expect.objectContaining(validPayload),
        );
        expect(result).toBeDefined();
    });

    it('payload reaches chain.append with exactly the closed tuple (alphabetical keys)', () => {
        const audit = mockAudit();
        appendMarketSettled(audit, validPayload);
        const EXPECTED_KEYS = ['buyer_civic_did_hash', 'irs_fee_wei', 'listing_id', 'price_wei', 'seller_business_did_hash', 'tick'];
        const passedPayload = audit.append.mock.calls[0][2] as Record<string, unknown>;
        expect(Object.keys(passedPayload).sort()).toEqual(EXPECTED_KEYS);
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = mockAudit();
        expect(appendMarketSettled(audit, { ...validPayload, tick: 0 })).toBeDefined();
    });
});
