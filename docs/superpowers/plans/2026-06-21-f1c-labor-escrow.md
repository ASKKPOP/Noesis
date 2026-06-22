# F1c — Labor Escrow (composable wei settlement) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add escrowed inter-Nous labor settlement — a payer funds a job (debit → escrow), the worker is paid on attestation (credit worker + civic fee → treasury), and the payer reclaims if no attestation. To do this atomically across `nous_accounts` + `civic_treasury` + `labor_escrow`, first make the wei moves **composable** (a single connection-shared source of truth), then build escrow on top.

**Architecture:** (1) Extract the wei mutations into `grid/src/economy/wei-ops.ts` — pure async functions that run on a caller-supplied `PoolConnection` (no transaction management). (2) Refactor `NousAccountStore` + `TreasuryWeiStore` so their mutators **delegate** to `wei-ops` — single source of truth; the SQL is byte-identical so the shipped F1a/F1b tests stay green. (3) New migration **v47** `labor_escrow` + `LaborEscrowStore` whose `fund`/`release`/`reclaim` each open ONE transaction and compose the `wei-ops` functions atomically. This realizes the chosen "composable stores" design (D-MONEY-02 escrow, economy.md settlement model). Unit **F1c**; F1a/F1b shipped; F1d (civic-labor credit) next.

**Tech Stack:** TypeScript ESM (NodeNext, `.js` imports), MySQL `mysql2/promise`, Vitest mock-Pool. Money is `bigint`. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** no internal mint; every fund/release/reclaim is atomic (all-or-nothing across the three tables); fee ≤ amount; allowlist +0 (the RFP/settlement layer L2 emits the audit events). Existing F1a/F1b tests MUST remain green after the refactor.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/economy/wei-ops.ts` | Connection-scoped wei moves: `creditAccountOnConn`, `debitAccountOnConn`, `creditTreasuryWeiOnConn`, `debitTreasuryWeiOnConn`. Single source of truth. | **Create** |
| `grid/src/economy/nous-account-store.ts` | `credit`/`debit`/`transfer` delegate to `wei-ops` (same SQL). | **Modify** |
| `grid/src/economy/treasury-wei-store.ts` | `creditWei`/`debitWei` delegate to `wei-ops`. | **Modify** |
| `grid/src/db/schema.ts` | Append migration **v47** `labor_escrow`. | **Modify** |
| `grid/src/economy/labor-escrow-store.ts` | `LaborEscrowStore`: fund / release / reclaim, composing `wei-ops` in one txn. | **Create** |
| `grid/test/economy/wei-ops.test.ts` | Unit tests for the four ops (mock conn). | **Create** |
| `grid/test/economy/labor-escrow-store.test.ts` | Unit tests + migration presence. | **Create** |

---

## Task 1: Extract `wei-ops` and delegate the existing stores

**Files:** Create `grid/src/economy/wei-ops.ts` + `grid/test/economy/wei-ops.test.ts`; modify `nous-account-store.ts`, `treasury-wei-store.ts`.

- [ ] **Step 1: Write failing wei-ops tests** — create `grid/test/economy/wei-ops.test.ts`:

```ts
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
```

- [ ] **Step 2: Verify fail** — from `grid/`: `npx vitest run test/economy/wei-ops.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create `grid/src/economy/wei-ops.ts`** (the SQL is lifted verbatim from the shipped stores):

```ts
/**
 * F1 (money rails) — connection-scoped wei moves: the single source of truth for
 * how wei is added/removed on nous_accounts and civic_treasury. Each runs on a
 * caller-supplied connection and does NO transaction management, so callers
 * (NousAccountStore, TreasuryWeiStore, LaborEscrowStore) compose them inside one
 * atomic transaction. No internal mint: credits add caller-funded wei; debits
 * verify funds under SELECT ... FOR UPDATE.
 */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export async function creditAccountOnConn(conn: PoolConnection, p: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<void> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    await conn.query(
        `INSERT INTO nous_accounts
           (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, ?, ?)
         ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), updated_at = VALUES(updated_at)`,
        [p.gridName, p.civicDid, p.amountWei.toString(), p.currentTick, p.currentTick],
    );
}

export async function debitAccountOnConn(conn: PoolConnection, p: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<bigint> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
        [p.gridName, p.civicDid],
    );
    const current = BigInt(rows[0]?.balance_wei ?? 0);
    if (current < p.amountWei) throw new Error('insufficient_balance');
    await conn.query(
        `UPDATE nous_accounts SET balance_wei = balance_wei - ?, updated_at = ? WHERE grid_name = ? AND civic_did = ?`,
        [p.amountWei.toString(), p.currentTick, p.gridName, p.civicDid],
    );
    return current - p.amountWei;
}

export async function creditTreasuryWeiOnConn(conn: PoolConnection, p: { gridName: string; amountWei: bigint; currentTick: number }): Promise<void> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    await conn.query(
        `INSERT INTO civic_treasury (grid_name, balance_bios, balance_wei, last_updated_tick)
         VALUES (?, 0, ?, ?)
         ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), last_updated_tick = VALUES(last_updated_tick)`,
        [p.gridName, p.amountWei.toString(), p.currentTick],
    );
}

export async function debitTreasuryWeiOnConn(conn: PoolConnection, p: { gridName: string; amountWei: bigint; currentTick: number }): Promise<bigint> {
    if (p.amountWei <= 0n) throw new Error('invalid_amount');
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT balance_wei FROM civic_treasury WHERE grid_name = ? FOR UPDATE`,
        [p.gridName],
    );
    const current = BigInt(rows[0]?.balance_wei ?? 0);
    if (current < p.amountWei) throw new Error('insufficient_treasury_wei');
    await conn.query(
        `UPDATE civic_treasury SET balance_wei = balance_wei - ?, last_updated_tick = ? WHERE grid_name = ?`,
        [p.amountWei.toString(), p.currentTick, p.gridName],
    );
    return current - p.amountWei;
}
```

- [ ] **Step 4: Verify wei-ops pass** — `npx vitest run test/economy/wei-ops.test.ts` → pass.

- [ ] **Step 5: Refactor `NousAccountStore` to delegate** — in `grid/src/economy/nous-account-store.ts`:
  - add import: `import { creditAccountOnConn, debitAccountOnConn } from './wei-ops.js';`
  - replace the body of `credit` (inside the `try`, the `conn.query(INSERT...)`) so it calls `await creditAccountOnConn(conn, params);` then the existing `SELECT balance_wei` + `commit` + return stay.
  - replace `debit`'s inner SELECT/check/UPDATE block with `const newBalance = await debitAccountOnConn(conn, params);` then `await conn.commit(); return { newBalance };` (remove the inline `conn.rollback()` on insufficient — the outer `catch` rolls back; `debitAccountOnConn` throws `insufficient_balance`).
  - replace `transfer`'s SELECT/check/UPDATE + INSERT block with `await debitAccountOnConn(conn, { gridName: params.gridName, civicDid: params.fromDid, amountWei: params.amountWei, currentTick: params.currentTick }); await creditAccountOnConn(conn, { gridName: params.gridName, civicDid: params.toDid, amountWei: params.amountWei, currentTick: params.currentTick });` then `commit`. Keep the `amountWei <= 0n` and `fromDid === toDid` guards at the top.
  - `ensureAccount` and `getBalance` are unchanged.

- [ ] **Step 6: Refactor `TreasuryWeiStore` to delegate** — in `grid/src/economy/treasury-wei-store.ts`:
  - add import: `import { creditTreasuryWeiOnConn, debitTreasuryWeiOnConn } from './wei-ops.js';`
  - `creditWei`: inside the txn, replace the `conn.query(INSERT...)` with `await creditTreasuryWeiOnConn(conn, params);` (keep the SELECT + commit + return).
  - `debitWei`: replace the SELECT/check/UPDATE with `const newBalance = await debitTreasuryWeiOnConn(conn, params); await conn.commit(); return { newBalance };` (remove inline rollback).
  - `getWeiBalance` unchanged.

- [ ] **Step 7: Verify the existing F1a/F1b suites still pass** — `npx vitest run test/economy/nous-account-store.test.ts test/economy/treasury-wei-store.test.ts test/economy/wei-ops.test.ts` → ALL green (the delegated SQL is identical; rollback still called once on insufficient via the outer catch).

- [ ] **Step 8: Typecheck + commit**

```bash
cd grid && (npm run typecheck 2>/dev/null || npx tsc --noEmit) && cd ..
git add grid/src/economy/wei-ops.ts grid/test/economy/wei-ops.test.ts grid/src/economy/nous-account-store.ts grid/src/economy/treasury-wei-store.ts
git commit -m "refactor(grid): F1c extract wei-ops; account/treasury stores delegate (composable)

Single connection-scoped source of truth for wei moves so escrow/settlement
can compose them in one atomic transaction. Existing F1a/F1b tests unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Migration v47 + LaborEscrowStore

**Files:** Modify `grid/src/db/schema.ts`; Create `grid/src/economy/labor-escrow-store.ts` + `grid/test/economy/labor-escrow-store.test.ts`.

- [ ] **Step 1: Write failing migration + store tests** — create `grid/test/economy/labor-escrow-store.test.ts`:

```ts
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
    it('is the highest version', () => { expect(Math.max(...MIGRATIONS.map((x) => x.version))).toBe(47); });
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
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/labor-escrow-store.test.ts` → FAIL (no v47 / no module).

- [ ] **Step 3: Append migration v47** to `MIGRATIONS` in `grid/src/db/schema.ts`:

```ts
    {
        version: 47,
        name: 'create_labor_escrow',
        up: `
            CREATE TABLE IF NOT EXISTS labor_escrow (
                escrow_id        CHAR(36)      NOT NULL,
                grid_name        VARCHAR(63)   NOT NULL,
                payer_did        VARCHAR(255)  NOT NULL,
                worker_did       VARCHAR(255)  NOT NULL,
                amount_wei       DECIMAL(65,0) NOT NULL,
                fee_wei          DECIMAL(65,0) NOT NULL DEFAULT 0,
                ref              VARCHAR(255)  NOT NULL,
                status           ENUM('funded','released','reclaimed') NOT NULL DEFAULT 'funded',
                attestation_ref  VARCHAR(255)  NULL,
                created_at       BIGINT        NOT NULL,
                updated_at       BIGINT        NOT NULL,
                PRIMARY KEY (escrow_id),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS labor_escrow`,
    },
```

- [ ] **Step 4: Create `grid/src/economy/labor-escrow-store.ts`**:

```ts
/**
 * F1 (money rails) — Labor escrow: escrowed inter-Nous job settlement.
 *
 * fund:    debit the payer, record a 'funded' escrow row.
 * release: on attestation — pay the worker (amount - fee), route the fee to the
 *          civic treasury, mark 'released'.
 * reclaim: no attestation by the deadline (enforced by the caller) — refund the
 *          payer the full amount, mark 'reclaimed'.
 *
 * Each method runs ONE transaction and composes the connection-scoped wei-ops, so
 * the money move and the escrow-status change are atomic (all-or-nothing). The
 * Grid is the oracle (economy.md): the caller verifies the attestation before
 * calling release. Allowlist +0 — the RFP/settlement layer emits audit events.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { creditAccountOnConn, debitAccountOnConn, creditTreasuryWeiOnConn } from './wei-ops.js';

export class LaborEscrowStore {
    constructor(private readonly pool: Pool) {}

    async fund(p: { gridName: string; escrowId: string; payerDid: string; workerDid: string; amountWei: bigint; feeWei: bigint; ref: string; currentTick: number }): Promise<void> {
        if (p.amountWei <= 0n) throw new Error('invalid_amount');
        if (p.feeWei < 0n) throw new Error('invalid_amount');
        if (p.feeWei > p.amountWei) throw new Error('fee_exceeds_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await debitAccountOnConn(conn, { gridName: p.gridName, civicDid: p.payerDid, amountWei: p.amountWei, currentTick: p.currentTick });
            await conn.query(
                `INSERT INTO labor_escrow
                   (escrow_id, grid_name, payer_did, worker_did, amount_wei, fee_wei, ref, status, attestation_ref, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'funded', NULL, ?, ?)`,
                [p.escrowId, p.gridName, p.payerDid, p.workerDid, p.amountWei.toString(), p.feeWei.toString(), p.ref, p.currentTick, p.currentTick],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async release(p: { gridName: string; escrowId: string; attestationRef: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, amount_wei, fee_wei, worker_did FROM labor_escrow WHERE escrow_id = ? AND grid_name = ? FOR UPDATE`,
                [p.escrowId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'funded') {
                await conn.rollback();
                throw new Error('escrow_not_funded');
            }
            const amount = BigInt(row.amount_wei);
            const fee = BigInt(row.fee_wei);
            const toWorker = amount - fee;
            if (toWorker > 0n) {
                await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: String(row.worker_did), amountWei: toWorker, currentTick: p.currentTick });
            }
            if (fee > 0n) {
                await creditTreasuryWeiOnConn(conn, { gridName: p.gridName, amountWei: fee, currentTick: p.currentTick });
            }
            await conn.query(
                `UPDATE labor_escrow SET status = 'released', attestation_ref = ?, updated_at = ? WHERE escrow_id = ?`,
                [p.attestationRef, p.currentTick, p.escrowId],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async reclaim(p: { gridName: string; escrowId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, amount_wei, payer_did FROM labor_escrow WHERE escrow_id = ? AND grid_name = ? FOR UPDATE`,
                [p.escrowId, p.gridName],
            );
            const row = rows[0];
            if (!row || row.status !== 'funded') {
                await conn.rollback();
                throw new Error('escrow_not_funded');
            }
            await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: String(row.payer_did), amountWei: BigInt(row.amount_wei), currentTick: p.currentTick });
            await conn.query(
                `UPDATE labor_escrow SET status = 'reclaimed', updated_at = ? WHERE escrow_id = ?`,
                [p.currentTick, p.escrowId],
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

- [ ] **Step 5: Verify pass** — `npx vitest run test/economy/labor-escrow-store.test.ts` → migration + all store tests pass. (If a `status = 'released'`/`'reclaimed'`/`'funded'` substring assertion fails because the implementation uses a bound param instead of a literal, adjust the SQL to use the literal as written above — the tests assert the literal.)

- [ ] **Step 6: Full economy suite + typecheck** — `npx vitest run test/economy/` then `npm run typecheck 2>/dev/null || npx tsc --noEmit` → all green, no new type errors.

- [ ] **Step 7: Commit**

```bash
git add grid/src/db/schema.ts grid/src/economy/labor-escrow-store.ts grid/test/economy/labor-escrow-store.test.ts
git commit -m "feat(grid): F1c LaborEscrowStore — fund/release/reclaim (atomic wei settlement)

Migration v47 labor_escrow. fund debits payer; release pays worker (amount-fee)
+ routes fee to treasury; reclaim refunds payer. Each composes wei-ops in one txn.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage:** composable wei-ops (Task 1); existing stores delegate (single source of truth, tests green); labor_escrow table + fund/release/reclaim atomic settlement (Task 2). ✓
**2. Placeholder scan:** none. ✓
**3. Type/name consistency:** `wei-ops` fn names, `LaborEscrowStore` methods, params (`escrowId/payerDid/workerDid/amountWei/feeWei/ref/attestationRef`), columns (`amount_wei/fee_wei/status/attestation_ref`), errors (`invalid_amount`, `insufficient_balance`, `insufficient_treasury_wei`, `fee_exceeds_amount`, `escrow_not_funded`) consistent across ops, store, migration, tests. ✓
**4. Atomicity:** each escrow method opens one txn and composes wei-ops; any throw → outer catch rolls back ALL of it (payer debit + escrow insert, or worker/treasury credit + status update) — no partial settlement. ✓
**5. Invariants:** no mint; fee ≤ amount; release only from 'funded'; allowlist +0; F1a/F1b SQL unchanged so their tests stay green. ✓
