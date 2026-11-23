/**
 * Grid House Objects §15.2 — CatalogStore: the boot seed of the Tier 0 catalog.
 *
 * Against an in-memory stand-in for civic_catalog_entries (no live DB harness in this
 * project): INSERT IGNORE keeps the first row per (grid, entry, version), SELECT reads
 * by grid. Covers the first seed, the idempotent re-seed, Tier 0 drift, per-Grid
 * keys, and hydrate.
 */
import { describe, it, expect } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { CatalogStore, compareVersions } from '../../src/civic/catalog-store.js';
import { genesisCatalogEntries } from '../../src/civic/genesis-catalog.js';

interface Row {
    grid_name: string; entry_id: string; version: string; tier: number; type: string; level: string;
    body_json: string; body_hash: string; created_tick: number;
}

function memoryPool() {
    const rows: Row[] = [];
    const sql: string[] = [];
    const query = async (text: string, params: unknown[]) => {
        sql.push(text);
        if (/^\s*INSERT IGNORE INTO civic_catalog_entries/.test(text)) {
            const [grid_name, entry_id, version, tier, type, level, body_json, body_hash, created_tick] = params as [
                string, string, string, number, string, string, string, string, number];
            if (rows.some((r) => r.grid_name === grid_name && r.entry_id === entry_id && r.version === version)) {
                return [{ affectedRows: 0 }, []];
            }
            rows.push({ grid_name, entry_id, version, tier, type, level, body_json, body_hash, created_tick });
            return [{ affectedRows: 1 }, []];
        }
        if (/^\s*SELECT entry_id, body_hash/.test(text)) {
            const [grid, version] = params as [string, string];
            return [rows.filter((r) => r.grid_name === grid && r.tier === 0 && r.version === version), []];
        }
        if (/^\s*SELECT entry_id, version, tier/.test(text)) {
            const [grid] = params as [string];
            // mysql2 hands a JSON column back parsed.
            return [rows.filter((r) => r.grid_name === grid).map((r) => ({ ...r, body_json: JSON.parse(r.body_json) })), []];
        }
        throw new Error(`unexpected sql: ${text}`);
    };
    return { pool: { query } as unknown as Pool, rows, sql };
}

describe('CatalogStore — seeding the Tier 0 catalog at boot', () => {
    it('the first boot writes every Tier 0 row for the environment, all INSERT IGNORE', async () => {
        const m = memoryPool();
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        expect(await store.seedGenesisCatalog(0)).toBe(125);
        expect(m.rows).toHaveLength(125);
        for (const s of m.sql.filter((x) => /INSERT/.test(x))) expect(s).toMatch(/INSERT IGNORE INTO civic_catalog_entries/);
    });

    it('every later boot writes nothing and changes nothing', async () => {
        const m = memoryPool();
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        await store.seedGenesisCatalog(0);
        const before = JSON.stringify(m.rows);
        expect(await store.seedGenesisCatalog(0)).toBe(0);
        expect(await new CatalogStore(m.pool, 'genesis', 'earth_orbit').seedGenesisCatalog(500)).toBe(0);
        expect(JSON.stringify(m.rows)).toBe(before);
    });

    it('refuses to boot when a stored Tier 0 row disagrees with the code at the same version', async () => {
        const m = memoryPool();
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        await store.seedGenesisCatalog(0);
        m.rows.find((r) => r.entry_id === 'core:work_desk')!.body_hash = '0'.repeat(64);
        await expect(store.seedGenesisCatalog(0)).rejects.toThrow(/catalog_tier0_drift: core:work_desk/);
    });

    it('refuses to boot when a Tier 0 row is missing after the insert', async () => {
        const m = memoryPool();
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        await store.seedGenesisCatalog(0);
        // A row that cannot be read back (say a wrong grid key) must not pass silently.
        m.rows.find((r) => r.entry_id === 'core:bed')!.grid_name = 'elsewhere';
        await expect(new CatalogStore(m.pool, 'genesis', 'earth_orbit').seedGenesisCatalog(0)).resolves.toBe(1);
        m.rows.find((r) => r.grid_name === 'genesis' && r.entry_id === 'core:bed')!.tier = 1;
        await expect(store.seedGenesisCatalog(0)).rejects.toThrow(/catalog_tier0_drift: core:bed/);
    });

    it('keys rows by Grid: two Grids in one database each get their own catalog', async () => {
        const m = memoryPool();
        await new CatalogStore(m.pool, 'genesis', 'earth_orbit').seedGenesisCatalog(0);
        expect(await new CatalogStore(m.pool, 'red', 'mars').seedGenesisCatalog(0)).toBe(127);
        expect(m.rows.filter((r) => r.grid_name === 'red' && r.entry_id === 'core:sulfur_concrete')).toHaveLength(1);
        expect(m.rows.filter((r) => r.grid_name === 'genesis' && r.entry_id === 'core:sulfur_concrete')).toHaveLength(0);
    });
});

describe('CatalogStore — hydrate and list', () => {
    it('hydrate loads this Grid only, and the bodies equal the code', async () => {
        const m = memoryPool();
        await new CatalogStore(m.pool, 'red', 'mars').seedGenesisCatalog(0);
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        await store.seedGenesisCatalog(0);
        expect(await store.hydrate()).toBe(125);
        const want = new Map(genesisCatalogEntries('earth_orbit').map((e) => [e.entryId, e]));
        for (const e of store.list()) {
            expect(e.bodyHash).toBe(want.get(e.entryId)!.bodyHash);
            expect(e.body).toEqual(JSON.parse(JSON.stringify(want.get(e.entryId)!.body)));
        }
    });

    it('list(type) narrows; before hydrate the cache is empty', async () => {
        const m = memoryPool();
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        expect(store.list()).toEqual([]);
        await store.seedGenesisCatalog(0);
        await store.hydrate();
        expect(store.list('kind')).toHaveLength(59);
        expect(store.list('starter_set')).toHaveLength(4);
        expect(store.list('material')).toHaveLength(16);
    });
});

describe('CatalogStore — versions', () => {
    it('serves only the newest version of an entry; the older row stays in the table', async () => {
        const m = memoryPool();
        const store = new CatalogStore(m.pool, 'genesis', 'earth_orbit');
        await store.seedGenesisCatalog(0);
        const bed = m.rows.find((r) => r.entry_id === 'core:bed')!;
        m.rows.push({ ...bed, version: '1.10.0', body_json: JSON.stringify({ id: 'bed', next: true }) });
        m.rows.push({ ...bed, version: '1.9.0', body_json: JSON.stringify({ id: 'bed', older: true }) });
        expect(await store.hydrate()).toBe(127);
        expect(store.list()).toHaveLength(125);
        const beds = store.list('kind').filter((e) => e.entryId === 'core:bed');
        expect(beds).toHaveLength(1);
        expect(beds[0].version).toBe('1.10.0');
        expect(beds[0].body).toEqual({ id: 'bed', next: true });
    });

    it('compares versions by number, not by text', () => {
        expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
        expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
    });
});
