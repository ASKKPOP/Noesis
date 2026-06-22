/**
 * O2a — Human-in-the-loop approval gate. A Nous pauses before a big decision
 * (buy/sell/large trade) and holds the action here as a PENDING approval; the
 * human approves or rejects it. The held `payload` (the action to run on approval)
 * is stored Grid-side and executed by the caller ONLY after status='approved' —
 * this store never auto-executes. Resolve-once under SELECT ... FOR UPDATE.
 *
 * O2b: optional `audit?: AuditChain` dep — emits human.approval_* events via
 * the sole-producer emitter FUNCTIONS (never audit.append directly). DIDs are
 * hashed (SHA-256 HEX64) before crossing the audit boundary. Default off so
 * O2a tests remain unaffected.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendHumanApprovalRequested } from '../audit/append-human-approval-requested.js';
import { appendHumanApprovalGranted } from '../audit/append-human-approval-granted.js';
import { appendHumanApprovalDenied } from '../audit/append-human-approval-denied.js';

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

export interface PendingApprovalRow {
    approval_id: string; grid_name: string; nous_did: string; human_did: string;
    kind: string; summary: string; payload: string; status: string;
    created_tick: number; deadline_tick: number; resolved_tick: number | null;
}

export class ApprovalStore {
    constructor(
        private readonly pool: Pool,
        private readonly audit?: AuditChain,
    ) {}

    /** A Nous requests human approval for a big-decision action (held as the payload). */
    async requestApproval(p: { gridName: string; approvalId: string; nousDid: string; humanDid: string; kind: string; summary: string; payload: unknown; deadlineTick: number; currentTick: number }): Promise<void> {
        if (!p.kind || p.kind.trim() === '') throw new Error('invalid_kind');
        await this.pool.query(
            `INSERT INTO pending_approvals
               (approval_id, grid_name, nous_did, human_did, kind, summary, payload, status, created_tick, deadline_tick, resolved_tick, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, ?, ?)`,
            [p.approvalId, p.gridName, p.nousDid, p.humanDid, p.kind, p.summary, JSON.stringify(p.payload), p.currentTick, p.deadlineTick, p.currentTick, p.currentTick],
        );
        if (this.audit) {
            appendHumanApprovalRequested(this.audit, {
                approval_id: p.approvalId,
                human_did_hash: sha256Hex(p.humanDid),
                kind: p.kind,
                nous_did_hash: sha256Hex(p.nousDid),
                tick: p.currentTick,
            });
        }
    }

    /** The human's pending queue (for the Portal/Steward UI). */
    async listPending(gridName: string, humanDid: string): Promise<PendingApprovalRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT approval_id, grid_name, nous_did, human_did, kind, summary, payload, status, created_tick, deadline_tick, resolved_tick
             FROM pending_approvals WHERE grid_name = ? AND human_did = ? AND status = 'pending' ORDER BY created_tick ASC LIMIT 200`,
            [gridName, humanDid],
        );
        return rows as unknown as PendingApprovalRow[];
    }

    /** Read one approval (the caller reads status + payload to execute the held action). */
    async getApproval(gridName: string, approvalId: string): Promise<PendingApprovalRow | undefined> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT approval_id, grid_name, nous_did, human_did, kind, summary, payload, status, created_tick, deadline_tick, resolved_tick
             FROM pending_approvals WHERE grid_name = ? AND approval_id = ?`,
            [gridName, approvalId],
        );
        return rows[0] as unknown as PendingApprovalRow | undefined;
    }

    /** The human approves — pending → approved (resolve-once). */
    async approve(p: { gridName: string; approvalId: string; currentTick: number }): Promise<void> {
        await this.resolve(p.gridName, p.approvalId, 'approved', p.currentTick);
    }

    /** The human rejects — pending → rejected (resolve-once). */
    async reject(p: { gridName: string; approvalId: string; currentTick: number }): Promise<void> {
        await this.resolve(p.gridName, p.approvalId, 'rejected', p.currentTick);
    }

    private async resolve(gridName: string, approvalId: string, to: 'approved' | 'rejected' | 'expired', currentTick: number): Promise<void> {
        const conn = await this.pool.getConnection();
        let humanDid: string | undefined;
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, human_did FROM pending_approvals WHERE approval_id = ? AND grid_name = ? FOR UPDATE`,
                [approvalId, gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'pending') {
                await conn.rollback();
                throw new Error('approval_not_pending');
            }
            humanDid = row.human_did as string;
            await conn.query(
                `UPDATE pending_approvals SET status = '${to}', resolved_tick = ?, updated_at = ? WHERE approval_id = ?`,
                [currentTick, currentTick, approvalId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        // Emit audit event after commit + connection released (O2b). Expiry emits nothing.
        if (this.audit && humanDid !== undefined && (to === 'approved' || to === 'rejected')) {
            const humanDidHash = sha256Hex(humanDid);
            if (to === 'approved') {
                appendHumanApprovalGranted(this.audit, {
                    approval_id: approvalId,
                    human_did_hash: humanDidHash,
                    tick: currentTick,
                });
            } else {
                appendHumanApprovalDenied(this.audit, {
                    approval_id: approvalId,
                    human_did_hash: humanDidHash,
                    tick: currentTick,
                });
            }
        }
    }
}
