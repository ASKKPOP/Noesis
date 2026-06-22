import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { TreasuryWeiStore } from '../../src/economy/treasury-wei-store.js';

describe('migration v46 — civic_treasury.balance_wei', () => {
    it('adds a wei DECIMAL column to civic_treasury', () => {
        const m = MIGRATIONS.find((x) => x.version === 46);
        expect(m, 'migration v46 must exist').toBeDefined();
        expect(m!.name).toBe('civic_treasury_add_balance_wei');
        expect(m!.up).toContain('ALTER TABLE civic_treasury');
        expect(m!.up).toContain('balance_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.down).toContain('DROP COLUMN balance_wei');
    });
    it('has a unique version number (no duplicate v46)', () => {
        expect(MIGRATIONS.filter((x) => x.version === 46)).toHaveLength(1);
    });
});

function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0;
    const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query,
    } as unknown as PoolConnection;
    const pool = { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
    return { pool, conn, calls: () => sql };
}
function rows(r: unknown): [RowDataPacket[], unknown] { return [r as RowDataPacket[], {}]; }

describe('TreasuryWeiStore', () => {
    it('getWeiBalance parses the DECIMAL string to bigint (0 when absent)', async () => {
        const a = makeMockPool([rows([{ balance_wei: '7000000000000000000' }])]);
        expect(await new TreasuryWeiStore(a.pool).getWeiBalance('genesis')).toBe(7_000_000_000_000_000_000n);
        const b = makeMockPool([rows([])]);
        expect(await new TreasuryWeiStore(b.pool).getWeiBalance('genesis')).toBe(0n);
    });

    it('creditWei rejects a non-positive amount', async () => {
        await expect(new TreasuryWeiStore(makeMockPool().pool).creditWei({ gridName: 'genesis', amountWei: 0n, currentTick: 1 }))
            .rejects.toThrow('invalid_amount');
    });

    it('creditWei upserts and returns the new balance', async () => {
        const m = makeMockPool([[{}, {}], rows([{ balance_wei: '500' }])]);
        const res = await new TreasuryWeiStore(m.pool).creditWei({ gridName: 'genesis', amountWei: 500n, currentTick: 2 });
        expect(res.newBalance).toBe(500n);
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('debitWei throws insufficient_treasury_wei and rolls back when short', async () => {
        const m = makeMockPool([rows([{ balance_wei: '100' }])]);
        await expect(new TreasuryWeiStore(m.pool).debitWei({ gridName: 'genesis', amountWei: 200n, currentTick: 3 }))
            .rejects.toThrow('insufficient_treasury_wei');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('debitWei succeeds and returns the new balance', async () => {
        const m = makeMockPool([rows([{ balance_wei: '900' }]), [{}, {}]]);
        const res = await new TreasuryWeiStore(m.pool).debitWei({ gridName: 'genesis', amountWei: 400n, currentTick: 4 });
        expect(res.newBalance).toBe(500n);
        const sql = m.calls().join('\n');
        expect(sql).toContain('FOR UPDATE');
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
