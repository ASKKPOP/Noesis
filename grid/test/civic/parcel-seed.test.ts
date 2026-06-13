/**
 * Phase 58 HOUSE-1 · Wave 2 — Genesis Core seed (exactly 53 parcels).
 *
 * Locks the D-58-03 (D-NH-04/09) seed contract: on an empty civic_parcels the
 * seeder inserts EXACTLY 53 parcels with the correct zone-per-ring distribution
 * and 5 pre-built commons venues, idempotently (INSERT IGNORE), emitting NO audit
 * events (world-creation, not commerce). Mocks the mysql2 Pool — no live DB.
 *
 * Covers: R-58-02 (Genesis Core seeded exactly 53 = 48 purchasable + 5 civic,
 *         idempotently, emitting no audit events).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { ParcelStore, buildGenesisCoreParcels } from '../../src/civic/parcel-store.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { GENESIS_CORE_SEED_PLAN, gravityPrice } from '../../src/civic/founding-law.js';
import * as AuditChainMod from '../../src/audit/index.js';

/**
 * Mock Pool whose INSERT IGNORE reports `affectedRows` per call so idempotency
 * can be exercised. `affectedRows` controls whether a row counts as inserted.
 */
function makeSeedPool(affectedRows = 1): { pool: Pool; queryCalls: () => unknown[][] } {
    const calls: unknown[][] = [];
    const mockQuery = vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
        calls.push(params);
        return Promise.resolve([{ affectedRows } as ResultSetHeader, []]);
    });
    const pool = { query: mockQuery } as unknown as Pool;
    return { pool, queryCalls: () => calls };
}

// ── Seed plan contract (D-58-03) ───────────────────────────────────────────────

describe('Genesis Core seed plan — exactly 53 parcels (D-58-03 / R-58-02)', () => {
    it('the seed plan totals EXACTLY 53 parcels (48 purchasable + 5 civic)', () => {
        const total = GENESIS_CORE_SEED_PLAN.reduce((sum, e) => sum + e.count, 0);
        expect(total).toBe(53);
    });

    it('ring 0 government_quarter ×1', () => {
        const e = GENESIS_CORE_SEED_PLAN.find(p => p.ring === 0 && p.zoneId === 'government_quarter');
        expect(e?.count).toBe(1);
    });

    it('ring 1 infrastructure ×4 (civic commons)', () => {
        const e = GENESIS_CORE_SEED_PLAN.find(p => p.ring === 1 && p.zoneId === 'infrastructure');
        expect(e?.count).toBe(4);
    });

    it('ring 2 business ×8 + shopping ×8 + manufacture ×8 (24 purchasable)', () => {
        const sum = (zone: string) =>
            GENESIS_CORE_SEED_PLAN.filter(p => p.ring === 2 && p.zoneId === zone)
                .reduce((s, p) => s + p.count, 0);
        expect(sum('business')).toBe(8);
        expect(sum('shopping')).toBe(8);
        expect(sum('manufacture')).toBe(8);
    });

    it('ring 3 residential ×24 (purchasable homes)', () => {
        const e = GENESIS_CORE_SEED_PLAN.find(p => p.ring === 3 && p.zoneId === 'residential');
        expect(e?.count).toBe(24);
    });

    it('distribution sums to 1 + 4 + 24 + 24 = 53', () => {
        const ring = (n: number) =>
            GENESIS_CORE_SEED_PLAN.filter(p => p.ring === n).reduce((s, p) => s + p.count, 0);
        expect(ring(0)).toBe(1);
        expect(ring(1)).toBe(4);
        expect(ring(2)).toBe(24);
        expect(ring(3)).toBe(24);
    });

    it('ring 4+ is absent (council legislation only — Phase 60 hook)', () => {
        expect(GENESIS_CORE_SEED_PLAN.some(p => p.ring >= 4)).toBe(false);
    });
});

// ── Materialized parcels: pricing + commons venues ─────────────────────────────

describe('Genesis Core seed — gravity pricing + 5 commons venues (R-58-02)', () => {
    it('purchasable rings are priced via gravityPrice: ring 2 = 900, ring 3 = 400', () => {
        expect(gravityPrice(2)).toBe(900);
        expect(gravityPrice(3)).toBe(400);
        const parcels = buildGenesisCoreParcels('genesis');
        expect(parcels.filter(p => p.ring === 2).every(p => p.priceBios === 900)).toBe(true);
        expect(parcels.filter(p => p.ring === 3).every(p => p.priceBios === 400)).toBe(true);
    });

    it('civic rings 0-1 are not for sale (price 0)', () => {
        const parcels = buildGenesisCoreParcels('genesis');
        const civic = parcels.filter(p => p.ring === 0 || p.ring === 1);
        expect(civic.every(p => p.priceBios === 0)).toBe(true);
    });

    it('the 5 civic parcels (ring 1 ×4) carry pre-built venue/open commons structures', () => {
        const parcels = buildGenesisCoreParcels('genesis');
        const commons = parcels.filter(p => p.ring === 1);
        expect(commons).toHaveLength(4);
        expect(commons.every(p => p.structure?.type === 'venue')).toBe(true);
        expect(commons.every(p => p.structure?.visibility === 'open')).toBe(true);
    });
});

// ── seedGenesisCore: write-through + idempotency + zero audit ──────────────────

describe('seedGenesisCore — write-through, idempotent, zero audit (R-58-02)', () => {
    it('inserts EXACTLY 53 rows on an empty grid and mirrors them into the registry', async () => {
        const { pool, queryCalls } = makeSeedPool(1);
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');
        const inserted = await store.seedGenesisCore(registry);
        expect(inserted).toBe(53);
        expect(queryCalls()).toHaveLength(53);
        expect(registry.count).toBe(53);
    });

    it('is idempotent — a re-run on a seeded grid inserts 0 rows (INSERT IGNORE affectedRows=0)', async () => {
        const { pool } = makeSeedPool(0);
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');
        const inserted = await store.seedGenesisCore(registry);
        expect(inserted).toBe(0);
        // registry is still mirrored (read cache) but the DB inserted nothing.
        expect(registry.count).toBe(53);
    });

    it('seeding emits NO audit events — the sole-producer AuditChain.append is never called', async () => {
        const appendSpy = vi.spyOn(AuditChainMod.AuditChain.prototype, 'append');
        const { pool } = makeSeedPool(1);
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(pool, 'genesis');
        await store.seedGenesisCore(registry);
        expect(appendSpy).not.toHaveBeenCalled();
        appendSpy.mockRestore();
    });
});
