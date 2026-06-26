/**
 * Phase 53 Portal Grid Approval Workflow — GridApprovalStore. request + decide (≤2/quarter).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { GridApprovalStore } from '../../src/portal-workflows/grid-approval-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const REQ = 'did:noesis:nous:founder';
const pending = [{ request_id: 'r1', proposed_name: 'Commerce', requester_did: REQ, status: 'pending_review' }];

describe('GridApprovalStore.request', () => {
    it('files a request + emits portal.grid_creation_requested (hashed requester)', async () => {
        const p = pool(); const audit = new AuditChain();
        const r = await new GridApprovalStore(p, audit).request({ proposedName: 'Commerce', requesterDid: REQ, foundingCapital: 5000, tick: 10 });
        expect(r.requestId).toMatch(/^[0-9a-f]{32}$/i);
        const ev = audit.query({ eventType: 'portal.grid_creation_requested' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).proposed_name).toBe('Commerce');
        expect(JSON.stringify(ev[0].payload)).not.toContain(REQ);
    });
});

describe('GridApprovalStore.decide', () => {
    it('approves a pending request → portal.grid_creation_approved', async () => {
        // get → pending; approvalsThisQuarter COUNT → 0.
        const p = { query: vi.fn() } as unknown as Pool;
        (p.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([pending as RowDataPacket[], {}]).mockResolvedValueOnce([[{ n: 0 }] as RowDataPacket[], {}]).mockResolvedValue([[], {}]);
        const audit = new AuditChain();
        const r = await new GridApprovalStore(p, audit).decide({ requestId: 'r1', reviewerDid: 'did:gov:noesis:rev', decision: 'approve', tick: 20 });
        expect(r).toEqual({ ok: true });
        expect(audit.query({ eventType: 'portal.grid_creation_approved' })).toHaveLength(1);
    });
    it('blocks a 3rd approval in the same quarter (quarter_limit)', async () => {
        const p = { query: vi.fn() } as unknown as Pool;
        (p.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([pending as RowDataPacket[], {}]).mockResolvedValueOnce([[{ n: 2 }] as RowDataPacket[], {}]).mockResolvedValue([[], {}]);
        const r = await new GridApprovalStore(p, new AuditChain()).decide({ requestId: 'r1', reviewerDid: 'did:gov:noesis:rev', decision: 'approve', tick: 20 });
        expect(r).toEqual({ ok: false, reason: 'quarter_limit' });
    });
    it('rejects with a closed-enum reason → portal.grid_creation_rejected', async () => {
        const audit = new AuditChain();
        const r = await new GridApprovalStore(pool(pending), audit).decide({ requestId: 'r1', reviewerDid: 'did:gov:noesis:rev', decision: 'reject', reason: 'charter_incompatible', tick: 20 });
        expect(r).toEqual({ ok: true });
        const ev = audit.query({ eventType: 'portal.grid_creation_rejected' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).reason).toBe('charter_incompatible');
    });
    it('404 when the request does not exist', async () => {
        const r = await new GridApprovalStore(pool([]), new AuditChain()).decide({ requestId: 'nope', reviewerDid: 'did:gov:noesis:rev', decision: 'approve', tick: 20 });
        expect(r).toEqual({ ok: false, reason: 'not_found' });
    });
});
