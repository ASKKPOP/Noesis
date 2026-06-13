/**
 * Phase 58 HOUSE-1 · Wave 0 skip-stub — GridServices wiring + list smoke check.
 *
 * Locks the D-58-07 services-wiring contract BEFORE Wave 3 attaches parcels to
 * GridServices in main.ts. `describe.skip` so the suite reports SKIPPED, not failed.
 * The Wave-1 ParcelStore lives in the not-yet-created grid/src/civic/parcel-store.ts
 * and is pulled in via a dynamic import INSIDE the skipped suite so module resolution
 * is deferred — the block never runs under .skip. Wave 3 deletes the .skip.
 *
 * Covers: R-58-05 (ParcelRegistry + ParcelStore wired into GridServices, boot log,
 *         CI route smoke check closing the registry-not-wired bug class — R-H-01).
 * Un-skipped by Wave 3 when main.ts wiring + civic-parcels routes ship.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';

type ParcelStoreMod = typeof import('../../src/civic/parcel-store.js');

describe.skip('GridServices.parcels wiring (D-58-07 / R-58-05)', () => {
    let ParcelStore: ParcelStoreMod['ParcelStore'];
    beforeAll(async () => {
        ({ ParcelStore } = await import('../../src/civic/parcel-store.js'));
        void ParcelStore;
    });

    it('GridServices exposes a parcels accessor { registry, store } after wiring', () => {
        // services.parcels?.registry instanceof ParcelRegistry; services.parcels?.store instanceof ParcelStore.
        expect(ParcelRegistry).toBeDefined();
    });

    it('boot logs "[civic] parcels loaded: N" after hydrate-on-boot', () => {});
});

describe.skip('GET /api/v1/civic/parcels — registry-not-wired smoke check (R-H-01 / R-58-05)', () => {
    it('GET /api/v1/civic/parcels returns 200 with a parcels array', () => {
        // Public map feed: { parcels: [...] }. Catches the civicDidStore-not-wired bug class.
    });

    it('the returned parcels array is non-empty on a seeded Genesis Core (53 rows)', () => {});
});
