# F1a — NousAccount (wei account holder + transfer primitive) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the foundational money-rail: a **wei-denominated, non-custodial Nous account** with atomic credit / debit / transfer, so later units (civic due L1, RFP settlement L2, labor payout) have a real place to hold and move money — model-first, shaped for a later on-chain Sepolia drop-in.

**Architecture:** New MySQL table `nous_accounts` (keyed `grid_name`+`civic_did`, balance in `DECIMAL(65,0)` wei) via migration **v45** appended to the embedded `MIGRATIONS` array in `grid/src/db/schema.ts`. New `NousAccountStore` (`grid/src/economy/nous-account-store.ts`) mirroring the `IrsStore` idiom exactly: constructor takes a `mysql2` `Pool`; balances handled as `bigint` (DB stores the decimal string); mutations are atomic (`getConnection()` → `SELECT ... FOR UPDATE` → `UPDATE` → commit, rollback on error). This is unit **F1a** of the Economic Reality Loop program (`docs/superpowers/specs/2026-06-21-noesis-economic-reality-loop-design.md`). Later F1 slices add the wei treasury extension, labor escrow, and civic-labor credit.

**Tech Stack:** TypeScript ESM (NodeNext, `.js` import extensions), MySQL via `mysql2/promise`, Vitest with a **mock Pool** (no live DB harness — see `grid/test/marketplace-store.test.ts`). Money is `bigint`. Run tests from `grid/` with `npx vitest run <target>` (**`vitest run` only, never watch; kill any stray vitest first**).

**Design notes (locked):**
- **wei = `DECIMAL(65,0)`** (not BIGINT — BIGINT UNSIGNED overflows at ~18.4 ETH; DECIMAL(65,0) holds ~1e65 wei). mysql2 returns DECIMAL as a string → `BigInt(string)`; write with `.toString()`. Same read/write idiom as `IrsStore.balance_bios`.
- **No internal mint (D-MONEY-01):** accounts start at **0** — no birth faucet. `credit` adds wei a caller funds from a real inflow; the store never conjures balance on its own.
- **Chain-ready (D-MONEY-02):** carry `session_cap_wei` + `session_expiry` columns now (mirror of the future on-chain capped session key); not enforced in this slice.
- **Allowlist +0:** this is a ledger primitive. The operations that move money (due payment, settlement, payout) emit their own audit events in later units; F1a adds no broadcast events.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/db/schema.ts` | Append migration **v45** creating `nous_accounts`. | **Modify** (append to `MIGRATIONS`) |
| `grid/src/economy/nous-account-store.ts` | `NousAccountStore`: ensureAccount / getBalance / credit / debit / transfer. | **Create** |
| `grid/test/economy/nous-account-store.test.ts` | Mock-Pool unit tests for all five methods + the migration presence. | **Create** |

---

## Task 1: Migration v45 — `nous_accounts` table

**Files:**
- Modify: `grid/src/db/schema.ts` (append one entry to `MIGRATIONS`)
- Test: `grid/test/economy/nous-account-store.test.ts` (migration-presence test only in this task)

- [ ] **Step 1: Write the failing migration test**

Create `grid/test/economy/nous-account-store.test.ts` with just the migration check for now:

```ts
import { describe, it, expect } from 'vitest';
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
```

- [ ] **Step 2: Run to verify failure**

Run (from `grid/`): `npx vitest run test/economy/nous-account-store.test.ts`
Expected: FAIL — no migration with version 45.

- [ ] **Step 3: Append migration v45**

In `grid/src/db/schema.ts`, append this entry as the LAST element of the `MIGRATIONS` array (match the formatting of the surrounding entries; if neighboring `CREATE TABLE`s specify `ENGINE`/`CHARSET`, mirror them — otherwise omit to match):

```ts
    {
        version: 45,
        name: 'create_nous_accounts',
        up: `
            CREATE TABLE IF NOT EXISTS nous_accounts (
                grid_name        VARCHAR(64)   NOT NULL,
                civic_did        VARCHAR(255)  NOT NULL,
                balance_wei      DECIMAL(65,0) NOT NULL DEFAULT 0,
                session_cap_wei  DECIMAL(65,0) NOT NULL DEFAULT 0,
                session_expiry   BIGINT        NOT NULL DEFAULT 0,
                created_at       BIGINT        NOT NULL,
                updated_at       BIGINT        NOT NULL,
                PRIMARY KEY (grid_name, civic_did)
            )
        `,
        down: `DROP TABLE IF EXISTS nous_accounts`,
    },
```

- [ ] **Step 4: Run to verify pass**

Run (from `grid/`): `npx vitest run test/economy/nous-account-store.test.ts`
Expected: PASS — both migration tests pass.

- [ ] **Step 5: Commit**

```bash
git add grid/src/db/schema.ts grid/test/economy/nous-account-store.test.ts
git commit -m "feat(grid): F1a migration v45 — nous_accounts (wei DECIMAL(65,0))

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: NousAccountStore

**Files:**
- Create: `grid/src/economy/nous-account-store.ts`
- Test: `grid/test/economy/nous-account-store.test.ts` (append store tests)

- [ ] **Step 1: Append the failing store tests**

Append to `grid/test/economy/nous-account-store.test.ts` (after the migration tests). This mirrors the mock-Pool style of `grid/test/marketplace-store.test.ts`:

```ts
import { vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';

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
```

- [ ] **Step 2: Run to verify failure**

Run (from `grid/`): `npx vitest run test/economy/nous-account-store.test.ts`
Expected: FAIL — `NousAccountStore` module does not exist.

- [ ] **Step 3: Write the store**

Create `grid/src/economy/nous-account-store.ts`:

```ts
/**
 * F1 (money rails) — NousAccount: a Nous's wei-denominated, non-custodial account.
 *
 * The account holder for the two-money economy (D-MONEY-01). Balances are in wei
 * (real-ETH denomination), stored as DECIMAL(65,0) and handled as bigint. Moves
 * are atomic (SELECT ... FOR UPDATE → UPDATE → commit), mirroring IrsStore.
 *
 * Model-first / chain-ready (D-MONEY-02): session_cap_wei + session_expiry mirror
 * the future on-chain capped session key; carried but not enforced in this slice.
 *
 * No internal mint (D-MONEY-01): accounts start at zero (no birth faucet); credit
 * adds wei a caller funds from a real inflow — the store never conjures balance.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class NousAccountStore {
    constructor(private readonly pool: Pool) {}

    /** Create the account row if absent (idempotent, zero balance — no faucet). */
    async ensureAccount(params: { gridName: string; civicDid: string; currentTick: number }): Promise<void> {
        await this.pool.query(
            `INSERT IGNORE INTO nous_accounts
               (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
             VALUES (?, ?, 0, 0, 0, ?, ?)`,
            [params.gridName, params.civicDid, params.currentTick, params.currentTick],
        );
    }

    /** Current balance in wei (0 if the account does not exist). */
    async getBalance(gridName: string, civicDid: string): Promise<bigint> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return BigInt(rows[0]?.balance_wei ?? 0);
    }

    /** Add wei to an account (creating it if needed). amountWei must be > 0. */
    async credit(params: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO nous_accounts
                   (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
                 VALUES (?, ?, ?, 0, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), updated_at = VALUES(updated_at)`,
                [params.gridName, params.civicDid, params.amountWei.toString(), params.currentTick, params.currentTick],
            );
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ?`,
                [params.gridName, params.civicDid],
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

    /** Remove wei from an account. Throws 'insufficient_balance'. amountWei must be > 0. */
    async debit(params: { gridName: string; civicDid: string; amountWei: bigint; currentTick: number }): Promise<{ newBalance: bigint }> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [params.gridName, params.civicDid],
            );
            const current = BigInt(rows[0]?.balance_wei ?? 0);
            if (current < params.amountWei) {
                await conn.rollback();
                throw new Error('insufficient_balance');
            }
            await conn.query(
                `UPDATE nous_accounts SET balance_wei = balance_wei - ?, updated_at = ?
                 WHERE grid_name = ? AND civic_did = ?`,
                [params.amountWei.toString(), params.currentTick, params.gridName, params.civicDid],
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

    /** Move wei from one account to another atomically. Throws 'insufficient_balance'. */
    async transfer(params: { gridName: string; fromDid: string; toDid: string; amountWei: bigint; currentTick: number }): Promise<void> {
        if (params.amountWei <= 0n) throw new Error('invalid_amount');
        if (params.fromDid === params.toDid) throw new Error('invalid_transfer_self');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [params.gridName, params.fromDid],
            );
            const fromBalance = BigInt(rows[0]?.balance_wei ?? 0);
            if (fromBalance < params.amountWei) {
                await conn.rollback();
                throw new Error('insufficient_balance');
            }
            await conn.query(
                `UPDATE nous_accounts SET balance_wei = balance_wei - ?, updated_at = ?
                 WHERE grid_name = ? AND civic_did = ?`,
                [params.amountWei.toString(), params.currentTick, params.gridName, params.fromDid],
            );
            await conn.query(
                `INSERT INTO nous_accounts
                   (grid_name, civic_did, balance_wei, session_cap_wei, session_expiry, created_at, updated_at)
                 VALUES (?, ?, ?, 0, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE balance_wei = balance_wei + VALUES(balance_wei), updated_at = VALUES(updated_at)`,
                [params.gridName, params.toDid, params.amountWei.toString(), params.currentTick, params.currentTick],
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

- [ ] **Step 4: Run to verify pass**

Run (from `grid/`): `npx vitest run test/economy/nous-account-store.test.ts`
Expected: PASS — migration tests + all 9 store tests pass.

- [ ] **Step 5: Typecheck**

Run from `grid/`: `npm run typecheck 2>/dev/null || npx tsc --noEmit`
Expected: no new type errors from the added files.

- [ ] **Step 6: Commit**

```bash
git add grid/src/economy/nous-account-store.ts grid/test/economy/nous-account-store.test.ts
git commit -m "feat(grid): F1a NousAccountStore — wei account holder + atomic transfer

Atomic credit/debit/transfer over nous_accounts (wei DECIMAL(65,0), bigint).
No mint (accounts start at 0); chain-ready session-key columns carried.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage (F1a):** wei account table (Task 1); ensureAccount/getBalance/credit/debit/transfer with atomicity + insufficient-balance guard (Task 2). Model-first session-key columns carried; no faucet (start at 0); allowlist +0. ✓
**2. Placeholder scan:** none — complete code + exact commands + expected results. ✓
**3. Type/name consistency:** `NousAccountStore`, method names, param shapes (`gridName/civicDid/amountWei/currentTick`, `fromDid/toDid`), column names (`balance_wei`, `session_cap_wei`, `session_expiry`), and error strings (`invalid_amount`, `insufficient_balance`, `invalid_transfer_self`) are identical across store, tests, and migration. ✓
**4. Pattern fidelity:** mirrors `IrsStore` (Pool ctor, `RowDataPacket`, `FOR UPDATE` txn, bigint↔string) and `marketplace-store.test.ts` (mock Pool). DECIMAL(65,0) chosen because BIGINT overflows real wei. ✓
**5. Invariants:** no internal mint (zero start, credit funded by callers); atomic moves; D-MONEY-01/02 honored; allowlist unchanged. ✓
