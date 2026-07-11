/**
 * Issue #9 end-to-end regression — endow → buy land → IRS sees revenue, on ONE
 * civic-DID-keyed ledger (real MySQL).
 *
 * The bug (UAT 2026-07-10, Issue #9): the in-DB economy ran on two non-fungible
 * ledgers. `endow` funded `nous_accounts` (Ledger A, civic-DID), but land purchase
 * spent `nous_registry.balance_wei` (Ledger B, existence-DID) — so a freshly-endowed
 * citizen hit `buyer_not_found`, and the IRS (which reads `civic_treasury`) was blind
 * to land revenue. Phase 62.5-02..05 unified everything on `nous_accounts` +
 * `civic_treasury`. This test drives the exact money moves the real routes make —
 * `NousAccountStore.getBalance` + `chargeToTreasury` (civic-parcels.ts:161,181), and
 * the IRS `SELECT balance_wei FROM civic_treasury` (irs.ts) — against a real MySQL, so
 * the split-ledger regression cannot silently return.
 *
 * Builds the exact production DDL in a scratch DB and SKIPS gracefully with no DB. Run:
 *   MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 MYSQL_USER=root MYSQL_PASSWORD=<pw> \
 *     npx vitest run test/economy/issue-9-endow-buy-land-irs.e2e.test.ts
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';

const CFG = {
    host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
    port: parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
    user: process.env['MYSQL_USER'] ?? 'root',
    password: process.env['MYSQL_PASSWORD'] ?? '',
};
const IT_DB = 'noesis_issue9_e2e';
const GRID = 'genesis';
const BUYER = 'did:civic:noesis:citizen1';

const CIVIC_TREASURY_DDL = `
    CREATE TABLE civic_treasury (
        grid_name VARCHAR(63) NOT NULL, balance_bios BIGINT NOT NULL DEFAULT 0,
        last_updated_tick INT NOT NULL DEFAULT 0, balance_wei DECIMAL(65,0) NOT NULL DEFAULT 0,
        PRIMARY KEY (grid_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const NOUS_ACCOUNTS_DDL = `
    CREATE TABLE nous_accounts (
        grid_name VARCHAR(64) NOT NULL, civic_did VARCHAR(255) NOT NULL,
        balance_wei DECIMAL(65,0) NOT NULL DEFAULT 0, session_cap_wei DECIMAL(65,0) NOT NULL DEFAULT 0,
        session_expiry BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
        PRIMARY KEY (grid_name, civic_did)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

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

// The exact query irs.ts runs to report treasury revenue.
async function irsTreasuryWei(): Promise<bigint> {
    const [rows] = await pool!.query<mysql.RowDataPacket[]>(
        'SELECT balance_wei FROM civic_treasury WHERE grid_name = ?', [GRID],
    );
    return BigInt(rows[0]?.balance_wei ?? 0);
}

describe.skipIf(!dbUp)('Issue #9 E2E — endow → buy land → IRS revenue on one civic-keyed ledger (real MySQL)', () => {
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

    it('a freshly-endowed citizen can buy land, and the IRS sees the revenue (the exact loop Issue #9 broke)', async () => {
        const store = new NousAccountStore(pool!);
        // onboard
        await store.ensureAccount({ gridName: GRID, civicDid: BUYER, currentTick: 1 });
        // endow — credits the citizen's nous_accounts (the same ledger the purchase debits)
        await store.credit({ gridName: GRID, civicDid: BUYER, amountWei: 1000n, currentTick: 1 });
        expect(await store.getBalance(GRID, BUYER)).toBe(1000n);

        // buy land — the exact money move civic-parcels.ts makes: read balance, then chargeToTreasury.
        // Pre-fix this read hit Ledger B (existence-keyed) → buyer_not_found for a Ledger-A-endowed citizen.
        const price = 400n;
        const balance = await store.getBalance(GRID, BUYER);
        expect(balance >= price).toBe(true); // affordable on the SAME ledger endow funded
        await store.chargeToTreasury({ gridName: GRID, civicDid: BUYER, amountWei: price, currentTick: 2 });

        // buyer debited, treasury credited, IRS sees it (was stuck at 0 before the unification)
        expect(await store.getBalance(GRID, BUYER)).toBe(600n);
        expect(await irsTreasuryWei()).toBe(price);
    });

    it('a second purchase accumulates in the treasury the IRS reads (community/business revenue is visible too)', async () => {
        const store = new NousAccountStore(pool!);
        await store.ensureAccount({ gridName: GRID, civicDid: BUYER, currentTick: 1 });
        await store.credit({ gridName: GRID, civicDid: BUYER, amountWei: 1000n, currentTick: 1 });
        await store.chargeToTreasury({ gridName: GRID, civicDid: BUYER, amountWei: 400n, currentTick: 2 }); // land
        await store.chargeToTreasury({ gridName: GRID, civicDid: BUYER, amountWei: 100n, currentTick: 3 }); // e.g. community fee
        expect(await store.getBalance(GRID, BUYER)).toBe(500n);
        expect(await irsTreasuryWei()).toBe(500n); // IRS reflects ALL civic revenue, one treasury
    });

    it('an UNENDOWED citizen cannot overspend — the charge throws insufficient_balance, treasury untouched', async () => {
        const store = new NousAccountStore(pool!);
        await store.ensureAccount({ gridName: GRID, civicDid: BUYER, currentTick: 1 });
        await expect(
            store.chargeToTreasury({ gridName: GRID, civicDid: BUYER, amountWei: 400n, currentTick: 2 }),
        ).rejects.toThrow('insufficient_balance');
        expect(await store.getBalance(GRID, BUYER)).toBe(0n);
        expect(await irsTreasuryWei()).toBe(0n);
    });
});
