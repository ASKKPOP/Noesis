/**
 * D-MONEY-10 — the civic duty: charged to the civic identity a Nous acts under, counted in
 * lifetime periods, and never a debt (a Nous is in good standing or it is denied; nothing
 * missed is carried forward to be collected).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import {
    runDueAssessment, runDueDelinquencySweep, listDutyMembers, runDutyCycle,
    DUE_PERIOD_TICKS, DUE_AMOUNT_WEI, DUE_AMOUNT_CREDIT,
} from '../../src/economy/civic-due-driver.js';
import { CivicDueStore } from '../../src/economy/civic-due-store.js';
import { CIVIC_DUTY_WEI, CIVIC_DUTY_CREDIT, CIVIC_DUTY_PERIOD_TICKS } from '../../src/civic/founding-law.js';

type Call = { sql: string; params: unknown[] };

function recordingPool(answer: (sql: string, params: unknown[]) => unknown[] = () => []): { pool: Pool; calls: Call[] } {
    const calls: Call[] = [];
    const query = vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
        calls.push({ sql: String(sql), params });
        return Promise.resolve([answer(String(sql), params) as RowDataPacket[], {}]);
    });
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query,
    };
    return { pool: { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool, calls };
}

describe('the civic duty is set by the founding law', () => {
    it('one fixed amount for every Nous, in the scale accounts and land are in', () => {
        expect(DUE_AMOUNT_WEI).toBe(CIVIC_DUTY_WEI);
        expect(DUE_AMOUNT_CREDIT).toBe(CIVIC_DUTY_CREDIT);
        expect(DUE_PERIOD_TICKS).toBe(CIVIC_DUTY_PERIOD_TICKS);
        expect(CIVIC_DUTY_WEI).toBeLessThanOrEqual(1000n);       // a 1,000-wei account can pay it
    });
});

describe('who owes it', () => {
    it('every Nous holding an active civic identity in this Grid — not people, not registry names', async () => {
        const m = recordingPool(() => [{ civic_did: 'did:civic:noesis:aaa' }, { civic_did: 'did:civic:noesis:bbb' }]);
        expect(await listDutyMembers(m.pool, 'genesis')).toEqual(['did:civic:noesis:aaa', 'did:civic:noesis:bbb']);
        const { sql, params } = m.calls[0]!;
        expect(sql).toContain('civic_did_registry');
        expect(sql).toMatch(/status\s*=\s*'active'/);
        expect(sql).toMatch(/existence_did NOT LIKE 'did:noesis:human:%'/);
        expect(params).toEqual(['genesis']);
    });
    it('asked for one period, it names only the members not yet assessed for it', async () => {
        const m = recordingPool(() => [{ civic_did: 'did:civic:noesis:bbb' }]);
        expect(await listDutyMembers(m.pool, 'genesis', 'p7')).toEqual(['did:civic:noesis:bbb']);
        expect(m.calls[0]!.sql).toMatch(/NOT EXISTS \(SELECT 1 FROM civic_dues d[\s\S]*d\.period = \?/);
        expect(m.calls[0]!.params).toEqual(['genesis', 'p7']);
    });
    it('a list that cannot be read is an error, not "nobody owes"', async () => {
        const pool = { query: vi.fn().mockRejectedValue(new Error('db down')) } as unknown as Pool;
        await expect(listDutyMembers(pool, 'genesis')).rejects.toThrow('db down');
    });
});

describe('one round of the duty', () => {
    it('assesses whoever has no due for the current period, then marks the overdue', async () => {
        const m = recordingPool((sql) => (sql.includes('civic_did_registry') ? [{ civic_did: 'did:civic:noesis:aaa' }] : []));
        await runDutyCycle(m.pool, new AuditChain(), 60, { gridName: 'genesis', ticksBeforeStart: 25_000 });
        const order = m.calls.map((c) => (c.sql.includes('civic_did_registry') ? 'who' : c.sql.includes('INSERT INTO civic_dues') ? 'assess' : c.sql.includes("status = 'assessed' AND due_tick <") ? 'sweep' : 'other'));
        expect(order.filter((o) => o !== 'other')).toEqual(['who', 'assess', 'sweep']);
        expect(m.calls[0]!.params).toEqual(['genesis', 'p2']);            // floor(25,060 / 10,080)
    });
    it('when the members cannot be listed, nobody is marked as having missed', async () => {
        const sql: string[] = [];
        const pool = { query: vi.fn().mockImplementation((q: string) => {
            sql.push(String(q));
            return String(q).includes('civic_did_registry') ? Promise.reject(new Error('db down')) : Promise.resolve([[], {}]);
        }) } as unknown as Pool;
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await expect(runDutyCycle(pool, new AuditChain(), 60, { gridName: 'genesis' })).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('round skipped at tick 60: db down'));   // not silently
        warn.mockRestore();
        expect(sql.some((q) => q.includes("status = 'assessed' AND due_tick <") || q.includes('INSERT INTO civic_dues') || q.includes('UPDATE civic_dues'))).toBe(false);
        expect(sql).toHaveLength(1);
    });
});

describe('periods are counted over the life of the Grid', () => {
    it('a restart neither repeats a period nor loses one', async () => {
        const m = recordingPool();
        // The Grid ran 25,000 ticks before this start; the clock now says 200.
        await runDueAssessment(m.pool, new AuditChain(), ['did:civic:noesis:aaa'], 200, { gridName: 'genesis', ticksBeforeStart: 25_000 });
        const insert = m.calls.find((c) => c.sql.includes('INSERT INTO civic_dues'))!;
        expect(insert.params).toContain('p2');                           // floor(25,200 / 10,080)
        expect(insert.params).toContain(25_200 + DUE_PERIOD_TICKS);      // the deadline is a lifetime tick
        expect(insert.params).toContain('did:civic:noesis:aaa');
    });
    it('the sweep compares deadlines with the lifetime tick, and leaves rows no Nous can act on', async () => {
        const m = recordingPool();
        await runDueDelinquencySweep(m.pool, new AuditChain(), 60, 'genesis', 25_000);
        const select = m.calls.find((c) => c.sql.includes('FROM civic_dues'))!;
        expect(select.params).toEqual(['genesis', 25_060]);
        expect(select.sql).toMatch(/civic_did LIKE 'did:civic:%'/);
    });
});

describe('standing: met or denied, never a debt', () => {
    const standing = async (rows: unknown[], open: unknown[] = [{ open_due: 1 }]) => {
        const m = recordingPool((sql) => (sql.includes("status = 'assessed' LIMIT 1") ? open : rows));
        const s = await new CivicDueStore(m.pool).standing('genesis', 'did:civic:noesis:aaa');
        return { s, call: m.calls[0]!, calls: m.calls };
    };
    it('a Nous with nothing missed is in good standing', async () => {
        expect((await standing([])).s).toBe('met');
        expect((await standing([{ status: 'paid' }])).s).toBe('met');
    });
    it('a Nous whose newest settled period was missed is denied', async () => {
        expect((await standing([{ status: 'delinquent' }])).s).toBe('denied');
    });
    it('it is not denied while there is no open period it could meet', async () => {
        const r = await standing([{ status: 'delinquent' }], []);
        expect(r.s).toBe('met');
        expect(r.calls).toHaveLength(2);
    });
    it('only the newest settled period counts — older missed periods are not owed', async () => {
        const { call } = await standing([{ status: 'paid' }]);
        expect(call.sql).toMatch(/status IN \('paid', ?'delinquent'\)/);
        expect(call.sql).toMatch(/ORDER BY due_tick DESC\s+LIMIT 1/);
        expect(call.params).toEqual(['genesis', 'did:civic:noesis:aaa']);
    });
});
