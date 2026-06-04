/**
 * Phase 45 (IRS-01..04) — IRS treasury service layer.
 *
 * Owns reads + writes on the civic_treasury table (created by migration v35 in Phase 44).
 * Disbursement transactions are atomic (SELECT ... FOR UPDATE → UPDATE → commit).
 * Audit-history queries read directly from the persistent audit_trail MySQL table because
 * the in-memory AuditChain has no tick-range filter (RESEARCH.md Pattern 4).
 *
 * Pitfall 1 (Phase 44 carry-forward): config values must be read OUTSIDE transactions.
 * Pitfall 4 (this phase): audit history must enumerate event_type explicitly (not LIKE 'irs.%').
 *
 * NOTE (Phase 45 carry-forward to Plan 03): audit_trail has no simulation-tick column —
 * created_at is a BIGINT millisecond epoch (AuditChain stamps Date.now()). getAuditHistory
 * therefore filters created_at by the [fromTick, toTick] params AS PROVIDED; the route layer
 * (Plan 03) owns the :period → range semantics and any tick↔epoch reconciliation.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

const IRS_EVENT_TYPES = [
    'irs.tax_collected',
    'irs.disbursement_authorized',
    'irs.disbursement_executed',
] as const;

export interface TreasuryBalanceSnapshot {
    readonly balance_bios: string;
    readonly last_updated_tick: number;
    readonly current_rate_percent: number;
}

export class IrsStore {
    constructor(private readonly pool: Pool) {}

    /** Read the current treasury balance + rate. Cache-Control: max-age=10 is a route concern. */
    async getTreasuryBalance(gridName: string): Promise<TreasuryBalanceSnapshot> {
        // Read config OUTSIDE any transaction (Pitfall 1).
        const [balanceRows] = await this.pool.query<RowDataPacket[]>(
            `SELECT balance_bios, last_updated_tick FROM civic_treasury WHERE grid_name = ?`,
            [gridName],
        );
        const [rateRows] = await this.pool.query<RowDataPacket[]>(
            `SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = 'irs_fee_rate'`,
            [gridName],
        );
        const rateRaw = rateRows[0]?.config_value ?? '0.02';
        const current_rate_percent = Number.parseFloat(String(rateRaw)) * 100;
        return {
            balance_bios: String(balanceRows[0]?.balance_bios ?? 0),
            last_updated_tick: Number(balanceRows[0]?.last_updated_tick ?? 0),
            current_rate_percent,
        };
    }

    /**
     * Atomic Government-authorized disbursement.
     * Throws Error('insufficient_treasury_balance') if balance < amountBios.
     * Does NOT emit audit events — caller (route handler) emits authorized BEFORE this call and executed AFTER.
     */
    async disburse(params: {
        gridName: string;
        amountBios: bigint;
        legislationRef: string;
        currentTick: number;
    }): Promise<{ newBalance: bigint }> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [treasuryRows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_bios FROM civic_treasury WHERE grid_name = ? FOR UPDATE`,
                [params.gridName],
            );
            const currentBalance = BigInt(treasuryRows[0]?.balance_bios ?? 0);
            if (currentBalance < params.amountBios) {
                await conn.rollback();
                throw new Error('insufficient_treasury_balance');
            }
            await conn.query(
                `UPDATE civic_treasury SET balance_bios = balance_bios - ?, last_updated_tick = ?
                 WHERE grid_name = ?`,
                [params.amountBios.toString(), params.currentTick, params.gridName],
            );
            await conn.commit();
            return { newBalance: currentBalance - params.amountBios };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Query persistent audit_trail for IRS events in [fromTick, toTick].
     * Pitfall 4: enumerate the 3 IRS event types explicitly — never use LIKE 'irs.%'.
     * Capped at 500 rows per query (RESEARCH "Don't Hand-Roll" — bounded result set).
     */
    async getAuditHistory(params: {
        gridName: string;
        fromTick: number;
        toTick: number;
    }): Promise<RowDataPacket[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT id, event_type, actor_did, payload, created_at
             FROM audit_trail
             WHERE grid_name = ?
               AND event_type IN (?, ?, ?)
               AND created_at >= ? AND created_at <= ?
             ORDER BY id ASC
             LIMIT 500`,
            [params.gridName, IRS_EVENT_TYPES[0], IRS_EVENT_TYPES[1], IRS_EVENT_TYPES[2], params.fromTick, params.toTick],
        );
        return rows;
    }
}
