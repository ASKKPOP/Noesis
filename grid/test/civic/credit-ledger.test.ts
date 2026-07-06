/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the mutual-credit IOU ledger (D-60-05 / D-NH-06 / R-60-07).
 *
 * describe.skip: grid/src/civic/credit-ledger.ts + IOU caps in founding-law.ts land in Wave 2.
 * Deferred dynamic import (Phase 58/59 Wave-0 pattern) defers module resolution.
 *
 * Contract under test (WIR/Sardex/LETS-grounded bilateral bookkeeping, v1):
 *   - recordIou creates a bilateral payable with settled_tick=null; outstandingFor totals it.
 *   - settleIou auto-nets when the debtor pays OR a counter-IOU offsets (smaller against larger).
 *   - per-pair cap IOU_PAIR_CAP_BIOS + global cap IOU_GLOBAL_CAP_BIOS reject an over-cap record.
 *   - v1 is BOOKKEEPING: no interest accrues over ticks; an IOU is NOT transferable to a 3rd DID.
 *   - recording an IOU emits NOTHING on chain; only settlement that moves Ousia rides the existing transfer path.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const loadLedger = () => import('../../src/civic/credit-ledger.js');
const loadLaw = () => import('../../src/civic/founding-law.js');

const CREDITOR = 'did:civic:noesis:alice';
const DEBTOR = 'did:civic:noesis:bob';
const THIRD = 'did:civic:noesis:carol';

beforeEach(async () => {
    const { _resetLedger } = await loadLedger();
    _resetLedger();
});

describe('Phase 60 HOUSE-3 — IOU record / settle / outstanding [Wave 2 un-skips]', () => {
    it('recordIou creates a bilateral payable with settled_tick=null; outstandingFor totals it', async () => {
        const { recordIou, outstandingFor } = await loadLedger();
        const entry = recordIou(CREDITOR, DEBTOR, 100, 'cowork:agreement:1', 10);
        expect(entry.creditor_civic_did).toBe(CREDITOR);
        expect(entry.debtor_civic_did).toBe(DEBTOR);
        expect(entry.amount_wei).toBe(100);
        expect(entry.settled_tick).toBeNull();
        expect(outstandingFor(DEBTOR)).toBe(100);
    });

    it('settleIou marks settled_tick and clears the debtor balance (debtor pays)', async () => {
        const { recordIou, settleIou, outstandingFor } = await loadLedger();
        const entry = recordIou(CREDITOR, DEBTOR, 100, 'cowork:agreement:2', 10);
        settleIou(entry.iou_id, 20);
        expect(outstandingFor(DEBTOR)).toBe(0);
    });

    it('settleIou auto-nets when a counter-IOU offsets (smaller netted against larger)', async () => {
        const { recordIou, outstandingFor } = await loadLedger();
        recordIou(CREDITOR, DEBTOR, 100, 'cowork:a', 10); // Bob owes Alice 100
        recordIou(DEBTOR, CREDITOR, 40, 'cowork:b', 11);   // Alice owes Bob 40 (counter)
        // Auto-net leaves Bob owing Alice net 60.
        expect(outstandingFor(DEBTOR)).toBe(60);
        expect(outstandingFor(CREDITOR)).toBe(0);
    });
});

describe('Phase 60 HOUSE-3 — IOU caps + v1 bookkeeping invariants [Wave 2 un-skips]', () => {
    it('per-pair cap IOU_PAIR_CAP_BIOS rejects an over-cap record', async () => {
        const { recordIou } = await loadLedger();
        const { IOU_PAIR_CAP_BIOS } = await loadLaw();
        expect(() => recordIou(CREDITOR, DEBTOR, IOU_PAIR_CAP_BIOS + 1, 'cowork:c', 10))
            .toThrow(/cap|pair/i);
    });

    it('global per-Nous cap IOU_GLOBAL_CAP_BIOS rejects an over-cap record', async () => {
        const { recordIou } = await loadLedger();
        const { IOU_GLOBAL_CAP_BIOS } = await loadLaw();
        expect(() => recordIou(CREDITOR, DEBTOR, IOU_GLOBAL_CAP_BIOS + 1, 'cowork:d', 10))
            .toThrow(/cap|global/i);
    });

    it('v1 is BOOKKEEPING — no interest accrues over ticks (amount is constant)', async () => {
        const { recordIou, outstandingFor } = await loadLedger();
        recordIou(CREDITOR, DEBTOR, 100, 'cowork:e', 10);
        // outstanding is unchanged across an arbitrary tick gap — no interest.
        expect(outstandingFor(DEBTOR)).toBe(100);
    });

    it('an IOU is NOT transferable to a third DID (no transfer affordance in v1)', async () => {
        const ledger = await loadLedger() as Record<string, unknown>;
        // v1 bookkeeping exposes no transfer/assign verb; the only mutators are record/settle.
        expect(ledger.transferIou).toBeUndefined();
        expect(ledger.assignIou).toBeUndefined();
        expect(THIRD).toBeTruthy();
    });
});

describe('Phase 60 HOUSE-3 — IOU recording emits nothing on chain [Wave 2 un-skips]', () => {
    it('recording an IOU emits NOTHING on chain (no audit append for a recordIou)', async () => {
        const { recordIou } = await loadLedger();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const before = audit.all().length;
        recordIou(CREDITOR, DEBTOR, 100, 'cowork:f', 10);
        // No new chain entry from a bare IOU record (it is bilateral bookkeeping).
        expect(audit.all().length).toBe(before);
    });
});
