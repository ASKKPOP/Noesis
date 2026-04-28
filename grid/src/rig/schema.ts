/**
 * Rig MySQL schema bootstrap — Phase 14 RIG-02.
 *
 * Creates an isolated MySQL schema for a single Rig run, applies the same MIGRATIONS
 * as production via MigrationRunner. Schema is LEFT after rig exit for researcher
 * post-hoc queries (D-14-01); no auto-drop.
 */
import mysql from 'mysql2/promise';
import { DatabaseConnection } from '../db/connection.js';
import { MigrationRunner } from '../db/migration-runner.js';
import { makeRigSchemaName } from './types.js';

export interface RigSchemaHandle {
    readonly schemaName: string;
    readonly db: DatabaseConnection;
    readonly migrationsApplied: number;
}

export interface RigSchemaBootstrapOptions {
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
    readonly configName: string;
    readonly seed: string;
}

/**
 * Connects to MySQL admin, CREATE SCHEMA IF NOT EXISTS rig_<name>_<seed8>, then
 * returns a DatabaseConnection scoped to that schema with all MIGRATIONS applied.
 * Idempotent: safe to call twice with the same (configName, seed) — second call
 * is a no-op for schema creation and migrations.
 */
export async function createRigSchema(opts: RigSchemaBootstrapOptions): Promise<RigSchemaHandle> {
    const schemaName = makeRigSchemaName(opts.configName, opts.seed);

    // Step 1: connect WITHOUT a database to issue DDL
    const adminConn = await mysql.createConnection({
        host: opts.host, port: opts.port, user: opts.user, password: opts.password,
    });
    try {
        // Backtick the identifier; we already validated charset in makeRigSchemaName.
        await adminConn.query(`CREATE SCHEMA IF NOT EXISTS \`${schemaName}\``);
    } finally {
        await adminConn.end();
    }

    // Step 2: connect scoped to the rig schema and run migrations
    const db = new DatabaseConnection({
        host: opts.host, port: opts.port, user: opts.user, password: opts.password,
        database: schemaName,
    });
    const runner = new MigrationRunner(db);
    const migrationsApplied = await runner.run();

    return { schemaName, db, migrationsApplied };
}
