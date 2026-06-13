/**
 * Phase 58 HOUSE-1 · Wave 0 skip-stub — write-through ParcelStore persistence.
 *
 * Locks the D-58-01/02 persistence contract BEFORE Wave 1 lands the implementation.
 * `describe.skip` so the suite reports SKIPPED, not failed. ParcelStore lives in the
 * not-yet-created grid/src/civic/parcel-store.ts and is pulled in via a dynamic
 * import INSIDE the skipped suite so module resolution is deferred — the block never
 * runs under .skip. Wave 1 deletes the .skip and the import resolves.
 *
 * Covers: R-58-01 (write-through store, hydrate-on-boot, DB source of truth),
 *         R-58-02 (idempotent seed), R-58-03 (gravity prices on seeded rows).
 * Un-skipped by Wave 1 when parcel-store.ts ships.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';

type ParcelStoreMod = typeof import('../../src/civic/parcel-store.js');

describe.skip('ParcelStore — seed idempotency + write-through (R-58-01 / R-58-02)', () => {
    let ParcelStore: ParcelStoreMod['ParcelStore'];
    beforeAll(async () => {
        ({ ParcelStore } = await import('../../src/civic/parcel-store.js'));
        void ParcelStore;
    });

    it('seedGenesisCore is idempotent: re-running does not duplicate rows (INSERT IGNORE)', () => {
        // 1st seedGenesisCore -> 53 rows; 2nd call -> 0 new rows; registry.count stays 53.
    });

    it('persistPurchase writes the DB row FIRST, then updates the in-memory registry (DB is source of truth)', () => {
        // After a purchase mutation the civic_parcels row carries owner_civic_did before memory reflects it.
    });

    it('hydrate(registry) loads all rows for the grid back into the in-memory registry on boot', () => {
        const r = new ParcelRegistry('genesis');
        void r; // hydrated registry.count === seeded rows.
    });

    it('persistBuild writes the embedded structure to the parcel row (one-structure-per-parcel)', () => {});

    it('persistEntryPolicy writes the entry_policy + entry_allowlist columns through to the DB', () => {});

    it('occupants are NOT persisted — presence is memory-only and lost on restart (R-H-09)', () => {
        // hydrate() rehydrates ownership/structure but never occupants; registry.occupants(id) is empty post-boot.
    });
});

describe.skip('ParcelStore — gravity prices + caps + civic-land guard (R-58-03)', () => {
    it('seeded ring-3 residential rows are priced 400 Bios (gravityPrice(3))', () => {});

    it('seeded ring-2 business/shopping/manufacture rows are priced 900 Bios (gravityPrice(2))', () => {});

    it('cap: a Nous may own <=1 home — the 2nd residential purchase returns cap_exceeded', () => {
        // ParcelRegistry.purchase -> { ok:false, reason:'cap_exceeded' } on the 2nd home.
    });

    it('cap: a Nous may own <=1 business — the 2nd business-class purchase returns cap_exceeded', () => {});

    it('commons (rings 0-1) are NOT purchasable — purchase returns zone_not_purchasable', () => {
        // government_quarter (ring 0) + infrastructure (ring 1) are absent from PURCHASABLE_ZONES.
    });
});
