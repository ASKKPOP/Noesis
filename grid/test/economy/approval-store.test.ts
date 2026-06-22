import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ApprovalStore } from '../../src/economy/approval-store.js';
import { AuditChain } from '../../src/audit/chain.js';

describe('migration v52 — pending_approvals', () => {
    it('creates the approvals table with a status + held payload', () => {
        const m = MIGRATIONS.find((x) => x.version === 52);
        expect(m, 'v52 must exist').toBeDefined();
        expect(m!.name).toBe('create_pending_approvals');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS pending_approvals');
        expect(m!.up).toContain('payload');
        expect(m!.up).toContain("status");
        expect(m!.down).toContain('DROP TABLE IF EXISTS pending_approvals');
    });
    it('migration v52 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 52)).toHaveLength(1);
    });
});

function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query } as unknown as PoolConnection;
    const pool = { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
    return { pool, conn, calls: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];

describe('ApprovalStore', () => {
    it('requestApproval inserts a pending row holding the action payload', async () => {
        const m = makeMockPool([[{}, {}]]);
        await new ApprovalStore(m.pool).requestApproval({ gridName: 'g', approvalId: 'a1', nousDid: 'n', humanDid: 'h', kind: 'trade', summary: 'sell 5 ETH of compute', payload: { action_type: 'trade_request', amount: '5' }, deadlineTick: 200, currentTick: 10 });
        const sql = m.calls()[0];
        expect(sql).toContain('INSERT INTO pending_approvals');
        expect(sql).toContain("'pending'");
    });
    it('requestApproval rejects an empty kind', async () => {
        await expect(new ApprovalStore(makeMockPool().pool).requestApproval({ gridName: 'g', approvalId: 'a1', nousDid: 'n', humanDid: 'h', kind: '', summary: 's', payload: {}, deadlineTick: 200, currentTick: 10 })).rejects.toThrow('invalid_kind');
    });
    it('listPending queries the human\'s pending approvals', async () => {
        const m = makeMockPool([rows([{ approval_id: 'a1', kind: 'trade', summary: 'x', status: 'pending' }])]);
        const list = await new ApprovalStore(m.pool).listPending('g', 'h');
        expect(list).toHaveLength(1);
        expect(m.calls()[0]).toContain('FROM pending_approvals');
        expect(m.calls()[0]).toContain("status = 'pending'");
    });
    it('approve flips pending → approved (atomic, once)', async () => {
        const m = makeMockPool([rows([{ status: 'pending' }]), [{}, {}]]);
        await new ApprovalStore(m.pool).approve({ gridName: 'g', approvalId: 'a1', currentTick: 20 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('FOR UPDATE');
        expect(sql).toContain("status = 'approved'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('approve refuses a non-pending approval', async () => {
        const m = makeMockPool([rows([{ status: 'approved' }])]);
        await expect(new ApprovalStore(m.pool).approve({ gridName: 'g', approvalId: 'a1', currentTick: 20 })).rejects.toThrow('approval_not_pending');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('reject flips pending → rejected', async () => {
        const m = makeMockPool([rows([{ status: 'pending' }]), [{}, {}]]);
        await new ApprovalStore(m.pool).reject({ gridName: 'g', approvalId: 'a1', currentTick: 21 });
        expect(m.calls().join('\n')).toContain("status = 'rejected'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
});

describe('ApprovalStore O2b — audit emit', () => {
    const APPROVAL_ID = 'aaaaaaaa-1234-1234-1234-123456789abc';
    const NOUS_DID = 'did:noesis:nous:test-nous';
    const HUMAN_DID = 'did:noesis:human:test-human';

    it('requestApproval emits human.approval_requested with hashed DIDs when audit is provided', async () => {
        const m = makeMockPool([[{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ApprovalStore(m.pool, chain).requestApproval({
            gridName: 'g', approvalId: APPROVAL_ID, nousDid: NOUS_DID, humanDid: HUMAN_DID,
            kind: 'trade', summary: 'sell compute', payload: { action_type: 'trade_request' },
            deadlineTick: 200, currentTick: 10,
        });
        expect(spy).toHaveBeenCalledOnce();
        const [eventType, actorDid, payload] = spy.mock.calls[0];
        expect(eventType).toBe('human.approval_requested');
        // actorDid = nous_did_hash (HEX64, not raw DID)
        expect(actorDid).toMatch(/^[0-9a-f]{64}$/);
        expect(actorDid).not.toBe(NOUS_DID);
        expect((payload as Record<string, unknown>).nous_did_hash).toBe(actorDid);
        expect((payload as Record<string, unknown>).human_did_hash).toMatch(/^[0-9a-f]{64}$/);
        expect((payload as Record<string, unknown>).human_did_hash).not.toBe(HUMAN_DID);
        expect((payload as Record<string, unknown>).approval_id).toBe(APPROVAL_ID);
        expect((payload as Record<string, unknown>).kind).toBe('trade');
        expect((payload as Record<string, unknown>).tick).toBe(10);
    });

    it('requestApproval does not emit when no audit is provided (O2a compatibility)', async () => {
        const m = makeMockPool([[{}, {}]]);
        // No AuditChain passed — should not throw and should not emit
        await new ApprovalStore(m.pool).requestApproval({
            gridName: 'g', approvalId: APPROVAL_ID, nousDid: NOUS_DID, humanDid: HUMAN_DID,
            kind: 'trade', summary: 'sell compute', payload: {}, deadlineTick: 200, currentTick: 10,
        });
        // Just verify it didn't throw — no audit to spy on
        expect(m.calls()[0]).toContain('INSERT INTO pending_approvals');
    });

    it('approve emits human.approval_granted with hashed human DID after commit', async () => {
        const m = makeMockPool([rows([{ status: 'pending', human_did: HUMAN_DID }]), [{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ApprovalStore(m.pool, chain).approve({ gridName: 'g', approvalId: APPROVAL_ID, currentTick: 20 });
        expect(spy).toHaveBeenCalledOnce();
        const [eventType, actorDid, payload] = spy.mock.calls[0];
        expect(eventType).toBe('human.approval_granted');
        expect(actorDid).toMatch(/^[0-9a-f]{64}$/);
        expect(actorDid).not.toBe(HUMAN_DID);
        expect((payload as Record<string, unknown>).human_did_hash).toBe(actorDid);
        expect((payload as Record<string, unknown>).approval_id).toBe(APPROVAL_ID);
        expect((payload as Record<string, unknown>).tick).toBe(20);
    });

    it('reject emits human.approval_denied with hashed human DID after commit', async () => {
        const m = makeMockPool([rows([{ status: 'pending', human_did: HUMAN_DID }]), [{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ApprovalStore(m.pool, chain).reject({ gridName: 'g', approvalId: APPROVAL_ID, currentTick: 21 });
        expect(spy).toHaveBeenCalledOnce();
        const [eventType, actorDid, payload] = spy.mock.calls[0];
        expect(eventType).toBe('human.approval_denied');
        expect(actorDid).toMatch(/^[0-9a-f]{64}$/);
        expect(actorDid).not.toBe(HUMAN_DID);
        expect((payload as Record<string, unknown>).human_did_hash).toBe(actorDid);
        expect((payload as Record<string, unknown>).approval_id).toBe(APPROVAL_ID);
        expect((payload as Record<string, unknown>).tick).toBe(21);
    });

    it('approve does not emit when no audit is provided', async () => {
        const m = makeMockPool([rows([{ status: 'pending', human_did: HUMAN_DID }]), [{}, {}]]);
        await new ApprovalStore(m.pool).approve({ gridName: 'g', approvalId: APPROVAL_ID, currentTick: 20 });
        expect(m.conn.commit).toHaveBeenCalled();
        // No error = no-op without audit
    });
});
