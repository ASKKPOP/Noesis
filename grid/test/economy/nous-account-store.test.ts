import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('migration v45 — nous_accounts', () => {
    it('exists with a wei balance column and the composite key', () => {
        const m = MIGRATIONS.find((x) => x.version === 45);
        expect(m, 'migration v45 must exist').toBeDefined();
        expect(m!.name).toBe('create_nous_accounts');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS nous_accounts');
        expect(m!.up).toContain('balance_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.up).toContain('PRIMARY KEY (grid_name, civic_did)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS nous_accounts');
    });

    it('is the highest version (appended, not inserted)', () => {
        const max = Math.max(...MIGRATIONS.map((x) => x.version));
        expect(max).toBe(45);
    });
});

/** A mock Pool whose query() returns queued [rows, fields] responses in order. */
function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0;
    const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => {
        sql.push(String(q));
        return Promise.resolve(responses[i++] ?? [[], {}]);
    });
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

import { NousAccountStore } from '../../src/economy/nous-account-store.js';

describe('NousAccountStore', () => {
    it('getBalance parses the DECIMAL string to bigint (0 when absent)', async () => {
        const a = makeMockPool([rows([{ balance_wei: '1000000000000000000' }])]);
        expect(await new NousAccountStore(a.pool).getBalance('genesis', 'did:a')).toBe(1_000_000_000_000_000_000n);
        const b = makeMockPool([rows([])]);
        expect(await new NousAccountStore(b.pool).getBalance('genesis', 'did:missing')).toBe(0n);
    });

    it('ensureAccount issues an INSERT IGNORE (idempotent, zero balance)', async () => {
        const m = makeMockPool();
        await new NousAccountStore(m.pool).ensureAccount({ gridName: 'genesis', civicDid: 'did:a', currentTick: 5 });
        expect(m.calls()[0]).toContain('INSERT IGNORE INTO nous_accounts');
    });

    it('credit rejects a non-positive amount (no mint of 0/negative)', async () => {
        const m = makeMockPool();
        await expect(new NousAccountStore(m.pool).credit({ gridName: 'genesis', civicDid: 'did:a', amountWei: 0n, currentTick: 1 }))
            .rejects.toThrow('invalid_amount');
    });

    it('credit upserts and returns the new balance', async () => {
        const m = makeMockPool([[{}, {}], rows([{ balance_wei: '500' }])]);
        const res = await new NousAccountStore(m.pool).credit({ gridName: 'genesis', civicDid: 'did:a', amountWei: 500n, currentTick: 2 });
        expect(res.newBalance).toBe(500n);
        expect(m.conn.beginTransaction).toHaveBeenCalled();
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('debit throws insufficient_balance and rolls back when short', async () => {
        const m = makeMockPool([rows([{ balance_wei: '100' }])]);
        await expect(new NousAccountStore(m.pool).debit({ gridName: 'genesis', civicDid: 'did:a', amountWei: 200n, currentTick: 3 }))
            .rejects.toThrow('insufficient_balance');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('debit succeeds and returns the new balance', async () => {
        const m = makeMockPool([rows([{ balance_wei: '300' }]), [{}, {}]]);
        const res = await new NousAccountStore(m.pool).debit({ gridName: 'genesis', civicDid: 'did:a', amountWei: 100n, currentTick: 4 });
        expect(res.newBalance).toBe(200n);
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('transfer rejects self-transfer and non-positive amounts', async () => {
        const store = new NousAccountStore(makeMockPool().pool);
        await expect(store.transfer({ gridName: 'g', fromDid: 'x', toDid: 'x', amountWei: 1n, currentTick: 1 })).rejects.toThrow('invalid_transfer_self');
        await expect(store.transfer({ gridName: 'g', fromDid: 'x', toDid: 'y', amountWei: 0n, currentTick: 1 })).rejects.toThrow('invalid_amount');
    });

    it('transfer debits sender and credits receiver atomically', async () => {
        const m = makeMockPool([rows([{ balance_wei: '1000' }]), [{}, {}], [{}, {}]]);
        await new NousAccountStore(m.pool).transfer({ gridName: 'genesis', fromDid: 'did:a', toDid: 'did:b', amountWei: 400n, currentTick: 6 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('FOR UPDATE');
        expect(sql).toContain('balance_wei = balance_wei - ?');           // debit sender
        expect(sql).toContain('ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei)'); // credit receiver
        expect(m.conn.commit).toHaveBeenCalled();
    });

    it('transfer rolls back when the sender is short', async () => {
        const m = makeMockPool([rows([{ balance_wei: '100' }])]);
        await expect(new NousAccountStore(m.pool).transfer({ gridName: 'genesis', fromDid: 'did:a', toDid: 'did:b', amountWei: 400n, currentTick: 7 }))
            .rejects.toThrow('insufficient_balance');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
});
