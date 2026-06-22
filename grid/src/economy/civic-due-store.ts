/**
 * L1 — Civic due (D-MONEY-08): the recurring civic obligation every member owes,
 * payable in wei (debit account → credit treasury) or in labor (redeem civic-labor
 * credit). Unpaid past due_tick → delinquent (sanction is downstream). A due carries
 * both amount_wei and amount_credit (the Polis sets both); the member pays either.
 *
 * Each pay opens ONE transaction and composes the rail ops (wei-ops / credit-ops)
 * with the status flip — atomic, pay-once (status guarded under FOR UPDATE).
 *
 * L1b: optional AuditChain dep (default undefined → no-op) emits due.assessed /
 * due.paid / due.delinquent via the sole-producer emitter functions (not via
 * audit.append directly — producer-boundary tests stay green).
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { debitAccountOnConn, creditTreasuryWeiOnConn } from './wei-ops.js';
import { redeemCreditOnConn } from './credit-ops.js';
import { appendDueAssessed } from '../audit/append-due-assessed.js';
import { appendDuePaid } from '../audit/append-due-paid.js';
import { appendDueDelinquent } from '../audit/append-due-delinquent.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export class CivicDueStore {
    constructor(
        private readonly pool: Pool,
        private readonly audit?: AuditChain,
    ) {}

    async assess(p: { gridName: string; dueId: string; civicDid: string; period: string; amountWei: bigint; amountCredit: bigint; dueTick: number; currentTick: number }): Promise<void> {
        if (p.amountWei <= 0n || p.amountCredit <= 0n) throw new Error('invalid_amount');
        await this.pool.query(
            `INSERT INTO civic_dues
               (due_id, grid_name, civic_did, period, amount_wei, amount_credit, status, paid_in, due_tick, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'assessed', NULL, ?, ?, ?)`,
            [p.dueId, p.gridName, p.civicDid, p.period, p.amountWei.toString(), p.amountCredit.toString(), p.dueTick, p.currentTick, p.currentTick],
        );
        if (this.audit) {
            appendDueAssessed(this.audit, {
                amount_credit: p.amountCredit.toString(),
                amount_wei: p.amountWei.toString(),
                civic_did_hash: sha256Hex(p.civicDid),
                due_id: p.dueId,
                period: p.period,
                tick: p.currentTick,
            });
        }
    }

    async payWithWei(p: { gridName: string; dueId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        let civicDid: string | undefined;
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, amount_wei, civic_did FROM civic_dues WHERE due_id = ? AND grid_name = ? FOR UPDATE`,
                [p.dueId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'assessed') {
                await conn.rollback();
                throw new Error('due_not_payable');
            }
            civicDid = String(row.civic_did);
            await debitAccountOnConn(conn, { gridName: p.gridName, civicDid, amountWei: BigInt(row.amount_wei), currentTick: p.currentTick });
            await creditTreasuryWeiOnConn(conn, { gridName: p.gridName, amountWei: BigInt(row.amount_wei), currentTick: p.currentTick });
            await conn.query(
                `UPDATE civic_dues SET status = 'paid', paid_in = 'wei', updated_at = ? WHERE due_id = ?`,
                [p.currentTick, p.dueId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit && civicDid !== undefined) {
            appendDuePaid(this.audit, {
                civic_did_hash: sha256Hex(civicDid),
                due_id: p.dueId,
                paid_in: 'wei',
                tick: p.currentTick,
            });
        }
    }

    async payWithCredit(p: { gridName: string; dueId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        let civicDid: string | undefined;
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, amount_credit, civic_did FROM civic_dues WHERE due_id = ? AND grid_name = ? FOR UPDATE`,
                [p.dueId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'assessed') {
                await conn.rollback();
                throw new Error('due_not_payable');
            }
            civicDid = String(row.civic_did);
            await redeemCreditOnConn(conn, { gridName: p.gridName, civicDid, amount: BigInt(row.amount_credit), currentTick: p.currentTick });
            await conn.query(
                `UPDATE civic_dues SET status = 'paid', paid_in = 'labor', updated_at = ? WHERE due_id = ?`,
                [p.currentTick, p.dueId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit && civicDid !== undefined) {
            appendDuePaid(this.audit, {
                civic_did_hash: sha256Hex(civicDid),
                due_id: p.dueId,
                paid_in: 'labor',
                tick: p.currentTick,
            });
        }
    }

    async markDelinquent(p: { gridName: string; dueId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        let civicDid: string | undefined;
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, civic_did FROM civic_dues WHERE due_id = ? AND grid_name = ? FOR UPDATE`,
                [p.dueId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'assessed') {
                await conn.rollback();
                throw new Error('due_not_assessed');
            }
            civicDid = String(row.civic_did);
            await conn.query(
                `UPDATE civic_dues SET status = 'delinquent', updated_at = ? WHERE due_id = ?`,
                [p.currentTick, p.dueId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit && civicDid !== undefined) {
            appendDueDelinquent(this.audit, {
                civic_did_hash: sha256Hex(civicDid),
                due_id: p.dueId,
                tick: p.currentTick,
            });
        }
    }
}
