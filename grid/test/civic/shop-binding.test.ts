/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for shop⇄structure binding + structure revenue
 * (D-60-03/04 / R-60-05/06).
 *
 * describe.skip: bind/unbind-shop on ParcelRegistry + ZONE_TAX_BPS/structureRevenueDue in
 * founding-law.ts land in Wave 2/3. Deferred dynamic import (Phase 58/59 Wave-0 pattern)
 * defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - bind-shop is owner-only and requires the structure type shop; it sets structure.boundShopId
 *     + stamps parcel_id on the ShopRegistry shop/listing.
 *   - structureRevenueDue(parcel, saleAmountBios) = floor(saleAmountBios * ZONE_TAX_BPS[zoneId] / 10000)
 *     for each zone (business 1200 / shopping 1000 / manufacture 900 / residential 500).
 *   - unbind-shop routes through the severance FSM (not a hard kill).
 */
import { describe, it, expect } from 'vitest';

const loadRegistry = () => import('../../src/civic/parcel-registry.js');
const loadLaw = () => import('../../src/civic/founding-law.js');

const OWNER = 'did:civic:noesis:alice';
const OTHER = 'did:civic:noesis:bob';
const SHOP_PARCEL = 'genesis:shopping:0001';

describe('Phase 60 HOUSE-3 — bind-shop owner-only + structure type shop [Wave 3 un-skips]', () => {
    it('bind-shop sets structure.boundShopId and stamps parcel_id on the shop', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get(SHOP_PARCEL)!;
        parcel.ownerDid = OWNER;
        parcel.structure = { name: 'Aurora', type: 'shop', visibility: 'open', builtAtTick: 1, namedAddress: null };
        const result = registry.bindShop(SHOP_PARCEL, 'shop:aurora', OWNER);
        expect(result.ok).toBe(true);
        expect(registry.get(SHOP_PARCEL)!.structure!.boundShopId).toBe('shop:aurora');
    });

    it('a non-owner binding a shop is rejected (not_owner)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get(SHOP_PARCEL)!;
        parcel.ownerDid = OWNER;
        parcel.structure = { name: 'Aurora', type: 'shop', visibility: 'open', builtAtTick: 1, namedAddress: null };
        expect(registry.bindShop(SHOP_PARCEL, 'shop:aurora', OTHER)).toEqual({ ok: false, reason: 'not_owner' });
    });

    it('binding to a non-shop structure type is rejected (not_a_shop)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get(SHOP_PARCEL)!;
        parcel.ownerDid = OWNER;
        parcel.structure = { name: 'Home', type: 'home', visibility: 'open', builtAtTick: 1, namedAddress: null };
        expect(registry.bindShop(SHOP_PARCEL, 'shop:aurora', OWNER)).toEqual({ ok: false, reason: 'not_a_shop' });
    });
});

describe('Phase 60 HOUSE-3 — structureRevenueDue zone-tax math [Wave 3 un-skips]', () => {
    it('ZONE_TAX_BPS rates: business 1200 / shopping 1000 / manufacture 900 / residential 500', async () => {
        const { ZONE_TAX_BPS } = await loadLaw();
        expect(ZONE_TAX_BPS.business).toBe(1200);
        expect(ZONE_TAX_BPS.shopping).toBe(1000);
        expect(ZONE_TAX_BPS.manufacture).toBe(900);
        expect(ZONE_TAX_BPS.residential).toBe(500);
    });

    it('structureRevenueDue = floor(saleAmountBios * ZONE_TAX_BPS[zoneId] / 10000) for shopping', async () => {
        const { structureRevenueDue } = await loadLaw();
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get(SHOP_PARCEL)!; // shopping → 1000 bps
        expect(structureRevenueDue(parcel, 1000)).toBe(100); // floor(1000 * 1000 / 10000)
    });

    it('structureRevenueDue floors a non-exact division (business 1200 bps on 105)', async () => {
        const { structureRevenueDue } = await loadLaw();
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get('genesis:business:0001')!; // business → 1200 bps
        // floor(105 * 1200 / 10000) = floor(12.6) = 12
        expect(structureRevenueDue(parcel, 105)).toBe(12);
    });
});

describe('Phase 60 HOUSE-3 — unbind-shop routes through the severance FSM [Wave 3 un-skips]', () => {
    it('unbind-shop traverses the severance FSM (not a hard kill)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get(SHOP_PARCEL)!;
        parcel.ownerDid = OWNER;
        parcel.structure = { name: 'Aurora', type: 'shop', visibility: 'open', builtAtTick: 1, namedAddress: null, boundShopId: 'shop:aurora' };
        const result = registry.unbindShop(SHOP_PARCEL, OWNER);
        // Unbind enters the severance FSM at ACTIVE → ... → ARCHIVED; never an instant delete.
        expect(result.ok).toBe(true);
        expect(result.severanceState).toBe('ARCHIVED');
    });
});
