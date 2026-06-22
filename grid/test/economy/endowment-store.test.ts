/**
 * W4 (D-MONEY-09) — EndowmentStore tests.
 *
 * Model-first endowment: a bounded, ledgered, audited operator-authorized wei
 * injection into a member account (the documented temporary bend of D-MONEY-01
 * "no internal mint"). Verifies:
 *   - credits the recipient account by amount_wei
 *   - writes an account_endowments ledger row (source='model_first')
 *   - emits portal.account_endowed when an AuditChain is provided
 *   - rejects amount <= 0
 *   - rejects amount > per-call cap
 *   - rejects when the per-account lifetime cap would be exceeded
 *   - ledger insert + account credit share ONE transaction (atomic)
 *
 * Mock-Pool pattern (no DB), mirrors civic-due-store tests.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import {
    EndowmentStore,
    MODEL_ENDOWMENT_CAP_WEI,
    MODEL_ENDOWMENT_ACCOUNT_CAP_WEI,
} from '../../src/economy/endowment-store.js';

const GRID = 'genesis';
const DID = 'did:civic:noesis:alice';

/**
 * A mock pool whose connection routes queries by SQL shape:
 *   - SELECT ... SUM(amount_wei) ... account_endowments → returns priorSum
 *   - INSERT INTO account_endowments → ok
 *   - INSERT INTO nous_accounts (creditAccountOnConn) → ok
 *   - SELECT balance_wei FROM nous_accounts → returns newBalance
 * Records calls so atomicity (one begin/commit, queries in between) is checkable.
 */
function makePool(opts: { priorSum?: bigint; newBalance?: bigint } = {}) {
    const priorSum = opts.priorSum ?? 0n;
    const newBalance = opts.newBalance ?? 0n;
    const calls: string[] = [];
    const conn = {
        beginTransaction: vi.fn().mockImplementation(() => { calls.push('begin'); return Promise.resolve(); }),
        commit: vi.fn().mockImplementation(() => { calls.push('commit'); return Promise.resolve(); }),
        rollback: vi.fn().mockImplementation(() => { calls.push('rollback'); return Promise.resolve(); }),
        release: vi.fn(),
        query: vi.fn().mockImplementation((sql: string) => {
            if (/SUM\(amount_wei\)/i.test(sql)) {
                calls.push('sum');
                return Promise.resolve([[{ total: priorSum.toString() }] as RowDataPacket[], {}]);
            }
            if (/INSERT INTO account_endowments/i.test(sql)) { calls.push('insert_ledger'); return Promise.resolve([{}, {}]); }
            if (/INSERT INTO nous_accounts/i.test(sql)) { calls.push('credit'); return Promise.resolve([{}, {}]); }
            if (/SELECT balance_wei FROM nous_accounts/i.test(sql)) {
                calls.push('read_balance');
                return Promise.resolve([[{ balance_wei: newBalance.toString() }] as RowDataPacket[], {}]);
            }
            calls.push('other');
            return Promise.resolve([[], {}]);
        }),
    };
    const pool = {
        getConnection: vi.fn().mockResolvedValue(conn),
        query: vi.fn().mockResolvedValue([[], {}]),
    } as unknown as Pool;
    return { pool, conn, calls };
}

describe('EndowmentStore.endow (D-MONEY-09)', () => {
    it('credits the recipient account by amount_wei and returns the new balance', async () => {
        const { pool, conn } = makePool({ newBalance: 5n * 10n ** 12n });
        const store = new EndowmentStore(pool);
        const res = await store.endow({ gridName: GRID, civicDid: DID, amountWei: 5n * 10n ** 12n, currentTick: 7 });

        expect(res.newBalance).toBe(5n * 10n ** 12n);
        // creditAccountOnConn issues an INSERT ... ON DUPLICATE KEY into nous_accounts.
        const creditCall = conn.query.mock.calls.find((c) => /INSERT INTO nous_accounts/i.test(c[0]));
        expect(creditCall).toBeDefined();
    });

    it('writes an account_endowments ledger row tagged source=model_first', async () => {
        const { pool, conn } = makePool();
        const store = new EndowmentStore(pool);
        const res = await store.endow({ gridName: GRID, civicDid: DID, amountWei: 1000n, reason: 'seed', currentTick: 7 });

        expect(res.endowmentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        const ledgerCall = conn.query.mock.calls.find((c) => /INSERT INTO account_endowments/i.test(c[0]));
        expect(ledgerCall).toBeDefined();
        // source is a fixed enum literal in the INSERT (not user input → safe inline).
        expect(ledgerCall![0]).toMatch(/'model_first'/);
    });

    it('emits portal.account_endowed when an AuditChain is provided', async () => {
        const { pool } = makePool();
        const audit = new AuditChain();
        const store = new EndowmentStore(pool, audit);
        await store.endow({ gridName: GRID, civicDid: DID, amountWei: 1000n, currentTick: 7 });

        expect(audit.query({ eventType: 'portal.account_endowed' })).toHaveLength(1);
    });

    it('does NOT emit when no AuditChain is provided (optional dep)', async () => {
        const { pool } = makePool();
        const store = new EndowmentStore(pool); // no audit
        // Should resolve without throwing.
        await expect(store.endow({ gridName: GRID, civicDid: DID, amountWei: 1000n, currentTick: 7 })).resolves.toBeDefined();
    });

    it('rejects a non-positive amount', async () => {
        const { pool } = makePool();
        const store = new EndowmentStore(pool);
        await expect(store.endow({ gridName: GRID, civicDid: DID, amountWei: 0n, currentTick: 7 })).rejects.toThrow('invalid_amount');
    });

    it('rejects an amount above the per-call cap', async () => {
        const { pool } = makePool();
        const store = new EndowmentStore(pool);
        await expect(
            store.endow({ gridName: GRID, civicDid: DID, amountWei: MODEL_ENDOWMENT_CAP_WEI + 1n, currentTick: 7 }),
        ).rejects.toThrow('endowment_exceeds_cap');
    });

    it('rejects when the per-account lifetime cap would be exceeded', async () => {
        // priorSum already at the account cap → any further endowment is rejected.
        const { pool, conn } = makePool({ priorSum: MODEL_ENDOWMENT_ACCOUNT_CAP_WEI });
        const store = new EndowmentStore(pool);
        await expect(
            store.endow({ gridName: GRID, civicDid: DID, amountWei: 1000n, currentTick: 7 }),
        ).rejects.toThrow('endowment_account_cap_exceeded');
        // Must have rolled back, not committed.
        expect(conn.commit).not.toHaveBeenCalled();
        expect(conn.rollback).toHaveBeenCalled();
    });

    it('ledger insert and account credit share one transaction (begin → ... → commit)', async () => {
        const { pool, calls } = makePool();
        const store = new EndowmentStore(pool);
        await store.endow({ gridName: GRID, civicDid: DID, amountWei: 1000n, currentTick: 7 });

        expect(calls[0]).toBe('begin');
        expect(calls[calls.length - 1]).toBe('commit');
        // both the ledger insert and the account credit happen inside the txn
        expect(calls).toContain('insert_ledger');
        expect(calls).toContain('credit');
        expect(calls.indexOf('insert_ledger')).toBeGreaterThan(calls.indexOf('begin'));
        expect(calls.indexOf('credit')).toBeLessThan(calls.indexOf('commit'));
    });
});
