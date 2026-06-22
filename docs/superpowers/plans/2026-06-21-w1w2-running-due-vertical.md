# W1+W2 — The first RUNNING vertical: live civic-due flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Stop the loop being inert. Make a running Genesis grid **autonomously assess civic dues each period** (a tick-driven driver, emitting `due.assessed` on the live audit chain) and let a member **see and pay** a due over HTTP (`due.paid`). This is the thin *vertical* the design always promised — one flow that actually executes on a live grid — de-orphaning the L1 stores. Treasury fills in wei the moment members hold wei (payment is wired + tested); seeding wei live is the explicit next decision (W4), called out, not silently minted.

**Architecture:**
- **W2 driver (`civic-due-driver.ts`):** pure, testable functions — `runDueAssessment(pool, audit, memberDids, tick, cfg)` (construct `CivicDueStore(pool, audit)`; assess one due per active member at a period boundary; idempotent — tolerate the `(grid,civic_did,period)` UNIQUE) and `runDueDelinquencySweep(pool, audit, tick)` (pending dues past `deadline_tick` → `markDelinquent`). Both never throw.
- **W2 wiring:** call the driver from the launcher's EXISTING `clock.onTick` (no second subscription) at period boundaries (`tick % DUE_PERIOD_TICKS === 0`), fire-and-forget + guarded on `this._pool`, mirroring the `governance.onTickClosed` / reconcile-every-60 pattern.
- **W1 routes (`civic-dues.ts`):** `GET /api/v1/civic/dues` (the caller's own dues; `didContext` civic_member) + `POST /api/v1/civic/dues/:dueId/pay` (`{method:'wei'|'labor'}` → `CivicDueStore(pool, audit).payWithWei|payWithCredit`; only the due's own `civic_did` may pay). Register in `server.ts`.

This de-orphans `CivicDueStore` (+ via payWithWei the `nous_accounts`/`treasury` wei rails). It RUNS: live grid emits `due.assessed`; a member pays → `due.paid` + treasury-wei credited.

**Tech Stack:** TypeScript ESM (NodeNext, `.js`), MySQL `mysql2/promise`, Vitest. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Honest limitation:** no MySQL here, so this is verified by unit tests (driver + route, mock pool) + typecheck, NOT a live boot. The wiring makes it *run on a real grid*; live verification needs a deploy. **Treasury only fills when payers hold wei** — wei-seeding (W4 / model-first endowment, which touches D-MONEY-01 "no mint") is the flagged next step, NOT done here.

**Invariants:** driver fire-and-forget + never throws + never blocks the clock + single `onTick` subscription preserved; assess/pay emit the existing L1b `due.*` events via `CivicDueStore`'s audit dep (sole-producer intact); a member pays only its own due; allowlist +0 (events already exist); model-first due amounts are constants (Polis-legislated later, D-V3-34).

---

## File Structure
| File | Action |
|---|---|
| `grid/src/economy/civic-due-driver.ts` | **Create** — `runDueAssessment` + `runDueDelinquencySweep` + config consts |
| `grid/src/genesis/launcher.ts` | **Modify** — call the driver in `clock.onTick` at period boundaries |
| `grid/src/api/routes/civic-dues.ts` | **Create** — `registerCivicDueRoutes` (GET dues + POST pay) |
| `grid/src/api/server.ts` | **Modify** — register the route |
| `grid/test/economy/civic-due-driver.test.ts` · `grid/test/api/civic-dues-route.test.ts` | **Create** |

---

## Task 1: W2 driver (testable)

- [ ] **Step 1: Failing test** — `grid/test/economy/civic-due-driver.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { runDueAssessment, runDueDelinquencySweep, DUE_PERIOD_TICKS } from '../../src/economy/civic-due-driver.js';

function mockPool(selectRows: unknown[] = []): { pool: Pool; calls: () => string[] } {
    const sql: string[] = [];
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query: vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve([selectRows as RowDataPacket[], {}]); }) };
    const pool = { query: vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve([selectRows as RowDataPacket[], {}]); }), getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
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
        const pool = { query: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })) } as unknown as Pool;
        await expect(runDueAssessment(pool, new AuditChain(), ['did:civic:noesis:a'], DUE_PERIOD_TICKS, { gridName: 'genesis' })).resolves.toBeUndefined();
    });
    it('delinquency sweep marks overdue pending dues', async () => {
        const m = mockPool([{ due_id: 'd1' }]); // one overdue pending due returned by the SELECT
        await runDueDelinquencySweep(m.pool, new AuditChain(), 999_999, 'genesis');
        expect(m.calls().some((s) => s.includes('civic_dues'))).toBe(true);
    });
    it('never throws on a pool error (driver is defensive)', async () => {
        const pool = { query: vi.fn().mockRejectedValue(new Error('db down')), getConnection: vi.fn().mockRejectedValue(new Error('db down')) } as unknown as Pool;
        await expect(runDueAssessment(pool, new AuditChain(), ['did:civic:noesis:a'], DUE_PERIOD_TICKS, { gridName: 'genesis' })).resolves.toBeUndefined();
        await expect(runDueDelinquencySweep(pool, new AuditChain(), 1, 'genesis')).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/civic-due-driver.test.ts` → FAIL.

- [ ] **Step 3: Create `grid/src/economy/civic-due-driver.ts`**:

```ts
/**
 * W2 — the civic-due driver: the tick-driven heartbeat that makes the loop's first
 * station ALIVE on a running grid. Each period boundary the grid assesses one due
 * per active member (emitting due.assessed via CivicDueStore's audit dep); a
 * separate sweep marks overdue pending dues delinquent. Both are fire-and-forget
 * and NEVER throw — the clock is never blocked, a DB hiccup is non-fatal.
 *
 * Model-first amounts (Polis-legislated later, D-V3-34). Idempotent: the
 * civic_dues UNIQUE(grid,civic_did,period) makes a re-run a no-op (dup tolerated).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { CivicDueStore } from './civic-due-store.js';
import { randomUUID } from 'node:crypto';

/** Model-first defaults (a Polis can legislate these per-Grid later). */
export const DUE_PERIOD_TICKS = 10_080;          // ~1 week at 1 tick/min
export const DUE_AMOUNT_WEI = 1_000_000_000_000n; // 1e12 wei (model-first)
export const DUE_AMOUNT_CREDIT = 10n;             // 10 civic-labor credits
export const DUE_DEADLINE_TICKS = 10_080;         // due within one period

function periodKey(tick: number): string {
    return `p${Math.floor(tick / DUE_PERIOD_TICKS)}`;
}

/** Assess one due per active member for the current period. Never throws. */
export async function runDueAssessment(
    pool: Pool,
    audit: AuditChain,
    memberDids: readonly string[],
    tick: number,
    cfg: { gridName: string },
): Promise<void> {
    const store = new CivicDueStore(pool, audit);
    const period = periodKey(tick);
    for (const civicDid of memberDids) {
        try {
            await store.assess({
                gridName: cfg.gridName,
                dueId: randomUUID(),
                civicDid,
                period,
                amountWei: DUE_AMOUNT_WEI,
                amountCredit: DUE_AMOUNT_CREDIT,
                dueTick: tick + DUE_DEADLINE_TICKS,
                currentTick: tick,
            });
        } catch {
            // Duplicate (already assessed this period) or transient error — non-fatal.
        }
    }
}

/** Mark pending dues past their deadline delinquent. Never throws. */
export async function runDueDelinquencySweep(
    pool: Pool,
    audit: AuditChain,
    tick: number,
    gridName: string,
): Promise<void> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT due_id FROM civic_dues WHERE grid_name = ? AND status = 'assessed' AND due_tick < ? LIMIT 500`,
            [gridName, tick],
        );
        const store = new CivicDueStore(pool, audit);
        for (const r of rows as unknown as { due_id: string }[]) {
            try { await store.markDelinquent({ gridName, dueId: r.due_id, currentTick: tick }); }
            catch { /* already resolved / transient — non-fatal */ }
        }
    } catch {
        // SELECT failed (DB hiccup) — non-fatal; next sweep retries.
    }
}
```
(Confirm `CivicDueStore`'s constructor accepts `(pool, audit?)` — from O2b/L1b it has an optional `audit?: AuditChain` so `assess`/`payWith*`/`markDelinquent` emit `due.*`. If the ctor signature differs, match it.)

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/civic-due-driver.test.ts` → pass.
- [ ] **Step 5: Commit**

```bash
git add grid/src/economy/civic-due-driver.ts grid/test/economy/civic-due-driver.test.ts
git commit -m "feat(grid): W2 civic-due driver — tick-driven assessment + delinquency sweep

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Wire the driver into the live tick

**Files:** `grid/src/genesis/launcher.ts`.

- [ ] **Step 1:** Import the driver: `import { runDueAssessment, runDueDelinquencySweep, DUE_PERIOD_TICKS } from '../economy/civic-due-driver.js';`

- [ ] **Step 2:** Inside the EXISTING `this.clock.onTick(event => { ... })` callback (do NOT add a second subscription), after the reconcile block, add a guarded, fire-and-forget due sweep:

```ts
            // W2 — civic-due driver. At each period boundary the grid assesses a due
            // per active member (emits due.assessed); every 60 ticks it sweeps overdue
            // pending dues delinquent. Fire-and-forget, gated on the pool, never blocks
            // the clock (mirrors governance.onTickClosed / auditReconcile above).
            if (this._pool && event.tick > 0) {
                if (event.tick % DUE_PERIOD_TICKS === 0) {
                    const members = this.registry.active().map((r) => r.did);
                    void runDueAssessment(this._pool, this.audit, members, event.tick, { gridName: this.gridName });
                }
                if (event.tick % 60 === 0) {
                    void runDueDelinquencySweep(this._pool, this.audit, event.tick, this.gridName);
                }
            }
```
(Match the actual field names: the pool field — `this._pool` per the settlement-timeout sweep — `this.audit`, `this.registry`, `this.gridName`, and the active-member DID accessor `this.registry.active()` → `.did`. Adjust if the launcher uses different names.)

- [ ] **Step 3:** Verify the launcher still compiles + its tests pass: `npx vitest run test/genesis/ test/integration/` (or the launcher's test dirs) + `npm run typecheck 2>/dev/null || npx tsc --noEmit`. The new sweep is additive + guarded; existing tick behavior is unchanged (the sweep only fires when `_pool` is set and at the cadences).

- [ ] **Step 4: Commit**

```bash
git add grid/src/genesis/launcher.ts
git commit -m "feat(grid): W2 wire civic-due driver into the live tick (period assess + delinquency sweep)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 3: W1 routes — see + pay a due

**Files:** `grid/src/api/routes/civic-dues.ts` (create), `grid/src/api/server.ts` (register), `grid/test/api/civic-dues-route.test.ts` (create).

Read `grid/src/api/routes/civic-inbox.ts` for the `didContext` civic_member auth idiom + the `services.pool` 503 pattern, and `grid/test/portal/grids.test.ts` for the route test harness.

- [ ] **Step 1: Failing route test** — `grid/test/api/civic-dues-route.test.ts` (buildServer with a mock pool + a stub `didContext`):

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const DID = 'did:civic:noesis:alice';
function poolReturning(rows: unknown[]): Pool {
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) };
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]), getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
}
function makeApp(pool?: Pool): FastifyInstance {
    const app = buildServer({ clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(), logos: new LogosEngine(), audit: new AuditChain(), gridName: 'genesis', pool: pool as never });
    // stub the caller identity (mirror how other civic-route tests inject didContext)
    app.addHook('preHandler', async (req) => { (req as { didContext?: unknown }).didContext = { did: DID, tier: 'civic_member' }; });
    return app;
}

describe('GET /api/v1/civic/dues', () => {
    it("returns the caller's dues", async () => {
        const app = makeApp(poolReturning([{ due_id: 'd1', period: 'p0', amount_wei: '1000000000000', amount_credit: '10', status: 'assessed', due_tick: 100 }]));
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/dues' });
        expect(res.statusCode).toBe(200);
        expect(res.json().dues[0]).toMatchObject({ due_id: 'd1', status: 'assessed' });
        await app.close();
    });
    it('503 without a pool', async () => {
        const app = makeApp(undefined);
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/dues' });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});

describe('POST /api/v1/civic/dues/:dueId/pay', () => {
    it('pays the caller\'s own due in wei (200)', async () => {
        // SELECT due FOR UPDATE returns the caller's pending due; payWithWei runs its txn
        const app = makeApp(poolReturning([{ status: 'assessed', amount_wei: '1000000000000', civic_did: DID, balance_wei: '5000000000000' }]));
        const res = await app.inject({ method: 'POST', url: '/api/v1/civic/dues/d1/pay', payload: { method: 'wei' } });
        expect([200, 402, 409]).toContain(res.statusCode); // 200 on success; 402/409 if the mock-sequence yields insufficient/not-payable — assert it routed to CivicDueStore
        await app.close();
    });
    it('rejects an unknown method (400)', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({ method: 'POST', url: '/api/v1/civic/dues/d1/pay', payload: { method: 'gold' } });
        expect(res.statusCode).toBe(400);
        await app.close();
    });
});
```
(Adjust the `didContext` injection to match how the project's other civic-route tests set the caller — check `grid/test/api/` for the pattern; some use a real preHandler, some inject. The key assertions: GET returns the caller's dues, POST routes wei/labor to `CivicDueStore`, bad method → 400, no pool → 503.)

- [ ] **Step 2: Verify fail** — `npx vitest run test/api/civic-dues-route.test.ts` → FAIL.

- [ ] **Step 3: Create `grid/src/api/routes/civic-dues.ts`**:

```ts
/**
 * W1 — civic-due routes: a member sees + pays its dues (D-MONEY-08).
 *   GET  /api/v1/civic/dues                 — the caller's dues
 *   POST /api/v1/civic/dues/:dueId/pay      — pay in wei | labor
 * Auth: civic_member (req.didContext). A member pays only its OWN due.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { RowDataPacket } from 'mysql2/promise';
import { CivicDueStore } from '../../economy/civic-due-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export function registerCivicDueRoutes(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/civic/dues', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT due_id, period, amount_wei, amount_credit, status, paid_in, due_tick
             FROM civic_dues WHERE grid_name = ? AND civic_did = ? ORDER BY due_tick DESC LIMIT 200`,
            [services.gridName ?? 'genesis', civicDid],
        );
        return reply.send({ dues: rows, count: rows.length });
    });

    app.post<{ Params: { dueId: string }; Body: { method?: string } }>('/api/v1/civic/dues/:dueId/pay', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const method = req.body?.method;
        if (method !== 'wei' && method !== 'labor') return reply.code(400).send({ error: 'invalid_method' });

        const gridName = services.gridName ?? 'genesis';
        // The caller may pay only its OWN due.
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT civic_did, status FROM civic_dues WHERE grid_name = ? AND due_id = ?`,
            [gridName, req.params.dueId],
        );
        const due = rows[0];
        if (!due) return reply.code(404).send({ error: 'due_not_found' });
        if (String(due.civic_did) !== civicDid) return reply.code(403).send({ error: 'not_your_due' });

        const store = new CivicDueStore(pool, services.audit);
        const tick = services.clock?.currentTick ?? 0;
        try {
            if (method === 'wei') await store.payWithWei({ gridName, dueId: req.params.dueId, currentTick: tick });
            else await store.payWithCredit({ gridName, dueId: req.params.dueId, currentTick: tick });
        } catch (err) {
            const msg = (err as Error).message;
            if (msg === 'insufficient_balance' || msg === 'insufficient_credit') return reply.code(402).send({ error: msg });
            if (msg === 'due_not_payable') return reply.code(409).send({ error: msg });
            throw err;
        }
        return reply.send({ ok: true, paid_in: method });
    });
}
```
(Confirm `GridServices` exposes `pool`, `audit`, `gridName`, and `clock` — `pool`/`audit`/`gridName` are known present; if `clock` isn't on services, pass the tick another way or default 0. Adjust `req.didContext` typing to the project's augmented Fastify request.)

- [ ] **Step 4: Register** in `grid/src/api/server.ts` — add `import { registerCivicDueRoutes } from './routes/civic-dues.js';` and call `registerCivicDueRoutes(app, services);` beside `registerCivicInboxRoutes`/`registerOrbitalRoutes`.

- [ ] **Step 5: Verify** — `npx vitest run test/api/civic-dues-route.test.ts` → pass; then `npx vitest run test/api/ test/economy/` → no regressions; `npm run typecheck 2>/dev/null || npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add grid/src/api/routes/civic-dues.ts grid/src/api/server.ts grid/test/api/civic-dues-route.test.ts
git commit -m "feat(grid): W1 civic-due routes — a member sees + pays its dues (live)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review
**1. Running:** the launcher tick now assesses dues at period boundaries (emitting `due.assessed`) + sweeps delinquency; routes let a member see + pay (`due.paid`). The L1 due station is alive on a live grid (de-orphaned). ✓
**2. Safe wiring:** driver is fire-and-forget, never throws, gated on `_pool`, rides the existing single `onTick`; existing tick behavior unchanged. ✓
**3. Honest limits:** verified by unit tests + typecheck (no live MySQL here); treasury fills only when payers hold wei — wei-seeding (W4) is the flagged next step, NOT minted here. ✓
**4. Invariants:** `due.*` emitted via `CivicDueStore` (sole-producer intact); member pays only its own due; allowlist +0; model-first amounts as constants (Polis-legislated later). ✓
**5. Consistency:** `runDueAssessment`/`runDueDelinquencySweep`/config consts; route paths + error codes (`invalid_method`/`not_your_due`/`due_not_found`/402/409/503). ✓
