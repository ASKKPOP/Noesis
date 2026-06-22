/**
 * F1/L1 — connection-scoped civic-labor credit moves: the single source of truth
 * for earning/redeeming credit on civic_labor_credit. Runs on a caller-supplied
 * connection (no txn mgmt) so callers (CivicLaborCreditStore, CivicDueStore)
 * compose them inside one atomic transaction. No self-mint; redeem verifies under
 * SELECT ... FOR UPDATE.
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export async function earnCreditOnConn(conn: PoolConnection, p: { gridName: string; civicDid: string; amount: bigint; currentTick: number }): Promise<void> {
    if (p.amount <= 0n) throw new Error('invalid_amount');
    await conn.query(
        `INSERT INTO civic_labor_credit (grid_name, civic_did, credit_balance, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE credit_balance = credit_balance + VALUES(credit_balance), updated_at = VALUES(updated_at)`,
        [p.gridName, p.civicDid, p.amount.toString(), p.currentTick, p.currentTick],
    );
}

export async function redeemCreditOnConn(conn: PoolConnection, p: { gridName: string; civicDid: string; amount: bigint; currentTick: number }): Promise<bigint> {
    if (p.amount <= 0n) throw new Error('invalid_amount');
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
        [p.gridName, p.civicDid],
    );
    const current = BigInt(rows[0]?.credit_balance ?? 0);
    if (current < p.amount) throw new Error('insufficient_credit');
    await conn.query(
        `UPDATE civic_labor_credit SET credit_balance = credit_balance - ?, updated_at = ? WHERE grid_name = ? AND civic_did = ?`,
        [p.amount.toString(), p.currentTick, p.gridName, p.civicDid],
    );
    return current - p.amount;
}
