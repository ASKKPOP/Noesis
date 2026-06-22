/**
 * F1 (money rails) — NousAccount: a Nous's wei-denominated, non-custodial account.
 *
 * The account holder for the two-money economy (D-MONEY-01). Balances are in wei
 * (real-ETH denomination), stored as DECIMAL(65,0) and handled as bigint. Moves
 * are atomic (SELECT ... FOR UPDATE → UPDATE → commit), mirroring IrsStore.
 *
 * Model-first / chain-ready (D-MONEY-02): session_cap_wei + session_expiry mirror
 * the future on-chain capped session key; carried but not enforced in this slice.
 *
 * No internal mint (D-MONEY-01): accounts start at zero (no birth faucet); credit
 * adds wei a caller funds from a real inflow — the store never conjures balance.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class NousAccountStore {
    constructor(private readonly pool: Pool) {}

    /** Create the account row if absent (idempotent, zero balance — no faucet). */
    async ensureAccount(params: { gridName: string; civicDid: string; currentTick: number }): Promise<void> {
        await this.pool.query(
            `INSERT IGNORE INTO nous_accounts
               (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
             VALUES (?, ?, 0, 0, 0, ?, ?)`,
            [params.gridName, params.civicDid, params.currentTick, params.currentTick],
        );
    }

    /** Current balance in wei (0 if the account does not exist). */
    async getBalance(gridName: string, civicDid: string): Promise<bigint> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return BigInt(rows[0]?.balance_wei ?? 0);
    }

    /** Add wei to an account (creating it if needed). amountWei must be > 0. */
    async credit(params: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO nous_accounts
                   (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
                 VALUES (?, ?, ?, 0, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), updated_at = VALUES(updated_at)`,
                [params.gridName, params.civicDid, params.amountWei.toString(), params.currentTick, params.currentTick],
            );
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ?`,
                [params.gridName, params.civicDid],
            );
            await conn.commit();
            return { newBalance: BigInt(rows[0]?.balance_wei ?? 0) };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /** Remove wei from an account. Throws 'insufficient_balance'. amountWei must be > 0. */
    async debit(params: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [params.gridName, params.civicDid],
            );
            const current = BigInt(rows[0]?.balance_wei ?? 0);
            if (current < params.amountWei) {
                await conn.rollback();
                throw new Error('insufficient_balance');
            }
            await conn.query(
                `UPDATE nous_accounts SET balance_wei = balance_wei - ?, updated_at = ?
                 WHERE grid_name = ? AND civic_did = ?`,
                [params.amountWei.toString(), params.currentTick, params.gridName, params.civicDid],
            );
            await conn.commit();
            return { newBalance: current - params.amountWei };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /** Move wei from one account to another atomically. Throws 'insufficient_balance'. */
    async transfer(params: { gridName: string; fromDid: string; toDid: string; amountWei: bigint; currentTick: number }): Promise<void> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        if (params.fromDid === params.toDid) throw new Error('invalid_transfer_self');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [params.gridName, params.fromDid],
            );
            const fromBalance = BigInt(rows[0]?.balance_wei ?? 0);
            if (fromBalance < params.amountWei) {
                await conn.rollback();
                throw new Error('insufficient_balance');
            }
            await conn.query(
                `UPDATE nous_accounts SET balance_wei = balance_wei - ?, updated_at = ?
                 WHERE grid_name = ? AND civic_did = ?`,
                [params.amountWei.toString(), params.currentTick, params.gridName, params.fromDid],
            );
            await conn.query(
                `INSERT INTO nous_accounts
                   (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
                 VALUES (?, ?, ?, 0, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), updated_at = VALUES(updated_at)`,
                [params.gridName, params.toDid, params.amountWei.toString(), params.currentTick, params.currentTick],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }
}
