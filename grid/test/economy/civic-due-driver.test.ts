import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { runDueAssessment, runDueDelinquencySweep, DUE_PERIOD_TICKS } from '../../src/economy/civic-due-driver.js';

function mockPool(selectRows: unknown[] = []): { pool: Pool; calls: () => string[] } {
    const sql: string[] = [];
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query: vi.fn().mockImplementation((q: string) => {
            sql.push(String(q));
            return Promise.resolve([selectRows as RowDataPacket[], {}]);
        }),
    };
    const pool = {
        query: vi.fn().mockImplementation((q: string) => {
            sql.push(String(q));
            return Promise.resolve([selectRows as RowDataPacket[], {}]);
        }),
        getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as Pool;
    return { pool, calls: () => sql };
}

describe('civic-due-driver', () => {
    it('assesses one due per active member (INSERT into civic_dues)', async () => {
        const m = mockPool();
        await runDueAssessment(m.pool, new AuditChain(), ['did:civic:noesis:a', 'did:civic:noesis:b'], DUE_PERIOD_TICKS, { gridName: 'genesis' });
        const inserts = m.calls().filter((s) => s.includes('INSERT INTO civic_dues'));
        expect(inserts.length).toBe(2);
    });
    it('tolerates a duplicate (already-assessed this period) without throwing', async () => {
        const pool = {
            query: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })),
        } as unknown as Pool;
        await expect(
            runDueAssessment(pool, new AuditChain(), ['did:civic:noesis:a'], DUE_PERIOD_TICKS, { gridName: 'genesis' }),
        ).resolves.toBeUndefined();
    });
    it('delinquency sweep marks overdue pending dues', async () => {
        const m = mockPool([{ due_id: 'd1' }]); // one overdue pending due returned by the SELECT
        await runDueDelinquencySweep(m.pool, new AuditChain(), 999_999, 'genesis');
        expect(m.calls().some((s) => s.includes('civic_dues'))).toBe(true);
    });
    it('never throws on a pool error (driver is defensive)', async () => {
        const pool = {
            query: vi.fn().mockRejectedValue(new Error('db down')),
            getConnection: vi.fn().mockRejectedValue(new Error('db down')),
        } as unknown as Pool;
        await expect(
            runDueAssessment(pool, new AuditChain(), ['did:civic:noesis:a'], DUE_PERIOD_TICKS, { gridName: 'genesis' }),
        ).resolves.toBeUndefined();
        await expect(
            runDueDelinquencySweep(pool, new AuditChain(), 1, 'genesis'),
        ).resolves.toBeUndefined();
    });
});
