/**
 * F1 (money rails) — Labor escrow: escrowed inter-Nous job settlement.
 *
 * fund:    debit the payer, record a 'funded' escrow row.
 * release: on attestation — pay the worker (amount - fee), route the fee to the
 *          civic treasury, mark 'released'.
 * reclaim: no attestation by the deadline (enforced by the caller) — refund the
 *          payer the full amount, mark 'reclaimed'.
 *
 * Each method runs ONE transaction and composes the connection-scoped wei-ops, so
 * the money move and the escrow-status change are atomic (all-or-nothing). The
 * Grid is the oracle (economy.md): the caller verifies the attestation before
 * calling release. Allowlist +0 — the RFP/settlement layer emits audit events.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { creditAccountOnConn, debitAccountOnConn, creditTreasuryWeiOnConn } from './wei-ops.js';

export class LaborEscrowStore {
    constructor(private readonly pool: Pool) {}

    async fund(p: { gridName: string; escrowId: string; payerDid: string; workerDid: string; amountWei: bigint; feeWei: bigint; ref: string; currentTick: number }): Promise<void> {
        if (p.amountWei <= 0n) throw new Error('invalid_amount');
        if (p.feeWei < 0n) throw new Error('invalid_amount');
        if (p.feeWei > p.amountWei) throw new Error('fee_exceeds_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await debitAccountOnConn(conn, { gridName: p.gridName, civicDid: p.payerDid, amountWei: p.amountWei, currentTick: p.currentTick });
            await conn.query(
                `INSERT INTO labor_escrow
                   (escrow_id, grid_name, payer_did, worker_did, amount_wei, fee_wei, ref, status, attestation_ref, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'funded', NULL, ?, ?)`,
                [p.escrowId, p.gridName, p.payerDid, p.workerDid, p.amountWei.toString(), p.feeWei.toString(), p.ref, p.currentTick, p.currentTick],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async release(p: { gridName: string; escrowId: string; attestationRef: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, amount_wei, fee_wei, worker_did FROM labor_escrow WHERE escrow_id = ? AND grid_name = ? FOR UPDATE`,
                [p.escrowId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'funded') {
                await conn.rollback();
                throw new Error('escrow_not_funded');
            }
            const amount = BigInt(row.amount_wei);
            const fee = BigInt(row.fee_wei);
            const toWorker = amount - fee;
            if (toWorker > 0n) {
                await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: String(row.worker_did), amountWei: toWorker, currentTick: p.currentTick });
            }
            if (fee > 0n) {
                await creditTreasuryWeiOnConn(conn, { gridName: p.gridName, amountWei: fee, currentTick: p.currentTick });
            }
            await conn.query(
                `UPDATE labor_escrow SET status = 'released', attestation_ref = ?, updated_at = ? WHERE escrow_id = ?`,
                [p.attestationRef, p.currentTick, p.escrowId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async reclaim(p: { gridName: string; escrowId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, amount_wei, payer_did FROM labor_escrow WHERE escrow_id = ? AND grid_name = ? FOR UPDATE`,
                [p.escrowId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'funded') {
                await conn.rollback();
                throw new Error('escrow_not_funded');
            }
            await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: String(row.payer_did), amountWei: BigInt(row.amount_wei), currentTick: p.currentTick });
            await conn.query(
                `UPDATE labor_escrow SET status = 'reclaimed', updated_at = ? WHERE escrow_id = ?`,
                [p.currentTick, p.escrowId],
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
