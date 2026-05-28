---
phase: 44
plan: 04
subsystem: marketplace
tags: [marketplace, routes, police-stub, settlement-timeout, launcher-wiring]
dependency_graph:
  requires: [44-02, 44-03]
  provides: [registerMarketRoutes, checkSettlementTimeouts, settlement-timeout-loop]
  affects: [grid/src/api/routes/market.ts, grid/src/marketplace/settlement-timeout.ts, grid/src/genesis/launcher.ts]
tech_stack:
  added: [settlement-timeout sweep loop, police_investigations direct INSERT, setInterval pattern]
  patterns: [OBS-R-32-02 paired clearInterval, sha256Hex privacy, D-44-02 min-price guard, unconditional appendIrsTaxCollected]
key_files:
  created:
    - grid/src/api/routes/market.ts
    - grid/src/marketplace/settlement-timeout.ts
  modified:
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - grid/src/genesis/launcher.ts
    - grid/test/market-routes.test.ts
    - grid/test/police-stub.test.ts
    - grid/test/settlement-timeout.test.ts
  deleted:
    - grid/src/api/routes/market-listings.ts (Phase 36 stub — replaced by market.ts)
decisions:
  - "settlement-timeout.ts placed in wave 2 (Plan 04) to avoid cross-wave-1 import of Plan 03's appendMarketDisputed"
  - "launcher._pool stored via attachRelationshipStorage() — no separate attachPool() needed (same pool)"
  - "ROADMAP.md Task 4 skipped per orchestrator instruction: Do NOT modify ROADMAP.md"
  - "check-route-did-policy.mjs and check-sole-producer-discipline.mjs CI scripts not present in worktree (Wave 1 artifact)"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  tasks_skipped: 1
  files_modified: 8
  tests_passing: 35
---

# Phase 44 Plan 04: Marketplace Routes + Settlement Timeout + Launcher Wiring Summary

**One-liner:** 9 Fastify marketplace routes (8 civic + 1 police stub) with D-44-02 min-price guard, unconditional IRS tax emission, direct police_investigations INSERT (no SSRF), and 1s settlement-timeout sweep loop wired into GenesisLauncher via setInterval/clearInterval (OBS-R-32-02).

## What Was Built

### Task 1 — 9 Marketplace Routes (commit d3636ab)

Created `grid/src/api/routes/market.ts` replacing the Phase 36 stub `market-listings.ts`:

| Route | Policy | Notes |
|-------|--------|-------|
| GET /api/v1/market/listings | public | browseListings with limit/offset/category/max_price |
| POST /api/v1/market/listing/create | business_did_required | D-44-02 price_bios >= 50n guard; emits market.listing_created |
| GET /api/v1/market/listing/:id | public | getListing, 404 if not found |
| POST /api/v1/market/listing/:id/bid | civic_did_required | placeBid; emits market.bid_placed |
| POST /api/v1/market/listing/:id/accept | civic_did_required | acceptBid; maps insufficient_bios→402, not_seller→403 |
| POST /api/v1/market/listing/:id/reject | civic_did_required | seller-only UPDATE bid status='rejected' |
| POST /api/v1/market/listing/:id/confirm-settlement | civic_did_required | D-44-02 IRS fee rate [0.01, 0.03] validated; emits market.settled THEN irs.tax_collected unconditionally |
| POST /api/v1/market/listing/:id/dispute | civic_did_required | freezes escrow; direct INSERT police_investigations (no SSRF — T-44-04-08); emits market.disputed |
| POST /api/v1/police/investigate | civic_did_required | D-44-05 stub; INSERT police_investigations status='pending'; returns 201 {investigation_id} |

**D-44-02 enforcements at HTTP layer:**
- `price_bios < MIN_LISTING_PRICE_BIOS (50n)` → 400 price_too_low (defense-in-depth — store also enforces)
- `irs_fee_rate` outside [0.01, 0.03] → 500 invalid_irs_fee_rate (operator must repair grid_config)
- `appendIrsTaxCollected` emitted unconditionally after `appendMarketSettled` — no `irsFee > 0n` branch (min-price guard ensures fee >= 1)

**Privacy:** All audit payloads use `sha256Hex()` for civic DIDs and business DIDs — plaintext DIDs never leave the route boundary into the audit chain.

**8 ROUTE_DID_POLICY entries** added to `grid/src/api/policy.ts`. The Phase 36 `GET /api/v1/market/listings: 'public'` entry was preserved unchanged (not duplicated).

**server.ts:** `registerMarketListingsRoute` import/call replaced with `registerMarketRoutes`.

**Tests:** 19 market-routes tests + 7 police-stub tests = 26 tests GREEN.

### Task 2 — Settlement Timeout Helper (commit 0553c5b)

Created `grid/src/marketplace/settlement-timeout.ts`:

```typescript
export async function checkSettlementTimeouts(
    pool: Pool,
    audit: AuditChain,
    currentTick: number,
    gridName: string,
): Promise<{ disputed: number; errors: number }>
```

Behavior:
1. Reads `market_settlement_timeout_ticks` from grid_config OUTSIDE any transaction (default 7 — Pitfall 1 from RESEARCH.md)
2. Calls `store.listExpiredEscrows({gridName, currentTick, timeoutTicks})`
3. For each expired escrow: `store.dispute()` → `appendMarketDisputed` → direct `INSERT police_investigations`
4. Idempotent: `escrow_not_disputable` caught and skipped silently
5. Returns `{disputed, errors}` — per-escrow errors don't block others
6. NO `clock.onTick` usage (single-subscription invariant — static source check in tests)

Note on revision placement: This file was originally planned in Plan 02 (wave 1) but moved to Plan 04 (wave 2) because it imports Plan 03's `appendMarketDisputed`. Plans 02 + 03 are parallel wave 1 — importing from a parallel plan risks compile failures during wave execution.

**Tests:** 9 settlement-timeout tests GREEN (including static source check for no clock.onTick).

### Task 3 — GenesisLauncher Wiring (commit b92f341)

Modified `grid/src/genesis/launcher.ts`:
- Added `private _pool: Pool | undefined` — stored when `attachRelationshipStorage()` is called (same pool used for all DB work)
- Added `private _settlementTimeoutInterval: NodeJS.Timeout | null = null`
- `start()`: `setInterval` calling `checkSettlementTimeouts(this._pool, this.audit, tick, this.gridName)` every 1s
- `stop()`: `clearInterval(this._settlementTimeoutInterval)` before `clock.stop()` (OBS-R-32-02 discipline)
- Single-onTick-subscription invariant preserved — no `clock.onTick()` call added

### Task 4 — ROADMAP.md Doc-sync (SKIPPED)

**Reason:** Orchestrator instruction explicitly prohibited modifying ROADMAP.md: "Do NOT modify STATE.md or ROADMAP.md — the orchestrator owns those writes after all worktree agents in the wave complete."

**What was required:** Correct Phase 44 allowlist annotation from "67 → 71" to "68 → 72", and cascade +1 to Phases 45-50 running totals in the Allowlist Growth Ledger table.

**Orchestrator action needed:** Apply the corrections from Plan 04 Task 4 spec when merging this worktree.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified.

### Rule 3 — Blocking Issue: No `_pool` Field in Launcher

**Found during:** Task 3

**Issue:** PATTERNS.md referenced `this._pool` in the setInterval callback but no `_pool` field existed in GenesisLauncher. The launcher pools via `attachRelationshipStorage(pool)` / `attachNormStorage(pool)` methods but doesn't store pool centrally.

**Fix:** Added `private _pool: Pool | undefined = undefined;` field and assigned it inside `attachRelationshipStorage()` (same pool that main.ts passes for all DB work). This is the minimal correct approach — no separate `attachPool()` method needed since `attachRelationshipStorage()` is always called with the production pool in main.ts before `start()`.

**Files modified:** `grid/src/genesis/launcher.ts`

**Commit:** b92f341

### Orchestrator Constraint: Task 4 Skipped

**Found during:** Task 4 pre-flight

**Issue:** Orchestrator explicitly restricted ROADMAP.md writes. Task 4 is a doc-sync of the Allowlist Growth Ledger.

**Action:** Task 4 skipped entirely. Documented above with required orchestrator action.

## CI Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| `npx tsc --noEmit` | PASS | TypeScript clean |
| `npx vitest run market-routes police-stub settlement-timeout` | PASS | 35/35 tests |
| `check-route-did-policy.mjs` | NOT RUN | Script not present in worktree (Wave 1 artifact — `grid/scripts/` only has `gen-whisper-jsfixture.mjs`) |
| `check-sole-producer-discipline.mjs` | NOT RUN | Script not present in worktree (same) |

## Threat Surface Scan

No new unplanned network endpoints, auth paths, or trust boundary violations introduced. All 12 STRIDE threats from the plan's threat model are mitigated as planned:
- T-44-04-08 (SSRF) — dispute route uses direct DB INSERT, not HTTP self-call to police stub
- T-44-04-12 (IRS fee tampering) — IRS fee rate validated against [0.01, 0.03] before settle()

## Known Stubs

None — all routes are fully implemented with real MarketplaceStore method calls. The police stub route (`POST /api/v1/police/investigate`) is intentionally minimal per D-44-05 spec — full police logic is Phase 47.

## Self-Check

**Files exist:**
- FOUND: `grid/src/api/routes/market.ts`
- FOUND: `grid/src/marketplace/settlement-timeout.ts`
- CONFIRMED: `grid/src/api/routes/market-listings.ts` deleted

**Commits exist:**
- d3636ab — feat(44-04): add 9 marketplace routes + ROUTE_DID_POLICY entries + wire server.ts
- 0553c5b — feat(44-04): settlement-timeout sweep helper + tests
- b92f341 — feat(44-04): wire checkSettlementTimeouts into GenesisLauncher

## Self-Check: PASSED
