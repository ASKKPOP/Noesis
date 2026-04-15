/**
 * MigrationRunner — schema versioning for Grid MySQL tables.
 *
 * Tracks applied migrations in the `grid_migrations` table.
 * Runs each pending migration in version order.
 * Rollback support via each migration's `down` SQL.
 */

import { MIGRATIONS } from './schema.js';
import type { DatabaseConnection } from './connection.js';

export class MigrationRunner {
    constructor(private readonly db: DatabaseConnection) {}

    /**
     * Apply all pending migrations.
     * Returns the number of migrations applied.
     */
    async run(): Promise<number> {
        // Migration 1 creates the migrations table — run it unconditionally
        // (CREATE TABLE IF NOT EXISTS is idempotent).
        await this.db.execute(MIGRATIONS[0].up);

        const applied = await this.getApplied();
        let count = 0;

        for (const migration of MIGRATIONS) {
            if (applied.has(migration.version)) continue;

            await this.db.execute(migration.up);
            await this.db.execute(
                `INSERT INTO grid_migrations (version, name) VALUES (?, ?)`,
                [migration.version, migration.name],
            );
            count++;
        }

        return count;
    }

    /**
     * Roll back migrations down to (but not including) `toVersion`.
     * Default rolls back ALL migrations.
     */
    async rollback(toVersion = 0): Promise<void> {
        const applied = await this.getApplied();

        const toRollback = MIGRATIONS
            .filter(m => applied.has(m.version) && m.version > toVersion)
            .sort((a, b) => b.version - a.version);   // highest first

        for (const migration of toRollback) {
            await this.db.execute(migration.down);
            await this.db.execute(
                `DELETE FROM grid_migrations WHERE version = ?`,
                [migration.version],
            );
        }
    }

    /** Return the set of applied migration versions. */
    async getApplied(): Promise<Set<number>> {
        try {
            const rows = await this.db.query<{ version: number }>(
                `SELECT version FROM grid_migrations ORDER BY version ASC`,
            );
            return new Set(rows.map(r => r.version));
        } catch {
            // Table doesn't exist yet
            return new Set();
        }
    }

    /** Return the highest applied migration version (0 = nothing applied). */
    async currentVersion(): Promise<number> {
        const applied = await this.getApplied();
        return applied.size > 0 ? Math.max(...applied) : 0;
    }
}
