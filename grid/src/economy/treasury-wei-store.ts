/**
 * F1 (money rails) — Treasury wei: the civic commons fund in wei.
 *
 * Operates on the civic_treasury.balance_wei column (migration v46), separate
 * from the legacy Ousia balance owned by IrsStore. Inflows (creditWei): fees +
 * the civic due. Outflows (debitWei): Polis-authorized disbursement / RFP award —
 * the caller enforces authorization + emits the audit events (as IrsStore.disburse
 * does); this store only moves money. Atomic (SELECT ... FOR UPDATE → UPDATE),
 * wei as bigint (DECIMAL(65,0) string ↔ BigInt).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { creditTreasuryWeiOnConn, debitTreasuryWeiOnConn } from './wei-ops.js';

export class TreasuryWeiStore {
    constructor(private readonly pool: Pool) {}

    /** Current treasury wei balance (0 if absent). */
    async getWeiBalance(gridName: string): Promise<bigint> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT balance_wei FROM civic_treasury WHERE grid_name = ?`,
            [gridName],
        );
        return BigInt(rows[0]?.balance_wei ?? 0);
    }

    /** Add wei to the treasury (fees / civic due). amountWei must be > 0. */
    async creditWei(params: { gridName: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await creditTreasuryWeiOnConn(conn, params);
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM civic_treasury WHERE grid_name = ?`,
                [params.gridName],
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

    /** Spend treasury wei (Polis-authorized by the caller). Throws 'insufficient_treasury_wei'. */
    async debitWei(params: { gridName: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const newBalance = await debitTreasuryWeiOnConn(conn, params);
            await conn.commit();
            return { newBalance };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }
}
