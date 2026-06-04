/**
 * Phase 45 (IRS-03) — append-irs-disbursement-authorized sole-producer test.
 *
 * Event: irs.disbursement_authorized (broadcast allowlist position 74; added in Plan 02)
 * Closed 5-key payload (alphabetical):
 *   amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick
 * Sole producer: grid/src/audit/append-irs-disbursement-authorized.ts
 *
 * RED state during Wave 0: import fails because the producer module does not exist.
 * Plan 02 creates the producer → tests turn GREEN.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('appendIrsDisbursementAuthorized — 9-step guard discipline', () => {
    let appendIrsDisbursementAuthorized: (audit: unknown, payload: unknown) => unknown;
    let mockAudit: () => { append: ReturnType<typeof vi.fn> };

    beforeAll(async () => {
        // Dynamic import inside beforeAll so the test FILE loads even if the module is missing.
        const mod = await import('../src/audit/append-irs-disbursement-authorized.js');
        appendIrsDisbursementAuthorized = (mod as { appendIrsDisbursementAuthorized: typeof appendIrsDisbursementAuthorized }).appendIrsDisbursementAuthorized;
        mockAudit = () => ({
            append: vi.fn(() => ({
                id: 5n,
                tick: 0,
                event_type: 'irs.disbursement_authorized',
                actor_did: 'x',
                payload: {},
                prev_hash: '',
                this_hash: '',
            })),
        });
    });

    const VALID_HEX64 = 'd'.repeat(64);
    const VALID_LEG_HASH = 'a'.repeat(64);

    const validPayload = () => ({
        amount_bios: 500,
        authorized_by_civic_did_hash: VALID_HEX64,
        grid_name: 'Genesis',
        legislation_ref_hash: VALID_LEG_HASH,
        tick: 42,
    });

    it('accepts valid 5-key payload and calls audit.append with event_type and actorDid', () => {
        const audit = mockAudit();
        appendIrsDisbursementAuthorized(audit, validPayload());
        expect(audit.append).toHaveBeenCalledTimes(1);
        expect(audit.append.mock.calls[0][0]).toBe('irs.disbursement_authorized');
        expect(audit.append.mock.calls[0][1]).toBe(VALID_HEX64); // actorDid = authorized_by_civic_did_hash
    });

    it('rejects non-object payload (TypeError)', () => {
        const audit = mockAudit();
        expect(() => appendIrsDisbursementAuthorized(audit, null)).toThrow(TypeError);
        expect(() => appendIrsDisbursementAuthorized(audit, 'x')).toThrow(TypeError);
        expect(() => appendIrsDisbursementAuthorized(audit, [])).toThrow(TypeError);
    });

    it('rejects invalid HEX64 for authorized_by_civic_did_hash', () => {
        const audit = mockAudit();
        const p = validPayload();
        p.authorized_by_civic_did_hash = 'not-hex';
        expect(() => appendIrsDisbursementAuthorized(audit, p)).toThrow(/authorized_by_civic_did_hash/);
    });

    it('rejects invalid HEX64 for legislation_ref_hash', () => {
        const audit = mockAudit();
        const p = validPayload();
        p.legislation_ref_hash = 'short';
        expect(() => appendIrsDisbursementAuthorized(audit, p)).toThrow(/legislation_ref_hash/);
    });

    it('rejects empty grid_name', () => {
        const audit = mockAudit();
        const p = validPayload();
        p.grid_name = '';
        expect(() => appendIrsDisbursementAuthorized(audit, p)).toThrow(/grid_name/);
    });

    it('rejects non-positive amount_bios (0 and -1)', () => {
        const audit = mockAudit();
        const p0 = { ...validPayload(), amount_bios: 0 };
        const pNeg = { ...validPayload(), amount_bios: -1 };
        expect(() => appendIrsDisbursementAuthorized(audit, p0)).toThrow(/amount_bios/);
        expect(() => appendIrsDisbursementAuthorized(audit, pNeg)).toThrow(/amount_bios/);
    });

    it('rejects negative tick; accepts tick=0 (boundary)', () => {
        const audit = mockAudit();
        const pNeg = { ...validPayload(), tick: -1 };
        expect(() => appendIrsDisbursementAuthorized(audit, pNeg)).toThrow(/tick/);
        const p0 = { ...validPayload(), tick: 0 };
        expect(() => appendIrsDisbursementAuthorized(audit, p0)).not.toThrow();
    });

    it('rejects extra key (closed-tuple violation)', () => {
        const audit = mockAudit();
        const p = { ...validPayload(), extra: 'nope' };
        expect(() => appendIrsDisbursementAuthorized(audit, p)).toThrow(/closed-tuple/);
    });

    it('rejects missing key (closed-tuple violation)', () => {
        // Per the codebase convention (see append-irs-tax-collected.test.ts): a missing
        // *validated* key trips its per-field guard before the closed-tuple check, so the
        // contract is a generic TypeError, not specifically a /closed-tuple/ message.
        const audit = mockAudit();
        const p = { ...validPayload() } as Record<string, unknown>;
        delete p.tick;
        expect(() => appendIrsDisbursementAuthorized(audit, p)).toThrow(TypeError);
    });

    it('audit.append receives explicit reconstruction (alphabetical) — no extra keys leak through', () => {
        const audit = mockAudit();
        appendIrsDisbursementAuthorized(audit, validPayload());
        const sentPayload = audit.append.mock.calls[0][2] as Record<string, unknown>;
        expect(Object.keys(sentPayload).sort()).toEqual([
            'amount_bios',
            'authorized_by_civic_did_hash',
            'grid_name',
            'legislation_ref_hash',
            'tick',
        ]);
    });
});
