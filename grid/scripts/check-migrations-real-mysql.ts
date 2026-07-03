/**
 * W-D2 (Substrate Trust) — real-MySQL migration CI gate.
 *
 * Runs the FULL migration chain (grid/src/db/schema.ts MIGRATIONS) against a
 * real MySQL 8.0 from an empty database, via the same MigrationRunner the Grid
 * uses on boot. Exits non-zero on any SQL error and prints the final schema
 * version.
 *
 * Why: the grid vitest suite runs against a mock mysql2 Pool — no real SQL
 * parsing. Reserved-word identifiers or syntax errors in migration SQL pass CI
 * green yet crash-loop the Grid container on the first real deploy (2026-06-14
 * incident: unquoted `condition` column → ER_PARSE_ERROR 1064). This gate
 * closes that blind spot. See .planning/implementation/migrations.md.
 *
 * Usage (CI: .github/workflows/real-mysql-migrations.yml):
 *   cd grid && npx tsx scripts/check-migrations-real-mysql.ts
 *
 * Env (sane CI defaults): MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root
 * MYSQL_PASSWORD=root MYSQL_DATABASE=noesis_grid
 */

import { DatabaseConnection } from '../src/db/connection.js';
import { MigrationRunner } from '../src/db/migration-runner.js';
import { MIGRATIONS } from '../src/db/schema.js';

const TAG = '[check-migrations-real-mysql]';

function envConfig() {
    return {
        host:     process.env['MYSQL_HOST']     ?? '127.0.0.1',
        port:     parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
        user:     process.env['MYSQL_USER']     ?? 'root',
        password: process.env['MYSQL_PASSWORD'] ?? 'root',
        database: process.env['MYSQL_DATABASE'] ?? 'noesis_grid',
    };
}

/** Wait for MySQL to accept connections (service container may still be booting). */
async function waitForReady(db: DatabaseConnection, attempts = 30, delayMs = 2_000): Promise<void> {
    for (let i = 1; i <= attempts; i++) {
        try {
            await db.query('SELECT 1');
            return;
        } catch (err) {
            if (i === attempts) throw err;
            console.log(`${TAG} MySQL not ready (attempt ${i}/${attempts}), retrying in ${delayMs}ms...`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

async function main(): Promise<void> {
    const config = envConfig();
    console.log(`${TAG} target: mysql://${config.user}@${config.host}:${config.port}/${config.database}`);
    console.log(`${TAG} migration chain: ${MIGRATIONS.length} migrations (v1 → v${MIGRATIONS[MIGRATIONS.length - 1].version})`);

    const db = new DatabaseConnection(config);
    try {
        await waitForReady(db);

        const runner = new MigrationRunner(db);
        const applied = await runner.run();
        const version = await runner.currentVersion();
        const expected = Math.max(...MIGRATIONS.map((m) => m.version));

        console.log(`${TAG} applied ${applied} migrations; final schema version = ${version}`);
        if (version !== expected) {
            console.error(`${TAG} FAIL: final schema version ${version} !== expected ${expected}`);
            process.exitCode = 1;
            return;
        }
        console.log(`${TAG} PASS: full migration chain applied cleanly on real MySQL`);
    } catch (err) {
        // Any SQL error (e.g. reserved-word ER_PARSE_ERROR 1064) lands here.
        console.error(`${TAG} FAIL: migration chain errored on real MySQL`);
        console.error(err);
        process.exitCode = 1;
    } finally {
        await db.close().catch(() => { /* pool may never have connected */ });
    }
}

void main();
