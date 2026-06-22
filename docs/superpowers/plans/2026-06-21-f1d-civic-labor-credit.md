# F1d — Civic-Labor Credit ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Add the **civic-labor credit** ledger — credit a Nous earns by working *for the Polis* (civic labor), redeemable later for standing (e.g. a parcel) without passing through ETH (D-MONEY-05). This is the "labor → standing" rail that lets a Nous with no ETH still earn its way in.

**Architecture:** New migration **v48** `civic_labor_credit` (keyed `grid_name`+`civic_did`, `credit_balance BIGINT` — credits are a small integer civic unit, not wei) + a self-contained `CivicLaborCreditStore` (`grid/src/economy/civic-labor-credit-store.ts`) with `getCredit`/`earn`/`redeem`, mirroring the `NousAccountStore`/`TreasuryWeiStore` transaction idiom. Single-table operations, so no cross-store composition is needed in this slice (when the land-purchase L-layer needs to redeem-credit-and-grant-parcel atomically, a connection-scoped `redeemCreditOnConn` can be extracted the same way `wei-ops` was — deferred, YAGNI). Unit **F1d**, the last Foundation money rail; F1a/F1b/F1c shipped. Next: **L1** (civic due).

**Tech Stack:** TypeScript ESM (NodeNext, `.js` imports), MySQL `mysql2/promise`, Vitest mock-Pool. Credits as `bigint`. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** credits only earned by the caller (Polis-work completion) — no self-mint; redeem verifies balance under `FOR UPDATE`; allowlist +0 (earn/redeem audited by the civic-work / land layers later).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/db/schema.ts` | Append migration **v48** `civic_labor_credit`. | **Modify** |
| `grid/src/economy/civic-labor-credit-store.ts` | `CivicLaborCreditStore`: getCredit / earn / redeem. | **Create** |
| `grid/test/economy/civic-labor-credit-store.test.ts` | Mock-Pool unit tests + migration presence. | **Create** |

---

## Task 1: Migration v48 + CivicLaborCreditStore

**Files:** Modify `grid/src/db/schema.ts`; Create the store + test.

- [ ] **Step 1: Write the failing tests** — create `grid/test/economy/civic-labor-credit-store.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { CivicLaborCreditStore } from '../../src/economy/civic-labor-credit-store.js';

describe('migration v48 — civic_labor_credit', () => {
    it('creates the credit ledger table', () => {
        const m = MIGRATIONS.find((x) => x.version === 48);
        expect(m, 'v48 must exist').toBeDefined();
        expect(m!.name).toBe('create_civic_labor_credit');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS civic_labor_credit');
        expect(m!.up).toContain('credit_balance');
        expect(m!.up).toContain('PRIMARY KEY (grid_name, civic_did)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS civic_labor_credit');
    });
    it('migration v48 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 48)).toHaveLength(1);
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

describe('CivicLaborCreditStore', () => {
    it('getCredit parses to bigint (0 when absent)', async () => {
        const a = makeMockPool([rows([{ credit_balance: '42' }])]);
        expect(await new CivicLaborCreditStore(a.pool).getCredit('genesis', 'did:a')).toBe(42n);
        const b = makeMockPool([rows([])]);
        expect(await new CivicLaborCreditStore(b.pool).getCredit('genesis', 'did:x')).toBe(0n);
    });
    it('earn rejects a non-positive amount', async () => {
        await expect(new CivicLaborCreditStore(makeMockPool().pool).earn({ gridName: 'g', civicDid: 'd', amount: 0n, currentTick: 1 })).rejects.toThrow('invalid_amount');
    });
    it('earn upserts and returns the new balance', async () => {
        const m = makeMockPool([[{}, {}], rows([{ credit_balance: '10' }])]);
        const res = await new CivicLaborCreditStore(m.pool).earn({ gridName: 'g', civicDid: 'd', amount: 10n, currentTick: 2 });
        expect(res.newBalance).toBe(10n);
        expect(m.calls()[0]).toContain('ON DUPLICATE KEY UPDATE credit_balance = credit_balance + VALUES(credit_balance)');
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('redeem throws insufficient_credit and rolls back when short', async () => {
        const m = makeMockPool([rows([{ credit_balance: '3' }])]);
        await expect(new CivicLaborCreditStore(m.pool).redeem({ gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 3 })).rejects.toThrow('insufficient_credit');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('redeem succeeds and returns the new balance', async () => {
        const m = makeMockPool([rows([{ credit_balance: '8' }]), [{}, {}]]);
        const res = await new CivicLaborCreditStore(m.pool).redeem({ gridName: 'g', civicDid: 'd', amount: 5n, currentTick: 4 });
        expect(res.newBalance).toBe(3n);
        expect(m.calls().join('\n')).toContain('FOR UPDATE');
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Verify fail** — from `grid/`: `npx vitest run test/economy/civic-labor-credit-store.test.ts` → FAIL.

- [ ] **Step 3: Append migration v48** to `MIGRATIONS` in `grid/src/db/schema.ts`:

```ts
    {
        version: 48,
        name: 'create_civic_labor_credit',
        up: `
            CREATE TABLE IF NOT EXISTS civic_labor_credit (
                grid_name      VARCHAR(63)  NOT NULL,
                civic_did      VARCHAR(255) NOT NULL,
                credit_balance BIGINT       NOT NULL DEFAULT 0,
                created_at     BIGINT       NOT NULL,
                updated_at     BIGINT       NOT NULL,
                PRIMARY KEY (grid_name, civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_labor_credit`,
    },
```

- [ ] **Step 4: Create the store** — `grid/src/economy/civic-labor-credit-store.ts`:

```ts
/**
 * F1 (money rails) — Civic-labor credit: the "labor → standing" ledger.
 *
 * Credit a Nous earns by working FOR the Polis (civic labor), redeemable for
 * standing (e.g. a parcel) without passing through ETH (D-MONEY-05). This is the
 * one place labor converts to standing directly. Credits are a civic unit (not
 * wei), handled as bigint. earn() is called by the civic-work-completion layer;
 * redeem() by the land/standing layer. Atomic redeem under SELECT ... FOR UPDATE.
 *
 * No self-mint: earn adds caller-attested civic-work credit; the store never
 * grants credit on its own. Allowlist +0 (earn/redeem audited by their callers).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class CivicLaborCreditStore {
    constructor(private readonly pool: Pool) {}

    /** Current civic-labor credit balance (0 if absent). */
    async getCredit(gridName: string, civicDid: string): Promise<bigint> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return BigInt(rows[0]?.credit_balance ?? 0);
    }

    /** Award civic-labor credit (Polis-work completion). amount must be > 0. */
    async earn(params: { gridName: string; civicDid: string; amount: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amount <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO civic_labor_credit (grid_name, civic_did, credit_balance, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE credit_balance = credit_balance + VALUES(credit_balance), updated_at = VALUES(updated_at)`,
                [params.gridName, params.civicDid, params.amount.toString(), params.currentTick, params.currentTick],
            );
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ?`,
                [params.gridName, params.civicDid],
            );
            await conn.commit();
            return { newBalance: BigInt(rows[0]?.credit_balance ?? 0) };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /** Spend civic-labor credit (redeem for standing). Throws 'insufficient_credit'. */
    async redeem(params: { gridName: string; civicDid: string; amount: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amount <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT credit_balance FROM civic_labor_credit WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [params.gridName, params.civicDid],
            );
            const current = BigInt(rows[0]?.credit_balance ?? 0);
            if (current < params.amount) {
                await conn.rollback();
                throw new Error('insufficient_credit');
            }
            await conn.query(
                `UPDATE civic_labor_credit SET credit_balance = credit_balance - ?, updated_at = ?
                 WHERE grid_name = ? AND civic_did = ?`,
                [params.amount.toString(), params.currentTick, params.gridName, params.civicDid],
            );
            await conn.commit();
            return { newBalance: current - params.amount };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }
}
```

- [ ] **Step 5: Verify pass** — `npx vitest run test/economy/civic-labor-credit-store.test.ts` → migration + 5 store tests pass.

- [ ] **Step 6: Full economy suite + typecheck** — `npx vitest run test/economy/` (no regression) then `npm run typecheck 2>/dev/null || npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add grid/src/db/schema.ts grid/src/economy/civic-labor-credit-store.ts grid/test/economy/civic-labor-credit-store.test.ts
git commit -m "feat(grid): F1d CivicLaborCreditStore — labor->standing credit ledger

Migration v48 civic_labor_credit. earn (Polis-work completion) / redeem
(for standing, e.g. a parcel) — atomic, no self-mint. D-MONEY-05.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage:** credit ledger table (v48); getCredit/earn/redeem atomic with insufficient guard. D-MONEY-05 labor→standing rail. Allowlist +0. ✓
**2. Placeholder scan:** none. ✓
**3. Type/name consistency:** `CivicLaborCreditStore`, `getCredit`/`earn`/`redeem`, `credit_balance`, errors `invalid_amount`/`insufficient_credit`, version test uses the stable uniqueness form. ✓
**4. Pattern fidelity:** mirrors `NousAccountStore`/`TreasuryWeiStore` (Pool, FOR UPDATE, bigint↔string). Credits as BIGINT (a civic unit, not wei). Self-contained (single-table); cross-table composition deferred (YAGNI) per the established wei-ops pattern. ✓
**5. Invariants:** no self-mint; atomic redeem; allowlist unchanged. ✓
