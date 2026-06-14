/**
 * ShopRegistry — in-memory registry of Nous-owned shops.
 *
 * Pure-memory per Phase 4 D7: no persistence, no DB writes. Seeded at
 * genesis bootstrap from preset config. Returns frozen Shop records so
 * callers cannot mutate registered listings.
 */

import type { Shop, ShopRegisterInput } from './types.js';

export class ShopRegistry {
    private readonly shops = new Map<string, Shop>();

    /** Register a new shop. Throws if ownerDid already has a shop. */
    register(input: ShopRegisterInput): Shop {
        if (this.shops.has(input.ownerDid)) {
            throw new Error(`Shop already registered for owner: ${input.ownerDid}`);
        }
        // Defensive copy of each listing BEFORE freezing so callers cannot
        // mutate the stored record via a reference they still hold.
        const frozenListings = Object.freeze(
            input.listings.map(l => Object.freeze({ ...l })),
        );
        const shop: Shop = Object.freeze({
            ownerDid: input.ownerDid,
            name: input.name,
            listings: frozenListings,
        });
        this.shops.set(input.ownerDid, shop);
        return shop;
    }

    /** All registered shops in insertion order. */
    list(): Shop[] {
        return Array.from(this.shops.values());
    }

    /** Lookup a shop by owner DID; returns undefined if absent. */
    getByOwner(ownerDid: string): Shop | undefined {
        return this.shops.get(ownerDid);
    }

    /**
     * Phase 60 HOUSE-3 (D-60-03 / R-60-05) — bind a shop to a parcel by stamping
     * `parcel_id` on the shop and every listing. Keyed by shopId (the shop's ownerDid).
     * Returns the new frozen Shop. Throws `shop_not_found` if the shop is unregistered.
     * Closes the Phase 4 land gap: a registered shop now anchors to a parcel of land.
     */
    bindShop(shopId: string, parcelId: string): Shop {
        return this.stampParcel(shopId, parcelId);
    }

    /** Phase 60 HOUSE-3 (D-60-03) — clear the parcel binding (unbind via the severance FSM). */
    unbindShop(shopId: string): Shop {
        return this.stampParcel(shopId, undefined);
    }

    /** Replace the frozen shop record with one carrying (or clearing) parcel_id on shop + listings. */
    private stampParcel(shopId: string, parcelId: string | undefined): Shop {
        const existing = this.shops.get(shopId);
        if (!existing) throw new Error(`shop_not_found: ${shopId}`);
        const frozenListings = Object.freeze(
            existing.listings.map(l =>
                Object.freeze(parcelId !== undefined
                    ? { ...l, parcel_id: parcelId }
                    : (() => { const { parcel_id: _drop, ...rest } = l; return rest; })()),
            ),
        );
        const shop: Shop = Object.freeze(
            parcelId !== undefined
                ? { ownerDid: existing.ownerDid, name: existing.name, listings: frozenListings, parcel_id: parcelId }
                : { ownerDid: existing.ownerDid, name: existing.name, listings: frozenListings },
        );
        this.shops.set(shopId, shop);
        return shop;
    }

    /** Number of registered shops. */
    get count(): number {
        return this.shops.size;
    }
}
