# O2a — Human-in-the-Loop approval gate (consult before a big decision) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** The capability the operator described at the start: a Nous **pauses before a big decision** (e.g. buy/sell/large trade) and **consults its human** — the action is held as a *pending approval* until the human approves or rejects it. This slice builds the approval **state machine** (request → pending → approved/rejected, resolved-once). The `human.approval_*` audit events (O2b) and the Portal↔Nous chat channel (O2c) follow.

**Architecture:** Grid-side `pending_approvals` table (migration **v52**) + `ApprovalStore`: `requestApproval` (a Nous holds a big-decision action for approval), `listPending` (the human's queue, for the Portal UI), `approve`/`reject` (the human resolves — atomic, once, under `FOR UPDATE`), `getApproval` (the caller reads status + the held payload to execute on approval). Mirrors the `CivicDueStore`/`OrbitalObjectStore` idiom (Pool ctor, `bigint` ticks, atomic `FOR UPDATE` resolution). **Allowlist +0** — audit events are O2b.

**Tech Stack:** TypeScript ESM (NodeNext, `.js`), MySQL `mysql2/promise`, Vitest mock-Pool. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** resolve-once (pending → approved | rejected | expired, guarded under `FOR UPDATE`); the held `payload` (the action to run on approval) is stored Grid-side and executed by the caller only after `approved` — never auto-executed by this store; no audit/allowlist change in O2a; existing suites green.

---

## File Structure

| File | Action |
|---|---|
| `grid/src/db/schema.ts` | **Modify** — append migration **v52** `pending_approvals` |
| `grid/src/economy/approval-store.ts` | **Create** — `ApprovalStore` |
| `grid/test/economy/approval-store.test.ts` | **Create** — migration + store tests |

(Placed under `economy/` alongside the other civic stores; it gates economic big-decisions.)

---

## Task 1: Migration v52 + ApprovalStore

- [ ] **Step 1: Failing tests** — `grid/test/economy/approval-store.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ApprovalStore } from '../../src/economy/approval-store.js';

describe('migration v52 — pending_approvals', () => {
    it('creates the approvals table with a status + held payload', () => {
        const m = MIGRATIONS.find((x) => x.version === 52);
        expect(m, 'v52 must exist').toBeDefined();
        expect(m!.name).toBe('create_pending_approvals');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS pending_approvals');
        expect(m!.up).toContain('payload');
        expect(m!.up).toContain("status");
        expect(m!.down).toContain('DROP TABLE IF EXISTS pending_approvals');
    });
    it('migration v52 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 52)).toHaveLength(1);
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

describe('ApprovalStore', () => {
    it('requestApproval inserts a pending row holding the action payload', async () => {
        const m = makeMockPool([[{}, {}]]);
        await new ApprovalStore(m.pool).requestApproval({ gridName: 'g', approvalId: 'a1', nousDid: 'n', humanDid: 'h', kind: 'trade', summary: 'sell 5 ETH of compute', payload: { action_type: 'trade_request', amount: '5' }, deadlineTick: 200, currentTick: 10 });
        const sql = m.calls()[0];
        expect(sql).toContain('INSERT INTO pending_approvals');
        expect(sql).toContain("'pending'");
    });
    it('requestApproval rejects an empty kind', async () => {
        await expect(new ApprovalStore(makeMockPool().pool).requestApproval({ gridName: 'g', approvalId: 'a1', nousDid: 'n', humanDid: 'h', kind: '', summary: 's', payload: {}, deadlineTick: 200, currentTick: 10 })).rejects.toThrow('invalid_kind');
    });
    it('listPending queries the human\'s pending approvals', async () => {
        const m = makeMockPool([rows([{ approval_id: 'a1', kind: 'trade', summary: 'x', status: 'pending' }])]);
        const list = await new ApprovalStore(m.pool).listPending('g', 'h');
        expect(list).toHaveLength(1);
        expect(m.calls()[0]).toContain('FROM pending_approvals');
        expect(m.calls()[0]).toContain("status = 'pending'");
    });
    it('approve flips pending → approved (atomic, once)', async () => {
        const m = makeMockPool([rows([{ status: 'pending' }]), [{}, {}]]);
        await new ApprovalStore(m.pool).approve({ gridName: 'g', approvalId: 'a1', currentTick: 20 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('FOR UPDATE');
        expect(sql).toContain("status = 'approved'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('approve refuses a non-pending approval', async () => {
        const m = makeMockPool([rows([{ status: 'approved' }])]);
        await expect(new ApprovalStore(m.pool).approve({ gridName: 'g', approvalId: 'a1', currentTick: 20 })).rejects.toThrow('approval_not_pending');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('reject flips pending → rejected', async () => {
        const m = makeMockPool([rows([{ status: 'pending' }]), [{}, {}]]);
        await new ApprovalStore(m.pool).reject({ gridName: 'g', approvalId: 'a1', currentTick: 21 });
        expect(m.calls().join('\n')).toContain("status = 'rejected'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/approval-store.test.ts` → FAIL.

- [ ] **Step 3: Append migration v52** to `MIGRATIONS` in `grid/src/db/schema.ts` (confirm v51 is the current max first):

```ts
    {
        version: 52,
        name: 'create_pending_approvals',
        up: `
            CREATE TABLE IF NOT EXISTS pending_approvals (
                approval_id   CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                nous_did      VARCHAR(255)  NOT NULL,
                human_did     VARCHAR(255)  NOT NULL,
                kind          VARCHAR(63)   NOT NULL,
                summary       TEXT          NOT NULL,
                payload       TEXT          NOT NULL,
                status        ENUM('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
                created_tick  BIGINT        NOT NULL,
                deadline_tick BIGINT        NOT NULL,
                resolved_tick BIGINT        NULL,
                created_at    BIGINT        NOT NULL,
                updated_at    BIGINT        NOT NULL,
                PRIMARY KEY (approval_id),
                INDEX idx_human_pending (grid_name, human_did, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS pending_approvals`,
    },
```

- [ ] **Step 4: Create `grid/src/economy/approval-store.ts`**:

```ts
/**
 * O2a — Human-in-the-loop approval gate. A Nous pauses before a big decision
 * (buy/sell/large trade) and holds the action here as a PENDING approval; the
 * human approves or rejects it. The held `payload` (the action to run on approval)
 * is stored Grid-side and executed by the caller ONLY after status='approved' —
 * this store never auto-executes. Resolve-once under SELECT ... FOR UPDATE.
 *
 * Audit events (human.approval_*) are O2b; the Portal chat channel is O2c.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface PendingApprovalRow {
    approval_id: string; grid_name: string; nous_did: string; human_did: string;
    kind: string; summary: string; payload: string; status: string;
    created_tick: number; deadline_tick: number; resolved_tick: number | null;
}

export class ApprovalStore {
    constructor(private readonly pool: Pool) {}

    /** A Nous requests human approval for a big-decision action (held as the payload). */
    async requestApproval(p: { gridName: string; approvalId: string; nousDid: string; humanDid: string; kind: string; summary: string; payload: unknown; deadlineTick: number; currentTick: number }): Promise<void> {
        if (!p.kind || p.kind.trim() === '') throw new Error('invalid_kind');
        await this.pool.query(
            `INSERT INTO pending_approvals
               (approval_id, grid_name, nous_did, human_did, kind, summary, payload, status, created_tick, deadline_tick, resolved_tick, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, ?, ?)`,
            [p.approvalId, p.gridName, p.nousDid, p.humanDid, p.kind, p.summary, JSON.stringify(p.payload), p.currentTick, p.deadlineTick, p.currentTick, p.currentTick],
        );
    }

    /** The human's pending queue (for the Portal/Steward UI). */
    async listPending(gridName: string, humanDid: string): Promise<PendingApprovalRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT approval_id, grid_name, nous_did, human_did, kind, summary, payload, status, created_tick, deadline_tick, resolved_tick
             FROM pending_approvals WHERE grid_name = ? AND human_did = ? AND status = 'pending' ORDER BY created_tick ASC LIMIT 200`,
            [gridName, humanDid],
        );
        return rows as unknown as PendingApprovalRow[];
    }

    /** Read one approval (the caller reads status + payload to execute the held action). */
    async getApproval(gridName: string, approvalId: string): Promise<PendingApprovalRow | undefined> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT approval_id, grid_name, nous_did, human_did, kind, summary, payload, status, created_tick, deadline_tick, resolved_tick
             FROM pending_approvals WHERE grid_name = ? AND approval_id = ?`,
            [gridName, approvalId],
        );
        return rows[0] as unknown as PendingApprovalRow | undefined;
    }

    /** The human approves — pending → approved (resolve-once). */
    async approve(p: { gridName: string; approvalId: string; currentTick: number }): Promise<void> {
        await this.resolve(p.gridName, p.approvalId, 'approved', p.currentTick);
    }

    /** The human rejects — pending → rejected (resolve-once). */
    async reject(p: { gridName: string; approvalId: string; currentTick: number }): Promise<void> {
        await this.resolve(p.gridName, p.approvalId, 'rejected', p.currentTick);
    }

    private async resolve(gridName: string, approvalId: string, to: 'approved' | 'rejected' | 'expired', currentTick: number): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status FROM pending_approvals WHERE approval_id = ? AND grid_name = ? FOR UPDATE`,
                [approvalId, gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'pending') {
                await conn.rollback();
                throw new Error('approval_not_pending');
            }
            await conn.query(
                `UPDATE pending_approvals SET status = '${to}', resolved_tick = ?, updated_at = ? WHERE approval_id = ?`,
                [currentTick, currentTick, approvalId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }
}
```
(`to` is an internal literal union — not user input — so the inlined `status = '${to}'` is safe; all external values are bound parameters.)

- [ ] **Step 5: Verify pass** — `npx vitest run test/economy/approval-store.test.ts` → migration + store tests pass.
- [ ] **Step 6: Full economy suite + typecheck** — `npx vitest run test/economy/` (no regression) then `npm run typecheck 2>/dev/null || npx tsc --noEmit`.
- [ ] **Step 7: Commit**

```bash
git add grid/src/db/schema.ts grid/src/economy/approval-store.ts grid/test/economy/approval-store.test.ts
git commit -m "feat(grid): O2a ApprovalStore — human-in-the-loop approval gate (migration v52)

A Nous holds a big-decision action as a pending approval; the human approves/
rejects (resolve-once under FOR UPDATE). The held payload runs only on approval.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review
**1. Coverage:** request → pending → approve/reject, plus listPending (human queue) + getApproval (read held action). The consult-your-human state machine. ✓
**2. Resolve-once:** approve/reject lock the row `FOR UPDATE`, refuse non-pending → `approval_not_pending`; rollback on refuse. ✓
**3. Safety:** the store never auto-executes the held payload — the caller runs it only after reading `status='approved'`. ✓
**4. Type/name consistency:** `ApprovalStore` methods, columns (`kind`/`summary`/`payload`/`status`/`resolved_tick`), error `invalid_kind`/`approval_not_pending`; the `to` literal is internal (no injection — external values bound). ✓
**5. Scope:** state machine only; `human.approval_*` audit events (O2b) + Portal↔Nous chat (O2c) deferred; allowlist +0. ✓
