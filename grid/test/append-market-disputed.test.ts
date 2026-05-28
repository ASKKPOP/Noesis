/**
 * Phase 44 MKT-06 — append-market-disputed sole-producer test stub.
 *
 * Event: market.disputed
 * Keys (alphabetical): complainant_civic_did_hash, dispute_id, listing_id, tick
 * Sole producer: grid/src/audit/append-market-disputed.ts (Plan 03 creates)
 *
 * Wave 0 stub: skipped until Plan 03 implementation lands.
 * Plan 03 will remove `.skip` to un-skip these tests when the producer files exist.
 * At that point, also add:
 *   import { appendMarketDisputed, type MarketDisputedPayload }
 *       from '../src/audit/append-market-disputed.js';
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Wave 0 stub: skipped until Plan 03 implementation lands.
describe.skip('appendMarketDisputed — 9-step guard discipline (market.disputed)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appendMarketDisputed: (audit: any, payload: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAudit: () => any;

    beforeAll(async () => {
        const mod = await import('../src/audit/append-market-disputed.js');
        appendMarketDisputed = mod.appendMarketDisputed;
        mockAudit = () => {
            const entry = { id: 4n, tick: 0, event_type: 'market.disputed', actor_did: 'x', payload: {}, prev_hash: '', this_hash: '' };
            return { append: vi.fn(() => entry) };
        };
    });

    const VALID_HEX64 = 'c'.repeat(64);
    const VALID_UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const VALID_UUID_B = '660e8400-e29b-41d4-a716-446655440001';

    const validPayload = {
        complainant_civic_did_hash: VALID_HEX64,
        dispute_id: VALID_UUID_A,
        listing_id: VALID_UUID_B,
        tick: 15,
    };

    it('rejects non-object payload', () => {
        const audit = mockAudit();
        expect(() => appendMarketDisputed(audit, null)).toThrow(TypeError);
        expect(() => appendMarketDisputed(audit, [])).toThrow(TypeError);
    });

    it('rejects payload with extra key (closed-tuple violation)', () => {
        const audit = mockAudit();
        expect(() => appendMarketDisputed(audit, { ...validPayload, extra: 'oops' })).toThrow(/closed-tuple/i);
    });

    it('rejects payload with missing key (closed-tuple violation)', () => {
        const audit = mockAudit();
        const { tick: _omit, ...partial } = validPayload;
        expect(() => appendMarketDisputed(audit, partial)).toThrow(TypeError);
    });

    it('rejects invalid UUID for dispute_id', () => {
        const audit = mockAudit();
        expect(() => appendMarketDisputed(audit, { ...validPayload, dispute_id: 'not-a-uuid' })).toThrow(/dispute_id/i);
    });

    it('rejects invalid UUID for listing_id', () => {
        const audit = mockAudit();
        expect(() => appendMarketDisputed(audit, { ...validPayload, listing_id: 'not-a-uuid' })).toThrow(/listing_id/i);
    });

    it('rejects invalid hex64 for complainant_civic_did_hash', () => {
        const audit = mockAudit();
        expect(() => appendMarketDisputed(audit, { ...validPayload, complainant_civic_did_hash: 'short' })).toThrow(/complainant_civic_did_hash/i);
    });

    it('rejects negative tick', () => {
        const audit = mockAudit();
        expect(() => appendMarketDisputed(audit, { ...validPayload, tick: -1 })).toThrow(/tick/i);
    });

    it('appends valid payload to chain with event_type "market.disputed" using complainant_civic_did_hash as actorDid', () => {
        const audit = mockAudit();
        const result = appendMarketDisputed(audit, validPayload);
        expect(audit.append).toHaveBeenCalledWith(
            'market.disputed',
            validPayload.complainant_civic_did_hash,
            expect.objectContaining(validPayload),
        );
        expect(result).toBeDefined();
    });

    it('payload reaches chain.append with exactly the closed tuple (alphabetical keys)', () => {
        const audit = mockAudit();
        appendMarketDisputed(audit, validPayload);
        const EXPECTED_KEYS = ['complainant_civic_did_hash', 'dispute_id', 'listing_id', 'tick'];
        const passedPayload = audit.append.mock.calls[0][2] as Record<string, unknown>;
        expect(Object.keys(passedPayload).sort()).toEqual(EXPECTED_KEYS);
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = mockAudit();
        expect(appendMarketDisputed(audit, { ...validPayload, tick: 0 })).toBeDefined();
    });
});
