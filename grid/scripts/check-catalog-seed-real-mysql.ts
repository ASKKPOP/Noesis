/**
 * Real-MySQL gate for the Genesis catalog seed (Grid House Objects §15.2).
 *
 * The vitest suite seeds against an in-memory stand-in. This script asserts on a real
 * MySQL 8.0, after the migration chain (run check-migrations-real-mysql.ts first; same
 * env variables), what only the database can show: that a JSON body is stored and read
 * back unchanged, that INSERT IGNORE makes a second boot write nothing, that two seeds
 * running at once still leave one row per entry, that two Grids keep their own rows,
 * and that a stored Tier 0 row changed behind the code's back stops the boot.
 *
 * Usage (CI: .github/workflows/real-mysql-migrations.yml):
 *   cd grid && npx tsx scripts/check-catalog-seed-real-mysql.ts
 */
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/db/connection.js';
import { CatalogStore } from '../src/civic/catalog-store.js';
import { canonicalJson, genesisCatalogEntries } from '../src/civic/genesis-catalog.js';
import { createHash } from 'node:crypto';

const TAG = '[check-catalog-seed-real-mysql]';

async function main(): Promise<void> {
    const db = new DatabaseConnection({
        host:     process.env['MYSQL_HOST']     ?? '127.0.0.1',
        port:     parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
        user:     process.env['MYSQL_USER']     ?? 'root',
        password: process.env['MYSQL_PASSWORD'] ?? 'root',
        database: process.env['MYSQL_DATABASE'] ?? 'noesis_grid',
    });
    const pool = db.getPool();
    // Grid names of their own, so a re-run on the same database starts clean.
    const G = `gate_${Date.now().toString(36)}`;
    const M = `${G}_mars`;
    const count = async (grid: string) => {
        const [r] = await pool.query('SELECT COUNT(*) AS n FROM civic_catalog_entries WHERE grid_name = ?', [grid]);
        return Number((r as Array<{ n: number }>)[0].n);
    };
    try {
        // 1. The first boot writes every Tier 0 row for the environment.
        const store = new CatalogStore(pool, G, 'earth_orbit');
        assert.equal(await store.seedGenesisCatalog(0), 125, 'first seed writes 125 rows');
        assert.equal(await count(G), 125);

        // 2. A JSON body comes back from MySQL equal to the code, and hashes the same.
        assert.equal(await store.hydrate(), 125);
        const want = new Map(genesisCatalogEntries('earth_orbit').map((e) => [e.entryId, e]));
        for (const e of store.list()) {
            const w = want.get(e.entryId)!;
            assert.deepEqual(e.body, JSON.parse(JSON.stringify(w.body)), `${e.entryId}: body round-trips`);
            assert.equal(createHash('sha256').update(canonicalJson(e.body)).digest('hex'), w.bodyHash,
                `${e.entryId}: the stored body still hashes to its body_hash`);
        }

        // 3. Every later boot writes nothing, also two boots at the same moment.
        const again = await Promise.all([
            new CatalogStore(pool, G, 'earth_orbit').seedGenesisCatalog(9),
            new CatalogStore(pool, G, 'earth_orbit').seedGenesisCatalog(9),
        ]);
        assert.deepEqual(again, [0, 0], 'a re-seed writes nothing');
        const fresh = `${G}_race`;
        const race = await Promise.all([
            new CatalogStore(pool, fresh, 'earth_orbit').seedGenesisCatalog(0),
            new CatalogStore(pool, fresh, 'earth_orbit').seedGenesisCatalog(0),
        ]);
        assert.equal(race[0] + race[1], 125, 'two first boots at once write each row exactly once');
        assert.equal(await count(fresh), 125);

        // 4. Two Grids in one database keep their own catalogs; Mars has its in-situ materials.
        assert.equal(await new CatalogStore(pool, M, 'mars').seedGenesisCatalog(0), 127);
        const [mars] = await pool.query(
            "SELECT entry_id FROM civic_catalog_entries WHERE grid_name = ? AND type = 'material' AND entry_id IN ('core:sintered_regolith','core:sulfur_concrete')",
            [M]);
        assert.equal((mars as unknown[]).length, 2, 'Mars has regolith and sulfur concrete');
        assert.equal(await count(G), 125, 'seeding Mars changed nothing in the first Grid');

        // 5. A Tier 0 row changed behind the code's back stops the boot.
        await pool.query("UPDATE civic_catalog_entries SET body_hash = REPEAT('0', 64) WHERE grid_name = ? AND entry_id = 'core:work_desk'", [G]);
        await assert.rejects(store.seedGenesisCatalog(0), /catalog_tier0_drift: core:work_desk/);

        console.log(`${TAG} OK — 125 rows seeded once, bodies round-trip, re-seed and concurrent seed write nothing, Grids separate, drift refused`);
    } finally {
        await pool.query('DELETE FROM civic_catalog_entries WHERE grid_name IN (?, ?, ?)', [G, M, `${G}_race`]);
        await db.close();
    }
}

main().catch((e) => {
    console.error(`${TAG} FAILED:`, e);
    process.exit(1);
});
