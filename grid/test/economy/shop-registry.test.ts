import { describe, it, expect, beforeEach } from 'vitest';
import { ShopRegistry } from '../../src/economy/shop-registry.js';
import type { ShopRegisterInput } from '../../src/economy/types.js';

describe('ShopRegistry', () => {
    let shops: ShopRegistry;

    beforeEach(() => {
        shops = new ShopRegistry();
    });

    it('returns empty list when no shops registered', () => {
        expect(shops.list()).toEqual([]);
        expect(shops.count).toBe(0);
    });

    it('registers a shop and lists it', () => {
        const input: ShopRegisterInput = {
            ownerDid: 'did:key:sophia',
            name: "Sophia's Library",
            listings: [{ sku: 'lesson', label: 'Philosophy lesson', priceOusia: 10 }],
        };
        const shop = shops.register(input);
        expect(shop.ownerDid).toBe('did:key:sophia');
        expect(shop.name).toBe("Sophia's Library");
        expect(shop.listings).toHaveLength(1);
        expect(shops.list()).toHaveLength(1);
        expect(shops.count).toBe(1);
    });

    it('preserves insertion order in list()', () => {
        shops.register({ ownerDid: 'did:key:a', name: 'A', listings: [] });
        shops.register({ ownerDid: 'did:key:b', name: 'B', listings: [] });
        shops.register({ ownerDid: 'did:key:c', name: 'C', listings: [] });
        const ordered = shops.list().map(s => s.ownerDid);
        expect(ordered).toEqual(['did:key:a', 'did:key:b', 'did:key:c']);
    });

    it('throws when registering a duplicate owner DID', () => {
        shops.register({ ownerDid: 'did:key:sophia', name: 'First', listings: [] });
        expect(() => shops.register({
            ownerDid: 'did:key:sophia',
            name: 'Second',
            listings: [],
        })).toThrow(/already registered/i);
    });

    it('getByOwner returns the shop for a known DID', () => {
        shops.register({ ownerDid: 'did:key:sophia', name: "Sophia's Library", listings: [] });
        const shop = shops.getByOwner('did:key:sophia');
        expect(shop).toBeDefined();
        expect(shop?.name).toBe("Sophia's Library");
    });

    it('getByOwner returns undefined for unknown DID', () => {
        expect(shops.getByOwner('did:key:nobody')).toBeUndefined();
    });

    it('freezes the listings array so mutation throws in strict mode', () => {
        const shop = shops.register({
            ownerDid: 'did:key:sophia',
            name: "Sophia's Library",
            listings: [{ sku: 'lesson', label: 'Philosophy lesson', priceOusia: 10 }],
        });
        // Listings array itself is frozen.
        expect(Object.isFrozen(shop.listings)).toBe(true);
        expect(() => {
            (shop.listings as unknown as Array<unknown>).push({});
        }).toThrow();
    });

    it('defensively copies listings so external mutations do not affect the stored shop', () => {
        const listings = [{ sku: 'x', label: 'X', priceOusia: 1 }];
        const shop = shops.register({
            ownerDid: 'did:key:x',
            name: 'X',
            listings,
        });
        // Mutate the original array the caller passed in.
        listings.push({ sku: 'y', label: 'Y', priceOusia: 2 });
        // Shop's listings should be unchanged.
        expect(shop.listings).toHaveLength(1);
        expect(shops.getByOwner('did:key:x')?.listings).toHaveLength(1);
    });
});
