/**
 * Real-MySQL integration test for the wei treasury-credit rail (CR-01 regression).
 *
 * WHY THIS EXISTS: CR-01 was a hard SQL defect (`civic_treasury` INSERT listing
 * `balance_wei` twice → MySQL ERROR 1110) that made EVERY `creditTreasuryWeiOnConn` /
 * `chargeToTreasury` throw on a real database — yet the whole unit suite stayed green
 * because it runs on the in-memory `accounts-pool` fake, which never parses SQL. This
 * test executes the real wei-ops against a real MySQL so a duplicate-column / bad-SQL
 * regression on this rail fails CI instead of silently no-op'ing the live economy.
 *
 * It builds the exact production DDL (schema.ts v35 + v46 civic_treasury, v45 nous_accounts)
 * in a namespaced scratch database and SKIPS gracefully when MySQL is unreachable — so it
 * is a no-op in environments without a DB (same philosophy as the rig tests). To run it:
 *   MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 MYSQL_USER=root MYSQL_PASSWORD=<pw> \
 *     npx vitest run test/economy/treasury-rail.integration.test.ts
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { creditTreasuryWeiOnConn, creditAccountOnConn } from '../../src/economy/wei-ops.js';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';

const CFG = {
    host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
    port: parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
    user: process.env['MYSQL_USER'] ?? 'root',
    password: process.env['MYSQL_PASSWORD'] ?? '',
};
const IT_DB = 'noesis_weirail_it';
const GRID = 'genesis';
const ALICE = 'did:civic:noesis:alice';

// civic_treasury: schema.ts v35 (grid_name/balance_bios/last_updated_tick) + v46 (balance_wei).
const CIVIC_TREASURY_DDL = `
    CREATE TABLE civic_treasury (
        grid_name           VARCHAR(63)    NOT NULL,
        balance_bios        BIGINT         NOT NULL DEFAULT 0,
        last_updated_tick   INT            NOT NULL DEFAULT 0,
        balance_wei         DECIMAL(65,0)  NOT NULL DEFAULT 0,
        PRIMARY KEY (grid_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
// nous_accounts: schema.ts v45.
const NOUS_ACCOUNTS_DDL = `
    CREATE TABLE nous_accounts (
        grid_name        VARCHAR(64)   NOT NULL,
        civic_did        VARCHAR(255)  NOT NULL,
        balance_wei      DECIMAL(65,0) NOT NULL DEFAULT 0,
        session_cap_wei  DECIMAL(65,0) NOT NULL DEFAULT 0,
        session_expiry   BIGINT        NOT NULL DEFAULT 0,
        created_at       BIGINT        NOT NULL,
        updated_at       BIGINT        NOT NULL,
        PRIMARY KEY (grid_name, civic_did)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

// Probe + full setup at collection time so describe.skipIf() reflects real readiness.
let pool: mysql.Pool | null = null;
let dbUp = false;
try {
    const admin = await mysql.createConnection(CFG);
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${IT_DB}\``);
    await admin.end();
    pool = mysql.createPool({ ...CFG, database: IT_DB, connectionLimit: 4, waitForConnections: true });
    await pool.query('DROP TABLE IF EXISTS civic_treasury');
    await pool.query('DROP TABLE IF EXISTS nous_accounts');
    await pool.query(CIVIC_TREASURY_DDL);
    await pool.query(NOUS_ACCOUNTS_DDL);
    dbUp = true;
} catch {
    dbUp = false;
    if (pool) { try { await pool.end(); } catch { /* ignore */ } pool = null; }
}

// Seed a nous_accounts balance via the real credit rail (one transaction).
async function seed(civicDid: string, amountWei: bigint): Promise<void> {
    const conn = await pool!.getConnection();
    try {
        await conn.beginTransaction();
        await creditAccountOnConn(conn, { gridName: GRID, civicDid, amountWei, currentTick: 0 });
        await conn.commit();
    } finally {
        conn.release();
    }
}
async function treasuryWei(): Promise<bigint> {
    const [rows] = await pool!.query<mysql.RowDataPacket[]>(
        'SELECT balance_wei FROM civic_treasury WHERE grid_name = ?', [GRID],
    );
    return BigInt(rows[0]?.balance_wei ?? 0);
}

describe.skipIf(!dbUp)('wei treasury-credit rail — real MySQL (CR-01 regression)', () => {
    beforeEach(async () => {
        await pool!.query('TRUNCATE civic_treasury');
        await pool!.query('TRUNCATE nous_accounts');
    });
    afterAll(async () => {
        if (pool) {
            try { await pool.query(`DROP DATABASE IF EXISTS \`${IT_DB}\``); } catch { /* ignore */ }
            await pool.end();
        }
    });

    it('creditTreasuryWeiOnConn actually credits civic_treasury.balance_wei (would catch CR-01 ERROR 1110)', async () => {
        const conn = await pool!.getConnection();
        try {
            await conn.beginTransaction();
            await creditTreasuryWeiOnConn(conn, { gridName: GRID, amountWei: 100n, currentTick: 1 });
            await creditTreasuryWeiOnConn(conn, { gridName: GRID, amountWei: 50n, currentTick: 2 }); // ON DUPLICATE KEY accumulate
            await conn.commit();
        } finally {
            conn.release();
        }
        expect(await treasuryWei()).toBe(150n);
    });

    it('chargeToTreasury debits nous_accounts and credits civic_treasury (end-to-end on real SQL)', async () => {
        const store = new NousAccountStore(pool!);
        await seed(ALICE, 1000n);
        const { newBalance } = await store.chargeToTreasury({ gridName: GRID, civicDid: ALICE, amountWei: 400n, currentTick: 3 });
        expect(newBalance).toBe(600n);
        expect(await store.getBalance(GRID, ALICE)).toBe(600n);
        expect(await treasuryWei()).toBe(400n);
    });

    it('chargeToTreasury throws insufficient_balance and leaves NO partial state (atomic rollback)', async () => {
        const store = new NousAccountStore(pool!);
        await seed(ALICE, 100n);
        await expect(
            store.chargeToTreasury({ gridName: GRID, civicDid: ALICE, amountWei: 500n, currentTick: 5 }),
        ).rejects.toThrow('insufficient_balance');
        expect(await store.getBalance(GRID, ALICE)).toBe(100n); // account untouched
        expect(await treasuryWei()).toBe(0n);                   // treasury not credited
    });
});
