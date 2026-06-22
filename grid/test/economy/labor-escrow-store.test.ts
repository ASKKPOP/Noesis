import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { LaborEscrowStore } from '../../src/economy/labor-escrow-store.js';

describe('migration v47 — labor_escrow', () => {
    it('creates the labor_escrow table with a wei amount + status', () => {
        const m = MIGRATIONS.find((x) => x.version === 47);
        expect(m, 'v47 must exist').toBeDefined();
        expect(m!.name).toBe('create_labor_escrow');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS labor_escrow');
        expect(m!.up).toContain('amount_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.up).toContain("status");
        expect(m!.down).toContain('DROP TABLE IF EXISTS labor_escrow');
    });
    it('migration v47 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 47)).toHaveLength(1);
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

describe('LaborEscrowStore', () => {
    it('fund rejects fee > amount', async () => {
        const s = new LaborEscrowStore(makeMockPool().pool);
        await expect(s.fund({ gridName: 'g', escrowId: 'e1', payerDid: 'p', workerDid: 'w', amountWei: 10n, feeWei: 20n, ref: 'rfp:1', currentTick: 1 })).rejects.toThrow('fee_exceeds_amount');
    });

    it('fund debits the payer and inserts a funded escrow row (atomic)', async () => {
        // responses: debit SELECT FOR UPDATE (payer has 1000), debit UPDATE, INSERT escrow
        const m = makeMockPool([rows([{ balance_wei: '1000' }]), [{}, {}], [{}, {}]]);
        await new LaborEscrowStore(m.pool).fund({ gridName: 'g', escrowId: 'e1', payerDid: 'p', workerDid: 'w', amountWei: 400n, feeWei: 40n, ref: 'rfp:1', currentTick: 5 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('FOR UPDATE');                       // payer debit locks
        expect(sql).toContain('INSERT INTO labor_escrow');         // escrow recorded
        expect(sql).toContain("'funded'");                          // status funded (or via param)
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('fund rolls back when the payer is short', async () => {
        const m = makeMockPool([rows([{ balance_wei: '100' }])]);
        await expect(new LaborEscrowStore(m.pool).fund({ gridName: 'g', escrowId: 'e1', payerDid: 'p', workerDid: 'w', amountWei: 400n, feeWei: 40n, ref: 'rfp:1', currentTick: 6 })).rejects.toThrow('insufficient_balance');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('release pays worker (amount - fee), routes fee to treasury, marks released', async () => {
        // responses: SELECT escrow FOR UPDATE (funded), credit worker (INSERT acct), credit treasury (INSERT), UPDATE escrow
        const m = makeMockPool([rows([{ status: 'funded', amount_wei: '400', fee_wei: '40', payer_did: 'p', worker_did: 'w' }]), [{}, {}], [{}, {}], [{}, {}]]);
        await new LaborEscrowStore(m.pool).release({ gridName: 'g', escrowId: 'e1', attestationRef: 'att:1', currentTick: 7 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('labor_escrow');
        expect(sql).toContain('nous_accounts');     // worker credited
        expect(sql).toContain('civic_treasury');    // fee routed
        expect(sql).toContain("status = 'released'");
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('release refuses a non-funded escrow', async () => {
        const m = makeMockPool([rows([{ status: 'released', amount_wei: '400', fee_wei: '40', payer_did: 'p', worker_did: 'w' }])]);
        await expect(new LaborEscrowStore(m.pool).release({ gridName: 'g', escrowId: 'e1', attestationRef: 'att:1', currentTick: 8 })).rejects.toThrow('escrow_not_funded');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('reclaim refunds the payer the full amount and marks reclaimed', async () => {
        const m = makeMockPool([rows([{ status: 'funded', amount_wei: '400', fee_wei: '40', payer_did: 'p', worker_did: 'w' }]), [{}, {}], [{}, {}]]);
        await new LaborEscrowStore(m.pool).reclaim({ gridName: 'g', escrowId: 'e1', currentTick: 9 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('nous_accounts');     // payer refunded
        expect(sql).toContain("status = 'reclaimed'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
