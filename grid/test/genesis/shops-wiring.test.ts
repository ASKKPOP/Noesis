/**
 * Plan 04-01 Task 3 — GenesisLauncher wires ShopRegistry + registers preset shops.
 *
 * Asserts:
 *   - GENESIS_SHOPS exists and is a non-empty ShopRegisterInput[]
 *   - launcher exposes a `shops: ShopRegistry` field
 *   - After bootstrap, shops for owners that exist in the registry are registered
 *   - Shops for owners that do NOT exist are skipped (no throw)
 */

import { describe, it, expect, vi } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { GENESIS_SHOPS } from '../../src/genesis/presets.js';
import { ShopRegistry } from '../../src/economy/shop-registry.js';
import type { GenesisConfig } from '../../src/genesis/types.js';

function cfgWithSeed(seedDid: string, seedName: string): GenesisConfig {
    return {
        gridName: 'ShopsTest',
        gridDomain: 'shops.test',
        tickRateMs: 1000,
        ticksPerEpoch: 10,
        regions: [
            { id: 'agora', name: 'Agora', description: '', regionType: 'public', capacity: 10, properties: {} },
        ],
        connections: [],
        laws: [],
        economy: { initialSupply: 100 },
        seedNous: [
            { name: seedName, did: seedDid, publicKey: 'pk', region: 'agora' },
        ],
    };
}

describe('Plan 04-01 — GenesisLauncher shops wiring', () => {
    it('GENESIS_SHOPS is a non-empty ShopRegisterInput[]', () => {
        expect(Array.isArray(GENESIS_SHOPS)).toBe(true);
        expect(GENESIS_SHOPS.length).toBeGreaterThanOrEqual(2);
        for (const shop of GENESIS_SHOPS) {
            expect(typeof shop.ownerDid).toBe('string');
            expect(typeof shop.name).toBe('string');
            expect(Array.isArray(shop.listings)).toBe(true);
        }
    });

    it('launcher exposes a ShopRegistry as `shops`', () => {
        const launcher = new GenesisLauncher(cfgWithSeed('did:key:x', 'X'));
        expect(launcher.shops).toBeInstanceOf(ShopRegistry);
    });

    it('bootstrap registers shops whose ownerDid matches a seeded Nous', () => {
        // Create a config where a seeded Nous matches the FIRST GENESIS_SHOPS entry
        const firstShop = GENESIS_SHOPS[0];
        const cfg = cfgWithSeed(firstShop.ownerDid, 'Owner');
        const launcher = new GenesisLauncher(cfg);
        launcher.bootstrap();

        const registered = launcher.shops.getByOwner(firstShop.ownerDid);
        expect(registered).toBeDefined();
        expect(registered?.name).toBe(firstShop.name);
    });

    it('bootstrap skips shops for unknown owners without throwing', () => {
        // No seeded Nous matches GENESIS_SHOPS entries — all should be skipped
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const cfg = cfgWithSeed('did:key:nobody', 'Nobody');
        const launcher = new GenesisLauncher(cfg);
        expect(() => launcher.bootstrap()).not.toThrow();
        // At least one skip warning should have been emitted
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
