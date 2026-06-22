/**
 * F1 (money rails) — Civic-labor credit: the "labor → standing" ledger.
 *
 * Credit a Nous earns by working FOR the Polis (civic labor), redeemable for
 * standing (e.g. a parcel) without passing through ETH (D-MONEY-05). This is the
 * one place labor converts to standing directly. Credits are a civic unit (not
 * wei), handled as bigint. earn() is called by the civic-work-completion layer;
 * redeem() by the land/standing layer. Atomic redeem under SELECT ... FOR UPDATE.
 *
 * No self-mint: earn adds caller-attested civic-work credit; the store never
 * grants credit on its own. Allowlist +0 (earn/redeem audited by their callers).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class CivicLaborCreditStore {
    constructor(private readonly pool: Pool) {}

    /** Current civic-labor credit balance (0 if absent). */
    async getCredit(gridName: string, civicDid: string): Promise<bigint> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return BigInt(rows[0]?.credit_balance ?? 0);
    }

    /** Award civic-labor credit (Polis-work completion). amount must be > 0. */
    async earn(params: { gridName: string; civicDid: string; amount: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amount <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO civic_labor_credit (grid_name, civic_did, credit_balance, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE credit_balance = credit_balance + VALUES(credit_balance), updated_at = VALUES(updated_at)`,
                [params.gridName, params.civicDid, params.amount.toString(), params.currentTick, params.currentTick],
            );
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ?`,
                [params.gridName, params.civicDid],
            );
            await conn.commit();
            return { newBalance: BigInt(rows[0]?.credit_balance ?? 0) };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /** Spend civic-labor credit (redeem for standing). Throws 'insufficient_credit'. */
    async redeem(params: { gridName: string; civicDid: string; amount: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amount <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [params.gridName, params.civicDid],
            );
            const current = BigInt(rows[0]?.credit_balance ?? 0);
            if (current < params.amount) {
                await conn.rollback();
                throw new Error('insufficient_credit');
            }
            await conn.query(
                `UPDATE civic_labor_credit SET credit_balance = credit_balance - ?, updated_at = ?
                 WHERE grid_name = ? AND civic_did = ?`,
                [params.amount.toString(), params.currentTick, params.gridName, params.civicDid],
            );
            await conn.commit();
            return { newBalance: current - params.amount };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }
}
