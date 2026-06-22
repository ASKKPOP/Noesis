# L2 — RFP Procurement (Polis commissions builds) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Let the Polis spend the treasury the civic due just filled: **issue a Procurement Notice / RFP** (budget + spec, Polis-authorized) → **Nous bid** → **award one** → **fund a labor escrow from the treasury** → on completion, **the builder is paid**. This is the half of the loop that *commissions the building*.

**Architecture:** Two slices.
- **L2a (this plan, Tasks 1–2):** migration **v50** (`procurement_notices`, `procurement_bids`, `procurement_contracts`); `ProcurementStore` — issueNotice / placeBid / award / settleContract / cancelNotice. `award` and `settleContract` open ONE transaction and compose the F1 rails: award **debits the treasury** (`debitTreasuryWeiOnConn`) and funds a `labor_escrow` row (reusing F1c's table) with `payer_did = TREASURY_CIVIC_DID`; settle **credits the builder** (`creditAccountOnConn`) and marks escrow released + contract settled. Mock-Pool tested, no audit yet.
- **L2b (this plan, Task 3):** six sole-producer `procurement.*` events + allowlist **110 → 116** + wire the store to emit.

**Design notes:** The Polis authorization (VOTE-05 Nous-only legislative act) is verified by the caller/route; `ProcurementStore` records the `polis_authorization_ref` — it never self-authorizes (preserves D-V3-21/VOTE-05). The escrow is funded **from the treasury** (the Polis is the payer; `payer_did = 'did:civic:noesis:treasury'`), reusing the F1c `labor_escrow` rail. Award price must be ≤ the notice budget. Settlement releases the full award to the builder (civic fee = 0 for procurement; the object-reality L3 then creates the `orbital_object`). Amounts wei `bigint` (DECIMAL(65,0)).

**Tech Stack:** TypeScript ESM (NodeNext, `.js`), MySQL `mysql2/promise`, Vitest mock-Pool. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** Polis-authorized (ref recorded, never self-authorized); award atomic (treasury debit + escrow fund + contract + notice/bid status, all-or-nothing); award-once + settle-once under `FOR UPDATE`; conservation (treasury −award on award; escrow → builder on settle); no mint; allowlist additions explicit (+6 in L2b). Existing suites stay green.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/db/schema.ts` | Append migration **v50** (3 procurement tables). | **Modify** |
| `grid/src/economy/procurement-store.ts` | `ProcurementStore`: issueNotice / placeBid / award / settleContract / cancelNotice. | **Create** |
| `grid/test/economy/procurement-store.test.ts` | Mock-Pool unit tests + migration presence. | **Create** |
| `grid/src/audit/append-procurement-*.ts` (×6) | Sole-producer `procurement.*` emitters. | **Create (L2b)** |
| `grid/src/audit/broadcast-allowlist.ts` | Add 6 `procurement.*` (110 → 116). | **Modify (L2b)** |
| `grid/test/audit/...` | allowlist count + emitter + boundary tests. | **Modify/Create (L2b)** |

---

## Task 1: Migration v50 — procurement tables

**Files:** Modify `grid/src/db/schema.ts`; Test in `grid/test/economy/procurement-store.test.ts` (migration presence).

- [ ] **Step 1: Failing migration test** — create `grid/test/economy/procurement-store.test.ts` with (for now) just:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ProcurementStore } from '../../src/economy/procurement-store.js';

describe('migration v50 — procurement tables', () => {
    it('creates notices, bids, contracts', () => {
        const m = MIGRATIONS.find((x) => x.version === 50);
        expect(m, 'v50 must exist').toBeDefined();
        expect(m!.name).toBe('create_procurement');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_notices');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_bids');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_contracts');
        expect(m!.up).toContain('budget_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS procurement_contracts');
    });
    it('migration v50 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 50)).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/procurement-store.test.ts` → FAIL.

- [ ] **Step 3: Append migration v50** to `MIGRATIONS` in `grid/src/db/schema.ts`:

```ts
    {
        version: 50,
        name: 'create_procurement',
        up: `
            CREATE TABLE IF NOT EXISTS procurement_notices (
                notice_id              CHAR(36)      NOT NULL,
                grid_name              VARCHAR(63)   NOT NULL,
                polis_authorization_ref VARCHAR(255) NOT NULL,
                title                  VARCHAR(255)  NOT NULL,
                spec                   TEXT          NOT NULL,
                budget_wei             DECIMAL(65,0) NOT NULL,
                zone                   VARCHAR(63)   NOT NULL,
                function_type          VARCHAR(63)   NOT NULL,
                status                 ENUM('open','awarded','cancelled') NOT NULL DEFAULT 'open',
                deadline_tick          BIGINT        NOT NULL,
                created_at             BIGINT        NOT NULL,
                updated_at             BIGINT        NOT NULL,
                PRIMARY KEY (notice_id),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS procurement_bids (
                bid_id        CHAR(36)      NOT NULL,
                notice_id     CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                bidder_did    VARCHAR(255)  NOT NULL,
                price_wei     DECIMAL(65,0) NOT NULL,
                artifact_spec TEXT          NOT NULL,
                status        ENUM('submitted','awarded','rejected') NOT NULL DEFAULT 'submitted',
                created_at    BIGINT        NOT NULL,
                PRIMARY KEY (bid_id),
                INDEX idx_notice (notice_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS procurement_contracts (
                contract_id   CHAR(36)      NOT NULL,
                notice_id     CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                winner_did    VARCHAR(255)  NOT NULL,
                award_wei     DECIMAL(65,0) NOT NULL,
                escrow_id     CHAR(36)      NOT NULL,
                status        ENUM('active','settled','cancelled') NOT NULL DEFAULT 'active',
                attested_tick BIGINT        NULL,
                created_at    BIGINT        NOT NULL,
                updated_at    BIGINT        NOT NULL,
                PRIMARY KEY (contract_id),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS procurement_contracts;
            DROP TABLE IF EXISTS procurement_bids;
            DROP TABLE IF EXISTS procurement_notices
        `,
    },
```

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/procurement-store.test.ts` → migration tests pass.

- [ ] **Step 5: Commit**

```bash
git add grid/src/db/schema.ts grid/test/economy/procurement-store.test.ts
git commit -m "feat(grid): L2a migration v50 — procurement notices/bids/contracts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: ProcurementStore

**Files:** Create `grid/src/economy/procurement-store.ts`; append tests to `grid/test/economy/procurement-store.test.ts`.

- [ ] **Step 1: Append failing store tests** (mock-Pool helper identical to `civic-due-store.test.ts`):

```ts
function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query } as unknown as PoolConnection;
    const pool = { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
    return { pool, conn, calls: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];

describe('ProcurementStore', () => {
    it('issueNotice rejects a non-positive budget', async () => {
        await expect(new ProcurementStore(makeMockPool().pool).issueNotice({ gridName: 'g', noticeId: 'n1', polisAuthorizationRef: 'law:1', title: 'Energy module', spec: 's', budgetWei: 0n, zone: 'infrastructure', functionType: 'power', deadlineTick: 100, currentTick: 1 })).rejects.toThrow('invalid_amount');
    });
    it('issueNotice inserts an open notice with the Polis authorization ref', async () => {
        const m = makeMockPool([[{}, {}]]);
        await new ProcurementStore(m.pool).issueNotice({ gridName: 'g', noticeId: 'n1', polisAuthorizationRef: 'law:1', title: 'Energy module', spec: 's', budgetWei: 5000n, zone: 'infrastructure', functionType: 'power', deadlineTick: 100, currentTick: 1 });
        const sql = m.calls()[0];
        expect(sql).toContain('INSERT INTO procurement_notices');
        expect(sql).toContain("'open'");
    });
    it('placeBid inserts a submitted bid when the notice is open', async () => {
        const m = makeMockPool([rows([{ status: 'open', deadline_tick: 100 }]), [{}, {}]]);
        await new ProcurementStore(m.pool).placeBid({ gridName: 'g', bidId: 'b1', noticeId: 'n1', bidderDid: 'w', priceWei: 4000n, artifactSpec: '{}', currentTick: 5 });
        expect(m.calls().join('\n')).toContain('INSERT INTO procurement_bids');
    });
    it('placeBid refuses a closed notice', async () => {
        const m = makeMockPool([rows([{ status: 'awarded', deadline_tick: 100 }])]);
        await expect(new ProcurementStore(m.pool).placeBid({ gridName: 'g', bidId: 'b1', noticeId: 'n1', bidderDid: 'w', priceWei: 4000n, artifactSpec: '{}', currentTick: 5 })).rejects.toThrow('notice_not_open');
    });
    it('award debits treasury, funds escrow from treasury, writes contract, marks awarded (atomic)', async () => {
        // notice FOR UPDATE (open, budget 5000); bid (submitted, price 4000, notice n1); treasury debit SELECT FOR UPDATE (8000); treasury UPDATE; escrow INSERT; contract INSERT; notice UPDATE; bid UPDATE
        const m = makeMockPool([
            rows([{ status: 'open', budget_wei: '5000' }]),
            rows([{ status: 'submitted', price_wei: '4000', notice_id: 'n1', bidder_did: 'w' }]),
            rows([{ balance_wei: '8000' }]), [{}, {}], [{}, {}], [{}, {}], [{}, {}], [{}, {}],
        ]);
        await new ProcurementStore(m.pool).award({ gridName: 'g', noticeId: 'n1', bidId: 'b1', contractId: 'c1', escrowId: 'e1', currentTick: 7 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('civic_treasury');           // treasury debited
        expect(sql).toContain('INSERT INTO labor_escrow');  // escrow funded from treasury
        expect(sql).toContain('INSERT INTO procurement_contracts');
        expect(sql).toContain("status = 'awarded'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('award rejects a bid above budget', async () => {
        const m = makeMockPool([rows([{ status: 'open', budget_wei: '3000' }]), rows([{ status: 'submitted', price_wei: '4000', notice_id: 'n1', bidder_did: 'w' }])]);
        await expect(new ProcurementStore(m.pool).award({ gridName: 'g', noticeId: 'n1', bidId: 'b1', contractId: 'c1', escrowId: 'e1', currentTick: 7 })).rejects.toThrow('bid_exceeds_budget');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('award refuses a non-open notice', async () => {
        const m = makeMockPool([rows([{ status: 'awarded', budget_wei: '5000' }])]);
        await expect(new ProcurementStore(m.pool).award({ gridName: 'g', noticeId: 'n1', bidId: 'b1', contractId: 'c1', escrowId: 'e1', currentTick: 7 })).rejects.toThrow('notice_not_open');
    });
    it('settleContract releases escrow to the builder and marks settled', async () => {
        // contract FOR UPDATE (active, winner w, award 4000, escrow e1); credit builder (INSERT acct); escrow UPDATE released; contract UPDATE settled
        const m = makeMockPool([rows([{ status: 'active', winner_did: 'w', award_wei: '4000', escrow_id: 'e1' }]), [{}, {}], [{}, {}], [{}, {}]]);
        await new ProcurementStore(m.pool).settleContract({ gridName: 'g', contractId: 'c1', attestationRef: 'att:1', currentTick: 9 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('nous_accounts');             // builder credited
        expect(sql).toContain("status = 'released'");        // escrow released
        expect(sql).toContain("status = 'settled'");         // contract settled
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('settleContract refuses a non-active contract', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000', escrow_id: 'e1' }])]);
        await expect(new ProcurementStore(m.pool).settleContract({ gridName: 'g', contractId: 'c1', attestationRef: 'att:1', currentTick: 9 })).rejects.toThrow('contract_not_active');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('cancelNotice flips an open notice to cancelled', async () => {
        const m = makeMockPool([rows([{ status: 'open' }]), [{}, {}]]);
        await new ProcurementStore(m.pool).cancelNotice({ gridName: 'g', noticeId: 'n1', currentTick: 10 });
        expect(m.calls().join('\n')).toContain("status = 'cancelled'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/procurement-store.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create `grid/src/economy/procurement-store.ts`**:

```ts
/**
 * L2 — RFP procurement: the Polis commissions builds with the treasury.
 *
 * issueNotice:    the Polis posts an RFP (budget + spec), authorized by a VOTE-05
 *                 legislative act (polis_authorization_ref recorded; never self-authorized).
 * placeBid:       a Nous bids (price + a physics-valid artifact spec) on an open notice.
 * award:          pick one bid — debit the TREASURY the award, fund a labor_escrow row
 *                 (payer = the treasury), write a contract, mark notice/bid awarded.
 * settleContract: on Grid-oracle attestation, release the escrow to the builder, mark settled.
 * cancelNotice:   withdraw an open (un-awarded) notice.
 *
 * award + settleContract each run ONE transaction composing the F1 rails (wei-ops),
 * so the money move and the status changes are atomic. award-once / settle-once under
 * FOR UPDATE. No mint; conservation (treasury −award on award; escrow → builder on settle).
 * Audit events (procurement.*) are wired in L2b.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { debitTreasuryWeiOnConn, creditAccountOnConn } from './wei-ops.js';

/** The civic treasury's account sentinel (matches grid/src/api/routes/irs.ts). */
const TREASURY_CIVIC_DID = 'did:civic:noesis:treasury';

export class ProcurementStore {
    constructor(private readonly pool: Pool) {}

    async issueNotice(p: { gridName: string; noticeId: string; polisAuthorizationRef: string; title: string; spec: string; budgetWei: bigint; zone: string; functionType: string; deadlineTick: number; currentTick: number }): Promise<void> {
        if (p.budgetWei <= 0n) throw new Error('invalid_amount');
        await this.pool.query(
            `INSERT INTO procurement_notices
               (notice_id, grid_name, polis_authorization_ref, title, spec, budget_wei, zone, function_type, status, deadline_tick, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
            [p.noticeId, p.gridName, p.polisAuthorizationRef, p.title, p.spec, p.budgetWei.toString(), p.zone, p.functionType, p.deadlineTick, p.currentTick, p.currentTick],
        );
    }

    async placeBid(p: { gridName: string; bidId: string; noticeId: string; bidderDid: string; priceWei: bigint; artifactSpec: string; currentTick: number }): Promise<void> {
        if (p.priceWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, deadline_tick FROM procurement_notices WHERE notice_id = ? AND grid_name = ? FOR UPDATE`,
                [p.noticeId, p.gridName],
            );
            const notice = rows[0];
            if (!notice || notice.status !== 'open') {
                await conn.rollback();
                throw new Error('notice_not_open');
            }
            await conn.query(
                `INSERT INTO procurement_bids (bid_id, notice_id, grid_name, bidder_did, price_wei, artifact_spec, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
                [p.bidId, p.noticeId, p.gridName, p.bidderDid, p.priceWei.toString(), p.artifactSpec, p.currentTick],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async award(p: { gridName: string; noticeId: string; bidId: string; contractId: string; escrowId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [noticeRows] = await conn.query<RowDataPacket[]>(
                `SELECT status, budget_wei FROM procurement_notices WHERE notice_id = ? AND grid_name = ? FOR UPDATE`,
                [p.noticeId, p.gridName],
            );
            const notice = noticeRows[0];
            if (!notice || notice.status !== 'open') {
                await conn.rollback();
                throw new Error('notice_not_open');
            }
            const [bidRows] = await conn.query<RowDataPacket[]>(
                `SELECT status, price_wei, notice_id, bidder_did FROM procurement_bids WHERE bid_id = ? AND grid_name = ? FOR UPDATE`,
                [p.bidId, p.gridName],
            );
            const bid = bidRows[0];
            if (!bid || bid.status !== 'submitted' || String(bid.notice_id) !== p.noticeId) {
                await conn.rollback();
                throw new Error('bid_not_eligible');
            }
            const award = BigInt(bid.price_wei);
            if (award > BigInt(notice.budget_wei)) {
                await conn.rollback();
                throw new Error('bid_exceeds_budget');
            }
            // Fund the escrow FROM the treasury (the Polis is the payer).
            await debitTreasuryWeiOnConn(conn, { gridName: p.gridName, amountWei: award, currentTick: p.currentTick });
            await conn.query(
                `INSERT INTO labor_escrow
                   (escrow_id, grid_name, payer_did, worker_did, amount_wei, fee_wei, ref, status, attestation_ref, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, ?, 'funded', NULL, ?, ?)`,
                [p.escrowId, p.gridName, TREASURY_CIVIC_DID, String(bid.bidder_did), award.toString(), `rfp:${p.noticeId}`, p.currentTick, p.currentTick],
            );
            await conn.query(
                `INSERT INTO procurement_contracts
                   (contract_id, notice_id, grid_name, winner_did, award_wei, escrow_id, status, attested_tick, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
                [p.contractId, p.noticeId, p.gridName, String(bid.bidder_did), award.toString(), p.escrowId, p.currentTick, p.currentTick],
            );
            await conn.query(`UPDATE procurement_notices SET status = 'awarded', updated_at = ? WHERE notice_id = ?`, [p.currentTick, p.noticeId]);
            await conn.query(`UPDATE procurement_bids SET status = 'awarded' WHERE bid_id = ?`, [p.bidId]);
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async settleContract(p: { gridName: string; contractId: string; attestationRef: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, winner_did, award_wei, escrow_id FROM procurement_contracts WHERE contract_id = ? AND grid_name = ? FOR UPDATE`,
                [p.contractId, p.gridName],
            );
            const c = rows[0];
            if (!c || c.status !== 'active') {
                await conn.rollback();
                throw new Error('contract_not_active');
            }
            // Grid (oracle) attests done → release the escrow to the builder.
            await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: String(c.winner_did), amountWei: BigInt(c.award_wei), currentTick: p.currentTick });
            await conn.query(`UPDATE labor_escrow SET status = 'released', attestation_ref = ?, updated_at = ? WHERE escrow_id = ?`, [p.attestationRef, p.currentTick, String(c.escrow_id)]);
            await conn.query(`UPDATE procurement_contracts SET status = 'settled', attested_tick = ?, updated_at = ? WHERE contract_id = ?`, [p.currentTick, p.currentTick, p.contractId]);
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async cancelNotice(p: { gridName: string; noticeId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status FROM procurement_notices WHERE notice_id = ? AND grid_name = ? FOR UPDATE`,
                [p.noticeId, p.gridName],
            );
            const notice = rows[0];
            if (!notice || notice.status !== 'open') {
                await conn.rollback();
                throw new Error('notice_not_open');
            }
            await conn.query(`UPDATE procurement_notices SET status = 'cancelled', updated_at = ? WHERE notice_id = ?`, [p.currentTick, p.noticeId]);
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

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/procurement-store.test.ts` → migration + all store tests pass.

- [ ] **Step 5: Full economy suite + typecheck** — `npx vitest run test/economy/` (no regression) then `npm run typecheck 2>/dev/null || npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add grid/src/economy/procurement-store.ts grid/test/economy/procurement-store.test.ts
git commit -m "feat(grid): L2a ProcurementStore — RFP issue/bid/award/settle/cancel (atomic)

award debits treasury -> funds labor escrow (payer=treasury); settleContract
releases escrow to the builder. Polis-authorized (ref recorded). award/settle-once.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 3 (L2b): `procurement.*` audit events + allowlist

Clone `append-irs-tax-collected.ts` (9-step guard) + `telos-refined-producer-boundary.test.ts` (boundary) + update the allowlist count test (it has ~9 `toBe(110)` occurrences after L1b, plus 1 in `human-civic-application.test.ts`). Add **six** sole-producer emitters and bring the allowlist **110 → 116**:

- `append-procurement-notice-issued.ts` → `procurement.notice_issued`, payload `{ budget_wei: string, function_type: string, grid_name: string, notice_id: string(UUID), polis_authorization_ref: string, tick: number, zone: string }`; actorDid = a hash of `polis_authorization_ref` (Polis act) or the grid_name — use `polis_authorization_ref` hashed (HEX64).
- `append-procurement-bid-placed.ts` → `procurement.bid_placed`, payload `{ bid_id: string(UUID), bidder_did_hash: string(HEX64), notice_id: string(UUID), price_wei: string, tick: number }`; actorDid = `bidder_did_hash`.
- `append-procurement-awarded.ts` → `procurement.awarded`, payload `{ award_wei: string, contract_id: string(UUID), notice_id: string(UUID), tick: number, winner_did_hash: string(HEX64) }`; actorDid = `winner_did_hash`.
- `append-procurement-attested.ts` → `procurement.attested`, payload `{ attestation_ref_hash: string(HEX64), contract_id: string(UUID), tick: number }`; actorDid = `contract_id`'s grid? use `attestation_ref_hash`.
- `append-procurement-settled.ts` → `procurement.settled`, payload `{ award_wei: string, contract_id: string(UUID), tick: number, winner_did_hash: string(HEX64) }`; actorDid = `winner_did_hash`.
- `append-procurement-cancelled.ts` → `procurement.cancelled`, payload `{ notice_id: string(UUID), reason: string, tick: number }`; actorDid = `notice_id`.

Wire `ProcurementStore` (optional `audit?: AuditChain`, `sha256Hex` for DIDs/refs) to emit after each commit: notice_issued (issueNotice), bid_placed (placeBid), awarded (award), attested + settled (settleContract emits both — oracle attests, then escrow released), cancelled (cancelNotice). Add the 6 producer-boundary tests + emitter unit tests, update allowlist count (110 → 116) across `broadcast-allowlist.test.ts` + `human-civic-application.test.ts`. Verify `npx vitest run test/audit/ test/economy/` green + tsc clean. Commit `feat(grid): L2b procurement.* audit events (allowlist 110->116) + emit`.

---

## Self-Review

**1. Spec coverage:** procurement tables (Task 1); issue/bid/award(fund-from-treasury)/settle(pay-builder)/cancel (Task 2); `procurement.*` events + allowlist +6 (Task 3). The Polis commissions + pays for builds — the loop's spend half. ✓
**2. Placeholder scan:** L2a fully coded; L2b specifies each emitter's payload + references the canonical pattern files. ✓
**3. Type/name consistency:** `ProcurementStore` methods, params, columns (`budget_wei`/`price_wei`/`award_wei`/`escrow_id`/`status`), errors (`invalid_amount`/`notice_not_open`/`bid_not_eligible`/`bid_exceeds_budget`/`contract_not_active`), `TREASURY_CIVIC_DID` matches irs.ts, reuses F1c `labor_escrow`. ✓
**4. Atomicity / once:** award + settle each one txn under `FOR UPDATE`; award refuses non-open notice / ineligible / over-budget bid before moving money; settle refuses non-active contract; rollback undoes treasury debit + escrow + contract together. ✓
**5. Invariants:** Polis-authorized (ref recorded, never self-authorized — VOTE-05/D-V3-21 preserved); no mint; conservation (treasury −award; escrow→builder); allowlist +6 explicit in L2b; existing suites green. ✓
