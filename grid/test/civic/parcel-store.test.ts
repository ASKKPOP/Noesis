/**
 * Phase 58 HOUSE-1 · Wave 1 — write-through ParcelStore persistence.
 *
 * Verifies the D-58-01/02 persistence contract against a MOCK Pool (vi.fn()) — there
 * is no live DB harness in this project (mirrors test/marketplace-store.test.ts). The
 * mock asserts QUERY BEHAVIOR: seed issues INSERT IGNORE (idempotent), persist* issue
 * UPDATE DB-first, hydrate issues SELECT and populates the registry — not real MySQL.
 *
 * Covers: R-58-01 (write-through store, hydrate-on-boot, DB source of truth),
 *         R-58-02 (idempotent seed), R-58-03 (gravity prices on seeded rows).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore, buildGenesisCoreParcels } from '../../src/civic/parcel-store.js';
import { gravityPrice } from '../../src/civic/founding-law.js';

/**
 * Mock Pool whose query() returns a configurable result per call. `affectedRows`
 * drives INSERT IGNORE idempotency; `selectRows` is returned for hydrate SELECTs.
 */
function makeMockPool(opts: { affectedRows?: number; selectRows?: unknown[] } = {}): Pool {
    const affectedRows = opts.affectedRows ?? 1;
    const selectRows = opts.selectRows ?? [];
    const mockQuery = vi.fn().mockImplementation((sql: string) => {
        if (/^\s*SELECT/i.test(sql)) return Promise.resolve([selectRows, []]);
        return Promise.resolve([{ affectedRows } as ResultSetHeader, []]);
    });
    return { query: mockQuery } as unknown as Pool;
}

// ── seed idempotency + write-through (R-58-01 / R-58-02) ───────────────────────

describe('ParcelStore — seed idempotency + write-through (R-58-01 / R-58-02)', () => {
    it('seedGenesisCore seeds exactly 53 rows and mirrors them into the registry', async () => {
        const pool = makeMockPool({ affectedRows: 1 });
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');

        const inserted = await store.seedGenesisCore(registry);

        expect(inserted).toBe(53);
        expect(registry.count).toBe(53);
        // Every seed write is an INSERT IGNORE (idempotent), never a plain INSERT.
        for (const call of (pool.query as ReturnType<typeof vi.fn>).mock.calls) {
            expect(String(call[0])).toMatch(/INSERT IGNORE INTO civic_parcels/);
        }
    });

    it('seedGenesisCore is idempotent: a 2nd run inserts 0 new rows (INSERT IGNORE)', async () => {
        // affectedRows=0 simulates rows already present → ON DUPLICATE/IGNORE no-op.
        const pool = makeMockPool({ affectedRows: 0 });
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');

        const inserted = await store.seedGenesisCore(registry);

        expect(inserted).toBe(0);
        // Registry mirror is still consistent (53) even though DB inserted nothing new.
        expect(registry.count).toBe(53);
    });

    it('persistPurchase writes the DB row FIRST via UPDATE (DB is source of truth)', async () => {
        const pool = makeMockPool();
        const store = new ParcelStore(pool, 'genesis');
        const parcel = buildGenesisCoreParcels('genesis').find(p => p.zoneId === 'residential')!;
        parcel.ownerDid = 'did:civic:noesis:nous:abc';
        parcel.acquiredAtTick = 42;

        await store.persistPurchase(parcel);

        const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(String(sql)).toMatch(/UPDATE civic_parcels/);
        expect(String(sql)).toMatch(/owner_civic_did/);
        expect(params).toContain('did:civic:noesis:nous:abc');
        expect(params).toContain(42);
        expect(params).toContain(parcel.id);
    });

    it('hydrate(registry) loads all rows for the grid back into the registry on boot', async () => {
        const rows = buildGenesisCoreParcels('genesis').slice(0, 3).map(p => ({
            parcel_id: p.id, grid_name: p.gridId, zone_id: p.zoneId,
            ring: p.ring, sector_deg: String(p.sector), level: p.level,
            owner_civic_did: null, price_wei: String(p.priceWei), acquired_at_tick: null,
            structure_name: null, structure_type: null, visibility: null,
            built_at_tick: null, named_address: null,
            entry_policy: 'open', entry_allowlist: null,
        }));
        const pool = makeMockPool({ selectRows: rows });
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');

        const count = await store.hydrate(registry);

        expect(count).toBe(3);
        expect(registry.count).toBe(3);
        const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(String(sql)).toMatch(/SELECT \* FROM civic_parcels/);
        expect(params).toContain('genesis');
    });

    it('persistBuild writes the embedded structure to the parcel row (one-structure-per-parcel)', async () => {
        const pool = makeMockPool();
        const store = new ParcelStore(pool, 'genesis');
        const parcel = buildGenesisCoreParcels('genesis').find(p => p.zoneId === 'residential')!;
        parcel.structure = { name: 'Aurora', type: 'home', visibility: 'private', builtAtTick: 7, namedAddress: null };

        await store.persistBuild(parcel);

        const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(String(sql)).toMatch(/UPDATE civic_parcels/);
        expect(String(sql)).toMatch(/structure_name/);
        expect(params).toContain('Aurora');
        expect(params).toContain('home');
    });

    it('persistEntryPolicy writes the entry_policy + entry_allowlist columns through to the DB', async () => {
        const pool = makeMockPool();
        const store = new ParcelStore(pool, 'genesis');
        const parcel = buildGenesisCoreParcels('genesis').find(p => p.zoneId === 'residential')!;
        parcel.entryPolicy = { policy: 'allowlist', allowlist: ['did:civic:noesis:nous:friend'] };

        await store.persistEntryPolicy(parcel);

        const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(String(sql)).toMatch(/UPDATE civic_parcels/);
        expect(String(sql)).toMatch(/entry_policy/);
        expect(params).toContain('allowlist');
        expect(params).toContain(JSON.stringify(['did:civic:noesis:nous:friend']));
    });

    it('occupants are NOT persisted — presence is memory-only and lost on restart (R-H-09)', async () => {
        // hydrate rehydrates ownership/structure but never occupants; no row carries occupants.
        const rows = buildGenesisCoreParcels('genesis').slice(0, 1).map(p => ({
            parcel_id: p.id, grid_name: p.gridId, zone_id: p.zoneId,
            ring: p.ring, sector_deg: String(p.sector), level: p.level,
            owner_civic_did: 'did:civic:noesis:nous:owner', price_wei: String(p.priceWei),
            acquired_at_tick: 1,
            structure_name: 'Hall', structure_type: 'venue', visibility: 'open',
            built_at_tick: 2, named_address: null,
            entry_policy: 'open', entry_allowlist: null,
        }));
        const pool = makeMockPool({ selectRows: rows });
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');

        await store.hydrate(registry);

        // Structure rehydrated, but occupancy is empty after a fresh boot.
        expect(registry.occupants(rows[0].parcel_id)).toEqual([]);
        // No persist path or SELECT column references occupants.
        for (const call of (pool.query as ReturnType<typeof vi.fn>).mock.calls) {
            expect(String(call[0])).not.toMatch(/occupant/i);
        }
    });
});

// ── gravity prices + caps + civic-land guard (R-58-03) ─────────────────────────

describe('ParcelStore — gravity prices + caps + civic-land guard (R-58-03)', () => {
    it('seeded ring-3 residential rows are priced 400 Bios (gravityPrice(3))', () => {
        const parcels = buildGenesisCoreParcels('genesis');
        const residential = parcels.filter(p => p.zoneId === 'residential');
        expect(residential).toHaveLength(24);
        for (const p of residential) {
            expect(p.ring).toBe(3);
            expect(p.priceWei).toBe(400);
            expect(p.priceWei).toBe(gravityPrice(3));
        }
    });

    it('seeded ring-2 business/shopping/manufacture rows are priced 900 Bios (gravityPrice(2))', () => {
        const parcels = buildGenesisCoreParcels('genesis');
        const ring2 = parcels.filter(p => p.ring === 2);
        expect(ring2).toHaveLength(24); // 8 + 8 + 8
        for (const p of ring2) {
            expect(['business', 'shopping', 'manufacture']).toContain(p.zoneId);
            expect(p.priceWei).toBe(900);
            expect(p.priceWei).toBe(gravityPrice(2));
        }
    });

    it('cap: a Nous may own <=1 home — the 2nd residential purchase returns cap_exceeded', async () => {
        const pool = makeMockPool();
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');
        await store.seedGenesisCore(registry);

        const homes = registry.list({ zoneId: 'residential' });
        const buyer = 'did:civic:noesis:nous:home-buyer';
        const first = registry.purchase(homes[0].id, buyer, 100000);
        expect(first.ok).toBe(true);
        const second = registry.purchase(homes[1].id, buyer, 100000);
        expect(second).toEqual({ ok: false, reason: 'cap_exceeded' });
    });

    it('cap: a Nous may own <=1 business — the 2nd business-class purchase returns cap_exceeded', async () => {
        const pool = makeMockPool();
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');
        await store.seedGenesisCore(registry);

        const buyer = 'did:civic:noesis:nous:biz-buyer';
        const biz = registry.list({ zoneId: 'business' });
        const shop = registry.list({ zoneId: 'shopping' });
        const first = registry.purchase(biz[0].id, buyer, 100000);
        expect(first.ok).toBe(true);
        // shopping is the same business class — 2nd purchase across the class is capped.
        const second = registry.purchase(shop[0].id, buyer, 100000);
        expect(second).toEqual({ ok: false, reason: 'cap_exceeded' });
    });

    it('commons (rings 0-1) are NOT purchasable — purchase returns zone_not_purchasable', async () => {
        const pool = makeMockPool();
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');
        await store.seedGenesisCore(registry);

        const buyer = 'did:civic:noesis:nous:wanderer';
        const gov = registry.list({ zoneId: 'government_quarter' });   // ring 0
        const infra = registry.list({ zoneId: 'infrastructure' });    // ring 1
        expect(registry.purchase(gov[0].id, buyer, 100000)).toEqual({ ok: false, reason: 'zone_not_purchasable' });
        expect(registry.purchase(infra[0].id, buyer, 100000)).toEqual({ ok: false, reason: 'zone_not_purchasable' });
    });
});
