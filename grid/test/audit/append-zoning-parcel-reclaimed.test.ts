/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the zoning.parcel_reclaimed sole producer
 * (D-59-01.3 / D-59-07/09 / R-59-07/09). Allowlist position 94.
 *
 * describe.skip: grid/src/audit/append-zoning-parcel-reclaimed.ts lands in Wave 4.
 * Deferred dynamic import (Phase 58 Wave-0 pattern).
 *
 * Closed 4-tuple {former_owner_civic_did_hash, parcel_id, reason, tick}:
 *   - former_owner_civic_did_hash HEX64; parcel_id PARCEL_ID_RE;
 *   - reason ∈ {'upkeep_default'}; tick non-negative int; actorDid = parcel_id
 *     (the land returns to the treasury).
 *   - closed-tuple + privacy assertions.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-zoning-parcel-reclaimed.js');
const loadChain = () => import('../../src/audit/chain.js');

const HEX64 = 'a'.repeat(64);
const PARCEL = 'genesis:residential:0001';
const valid = { former_owner_civic_did_hash: HEX64, parcel_id: PARCEL, reason: 'upkeep_default' as const, tick: 30240 };

describe.skip('Phase 59 — appendZoningParcelReclaimed sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the parcel_id as actor (land returns to treasury)', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningParcelReclaimed(new AuditChain(), valid);
        expect(entry.eventType).toBe('zoning.parcel_reclaimed');
        expect(entry.actorDid).toBe(PARCEL);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {former_owner_civic_did_hash, parcel_id, reason, tick}', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningParcelReclaimed(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['former_owner_civic_did_hash', 'parcel_id', 'reason', 'tick']);
    });

    it('reason is the closed enum {upkeep_default}', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningParcelReclaimed(new AuditChain(), valid);
        expect(entry.payload).toMatchObject({ reason: 'upkeep_default' });
    });

    it('rejects a reason outside {upkeep_default}', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningParcelReclaimed(new AuditChain(), { ...valid, reason: 'eviction' as never }))
            .toThrow(/reason/);
    });

    it('rejects a non-HEX64 former owner hash', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningParcelReclaimed(new AuditChain(), { ...valid, former_owner_civic_did_hash: 'nope' }))
            .toThrow(/HEX64/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningParcelReclaimed(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningParcelReclaimed(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed-tuple)', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningParcelReclaimed(new AuditChain(), { ...valid, condition: 'derelict' }))
            .toThrow(/closed-tuple/);
    });

    it('no raw owner DID and no FORBIDDEN_KEY_PATTERN key cross the boundary (privacy walker)', async () => {
        const { appendZoningParcelReclaimed } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningParcelReclaimed(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/content|body|text|prompt|response/i);
    });
});
