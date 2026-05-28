/**
 * Phase 44 D-44-03 — append-irs-tax-collected sole-producer test stub.
 *
 * Event: irs.tax_collected (audit-chain-only — NOT on broadcast allowlist in Phase 44)
 * Keys (alphabetical): amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after
 * Sole producer: grid/src/audit/append-irs-tax-collected.ts (Plan 03 creates)
 *
 * IMPORTANT: irs.tax_collected is intentionally NOT in ALLOWLIST_MEMBERS in Phase 44.
 * It is audit-chain-only until Phase 45 adds it (+3 allowlist delta: tax_collected,
 * disbursement_authorized, disbursement_executed). This mirrors the Phase 41
 * append-irs-disbursement-executed.ts pattern.
 *
 * Wave 0 stub: skipped until Plan 03 implementation lands.
 * Plan 03 will remove `.skip` to un-skip these tests when the producer files exist.
 * At that point, also add:
 *   import { appendIrsTaxCollected, type IrsTaxCollectedPayload }
 *       from '../src/audit/append-irs-tax-collected.js';
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Wave 0 stub: skipped until Plan 03 implementation lands.
describe('appendIrsTaxCollected — 9-step guard discipline (irs.tax_collected, audit-chain-only)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let appendIrsTaxCollected: (audit: any, payload: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAudit: () => any;

    beforeAll(async () => {
        const mod = await import('../src/audit/append-irs-tax-collected.js');
        appendIrsTaxCollected = mod.appendIrsTaxCollected;
        mockAudit = () => {
            const entry = { id: 5n, tick: 0, event_type: 'irs.tax_collected', actor_did: 'x', payload: {}, prev_hash: '', this_hash: '' };
            return { append: vi.fn(() => entry) };
        };
    });

    const VALID_HEX64 = 'd'.repeat(64);
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

    const validPayload = {
        amount_bios: 2,
        listing_id: VALID_UUID,
        payer_civic_did_hash: VALID_HEX64,
        tick: 10,
        total_treasury_after: 1002,
    };

    it('rejects non-object payload', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, null)).toThrow(TypeError);
        expect(() => appendIrsTaxCollected(audit, [])).toThrow(TypeError);
    });

    it('rejects payload with extra key (closed-tuple violation)', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, extra: 'oops' })).toThrow(/closed-tuple/i);
    });

    it('rejects payload with missing key (closed-tuple violation)', () => {
        const audit = mockAudit();
        const { tick: _omit, ...partial } = validPayload;
        expect(() => appendIrsTaxCollected(audit, partial)).toThrow(TypeError);
    });

    it('rejects invalid UUID for listing_id', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, listing_id: 'not-a-uuid' })).toThrow(/listing_id/i);
    });

    it('rejects invalid hex64 for payer_civic_did_hash', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, payer_civic_did_hash: 'short' })).toThrow(/payer_civic_did_hash/i);
    });

    it('rejects non-positive amount_bios', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, amount_bios: 0 })).toThrow(/amount_bios/i);
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, amount_bios: -1 })).toThrow(/amount_bios/i);
    });

    it('accepts total_treasury_after=0 (valid: treasury may start empty)', () => {
        // total_treasury_after is non-negative integer (0 is valid)
        const audit = mockAudit();
        expect(appendIrsTaxCollected(audit, { ...validPayload, total_treasury_after: 0 })).toBeDefined();
    });

    it('rejects negative total_treasury_after', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, total_treasury_after: -1 })).toThrow(/total_treasury_after/i);
    });

    it('rejects negative tick', () => {
        const audit = mockAudit();
        expect(() => appendIrsTaxCollected(audit, { ...validPayload, tick: -1 })).toThrow(/tick/i);
    });

    it('calls audit.append with event_type "irs.tax_collected" (audit-chain-only — D-44-03)', () => {
        // Verifies the event NAME is correct.
        // This stub does NOT assert allowlist presence — that is broadcast-allowlist.test.ts job.
        const audit = mockAudit();
        const result = appendIrsTaxCollected(audit, validPayload);
        expect(audit.append).toHaveBeenCalledWith(
            'irs.tax_collected',
            validPayload.payer_civic_did_hash,
            expect.objectContaining(validPayload),
        );
        expect(result).toBeDefined();
    });

    it('payload reaches chain.append with exactly the closed tuple (alphabetical keys)', () => {
        const audit = mockAudit();
        appendIrsTaxCollected(audit, validPayload);
        const EXPECTED_KEYS = ['amount_bios', 'listing_id', 'payer_civic_did_hash', 'tick', 'total_treasury_after'];
        const passedPayload = audit.append.mock.calls[0][2] as Record<string, unknown>;
        expect(Object.keys(passedPayload).sort()).toEqual(EXPECTED_KEYS);
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = mockAudit();
        expect(appendIrsTaxCollected(audit, { ...validPayload, tick: 0 })).toBeDefined();
    });
});
