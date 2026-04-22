/**
 * DatabaseConnection — mysql2 connection pool wrapper.
 *
 * Provides typed query/execute helpers over a pooled connection.
 * Use fromEnv() for production; inject DbConfig for tests/Docker.
 */

import mysql from 'mysql2/promise';
import type { DbConfig } from './types.js';

export class DatabaseConnection {
    private readonly pool: mysql.Pool;

    constructor(config: DbConfig) {
        this.pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            connectionLimit: config.connectionLimit ?? 5,
            waitForConnections: true,
            enableKeepAlive: true,
        });
    }

    /** Create a connection from environment variables. */
    static fromEnv(): DatabaseConnection {
        return new DatabaseConnection({
            host:     process.env['MYSQL_HOST']     ?? 'localhost',
            port:     parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
            user:     process.env['MYSQL_USER']     ?? 'root',
            password: process.env['MYSQL_PASSWORD'] ?? '',
            database: process.env['MYSQL_DATABASE'] ?? 'noesis_grid',
        });
    }

    /** Execute a SELECT query and return typed rows. */
    async query<T = unknown>(sql: string, values?: unknown[]): Promise<T[]> {
        const [rows] = await this.pool.execute(sql, values as never);
        return rows as T[];
    }

    /** Execute a DML/DDL statement (INSERT, UPDATE, DELETE, CREATE). */
    async execute(sql: string, values?: unknown[]): Promise<void> {
        await this.pool.execute(sql, values as never);
    }

    /** Close all connections in the pool. */
    async close(): Promise<void> {
        await this.pool.end();
    }

    /**
     * Return the underlying mysql2 Pool so other subsystems (e.g. Phase 9
     * RelationshipStorage via GenesisLauncher.attachRelationshipStorage) can
     * reuse the same connection pool without constructing a second one.
     */
    getPool(): mysql.Pool {
        return this.pool;
    }
}
