import { describe, it, expect, vi } from 'vitest';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { earnCreditOnConn, redeemCreditOnConn } from '../../src/economy/credit-ops.js';

function mockConn(responses: Array<[unknown, unknown]> = []): { conn: PoolConnection; sql: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    return { conn: { query } as unknown as PoolConnection, sql: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];

describe('credit-ops (connection-scoped)', () => {
    it('earnCreditOnConn rejects non-positive and upserts otherwise', async () => {
        await expect(earnCreditOnConn(mockConn().conn, { gridName: 'g', civicDid: 'd', amount: 0n, currentTick: 1 })).rejects.toThrow('invalid_amount');
        const m = mockConn();
        await earnCreditOnConn(m.conn, { gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 1 });
        expect(m.sql()[0]).toContain('ON DUPLICATE KEY UPDATE credit_balance = credit_balance + VALUES(credit_balance)');
    });
    it('redeemCreditOnConn throws insufficient_credit, returns remainder on success', async () => {
        await expect(redeemCreditOnConn(mockConn([rows([{ credit_balance: '2' }])]).conn, { gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 1 })).rejects.toThrow('insufficient_credit');
        const m = mockConn([rows([{ credit_balance: '8' }]), [{}, {}]]);
        expect(await redeemCreditOnConn(m.conn, { gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 1 })).toBe(3n);
        expect(m.sql().join('\n')).toContain('FOR UPDATE');
    });
});
