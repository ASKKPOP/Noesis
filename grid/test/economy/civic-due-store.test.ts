import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { CivicDueStore } from '../../src/economy/civic-due-store.js';

describe('migration v49 — civic_dues', () => {
    it('creates the dues table with wei + credit amounts and a status', () => {
        const m = MIGRATIONS.find((x) => x.version === 49);
        expect(m, 'v49 must exist').toBeDefined();
        expect(m!.name).toBe('create_civic_dues');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS civic_dues');
        expect(m!.up).toContain('amount_wei');
        expect(m!.up).toContain('amount_credit');
        expect(m!.up).toContain("status");
        expect(m!.down).toContain('DROP TABLE IF EXISTS civic_dues');
    });
    it('migration v49 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 49)).toHaveLength(1);
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

describe('CivicDueStore', () => {
    it('assess rejects non-positive amounts', async () => {
        const s = new CivicDueStore(makeMockPool().pool);
        await expect(s.assess({ gridName: 'g', dueId: 'd1', civicDid: 'm', period: '2026-06', amountWei: 0n, amountCredit: 5n, dueTick: 100, currentTick: 1 })).rejects.toThrow('invalid_amount');
    });

    it('assess inserts an assessed due', async () => {
        const m = makeMockPool([[{}, {}]]);
        await new CivicDueStore(m.pool).assess({ gridName: 'g', dueId: 'd1', civicDid: 'm', period: '2026-06', amountWei: 1000n, amountCredit: 5n, dueTick: 100, currentTick: 1 });
        expect(m.calls()[0]).toContain('INSERT INTO civic_dues');
        expect(m.calls()[0]).toContain("'assessed'");
    });

    it('payWithWei debits member, credits treasury, marks paid (atomic)', async () => {
        // SELECT due FOR UPDATE (assessed, amount_wei 1000); debit member SELECT FOR UPDATE (bal 5000); debit UPDATE; treasury upsert; due UPDATE
        const m = makeMockPool([rows([{ status: 'assessed', amount_wei: '1000', amount_credit: '5', civic_did: 'm' }]), rows([{ balance_wei: '5000' }]), [{}, {}], [{}, {}], [{}, {}]]);
        await new CivicDueStore(m.pool).payWithWei({ gridName: 'g', dueId: 'd1', currentTick: 7 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('nous_accounts');     // member debited
        expect(sql).toContain('civic_treasury');    // treasury credited
        expect(sql).toContain("status = 'paid'");
        expect(sql).toContain("paid_in = 'wei'");
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('payWithWei refuses an already-paid due', async () => {
        const m = makeMockPool([rows([{ status: 'paid', amount_wei: '1000', amount_credit: '5', civic_did: 'm' }])]);
        await expect(new CivicDueStore(m.pool).payWithWei({ gridName: 'g', dueId: 'd1', currentTick: 8 })).rejects.toThrow('due_not_payable');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('payWithCredit redeems credit and marks paid in labor', async () => {
        // SELECT due FOR UPDATE (assessed, amount_credit 5); redeem SELECT FOR UPDATE (bal 8); redeem UPDATE; due UPDATE
        const m = makeMockPool([rows([{ status: 'assessed', amount_wei: '1000', amount_credit: '5', civic_did: 'm' }]), rows([{ credit_balance: '8' }]), [{}, {}], [{}, {}]]);
        await new CivicDueStore(m.pool).payWithCredit({ gridName: 'g', dueId: 'd1', currentTick: 9 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('civic_labor_credit');
        expect(sql).toContain("status = 'paid'");
        expect(sql).toContain("paid_in = 'labor'");
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('markDelinquent flips an assessed due to delinquent', async () => {
        const m = makeMockPool([rows([{ status: 'assessed' }]), [{}, {}]]);
        await new CivicDueStore(m.pool).markDelinquent({ gridName: 'g', dueId: 'd1', currentTick: 200 });
        expect(m.calls().join('\n')).toContain("status = 'delinquent'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
