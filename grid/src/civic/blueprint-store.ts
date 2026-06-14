/**
 * Phase 61 HOUSE-4 (NH4-01 / D-61-08 / R-61-01) — write-through BlueprintStore.
 *
 * MySQL is the source of truth; the in-memory blueprint cache is a read cache. A
 * stored blueprint writes the civic_blueprints row FIRST, then the caller mirrors
 * the recipe into memory. On boot, hydrate() reloads every row for the grid back
 * into the cache.
 *
 * Lesson — HumanRegistry incident (2026-06-11): an in-memory registry not backed by
 * MySQL lost state on restart. The blueprint HASH already lives in the Phase 18 skill
 * lineage (the audit chain) — civic_blueprints stores only the Grid-side recipe BODY
 * the build executor applies. The row write emits NO chain event (Grid-side storage).
 *
 * Mirrors the Phase 58/59/60 ParcelStore DB-first persist* + hydrate pattern.
 */
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { BlueprintRecipe } from './blueprint.js';

/** A civic_blueprints DB row (snake_case columns as returned by mysql2). */
export interface BlueprintRow extends RowDataPacket {
    blueprint_hash: string;
    grid_name: string;
    recipe_json: BlueprintRecipe | string;   // mysql2 may return JSON as text
    material_cost_bios: string | number;      // BIGINT UNSIGNED arrives as string
    created_tick: number;
}

/** Parse the recipe_json JSON column (mysql2 may return it as text). */
function parseRecipe(raw: BlueprintRecipe | string): BlueprintRecipe {
    return typeof raw === 'string' ? (JSON.parse(raw) as BlueprintRecipe) : raw;
}

export class BlueprintStore {
    constructor(
        private readonly pool: Pool,
        private readonly gridName: string = 'genesis',
    ) {}

    /**
     * Persist a blueprint recipe DB-first (UPSERT civic_blueprints). recipe_json holds
     * the objects + arrangement DAG; the row write emits NOTHING on chain. The caller
     * mirrors the recipe into the in-memory cache after this returns.
     */
    async persistBlueprint(recipe: BlueprintRecipe, tick: number): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_blueprints
                (blueprint_hash, grid_name, recipe_json, material_cost_bios, created_tick)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                recipe_json = VALUES(recipe_json),
                material_cost_bios = VALUES(material_cost_bios),
                created_tick = VALUES(created_tick)`,
            [
                recipe.blueprint_hash, this.gridName, JSON.stringify(recipe),
                recipe.material_cost_bios, tick,
            ],
        );
    }

    /**
     * Hydrate the in-memory blueprint cache from the DB on boot (DB is source of truth).
     * Reads every civic_blueprints row for this grid into the cache. Returns row count.
     */
    async hydrate(cache: Map<string, BlueprintRecipe>): Promise<number> {
        const [rows] = await this.pool.query<BlueprintRow[]>(
            `SELECT * FROM civic_blueprints WHERE grid_name = ?`,
            [this.gridName],
        );
        for (const row of rows) {
            cache.set(row.blueprint_hash, parseRecipe(row.recipe_json));
        }
        return rows.length;
    }
}
