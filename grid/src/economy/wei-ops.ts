/**
 * F1 (money rails) — connection-scoped wei moves: the single source of truth for
 * how wei is added/removed on nous_accounts and civic_treasury. Each runs on a
 * caller-supplied connection and does NO transaction management, so callers
 * (NousAccountStore, TreasuryWeiStore, LaborEscrowStore) compose them inside one
 * atomic transaction. No internal mint: credits add caller-funded wei; debits
 * verify funds under SELECT ... FOR UPDATE.
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export async function creditAccountOnConn(conn: PoolConnection, p: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<void> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    await conn.query(
        `INSERT INTO nous_accounts
           (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, ?, ?)
         ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), updated_at = VALUES(updated_at)`,
        [p.gridName, p.civicDid, p.amountWei.toString(), p.currentTick, p.currentTick],
    );
}

export async function debitAccountOnConn(conn: PoolConnection, p: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<bigint> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
        [p.gridName, p.civicDid],
    );
    const current = BigInt(rows[0]?.balance_wei ?? 0);
    if (current < p.amountWei) throw new Error('insufficient_balance');
    await conn.query(
        `UPDATE nous_accounts SET balance_wei = balance_wei - ?, updated_at = ? WHERE grid_name = ? AND civic_did = ?`,
        [p.amountWei.toString(), p.currentTick, p.gridName, p.civicDid],
    );
    return current - p.amountWei;
}

export async function creditTreasuryWeiOnConn(conn: PoolConnection, p: { gridName: string; amountWei: bigint; currentTick: number }): Promise<void> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    await conn.query(
        `INSERT INTO civic_treasury (grid_name, balance_wei, balance_wei, last_updated_tick)
         VALUES (?, 0, ?, ?)
         ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), last_updated_tick = VALUES(last_updated_tick)`,
        [p.gridName, p.amountWei.toString(), p.currentTick],
    );
}

export async function debitTreasuryWeiOnConn(conn: PoolConnection, p: { gridName: string; amountWei: bigint; currentTick: number }): Promise<bigint> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT balance_wei FROM civic_treasury WHERE grid_name = ? FOR UPDATE`,
        [p.gridName],
    );
    const current = BigInt(rows[0]?.balance_wei ?? 0);
    if (current < p.amountWei) throw new Error('insufficient_treasury_wei');
    await conn.query(
        `UPDATE civic_treasury SET balance_wei = balance_wei - ?, last_updated_tick = ? WHERE grid_name = ?`,
        [p.amountWei.toString(), p.currentTick, p.gridName],
    );
    return current - p.amountWei;
}
