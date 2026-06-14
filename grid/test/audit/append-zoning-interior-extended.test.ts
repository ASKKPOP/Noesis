/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the zoning.interior_extended sole producer
 * (D-59-01.1 / D-59-08 / R-59-04/09). Allowlist position 92.
 *
 * describe.skip: grid/src/audit/append-zoning-interior-extended.ts lands in Wave 4
 * (clones the append-treasury-parcel-revenue triad). Deferred dynamic import (Phase 58
 * Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Closed 4-tuple {object_class, object_kind, parcel_id, tick}:
 *   - object_class ∈ {'mirror','functional'}; object_kind ∈ furniture catalog;
 *   - parcel_id PARCEL_ID_RE; tick non-negative int; actorDid = parcel_id.
 *   - NO interior name/state key; no FORBIDDEN_KEY_PATTERN key; a 5th key throws (closed tuple).
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-zoning-interior-extended.js');
const loadChain = () => import('../../src/audit/chain.js');

const PARCEL = 'genesis:residential:0001';
const valid = { object_class: 'mirror' as const, object_kind: 'bed', parcel_id: PARCEL, tick: 7 };

describe.skip('Phase 59 — appendZoningInteriorExtended sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the parcel_id as actor (object owner already audited via #84)', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningInteriorExtended(new AuditChain(), valid);
        expect(entry.eventType).toBe('zoning.interior_extended');
        expect(entry.actorDid).toBe(PARCEL);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {object_class, object_kind, parcel_id, tick}', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningInteriorExtended(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['object_class', 'object_kind', 'parcel_id', 'tick']);
    });

    it('rejects an object_class outside {mirror, functional}', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningInteriorExtended(new AuditChain(), { ...valid, object_class: 'throne' as never }))
            .toThrow(/object_class/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningInteriorExtended(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningInteriorExtended(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed-tuple)', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningInteriorExtended(new AuditChain(), { ...valid, area_name: 'bedroom' }))
            .toThrow(/closed-tuple/);
    });

    it('carries NO interior name/state/tree key and no FORBIDDEN_KEY_PATTERN key (D-59-08 privacy)', async () => {
        const { appendZoningInteriorExtended } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningInteriorExtended(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toMatch(/state|areas|name|content|body|text/i);
    });
});
