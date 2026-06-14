/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the treasury.structure_revenue sole producer
 * (D-60-09.3 / R-60-06/11). Allowlist position 98.
 *
 * describe.skip: grid/src/audit/append-treasury-structure-revenue.ts lands in Wave 4 (clones
 * the append-treasury-parcel-revenue triad — #83 land attribution). Deferred dynamic import
 * (Phase 58/59 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Closed 4-tuple {amount_bios, parcel_id, tick, zone_tax_bps}:
 *   - amount_bios positive int (the skimmed zone tax); zone_tax_bps positive int;
 *   - parcel_id PARCEL_ID_RE; tick non-negative int;
 *   - actorDid = parcel_id (mirrors treasury.parcel_revenue #83 — NO buyer/seller DID on chain);
 *   - a 5th key throws (closed tuple); no FORBIDDEN_KEY_PATTERN key.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-treasury-structure-revenue.js');
const loadChain = () => import('../../src/audit/chain.js');

const PARCEL = 'genesis:shopping:0001';
const valid = { amount_bios: 100, parcel_id: PARCEL, tick: 7, zone_tax_bps: 1000 };

describe.skip('Phase 60 — appendTreasuryStructureRevenue sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the parcel_id as actor (NO buyer/seller DID — mirrors #83)', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendTreasuryStructureRevenue(new AuditChain(), valid);
        expect(entry.eventType).toBe('treasury.structure_revenue');
        expect(entry.actorDid).toBe(PARCEL);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {amount_bios, parcel_id, tick, zone_tax_bps}', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendTreasuryStructureRevenue(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['amount_bios', 'parcel_id', 'tick', 'zone_tax_bps']);
    });

    it('rejects a non-positive amount_bios', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryStructureRevenue(new AuditChain(), { ...valid, amount_bios: 0 }))
            .toThrow(/amount_bios/);
    });

    it('rejects a non-positive zone_tax_bps', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryStructureRevenue(new AuditChain(), { ...valid, zone_tax_bps: 0 }))
            .toThrow(/zone_tax_bps/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryStructureRevenue(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryStructureRevenue(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed-tuple)', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key (buyer/seller DID must NEVER be on this payload)
        expect(() => appendTreasuryStructureRevenue(new AuditChain(), { ...valid, buyer_civic_did_hash: 'a'.repeat(64) }))
            .toThrow(/closed-tuple/);
    });

    it('carries no raw DID and no FORBIDDEN_KEY_PATTERN key (privacy walker)', async () => {
        const { appendTreasuryStructureRevenue } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendTreasuryStructureRevenue(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/name|content|body|text/i);
    });
});
