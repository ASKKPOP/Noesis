/**
 * Shop Registry — Nous-created shops and services.
 *
 * Shops are local to a region and advertised via Agora channels.
 * Each Nous can own one shop at a time.
 */

import type { Shop, ShopService } from './types.js';

export class ShopRegistry {
    private readonly shops = new Map<string, Shop>(); // keyed by ownerDid

    /** Create a new shop. Returns the shop or throws if owner already has one. */
    create(
        ownerDid: string,
        name: string,
        description: string,
        services: ShopService[],
        region: string,
        tick: number,
    ): Shop {
        if (this.shops.has(ownerDid)) {
            throw new Error(`Nous ${ownerDid} already has a shop`);
        }

        const shop: Shop = {
            ownerDid,
            name,
            description,
            services,
            region,
            createdAtTick: tick,
            active: true,
        };

        this.shops.set(ownerDid, shop);
        return shop;
    }

    /** Get a shop by owner did. */
    getByOwner(ownerDid: string): Shop | undefined {
        return this.shops.get(ownerDid);
    }

    /** List all active shops. */
    activeShops(): Shop[] {
        return [...this.shops.values()].filter(s => s.active);
    }

    /** List shops in a specific region. */
    shopsInRegion(region: string): Shop[] {
        return this.activeShops().filter(s => s.region === region);
    }

    /** Search shops by service name (case-insensitive substring match). */
    searchServices(query: string): Shop[] {
        const q = query.toLowerCase();
        return this.activeShops().filter(s =>
            s.services.some(svc => svc.name.toLowerCase().includes(q)),
        );
    }

    /** Add a service to an existing shop. */
    addService(ownerDid: string, service: ShopService): void {
        const shop = this.shops.get(ownerDid);
        if (!shop) throw new Error('Shop not found');
        shop.services.push(service);
    }

    /** Remove a service from a shop by name. */
    removeService(ownerDid: string, serviceName: string): boolean {
        const shop = this.shops.get(ownerDid);
        if (!shop) throw new Error('Shop not found');
        const idx = shop.services.findIndex(s => s.name === serviceName);
        if (idx === -1) return false;
        shop.services.splice(idx, 1);
        return true;
    }

    /** Close a shop (deactivate). */
    close(ownerDid: string): boolean {
        const shop = this.shops.get(ownerDid);
        if (!shop || !shop.active) return false;
        shop.active = false;
        return true;
    }

    /** Total shop count (active and inactive). */
    get count(): number {
        return this.shops.size;
    }
}
