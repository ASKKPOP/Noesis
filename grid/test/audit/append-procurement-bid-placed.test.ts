/**
 * L2b D-MONEY-08 — appendProcurementBidPlaced emitter unit tests.
 * Verifies closed 5-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProcurementBidPlaced } from '../../src/audit/append-procurement-bid-placed.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'c'.repeat(64);
const BID_ID = '22345678-1234-1234-1234-123456789abc';
const NOTICE_ID = '12345678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        bid_id: BID_ID,
        bidder_did_hash: HASH,
        notice_id: NOTICE_ID,
        price_wei: '4000',
        tick: 5,
    };
}

describe('appendProcurementBidPlaced — emitter', () => {
    it('emits procurement.bid_placed with a closed 5-key payload', () => {
        const chain = new AuditChain();
        const entry = appendProcurementBidPlaced(chain, validPayload());
        expect(entry.eventType).toBe('procurement.bid_placed');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('procurement.bid_placed is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('procurement.bid_placed')).toBe(true);
    });

    it('rejects bad bidder_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementBidPlaced(chain, { ...validPayload(), bidder_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad bid_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementBidPlaced(chain, { ...validPayload(), bid_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects bad notice_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementBidPlaced(chain, { ...validPayload(), notice_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects price_wei with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementBidPlaced(chain, { ...validPayload(), price_wei: '4000n' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementBidPlaced(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendProcurementBidPlaced(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { price_wei: _omit, ...noPrice } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendProcurementBidPlaced(chain, noPrice))
            .toThrow(TypeError);
    });
});
