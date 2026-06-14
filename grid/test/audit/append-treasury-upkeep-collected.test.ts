/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the treasury.upkeep_collected sole producer
 * (D-59-01.4 / D-59-09 / R-59-06/09). Allowlist position 95.
 *
 * describe.skip: grid/src/audit/append-treasury-upkeep-collected.ts lands in Wave 4
 * (clones the append-treasury-parcel-revenue triad; mirrors #83 land-attribution).
 * Deferred dynamic import (Phase 58 Wave-0 pattern).
 *
 * Closed 4-tuple {amount_bios, owner_civic_did_hash, parcel_id, tick}:
 *   - amount_bios positive int; owner_civic_did_hash HEX64; parcel_id PARCEL_ID_RE;
 *   - tick non-negative int; actorDid = parcel_id (mirrors treasury.parcel_revenue #83).
 *   - closed-tuple + privacy assertions.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-treasury-upkeep-collected.js');
const loadChain = () => import('../../src/audit/chain.js');

const HEX64 = 'a'.repeat(64);
const PARCEL = 'genesis:residential:0001';
const valid = { amount_bios: 8, owner_civic_did_hash: HEX64, parcel_id: PARCEL, tick: 10080 };

describe('Phase 59 — appendTreasuryUpkeepCollected sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the parcel_id as actor (mirrors #83 land-attribution)', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendTreasuryUpkeepCollected(new AuditChain(), valid);
        expect(entry.eventType).toBe('treasury.upkeep_collected');
        expect(entry.actorDid).toBe(PARCEL);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {amount_bios, owner_civic_did_hash, parcel_id, tick}', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendTreasuryUpkeepCollected(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['amount_bios', 'owner_civic_did_hash', 'parcel_id', 'tick']);
    });

    it('rejects a non-positive amount_bios', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryUpkeepCollected(new AuditChain(), { ...valid, amount_bios: 0 }))
            .toThrow(/amount_bios/);
    });

    it('rejects a non-HEX64 owner hash', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryUpkeepCollected(new AuditChain(), { ...valid, owner_civic_did_hash: 'nope' }))
            .toThrow(/HEX64/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryUpkeepCollected(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendTreasuryUpkeepCollected(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed-tuple)', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendTreasuryUpkeepCollected(new AuditChain(), { ...valid, condition: 'worn' }))
            .toThrow(/closed-tuple/);
    });

    it('no raw owner DID and no FORBIDDEN_KEY_PATTERN key cross the boundary (privacy walker)', async () => {
        const { appendTreasuryUpkeepCollected } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendTreasuryUpkeepCollected(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/content|body|text|prompt|response/i);
    });
});
