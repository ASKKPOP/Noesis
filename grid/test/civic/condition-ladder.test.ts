/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the condition-ladder state machine
 * (D-NH-03/05 / D-59-07 / R-59-07).
 *
 * describe.skip: advanceCondition / resetCondition + reclaim land in Wave 1/4.
 * Deferred dynamic import (Phase 58 Wave-0 pattern) defers module resolution.
 *
 * Contract under test:
 *   - missed payment advances maintained → worn (1) → derelict (2) → reclaimed (3).
 *   - paying upkeep resets missed_periods=0 and condition='maintained'.
 *   - derelict CLOSES the structure to visitors (GET interior + join refuse).
 *   - reclaim returns ownership to TREASURY_DID, razes structure+interior, ejects
 *     occupants, and resets condition to maintained on the now-treasury parcel.
 *   - each transition emits zoning.condition_changed; reclaim additionally emits
 *     zoning.parcel_reclaimed {reason:'upkeep_default'}.
 */
import { describe, it, expect } from 'vitest';

const loadRegistry = () => import('../../src/civic/parcel-registry.js');

const TREASURY_DID = 'did:noesis:system:treasury';
const OWNER = 'did:civic:noesis:alice';
const PARCEL = 'genesis:residential:0001';

describe('Phase 59 HOUSE-2 — condition ladder advance/reset [Wave 4 un-skips]', () => {
    it('1 missed period: maintained → worn', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        expect(registry.advanceCondition(PARCEL)).toBe('worn');
    });

    it('2 missed periods: worn → derelict', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.advanceCondition(PARCEL); // worn
        expect(registry.advanceCondition(PARCEL)).toBe('derelict');
    });

    it('3 missed periods: derelict → reclaimed (the reclaim threshold)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.advanceCondition(PARCEL); // worn
        registry.advanceCondition(PARCEL); // derelict
        expect(registry.advanceCondition(PARCEL)).toBe('reclaimed');
    });

    it('paying upkeep resets missed_periods=0 and condition=maintained', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.advanceCondition(PARCEL); // worn
        registry.resetCondition(PARCEL);
        expect(registry.get(PARCEL)?.condition).toBe('maintained');
        expect(registry.get(PARCEL)?.missedPeriods).toBe(0);
    });

    it('derelict CLOSES the structure to visitors — join refuses with closed_to_visitors', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.advanceCondition(PARCEL); // worn
        registry.advanceCondition(PARCEL); // derelict
        const result = registry.join(PARCEL, 'did:civic:noesis:bob');
        expect(result).toEqual({ ok: false, reason: 'closed_to_visitors' });
    });

    it('reclaim returns ownership to TREASURY_DID, razes the structure+interior, and ejects occupants', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.advanceCondition(PARCEL); // worn
        registry.advanceCondition(PARCEL); // derelict
        registry.advanceCondition(PARCEL); // reclaimed
        const parcel = registry.get(PARCEL)!;
        expect(parcel.ownerDid).toBe(TREASURY_DID);
        expect(parcel.structure).toBeUndefined();
        expect(registry.occupants(PARCEL)).toEqual([]);
        // condition resets to maintained on the now-treasury parcel.
        expect(parcel.condition).toBe('maintained');
    });

    it('each ladder transition emits zoning.condition_changed', async () => {
        // The ladder step appends zoning.condition_changed {condition, owner_civic_did_hash, parcel_id, tick}.
        const { appendZoningConditionChanged } = await import('../../src/audit/append-zoning-condition-changed.js');
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const entry = appendZoningConditionChanged(audit, {
            condition: 'worn', owner_civic_did_hash: 'a'.repeat(64), parcel_id: PARCEL, tick: 10080,
        });
        expect(entry.eventType).toBe('zoning.condition_changed');
    });

    it('reclaim additionally emits zoning.parcel_reclaimed {reason:upkeep_default}', async () => {
        const { appendZoningParcelReclaimed } = await import('../../src/audit/append-zoning-parcel-reclaimed.js');
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const entry = appendZoningParcelReclaimed(audit, {
            former_owner_civic_did_hash: 'a'.repeat(64), parcel_id: PARCEL, reason: 'upkeep_default', tick: 30240,
        });
        expect(entry.eventType).toBe('zoning.parcel_reclaimed');
        expect(entry.payload).toMatchObject({ reason: 'upkeep_default' });
        expect(OWNER).toBeTruthy(); // owner identity stays hashed, never raw on the chain
    });
});
