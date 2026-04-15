import { describe, it, expect, beforeEach } from 'vitest';
import { ShopRegistry } from '../../src/noesis/ousia/shop.js';
import type { ShopService } from '../../src/noesis/ousia/types.js';

const SOPHIA = 'did:key:sophia';
const HERMES = 'did:key:hermes';

function svc(name: string, price: number, category = 'knowledge'): ShopService {
    return { name, description: `${name} service`, price, category };
}

describe('ShopRegistry', () => {
    let registry: ShopRegistry;

    beforeEach(() => {
        registry = new ShopRegistry();
    });

    it('creates a shop', () => {
        const shop = registry.create(SOPHIA, 'Sophia\'s Academy', 'Teaching', [svc('Tutoring', 20)], 'agora', 1);
        expect(shop.ownerDid).toBe(SOPHIA);
        expect(shop.services).toHaveLength(1);
        expect(shop.active).toBe(true);
        expect(registry.count).toBe(1);
    });

    it('rejects duplicate shop per owner', () => {
        registry.create(SOPHIA, 'Shop 1', 'desc', [], 'agora', 1);
        expect(() => registry.create(SOPHIA, 'Shop 2', 'desc', [], 'agora', 2)).toThrow('already has a shop');
    });

    it('retrieves by owner', () => {
        registry.create(SOPHIA, 'Academy', 'desc', [], 'agora', 1);
        expect(registry.getByOwner(SOPHIA)?.name).toBe('Academy');
        expect(registry.getByOwner('unknown')).toBeUndefined();
    });

    it('lists active shops', () => {
        registry.create(SOPHIA, 'Shop A', 'desc', [], 'agora', 1);
        registry.create(HERMES, 'Shop B', 'desc', [], 'market', 1);
        expect(registry.activeShops()).toHaveLength(2);
        registry.close(HERMES);
        expect(registry.activeShops()).toHaveLength(1);
    });

    it('filters shops by region', () => {
        registry.create(SOPHIA, 'Shop A', 'desc', [svc('X', 10)], 'agora', 1);
        registry.create(HERMES, 'Shop B', 'desc', [svc('Y', 20)], 'market', 1);
        expect(registry.shopsInRegion('agora')).toHaveLength(1);
        expect(registry.shopsInRegion('market')).toHaveLength(1);
        expect(registry.shopsInRegion('library')).toHaveLength(0);
    });

    it('searches services by name', () => {
        registry.create(SOPHIA, 'Academy', 'desc', [svc('Math Tutoring', 20), svc('Philosophy', 30)], 'agora', 1);
        registry.create(HERMES, 'Courier', 'desc', [svc('Delivery', 10)], 'market', 1);
        expect(registry.searchServices('tutor')).toHaveLength(1);
        expect(registry.searchServices('DELIVERY')).toHaveLength(1);
        expect(registry.searchServices('cooking')).toHaveLength(0);
    });

    it('adds a service to existing shop', () => {
        registry.create(SOPHIA, 'Academy', 'desc', [svc('Math', 20)], 'agora', 1);
        registry.addService(SOPHIA, svc('Physics', 25));
        expect(registry.getByOwner(SOPHIA)!.services).toHaveLength(2);
    });

    it('removes a service by name', () => {
        registry.create(SOPHIA, 'Academy', 'desc', [svc('Math', 20), svc('Physics', 25)], 'agora', 1);
        expect(registry.removeService(SOPHIA, 'Math')).toBe(true);
        expect(registry.getByOwner(SOPHIA)!.services).toHaveLength(1);
        expect(registry.removeService(SOPHIA, 'Chemistry')).toBe(false);
    });

    it('closes a shop', () => {
        registry.create(SOPHIA, 'Academy', 'desc', [], 'agora', 1);
        expect(registry.close(SOPHIA)).toBe(true);
        expect(registry.getByOwner(SOPHIA)!.active).toBe(false);
        expect(registry.close(SOPHIA)).toBe(false); // already closed
    });

    it('addService throws for missing shop', () => {
        expect(() => registry.addService('nobody', svc('X', 10))).toThrow('Shop not found');
    });

    it('removeService throws for missing shop', () => {
        expect(() => registry.removeService('nobody', 'X')).toThrow('Shop not found');
    });
});
