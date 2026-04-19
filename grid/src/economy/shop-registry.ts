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

    /** Number of registered shops. */
    get count(): number {
        return this.shops.size;
    }
}
