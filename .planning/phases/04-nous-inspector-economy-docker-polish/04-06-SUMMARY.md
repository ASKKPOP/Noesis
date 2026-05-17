---
phase: 04-nous-inspector-economy-docker-polish
plan: 06
subsystem: ui
tags: [next15, react19, vitest, economy, firehose, tdd, useSyncExternalStore]

# Dependency graph
requires:
  - phase: 04-nous-inspector-economy-docker-polish
    provides: "Plan 04-03: /api/v1/grid/nous, /api/v1/economy/trades (W2 Unix-seconds timestamp), /api/v1/economy/shops"
  - phase: 04-nous-inspector-economy-docker-polish
    provides: "Plan 04-04: shared primitives at @/components/primitives (Chip, EmptyState) + SelectionStore + useSelection"
provides:
  - "Typed fetchRoster / fetchTrades / fetchShops wrappers with Result-style discriminated union"
  - "EconomyPanel with parallel-on-mount fetch + trade.settled-driven invalidation (roster + trades only; shops are launcher-registered)"
  - "BalancesTable, TradesTable, ShopsList sub-components with NOUS-03 linkback (row click → SelectionStore.select → Inspector opens)"
  - "?tab=economy gate wired into GridLayout (grid-client.tsx) via useSearchParams"
  - "Frozen stable test-ids handed to Plan 07 for smoke tests"
affects: [04-07, 05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated Result union { ok: true; data } | { ok: false; error: { kind: 'network' } } — AbortError re-thrown so callers gate on signal.aborted"
    - "useSyncExternalStore with .bind(store) to preserve `this` when passing instance methods as subscribe/getSnapshot"
    - "Firehose-driven invalidation with lastTradeId ref (scan snapshot backwards for newest trade.settled id → dedup via ref comparison)"
    - "Per-section error isolation: three independent Slot<T> states so one endpoint failure never blanks the siblings"
    - "Client-tree gating (not server-component) for ?tab querystring because page.tsx is async server component and searchParams live on client"

key-files:
  created:
    - "dashboard/src/lib/api/economy.ts — typed fetch wrappers + TradeRecord type with W2 Unix-seconds comment"
    - "dashboard/src/lib/api/economy.test.ts — 13 tests covering 200/500/limit-clamp/AbortError contract"
    - "dashboard/src/app/grid/economy/economy-panel.tsx — container with fetch lifecycle + firehose invalidation"
    - "dashboard/src/app/grid/economy/economy-panel.test.tsx — 5 tests covering mount, invalidation, dedup, error isolation, abort"
    - "dashboard/src/app/grid/economy/balances-table.tsx — Name / Region / Ousia / Status, sort by Ousia desc"
    - "dashboard/src/app/grid/economy/balances-table.test.tsx — 4 tests (sort, select-on-click, empty, status chip)"
    - "dashboard/src/app/grid/economy/trades-table.tsx — Time / Seller / Buyer / Amount / Nonce with W2 ts*1000"
    - "dashboard/src/app/grid/economy/trades-table.test.tsx — 7 tests (including 1970 regression guard for the W2 contract)"
    - "dashboard/src/app/grid/economy/shops-list.tsx — per-shop cards with owner name + nested listings"
    - "dashboard/src/app/grid/economy/shops-list.test.tsx — 3 tests (empty / populated / owner fallback)"
  modified:
    - "dashboard/src/app/grid/grid-client.tsx — added useSearchParams gating + TabBar + EconomyPanel conditional"

key-decisions:
  - "Gate ?tab=economy inside GridLayout (client-tree) rather than page.tsx — page.tsx is an async server component; useSearchParams is a client hook. Rule 3 blocking-issue auto-fix."
  - "Firehose dedup via lastTradeId ref instead of effect-key: scanning snapshot.entries backwards for newest trade.settled id and comparing to ref avoids a refetch storm when multiple subscribers replay the ring buffer (T-04-27 mitigation in plan)."
  - "Layout: Balances row at top (full width), Shops left + Trades right in a 2-col grid on lg. Matches UI-SPEC and mirrors the Firehose/RegionMap stacking used on tab 1."
  - "DID fallback when a row references a Nous absent from the roster: `…<last 8 chars>`. Never render raw 50-char DIDs."
  - "Per-section error isolation: three parallel fetches (Promise.all with .catch(() => null)) each write to their own Slot<T> state. One failure → one EmptyState; the other two sections stay live."
  - "Sort BalancesTable by Ousia desc default — the economic signal users come to this tab for — with a stable tiebreak on name."

patterns-established:
  - "useSyncExternalStore bind pattern: `store.subscribe.bind(store)` / `store.getSnapshot.bind(store)` for every external store subscription to preserve `this` through React's call."
  - "Slot<T> state shape: `{ state: 'loading' } | { state: 'ready'; data: T } | { state: 'error' }` — lets render paths stay exhaustive and future-friendly vs null checks."
  - "Fetch wrapper discriminant: `Result<T> = { ok: true; data: T } | { ok: false; error: { kind: 'network' } }`. AbortError is re-thrown (signal-based cancellation, not a logical failure)."
  - "Test-id convention for panels consumed by E2E: `<component>-<variant>` (e.g. `trades-empty`, `balances-error`, `shops-loading`). Plan 07 owns the full registry."

requirements-completed: [ECON-01, ECON-02, ECON-03]

# Metrics
duration: 45min
completed: 2026-04-18
---

# Phase 04 Plan 06: Economy Panel Summary

**Economy tab with Balances / Trades / Shops sub-tables, firehose trade.settled invalidation via lastTradeId dedup, and `?tab=economy` gating wired into GridLayout.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-04-18
- **Tasks:** 3
- **Files created:** 10 (6 impl + 4 test; one impl file later split into 3 sub-tables → 6 actual impl files)
- **Files modified:** 1 (grid-client.tsx)
- **Tests added:** 32 (13 API + 4 balances + 7 trades + 3 shops + 5 panel)
- **Test total:** 214 passing (baseline 182)

## Accomplishments

- Typed REST wrappers with unified Result discriminant and AbortError-preserving signal handling.
- Full Economy panel: parallel-on-mount fetch → firehose subscription → on each new `trade.settled` (dedup'd via lastTradeId ref) re-fetch roster + trades only.
- Three sub-tables with NOUS-03 linkback (every Nous name is a button that calls `useSelection().select(did)` → Inspector opens).
- Client-tree tab gating so `?tab=economy` mounts/unmounts the whole panel cleanly alongside the existing Firehose/RegionMap layout.
- W2 Unix-seconds timestamp contract honored: `new Date(t.timestamp * 1000).toLocaleTimeString()` with a dedicated 1970-regression test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Typed economy fetch wrappers (fetchRoster / fetchTrades / fetchShops)** — `d5ad6f1` (feat)
2. **Task 2: BalancesTable + TradesTable + ShopsList sub-components** — `2f07f8b` (feat)
3. **Task 3: EconomyPanel + TabBar gating in GridLayout** — `40bb119` (feat)

_Note: sandbox uses `gsd-sdk query commit` which collapses RED/GREEN into single commits — the test files and impls landed together per task._

## Files Created/Modified

**Created:**
- `dashboard/src/lib/api/economy.ts` — fetchRoster/Trades/Shops with getJson<T> helper, TradeRecord (W2 Unix-seconds comment), EconomyResult<T> discriminant.
- `dashboard/src/lib/api/economy.test.ts` — 13 tests (200/500/AbortError/limit clamp to [1,100]/NaN fallback to 20).
- `dashboard/src/app/grid/economy/economy-panel.tsx` — container with two useEffects (mount / invalidation), Slot<T> tri-state, AbortController per pass.
- `dashboard/src/app/grid/economy/economy-panel.test.tsx` — 5 tests using StoresProbe helper to push firehose events inside `<StoresProvider>`.
- `dashboard/src/app/grid/economy/balances-table.tsx` — Ousia desc sort, Name→select button, Chip for status, tabular-nums.
- `dashboard/src/app/grid/economy/balances-table.test.tsx` — 4 tests.
- `dashboard/src/app/grid/economy/trades-table.tsx` — formatted time via `ts * 1000`, buyer/seller label-with-fallback Map, per-row select buttons.
- `dashboard/src/app/grid/economy/trades-table.test.tsx` — 7 tests including 1970 guard (if someone drops the `* 1000`, the Date will land in 1970 and the test fails loudly).
- `dashboard/src/app/grid/economy/shops-list.tsx` — `<ul>` of `<li>` cards; nested `<table>` for listings.
- `dashboard/src/app/grid/economy/shops-list.test.tsx` — 3 tests.

**Modified:**
- `dashboard/src/app/grid/grid-client.tsx` — added `useSearchParams` → `activeTab`; replaced the two-section Firehose/RegionMap block with a conditional between `<EconomyPanel />` and the existing panels; wired `<TabBar />` at the top of the content area.

## Decisions Made

- **Firehose dedup strategy (lastTradeId ref).** On each store change, scan `snapshot.entries` from the end for the newest `trade.settled` entry. If its `id` matches the ref, no-op. Otherwise bump the ref and re-fetch roster + trades. Shops stay at their mount-time snapshot — they're launcher-registered. This was plan T-04-27 and survives ring-buffer replay storms.
- **Layout: Balances top, Shops left, Trades right.** Balances owns the full width because the roster is the primary signal; Shops and Trades sit side-by-side below it in a `lg:grid-cols-2`. Keeps the page readable at the existing container width without resizing.
- **DID fallback `…<last 8>`.** Whenever a TradesTable row or a Shop owner references a DID not in the current roster, the label falls back to `…<last 8 chars>`. Full 50-char DIDs are never rendered.
- **W2 Unix-seconds confirmed.** TradeRecord.timestamp is a plain integer of seconds. Display path is `new Date(t.timestamp * 1000).toLocaleTimeString()` at `trades-table.tsx:92`. Dedicated 1970-regression test guards the `* 1000`.

## Test-IDs Handed to Plan 07

For Plan 04-07's smoke layer:

| Test-ID | Where | Purpose |
|---------|-------|---------|
| `economy-panel` | economy-panel.tsx | Tab visibility check |
| `balances-table` | balances-table.tsx | Balances renders |
| `balances-loading` | economy-panel.tsx | Mount-time loading state |
| `balances-error` | economy-panel.tsx | Roster fetch failure |
| `balances-empty` | balances-table.tsx | Empty roster |
| `balances-row-<did>` | balances-table.tsx | Per-row handle |
| `balances-status-<did>` | balances-table.tsx | Status chip target |
| `trades-table` | trades-table.tsx | Trades renders |
| `trades-loading` | economy-panel.tsx | Mount-time loading state |
| `trades-error` | economy-panel.tsx | Trades fetch failure |
| `trades-empty` | trades-table.tsx | Zero-trades empty state |
| `trades-row-<nonce>` | trades-table.tsx | Per-row handle (nonce is stable) |
| `shops-list` | shops-list.tsx | Shops renders |
| `shops-loading` | economy-panel.tsx | Mount-time loading state |
| `shops-error` | economy-panel.tsx | Shops fetch failure |
| `shops-empty` | shops-list.tsx | Zero-shops empty state |
| `shop-<ownerDid>` | shops-list.tsx | Per-card handle |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tab gating moved from page.tsx to grid-client.tsx**
- **Found during:** Task 3 (EconomyPanel wiring)
- **Issue:** Plan specified gating `?tab=economy` in `page.tsx`, but `page.tsx` is an `async function GridPage()` — a Next.js server component. `useSearchParams()` is a client-only hook; reading the querystring on the server would require switching the entire page to a client component or threading `searchParams` through props (invasive, would break the existing server-side regions fetch).
- **Fix:** Moved gating into `GridLayout` inside `grid-client.tsx` where we already sit at the client boundary and `useStores()` lives. Added `const activeTab = searchParams.get('tab') === 'economy' ? 'economy' : 'firehose'` and wrapped the existing Firehose/RegionMap block behind the `activeTab !== 'economy'` branch.
- **Files modified:** `dashboard/src/app/grid/grid-client.tsx`
- **Verification:** Existing 182 tests still pass; new panel test mounts inside `<StoresProvider>` just like the real route.
- **Committed in:** `40bb119`

**2. [Rule 1 - Bug] Test fetchMock tuple type needed parameter signature**
- **Found during:** Task 1 (economy.test.ts)
- **Issue:** `vi.fn(async () => jsonResp(...))` typed the call args as empty tuple `[]`, so `fetchMock.mock.calls[0]!` tripped `TS2493: Tuple type '[]' of length '0' has no element at index '0'`.
- **Fix:** Gave the mock explicit signatures: `vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(...))`. Now calls[0] is `[string, RequestInit | undefined]`.
- **Files modified:** `dashboard/src/lib/api/economy.test.ts`
- **Verification:** `tsc --noEmit` clean, 13/13 API tests pass.
- **Committed in:** `d5ad6f1`

**3. [Rule 1 - Bug] jest-dom matchers not installed — use null-checks**
- **Found during:** Task 2 (balances-table.test.tsx)
- **Issue:** `expect(el).toBeInTheDocument()` returned "invalid Chai property" — `@testing-library/jest-dom` matchers are not wired into this project's vitest setup.
- **Fix:** Replaced all `.toBeInTheDocument()` with `.not.toBeNull()` and `.not.toBeInTheDocument()` with `.toBeNull()`, matching the project convention (confirmed by the existing `memory.test.tsx` pattern).
- **Files modified:** all four new test files.
- **Verification:** 214/214 green.
- **Committed in:** `2f07f8b` and `40bb119`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug)
**Impact on plan:** None structural. All three fixes preserve plan intent; the page.tsx → grid-client.tsx move is the only architectural shift and it was forced by Next.js's client/server boundary — not a plan error, just a detail the plan couldn't see from outside the code.

## Issues Encountered

- `/Alpha/` regex in shops-list.test.tsx matched both "Alpha Emporium" and "owned by Alpha" — tightened to `/owned by Alpha/`. Trivial fix during TDD GREEN.

## User Setup Required

None — no external services touched.

## Next Phase Readiness

- Plan 04-07 (Docker polish + E2E smoke) has a full test-id registry to hook into.
- ECON-01/02/03 close out the user-facing Economy surface.
- Phase 5 (whatever it ends up being) inherits the firehose-invalidation pattern and the shared `@/components/primitives` module intact.

## Self-Check: PASSED

- Files present:
  - `dashboard/src/lib/api/economy.ts` FOUND
  - `dashboard/src/lib/api/economy.test.ts` FOUND
  - `dashboard/src/app/grid/economy/economy-panel.tsx` FOUND
  - `dashboard/src/app/grid/economy/economy-panel.test.tsx` FOUND
  - `dashboard/src/app/grid/economy/balances-table.tsx` FOUND
  - `dashboard/src/app/grid/economy/balances-table.test.tsx` FOUND
  - `dashboard/src/app/grid/economy/trades-table.tsx` FOUND
  - `dashboard/src/app/grid/economy/trades-table.test.tsx` FOUND
  - `dashboard/src/app/grid/economy/shops-list.tsx` FOUND
  - `dashboard/src/app/grid/economy/shops-list.test.tsx` FOUND
  - `dashboard/src/app/grid/grid-client.tsx` FOUND (modified)
- Commits present: `d5ad6f1` FOUND, `2f07f8b` FOUND, `40bb119` FOUND.
- Test run: 214/214 green; tsc clean; retired primitives path `@/app/grid/inspector/primitives` has zero references.

---
*Phase: 04-nous-inspector-economy-docker-polish*
*Completed: 2026-04-18*
