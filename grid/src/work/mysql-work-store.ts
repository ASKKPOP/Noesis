/**
 * WorkStore on MySQL — table `works` (migration v82). The card is kept as text, not as a
 * JSON column: MySQL rewrites JSON values, and `card_hash` is the sha256 of the exact
 * text. `replace` is the version check: the row changes only while it still holds the
 * version the write was based on.
 */
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { WorkCard } from './work-logic.js';
import type { WorkListOptions, WorkRow, WorkStore } from './work-service.js';

interface StoredRow extends RowDataPacket { card_json: string; card_hash: string }

const toRow = (r: StoredRow): WorkRow => ({ card: JSON.parse(r.card_json) as WorkCard, json: r.card_json, hash: r.card_hash });

export class MysqlWorkStore implements WorkStore {
    constructor(private readonly pool: Pool) {}

    async insert(row: WorkRow): Promise<void> {
        const c = row.card;
        await this.pool.query(
            `INSERT INTO works
               (grid_name, work_id, stage, owner_civic_did, builder_civic_did, version, card_json, card_hash, created_tick, updated_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.grid, c.work_id, c.stage, c.owner, c.builder, c.version, row.json, row.hash, c.created_tick, c.updated_tick],
        );
    }

    async get(gridName: string, workId: string): Promise<WorkRow | null> {
        const [rows] = await this.pool.query<StoredRow[]>(
            `SELECT card_json, card_hash FROM works WHERE grid_name = ? AND work_id = ? LIMIT 1`,
            [gridName, workId],
        );
        return rows[0] ? toRow(rows[0]) : null;
    }

    async replace(expectedVersion: number, row: WorkRow): Promise<boolean> {
        const c = row.card;
        const [res] = await this.pool.query<ResultSetHeader>(
            `UPDATE works SET stage = ?, version = ?, card_json = ?, card_hash = ?, updated_tick = ?
              WHERE grid_name = ? AND work_id = ? AND version = ?`,
            [c.stage, c.version, row.json, row.hash, c.updated_tick, c.grid, c.work_id, expectedVersion],
        );
        return res.affectedRows === 1;
    }

    async list(gridName: string, opts: WorkListOptions): Promise<WorkRow[]> {
        const where = ['grid_name = ?'];
        const params: Array<string | number> = [gridName];
        if (opts.stage !== undefined) { where.push('stage = ?'); params.push(opts.stage); }
        if (opts.owner !== undefined) { where.push('owner_civic_did = ?'); params.push(opts.owner); }
        if (opts.builder !== undefined) { where.push('builder_civic_did = ?'); params.push(opts.builder); }
        if (opts.notBuilder !== undefined) { where.push('builder_civic_did <> ?'); params.push(opts.notBuilder); }
        params.push(opts.limit);
        const [rows] = await this.pool.query<StoredRow[]>(
            `SELECT card_json, card_hash FROM works WHERE ${where.join(' AND ')} ORDER BY updated_tick DESC, work_id ASC LIMIT ?`,
            params,
        );
        return rows.map(toRow);
    }
}
