/**
 * LoreStorage — MySQL wrapper for lore_commons hash index (Phase 20 LORE-01).
 *
 * Sole responsibility: CRUD on lore_commons table.
 * Write errors are swallowed (audit chain is truth; citation_count is denormalized cache).
 * Read errors are propagated (REST endpoint caller handles them).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface LoreEntryRow {
    contributor_did: string;
    tick: number;
    content_hash: string;
    title_hash: string;
    category_tag: string;
    citation_count: number;
}

export class LoreStorage {
    constructor(public readonly pool: Pool) {}

    /** Insert or ignore a lore contribution entry. Swallows errors. */
    async upsertContribution(
        gridName: string,
        contentHash: string,
        contributorDid: string,
        titleHash: string,
        categoryTag: string,
        tick: number,
    ): Promise<void> {
        const sql = `
            INSERT IGNORE INTO lore_commons
                (grid_name, content_hash, contributor_did, title_hash, category_tag, citation_count, contributed_tick)
            VALUES (?, ?, ?, ?, ?, 0, ?)
        `;
        try {
            await this.pool.query(sql, [gridName, contentHash, contributorDid, titleHash, categoryTag, tick]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(JSON.stringify({ msg: 'lore_contribution_upsert_failed', gridName, contentHash, err: msg }));
        }
    }

    /** Increment citation_count by 1 for a lore entry. Swallows errors. */
    async incrementCitationCount(gridName: string, contentHash: string): Promise<void> {
        try {
            await this.pool.query(
                'UPDATE lore_commons SET citation_count = citation_count + 1 WHERE grid_name = ? AND content_hash = ?',
                [gridName, contentHash],
            );
        } catch (err) {
            // Swallow — audit chain is truth; citation_count is a denormalized cache
        }
    }

    /**
     * Query lore_commons entries. Propagates errors (caller handles).
     * Params: category optional filter; limit default 20.
     * Returns rows with all columns needed for REST response (D-20-11).
     */
    async queryEntries(
        gridName: string,
        category?: string,
        limit = 20,
    ): Promise<LoreEntryRow[]> {
        const clampedLimit = Math.min(Math.max(1, limit), 100);
        let sql: string;
        let params: unknown[];
        if (category) {
            sql = `
                SELECT contributor_did, contributed_tick AS tick, content_hash, title_hash, category_tag, citation_count
                FROM lore_commons
                WHERE grid_name = ? AND category_tag = ?
                ORDER BY contributed_tick DESC
                LIMIT ?
            `;
            params = [gridName, category, clampedLimit];
        } else {
            sql = `
                SELECT contributor_did, contributed_tick AS tick, content_hash, title_hash, category_tag, citation_count
                FROM lore_commons
                WHERE grid_name = ?
                ORDER BY contributed_tick DESC
                LIMIT ?
            `;
            params = [gridName, clampedLimit];
        }
        const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
        return rows as LoreEntryRow[];
    }
}
