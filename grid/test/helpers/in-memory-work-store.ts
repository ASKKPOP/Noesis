/**
 * Test helper — WorkStore without a database. `replace` compares and sets in one
 * synchronous step, the way the SQL `UPDATE … WHERE version = ?` does. Every call yields
 * first, so writes started together interleave.
 */
import type { WorkListOptions, WorkRow, WorkStore } from '../../src/work/work-service.js';

export class InMemoryWorkStore implements WorkStore {
    readonly rows = new Map<string, WorkRow>();
    private key(grid: string, workId: string): string { return `${grid} ${workId}`; }

    async insert(row: WorkRow): Promise<void> {
        await Promise.resolve();
        const k = this.key(row.card.grid, row.card.work_id);
        if (this.rows.has(k)) throw new Error('duplicate work_id');
        this.rows.set(k, row);
    }

    async get(grid: string, workId: string): Promise<WorkRow | null> {
        await Promise.resolve();
        return this.rows.get(this.key(grid, workId)) ?? null;
    }

    async replace(expectedVersion: number, row: WorkRow): Promise<boolean> {
        await Promise.resolve();
        const k = this.key(row.card.grid, row.card.work_id);
        const current = this.rows.get(k);
        if (!current || current.card.version !== expectedVersion) return false;
        this.rows.set(k, row);
        return true;
    }

    async list(grid: string, opts: WorkListOptions): Promise<WorkRow[]> {
        await Promise.resolve();
        return [...this.rows.values()]
            .filter((r) => r.card.grid === grid && (opts.stage === undefined || r.card.stage === opts.stage)
                && (opts.owner === undefined || r.card.owner === opts.owner)
                && (opts.builder === undefined || r.card.builder === opts.builder)
                && (opts.notBuilder === undefined || r.card.builder !== opts.notBuilder))
            .sort((a, b) => b.card.updated_tick - a.card.updated_tick || (a.card.work_id < b.card.work_id ? -1 : 1))
            .slice(0, opts.limit);
    }
}
