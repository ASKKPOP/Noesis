import { describe, it, expect, vi } from 'vitest';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { creditAccountOnConn, debitAccountOnConn, creditTreasuryWeiOnConn, debitTreasuryWeiOnConn } from '../../src/economy/wei-ops.js';

function mockConn(responses: Array<[unknown, unknown]> = []): { conn: PoolConnection; sql: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    return { conn: { query } as unknown as PoolConnection, sql: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];

describe('wei-ops (connection-scoped)', () => {
    it('creditAccountOnConn rejects non-positive and upserts otherwise', async () => {
        await expect(creditAccountOnConn(mockConn().conn, { gridName: 'g', civicDid: 'd', amountWei: 0n, currentTick: 1 })).rejects.toThrow('invalid_amount');
        const m = mockConn();
        await creditAccountOnConn(m.conn, { gridName: 'g', civicDid: 'd', amountWei: 5n, currentTick: 1 });
        expect(m.sql()[0]).toContain('ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei)');
    });
    it('debitAccountOnConn throws insufficient_balance and returns remainder on success', async () => {
        await expect(debitAccountOnConn(mockConn([rows([{ balance_wei: '10' }])]).conn, { gridName: 'g', civicDid: 'd', amountWei: 20n, currentTick: 1 })).rejects.toThrow('insufficient_balance');
        const m = mockConn([rows([{ balance_wei: '300' }]), [{}, {}]]);
        expect(await debitAccountOnConn(m.conn, { gridName: 'g', civicDid: 'd', amountWei: 100n, currentTick: 1 })).toBe(200n);
        expect(m.sql().join('\n')).toContain('FOR UPDATE');
    });
    it('treasury ops mirror account ops with insufficient_treasury_wei', async () => {
        await expect(debitTreasuryWeiOnConn(mockConn([rows([{ balance_wei: '1' }])]).conn, { gridName: 'g', amountWei: 5n, currentTick: 1 })).rejects.toThrow('insufficient_treasury_wei');
        const m = mockConn();
        await creditTreasuryWeiOnConn(m.conn, { gridName: 'g', amountWei: 9n, currentTick: 1 });
        expect(m.sql()[0]).toContain('civic_treasury');
    });
});
