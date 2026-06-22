import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { CivicLaborCreditStore } from '../../src/economy/civic-labor-credit-store.js';

describe('migration v48 — civic_labor_credit', () => {
    it('creates the credit ledger table', () => {
        const m = MIGRATIONS.find((x) => x.version === 48);
        expect(m, 'v48 must exist').toBeDefined();
        expect(m!.name).toBe('create_civic_labor_credit');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS civic_labor_credit');
        expect(m!.up).toContain('credit_balance');
        expect(m!.up).toContain('PRIMARY KEY (grid_name, civic_did)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS civic_labor_credit');
    });
    it('migration v48 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 48)).toHaveLength(1);
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

describe('CivicLaborCreditStore', () => {
    it('getCredit parses to bigint (0 when absent)', async () => {
        const a = makeMockPool([rows([{ credit_balance: '42' }])]);
        expect(await new CivicLaborCreditStore(a.pool).getCredit('genesis', 'did:a')).toBe(42n);
        const b = makeMockPool([rows([])]);
        expect(await new CivicLaborCreditStore(b.pool).getCredit('genesis', 'did:x')).toBe(0n);
    });
    it('earn rejects a non-positive amount', async () => {
        await expect(new CivicLaborCreditStore(makeMockPool().pool).earn({ gridName: 'g', civicDid: 'd', amount: 0n, currentTick: 1 })).rejects.toThrow('invalid_amount');
    });
    it('earn upserts and returns the new balance', async () => {
        const m = makeMockPool([[{}, {}], rows([{ credit_balance: '10' }])]);
        const res = await new CivicLaborCreditStore(m.pool).earn({ gridName: 'g', civicDid: 'd', amount: 10n, currentTick: 2 });
        expect(res.newBalance).toBe(10n);
        expect(m.calls()[0]).toContain('ON DUPLICATE KEY UPDATE credit_balance = credit_balance + VALUES(credit_balance)');
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('redeem throws insufficient_credit and rolls back when short', async () => {
        const m = makeMockPool([rows([{ credit_balance: '3' }])]);
        await expect(new CivicLaborCreditStore(m.pool).redeem({ gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 3 })).rejects.toThrow('insufficient_credit');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('redeem succeeds and returns the new balance', async () => {
        const m = makeMockPool([rows([{ credit_balance: '8' }]), [{}, {}]]);
        const res = await new CivicLaborCreditStore(m.pool).redeem({ gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 4 });
        expect(res.newBalance).toBe(3n);
        expect(m.calls().join('\n')).toContain('FOR UPDATE');
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
