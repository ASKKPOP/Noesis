/**
 * CatalogStore — the Grid's catalog (Grid House Objects sheet §15.1–§15.2).
 *
 * MySQL `civic_catalog_entries` holds every entry of this Grid; the read cache is
 * filled from it by `hydrate`. At every boot `seedGenesisCatalog` writes the Tier 0
 * core from code (genesis-catalog.ts), the same way the parcel and group seeds run.
 *
 * Idempotent: a row that exists at the same (entry_id, version) is left alone. Tier 0
 * is immutable within a version, so a seeded row whose hash differs from the code is
 * a release that changed an entry without changing the version. The seed refuses to
 * boot past that rather than serve two meanings under one version.
 *
 * Seeding emits no audit event and charges nobody (§15.1: "who pays: nobody").
 */
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
    genesisCatalogEntries,
    GENESIS_CATALOG_VERSION,
    type CatalogEntry,
    type CatalogEntryType,
    type CatalogEnvironment,
} from './genesis-catalog.js';

interface CatalogRow extends RowDataPacket {
    entry_id: string;
    version: string;
    tier: number;
    type: CatalogEntryType;
    level: CatalogEntry['level'];
    body_json: unknown;
    body_hash: string;
}

export class CatalogStore {
    private cache: readonly CatalogEntry[] = [];

    constructor(
        private readonly pool: Pool,
        private readonly gridName: string,
        private readonly environment: CatalogEnvironment,
    ) {}

    /**
     * Seed the Tier 0 core for this Grid's environment. Returns the rows inserted
     * (0 on every boot after the first, for the same catalog version). Throws
     * `catalog_tier0_drift` when a stored Tier 0 row disagrees with the code.
     */
    async seedGenesisCatalog(tick = 0): Promise<number> {
        const entries = genesisCatalogEntries(this.environment);
        let inserted = 0;
        for (const e of entries) {
            const [res] = await this.pool.query<ResultSetHeader>(
                `INSERT IGNORE INTO civic_catalog_entries
                    (grid_name, entry_id, version, tier, type, level, body_json, body_hash, author_hash, created_tick)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
                [this.gridName, e.entryId, e.version, e.tier, e.type, e.level, JSON.stringify(e.body), e.bodyHash, tick],
            );
            inserted += res.affectedRows;
        }
        const [rows] = await this.pool.query<CatalogRow[]>(
            `SELECT entry_id, body_hash FROM civic_catalog_entries
              WHERE grid_name = ? AND tier = 0 AND version = ?`,
            [this.gridName, GENESIS_CATALOG_VERSION],
        );
        const stored = new Map(rows.map((r) => [r.entry_id, r.body_hash]));
        const drifted = entries.filter((e) => stored.get(e.entryId) !== e.bodyHash).map((e) => e.entryId);
        if (drifted.length > 0) {
            throw new Error(`catalog_tier0_drift: ${drifted.slice(0, 5).join(', ')}${drifted.length > 5 ? ', …' : ''}`);
        }
        return inserted;
    }

    /** Load this Grid's entries into the read cache. Returns how many were loaded. */
    async hydrate(): Promise<number> {
        const [rows] = await this.pool.query<CatalogRow[]>(
            `SELECT entry_id, version, tier, type, level, body_json, body_hash
               FROM civic_catalog_entries
              WHERE grid_name = ?
              ORDER BY tier, type, entry_id, version`,
            [this.gridName],
        );
        this.cache = Object.freeze(rows.map((r) => Object.freeze({
            entryId: r.entry_id,
            tier: r.tier as CatalogEntry['tier'],
            type: r.type,
            version: r.version,
            level: r.level,
            // mysql2 returns a JSON column parsed; a string means a driver without that.
            body: typeof r.body_json === 'string' ? JSON.parse(r.body_json) : r.body_json,
            bodyHash: r.body_hash,
        })));
        return this.cache.length;
    }

    /**
     * The current entries, optionally of one type: for each entry id, the row of its
     * highest version. Older versions stay in the table (a pinned manifest may still
     * name one) but are not served as current.
     */
    list(type?: CatalogEntryType): readonly CatalogEntry[] {
        const latest = new Map<string, CatalogEntry>();
        for (const e of this.cache) {
            const seen = latest.get(e.entryId);
            if (seen === undefined || compareVersions(e.version, seen.version) > 0) latest.set(e.entryId, e);
        }
        const current = [...latest.values()];
        return type === undefined ? current : current.filter((e) => e.type === type);
    }
}

/** Compare dotted numeric versions ("1.10.0" > "1.9.0"). */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}
