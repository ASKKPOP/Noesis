/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the zoning.condition_changed sole producer
 * (D-59-01.2 / D-59-07/09 / R-59-07/09). Allowlist position 93.
 *
 * describe.skip: grid/src/audit/append-zoning-condition-changed.ts lands in Wave 4.
 * Deferred dynamic import (Phase 58 Wave-0 pattern).
 *
 * Closed 4-tuple {condition, owner_civic_did_hash, parcel_id, tick}:
 *   - condition ∈ {'maintained','worn','derelict'}; owner_civic_did_hash HEX64;
 *   - parcel_id PARCEL_ID_RE; tick non-negative int; actorDid = owner_civic_did_hash.
 *   - closed-tuple + privacy assertions.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-zoning-condition-changed.js');
const loadChain = () => import('../../src/audit/chain.js');

const HEX64 = 'a'.repeat(64);
const PARCEL = 'genesis:residential:0001';
const valid = { condition: 'worn' as const, owner_civic_did_hash: HEX64, parcel_id: PARCEL, tick: 10080 };

describe.skip('Phase 59 — appendZoningConditionChanged sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the owner hash as actor', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningConditionChanged(new AuditChain(), valid);
        expect(entry.eventType).toBe('zoning.condition_changed');
        expect(entry.actorDid).toBe(HEX64);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {condition, owner_civic_did_hash, parcel_id, tick}', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningConditionChanged(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['condition', 'owner_civic_did_hash', 'parcel_id', 'tick']);
    });

    it('accepts each condition in {maintained, worn, derelict}', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        for (const condition of ['maintained', 'worn', 'derelict'] as const) {
            const entry = appendZoningConditionChanged(new AuditChain(), { ...valid, condition });
            expect(entry.payload).toMatchObject({ condition });
        }
    });

    it('rejects a condition outside the enum (e.g. reclaimed is NOT a chain condition)', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningConditionChanged(new AuditChain(), { ...valid, condition: 'reclaimed' as never }))
            .toThrow(/condition/);
    });

    it('rejects a non-HEX64 owner hash', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningConditionChanged(new AuditChain(), { ...valid, owner_civic_did_hash: 'nope' }))
            .toThrow(/HEX64/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningConditionChanged(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningConditionChanged(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed-tuple)', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningConditionChanged(new AuditChain(), { ...valid, reason: 'x' }))
            .toThrow(/closed-tuple/);
    });

    it('no raw owner DID and no FORBIDDEN_KEY_PATTERN key cross the boundary (privacy walker)', async () => {
        const { appendZoningConditionChanged } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningConditionChanged(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/content|body|text|prompt|response/i);
    });
});
