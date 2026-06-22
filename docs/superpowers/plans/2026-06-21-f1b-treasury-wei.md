# F1b — Treasury wei extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the civic treasury a **wei balance** alongside its legacy Ousia balance, with atomic credit (inflows: fees + civic due) and Polis-authorized debit (disbursement / RFP award) — the commons fund of the two-money economy.

**Architecture:** Add a `balance_wei DECIMAL(65,0)` column to the existing `civic_treasury` table (migration **v46**, an `ALTER TABLE` — the table + genesis row already exist from v35). Add a focused `TreasuryWeiStore` (`grid/src/economy/treasury-wei-store.ts`) operating on that column, separate from the shipped Ousia `IrsStore` so the live economy is untouched. Mirrors the `IrsStore`/`NousAccountStore` idiom (Pool ctor; bigint↔string; atomic `FOR UPDATE` txns). Unit **F1b** of the Economic Reality Loop program; F1a (`NousAccountStore`) already shipped. Later: F1c labor escrow, F1d civic-labor credit.

**Tech Stack:** TypeScript ESM (NodeNext, `.js` imports), MySQL `mysql2/promise`, Vitest mock-Pool. Money is `bigint`. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Design notes:** wei = `DECIMAL(65,0)` (BIGINT overflows real wei). Debit throws `insufficient_treasury_wei`; credit/debit reject `amountWei <= 0n` (`invalid_amount`). Polis authorization is enforced by the caller/route (as `IrsStore.disburse` does — emits authorized event before, executed after); this store just moves money. **Allowlist +0.**

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/db/schema.ts` | Append migration **v46** (`ALTER TABLE civic_treasury ADD COLUMN balance_wei`). | **Modify** |
| `grid/src/economy/treasury-wei-store.ts` | `TreasuryWeiStore`: getWeiBalance / creditWei / debitWei. | **Create** |
| `grid/test/economy/treasury-wei-store.test.ts` | Mock-Pool unit tests + migration presence. | **Create** |

---

## Task 1: Migration v46 — `civic_treasury.balance_wei`

**Files:** Modify `grid/src/db/schema.ts`; Test `grid/test/economy/treasury-wei-store.test.ts`.

- [ ] **Step 1: Write the failing migration test** — create `grid/test/economy/treasury-wei-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

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
    it('is the highest version (appended)', () => {
        expect(Math.max(...MIGRATIONS.map((x) => x.version))).toBe(46);
    });
});
```

- [ ] **Step 2: Verify fail** — from `grid/`: `npx vitest run test/economy/treasury-wei-store.test.ts` → FAIL (no v46).

- [ ] **Step 3: Append migration v46** to the end of `MIGRATIONS` in `grid/src/db/schema.ts`:

```ts
    {
        version: 46,
        name: 'civic_treasury_add_balance_wei',
        up: `ALTER TABLE civic_treasury ADD COLUMN balance_wei DECIMAL(65,0) NOT NULL DEFAULT 0`,
        down: `ALTER TABLE civic_treasury DROP COLUMN balance_wei`,
    },
```

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/treasury-wei-store.test.ts` → migration tests pass.

- [ ] **Step 5: Commit**

```bash
git add grid/src/db/schema.ts grid/test/economy/treasury-wei-store.test.ts
git commit -m "feat(grid): F1b migration v46 — civic_treasury.balance_wei DECIMAL(65,0)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: TreasuryWeiStore

**Files:** Create `grid/src/economy/treasury-wei-store.ts`; append tests to `grid/test/economy/treasury-wei-store.test.ts`.

- [ ] **Step 1: Append failing store tests** (mock-Pool style, same helper as `grid/test/economy/nous-account-store.test.ts`):

```ts
import { vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { TreasuryWeiStore } from '../../src/economy/treasury-wei-store.js';

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
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/treasury-wei-store.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write the store** — create `grid/src/economy/treasury-wei-store.ts`:

```ts
/**
 * F1 (money rails) — Treasury wei: the civic commons fund in wei.
 *
 * Operates on the civic_treasury.balance_wei column (migration v46), separate
 * from the legacy Ousia balance owned by IrsStore. Inflows (creditWei): fees +
 * the civic due. Outflows (debitWei): Polis-authorized disbursement / RFP award —
 * the caller enforces authorization + emits the audit events (as IrsStore.disburse
 * does); this store only moves money. Atomic (SELECT ... FOR UPDATE → UPDATE),
 * wei as bigint (DECIMAL(65,0) string ↔ BigInt).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class TreasuryWeiStore {
    constructor(private readonly pool: Pool) {}

    /** Current treasury wei balance (0 if absent). */
    async getWeiBalance(gridName: string): Promise<bigint> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT balance_wei FROM civic_treasury WHERE grid_name = ?`,
            [gridName],
        );
        return BigInt(rows[0]?.balance_wei ?? 0);
    }

    /** Add wei to the treasury (fees / civic due). amountWei must be > 0. */
    async creditWei(params: { gridName: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO civic_treasury (grid_name, balance_bios, balance_wei, last_updated_tick)
                 VALUES (?, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), last_updated_tick = VALUES(last_updated_tick)`,
                [params.gridName, params.amountWei.toString(), params.currentTick],
            );
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM civic_treasury WHERE grid_name = ?`,
                [params.gridName],
            );
            await conn.commit();
            return { newBalance: BigInt(rows[0]?.balance_wei ?? 0) };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /** Spend treasury wei (Polis-authorized by the caller). Throws 'insufficient_treasury_wei'. */
    async debitWei(params: { gridName: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM civic_treasury WHERE grid_name = ? FOR UPDATE`,
                [params.gridName],
            );
            const current = BigInt(rows[0]?.balance_wei ?? 0);
            if (current < params.amountWei) {
                await conn.rollback();
                throw new Error('insufficient_treasury_wei');
            }
            await conn.query(
                `UPDATE civic_treasury SET balance_wei = balance_wei - ?, last_updated_tick = ?
                 WHERE grid_name = ?`,
                [params.amountWei.toString(), params.currentTick, params.gridName],
            );
            await conn.commit();
            return { newBalance: current - params.amountWei };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }
}
```

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/treasury-wei-store.test.ts` → migration + 5 store tests pass.

- [ ] **Step 5: Typecheck** — from `grid/`: `npm run typecheck 2>/dev/null || npx tsc --noEmit` → no new errors.

- [ ] **Step 6: Commit**

```bash
git add grid/src/economy/treasury-wei-store.ts grid/test/economy/treasury-wei-store.test.ts
git commit -m "feat(grid): F1b TreasuryWeiStore — wei commons fund (credit/debit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage:** wei column on civic_treasury (Task 1); getWeiBalance/creditWei/debitWei atomic with insufficient guard (Task 2). Separate from Ousia IrsStore. Allowlist +0. ✓
**2. Placeholder scan:** none. ✓
**3. Type/name consistency:** `TreasuryWeiStore`, `getWeiBalance`/`creditWei`/`debitWei`, `balance_wei`, errors `invalid_amount`/`insufficient_treasury_wei` consistent across migration, store, tests. ✓
**4. Pattern fidelity:** mirrors `IrsStore.disburse` / `NousAccountStore` (Pool, FOR UPDATE, bigint↔string, DECIMAL(65,0)). The upsert keeps `balance_bios` untouched (defaults 0 only on a brand-new row; genesis row already exists). ✓
**5. Invariants:** no mint (credit funded by real inflows); atomic; Ousia path untouched; allowlist unchanged. ✓
