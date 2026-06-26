/**
 * Phase 53 Portal Grid Approval Workflow — request + reviewer-panel decision.
 *
 * Grid-side implementation of the Portal pipeline (same pattern as the Phase 54 human track).
 * v3.0 ships the workflow but instantiates no Grid (only Genesis exists). Approvals are
 * rate-limited to ≤2 per quarter.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendPortalGridCreationRequested } from '../audit/append-portal-grid-creation-requested.js';
import { appendPortalGridCreationApproved } from '../audit/append-portal-grid-creation-approved.js';
import { appendPortalGridCreationRejected } from '../audit/append-portal-grid-creation-rejected.js';
import { GRID_QUARTER_TICKS, GRID_QUARTER_APPROVAL_LIMIT, type GridRejectReason } from './grid-approval-types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface GridRequestRow { request_id: string; proposed_name: string; requester_did: string; status: string; }

export class GridApprovalStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** File a Grid-creation request → portal.grid_creation_requested. */
    async request(p: { proposedName: string; requesterDid: string; foundingCapital: number; tick: number }): Promise<{ requestId: string }> {
        const requestId = sha256Hex(`${p.requesterDid}|${p.proposedName}|${p.tick}`).slice(0, 32);
        await this.pool.query(
            `INSERT INTO grid_creation_requests (request_id, proposed_name, requester_did, status, founding_capital, filed_tick)
             VALUES (?, ?, ?, 'pending_review', ?, ?)`,
            [requestId, p.proposedName, p.requesterDid, p.foundingCapital, p.tick],
        );
        appendPortalGridCreationRequested(this.audit, { proposed_name: p.proposedName, request_id: requestId, requester_did_hash: sha256Hex(p.requesterDid), tick: p.tick });
        return { requestId };
    }

    private async get(requestId: string): Promise<GridRequestRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT request_id, proposed_name, requester_did, status FROM grid_creation_requests WHERE request_id = ? LIMIT 1`,
            [requestId],
        );
        const r = rows as unknown as GridRequestRow[];
        return r.length ? r[0] : null;
    }

    async approvalsThisQuarter(tick: number): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM grid_creation_requests WHERE status = 'approved' AND decided_tick >= ?`,
            [tick - GRID_QUARTER_TICKS],
        );
        return Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    }

    /** Reviewer-panel decision. Approve is rate-limited ≤2/quarter. Emits approved/rejected. */
    async decide(p: { requestId: string; reviewerDid: string; decision: 'approve' | 'reject'; reason?: GridRejectReason; tick: number }): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'bad_state' | 'quarter_limit' }> {
        const r = await this.get(p.requestId);
        if (!r) return { ok: false, reason: 'not_found' };
        if (r.status !== 'pending_review') return { ok: false, reason: 'bad_state' };
        if (p.decision === 'approve') {
            if (await this.approvalsThisQuarter(p.tick) >= GRID_QUARTER_APPROVAL_LIMIT) return { ok: false, reason: 'quarter_limit' };
            await this.pool.query(`UPDATE grid_creation_requests SET status = 'approved', decided_tick = ? WHERE request_id = ?`, [p.tick, p.requestId]);
            appendPortalGridCreationApproved(this.audit, { request_id: p.requestId, reviewer_did_hash: sha256Hex(p.reviewerDid), tick: p.tick });
            return { ok: true };
        }
        const reason: GridRejectReason = p.reason ?? 'other';
        await this.pool.query(`UPDATE grid_creation_requests SET status = 'rejected', reason = ?, decided_tick = ? WHERE request_id = ?`, [reason, p.tick, p.requestId]);
        appendPortalGridCreationRejected(this.audit, { reason, request_id: p.requestId, reviewer_did_hash: sha256Hex(p.reviewerDid), tick: p.tick });
        return { ok: true };
    }
}
