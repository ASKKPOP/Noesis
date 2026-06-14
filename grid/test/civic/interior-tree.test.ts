/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the interior tree (D-NH-02 / D-59-03 / R-59-03).
 *
 * describe.skip: ParcelRegistry.extendInterior + the Structure.interior tree land in
 * Wave 1. The deferred dynamic import (Phase 58 Wave-0 pattern) defers module
 * resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - extendInterior(addr, ownerDid, {area:'bedroom', kind:'bed'}) on an owned home
 *     mutates Structure.interior.areas (area created if absent; object appended with class).
 *   - rejects an unknown furniture kind → invalid_furniture.
 *   - rejects mirror furniture in a non-home structure (mirror-only-in-home).
 *   - the interior tree is Grid-side sovereign space: it is NEVER serialized onto the
 *     audit chain — only object_class / object_kind enums cross (D-59-08).
 */
import { describe, it, expect } from 'vitest';

const loadRegistry = () => import('../../src/civic/parcel-registry.js');

const OWNER = 'did:civic:noesis:alice';
const HOME = 'genesis:residential:0001';

describe('Phase 59 HOUSE-2 — interior tree mutation (extendInterior) [Wave 1 un-skips]', () => {
    it('extendInterior on an owned home creates the area when absent and appends the object', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const structure = registry.extendInterior(HOME, OWNER, { area: 'bedroom', kind: 'bed' });
        const bedroom = structure.interior!.areas.find(a => a.name === 'bedroom')!;
        expect(bedroom).toBeTruthy();
        expect(bedroom.objects.map(o => o.kind)).toContain('bed');
    });

    it('a second extend into the same area appends a second object (no overwrite)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.extendInterior(HOME, OWNER, { area: 'bedroom', kind: 'bed' });
        const structure = registry.extendInterior(HOME, OWNER, { area: 'bedroom', kind: 'closet' });
        const bedroom = structure.interior!.areas.find(a => a.name === 'bedroom')!;
        expect(bedroom.objects).toHaveLength(2);
    });

    it('appended objects carry the catalog class (mirror) tag from the catalog', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const structure = registry.extendInterior(HOME, OWNER, { area: 'bedroom', kind: 'bed' });
        const obj = structure.interior!.areas[0].objects.find(o => o.kind === 'bed')!;
        expect(obj.class).toBe('mirror');
    });

    it('rejects an unknown furniture kind with invalid_furniture', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        expect(() => registry.extendInterior(HOME, OWNER, { area: 'bedroom', kind: 'throne' }))
            .toThrow(/invalid_furniture/);
    });

    it('rejects mirror furniture in a non-home structure (mirror-only-in-home)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const SHOP = 'genesis:shopping:0001';
        expect(() => registry.extendInterior(SHOP, OWNER, { area: 'floor', kind: 'bed' }))
            .toThrow(/invalid_furniture/);
    });

    it('accepts functional furniture in a non-home structure (work_desk in a shop)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const SHOP = 'genesis:shopping:0001';
        const structure = registry.extendInterior(SHOP, OWNER, { area: 'floor', kind: 'work_desk' });
        expect(structure.interior!.areas[0].objects[0].kind).toBe('work_desk');
    });

    it('the interior tree is NEVER serialized onto the audit chain — only object_class/object_kind cross', async () => {
        // A spy on the zoning.interior_extended sole producer must only ever see the closed
        // 4-tuple {object_class, object_kind, parcel_id, tick} — never object names/state/the tree.
        const { appendZoningInteriorExtended } = await import('../../src/audit/append-zoning-interior-extended.js');
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const entry = appendZoningInteriorExtended(audit, {
            object_class: 'mirror', object_kind: 'bed', parcel_id: HOME, tick: 7,
        });
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('areas');
        expect(serialized).not.toContain('bedroom');
        expect(serialized).not.toContain('state');
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['object_class', 'object_kind', 'parcel_id', 'tick']);
    });
});
