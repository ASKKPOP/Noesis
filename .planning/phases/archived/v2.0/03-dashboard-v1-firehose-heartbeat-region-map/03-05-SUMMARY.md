---
phase: 03-dashboard-v1-firehose-heartbeat-region-map
plan: 05
subsystem: ui
tags: [nextjs-15, react-19, use-sync-external-store, tailwind-4, vitest, testing-library, ws-client, firehose, heartbeat]

# Dependency graph
requires:
  - phase: 03-dashboard-v1-firehose-heartbeat-region-map
    provides: WsClient + refillFromDropped transport (Plan 03-03)
  - phase: 03-dashboard-v1-firehose-heartbeat-region-map
    provides: FirehoseStore / PresenceStore / HeartbeatStore singletons (Plan 03-04)
provides:
  - /grid route (server page + client shell) that mounts one WsClient per page session
  - useStores() + useFirehose/usePresence/useHeartbeat hooks over useSyncExternalStore
  - Firehose panel with 100-row DOM cap over 500-entry ring buffer
  - Heartbeat widget with live/stale status bound to HeartbeatStore
  - EventTypeFilter chip bar driving FirehoseStore.setFilter
  - Region-map placeholder ready for Plan 06 drop-in
affects: [03-06-region-map, phase-04-e2e-validation]

# Tech tracking
tech-stack:
  added: []  # all deps already present from 03-02/03-04
  patterns:
    - "Server-component page reads process.env.NEXT_PUBLIC_GRID_ORIGIN and hands origin + best-effort seed data to client shell"
    - "Client shell owns WsClient lifecycle in a single useEffect([origin, stores]); cleanup aborts in-flight refill and closes socket (StrictMode-safe)"
    - "useSyncExternalStore subscription via hooks layer — no prop drilling, no React context for store data (context only carries store *instances*)"
    - "data-testid + data-status / data-category attrs for stable E2E selectors"
    - "DOM cap = 100 rows newest-first via slice(-100).reverse() from filteredEntries snapshot"
    - "Capture-probe pattern for component tests: inline <Capture capture={ref}/> reads stores via useStores() without HOCs"

key-files:
  created:
    - dashboard/src/app/grid/page.tsx
    - dashboard/src/app/grid/grid-client.tsx
    - dashboard/src/app/grid/components/firehose.tsx
    - dashboard/src/app/grid/components/firehose-row.tsx
    - dashboard/src/app/grid/components/heartbeat.tsx
    - dashboard/src/app/grid/components/event-type-filter.tsx
    - dashboard/src/app/grid/components/firehose.test.tsx
    - dashboard/src/app/grid/components/firehose-row.test.tsx
    - dashboard/src/app/grid/components/heartbeat.test.tsx
    - dashboard/src/app/grid/components/event-type-filter.test.tsx
  modified: []  # Task 1 already committed use-stores.ts + hooks.ts + hooks.test.tsx + vitest.config.ts in e56a858

key-decisions:
  - "Used inline <Capture capture={ref}/> probe components in tests instead of HOC factories — HOC pattern triggered React 'Invalid hook call' because probes were invoked as plain functions"
  - "Replaced .toBeInTheDocument() with .not.toBeNull() in new tests — vitest 4's matcher registration timing for @testing-library/jest-dom was unreliable under parallel runs"
  - "DOM cap applied at render time via slice(-100).reverse() on filteredEntries, keeping full ring buffer for future search/history without remounting"
  - "Heartbeat stale state uses animate-pulse + text-red-400 (UI-SPEC §Heartbeat) rather than a separate toast — matches the 'ambient presence' aesthetic"
  - "EventTypeFilter auto-collapses empty Set to null so FirehoseStore.filter === null means 'show all' (no 'empty filter hides everything' trap)"
  - "Region map is a placeholder <section data-testid='region-map-placeholder'> — Plan 06 swaps component in place without touching GridLayout grid tracks"

patterns-established:
  - "Client-shell boundary: page.tsx (RSC) → grid-client.tsx ('use client') → StoresProvider → GridLayout — single WsClient mount point"
  - "Store subscription via useSyncExternalStore hooks layer (hooks.ts) — components never call stores.getSnapshot() directly"
  - "Test probe pattern: function Capture({capture}: {capture: {firehose?: Store}}) { capture.firehose = useStores().firehose; return <Target/>; }"
  - "Category color map exported from firehose-row.tsx as CATEGORY_BADGE constant — EventTypeFilter reuses the same keys for chip dots"

requirements-completed: [ACT-03, AUDIT-01, AUDIT-03]

# Metrics
duration: ~55 min
completed: 2026-04-18
---

# Phase 03 Plan 05: /grid Route + Firehose/Heartbeat/Filter Panels Summary

**Live /grid page with one-WsClient-per-session wiring, 100-row firehose (DOM cap over 500-entry ring), heartbeat stale detection, and event-type filter chips — region map placeholder ready for Plan 06 swap-in**

## Performance

- **Duration:** ~55 min (Task 1 previously committed; Tasks 2+3 in this session)
- **Started:** 2026-04-18 (Task 2 kickoff)
- **Completed:** 2026-04-18T14:04Z (final vitest green)
- **Tasks:** 3 (Task 1 committed separately as e56a858; Tasks 2 & 3 pending orchestrator commit)
- **Files created:** 10 (4 components + 4 tests + 2 route files)
- **Files modified (prior task):** 4 (use-stores.ts, hooks.ts, hooks.test.tsx, vitest.config.ts)

## Accomplishments

- **/grid route lives** — server page reads origin from env, best-effort fetches /api/v1/grid/regions, renders client shell with graceful "fetch failed / reconnect in progress" banner
- **Single WsClient per page** — grid-client.tsx owns lifecycle in useEffect([origin, stores]); StrictMode-safe cleanup (abort + close) prevents double-socket leak
- **Firehose panel** — 500-entry ring buffer in store, 100 newest-first rows in DOM, chip filter, two distinct empty states ("Waiting for events" vs "No events match")
- **Heartbeat widget** — three states (unknown / live / stale), tabular-nums tick counter, elapsed seconds driven by now-interval subscription, animate-pulse + red-400 when stale
- **EventTypeFilter** — "All" + 5 category chips with aria-pressed + colored dots, auto-collapses empty Set to null
- **Refill wiring** — 'dropped' handler paginates REST audit trail via refillFromDropped, batch-ingests into all three stores, advances WsClient.bumpLastSeenId atomically
- **Region map placeholder** — testable stub with initial region count readout; Plan 06 replaces without touching GridLayout

## Task Commits

1. **Task 1: store singleton + React hooks (useStores / useFirehose / usePresence / useHeartbeat)** — `e56a858` (feat) — committed prior to this session
2. **Task 2: FirehosePanel / FirehoseRow / HeartbeatWidget / EventTypeFilter components + 15 tests** — _pending orchestrator commit_
3. **Task 3: /grid route (server page + client shell) with WsClient lifecycle + refill wiring** — _pending orchestrator commit_

**Plan metadata:** _pending orchestrator commit (SUMMARY.md + STATE/ROADMAP updates)_

_Note: Task 1 was committed in a prior session before the sandbox-blocked commit boundary. Tasks 2 and 3 are staged as uncommitted working-tree changes for the orchestrator to atomize._

## Files Created/Modified

### Task 2 — Components (uncommitted)

- `dashboard/src/app/grid/components/firehose-row.tsx` — 28px mono row; HH:MM:SS timestamp, colored category badge, actor name (presence-resolved) or truncated DID, payload JSON preview
- `dashboard/src/app/grid/components/firehose.tsx` — Panel shell; wraps EventTypeFilter + row list; applies DOM cap via `filteredEntries.slice(-100).reverse()`
- `dashboard/src/app/grid/components/heartbeat.tsx` — Ambient status widget with data-status="unknown|live|stale" and tabular tick count
- `dashboard/src/app/grid/components/event-type-filter.tsx` — "All" + per-category chips; aria-pressed reflects FirehoseStore.filter; clicking category toggles membership in the Set (collapses to null when empty)
- `dashboard/src/app/grid/components/firehose.test.tsx` — F-1..F-4 (empty state, 200→100 cap, filter interaction, filter-no-match empty)
- `dashboard/src/app/grid/components/firehose-row.test.tsx` — FR-1..FR-4 (timestamp+badge+actor+payload, DID fallback, presence-resolved name, movement category attr)
- `dashboard/src/app/grid/components/heartbeat.test.tsx` — H-1..H-3 (unknown/live/stale rendering)
- `dashboard/src/app/grid/components/event-type-filter.test.tsx` — ETF-1..ETF-4 (chip count, toggle, aria-pressed, "All" clears)

### Task 3 — Route (uncommitted)

- `dashboard/src/app/grid/page.tsx` — Server component (no 'use client'); reads `NEXT_PUBLIC_GRID_ORIGIN`; best-effort fetches regions with `cache: 'no-store'`; hands origin + initialRegions + initialError to client shell
- `dashboard/src/app/grid/grid-client.tsx` — Client boundary; wraps <StoresProvider><GridLayout/></StoresProvider>; GridLayout owns WsClient effect with abort+close cleanup; registers 'event' (batch-ingest to 3 stores) and 'dropped' (refill → bumpLastSeenId) handlers; renders region-map placeholder + <Firehose/> + <Heartbeat/>

### Task 1 — Hooks (already committed as e56a858)

- `dashboard/src/app/grid/use-stores.ts` — StoresProvider + useStores hook; per-page-session singletons via useMemo ref
- `dashboard/src/app/grid/hooks.ts` — useFirehose / usePresence / useHeartbeat over useSyncExternalStore
- `dashboard/src/app/grid/hooks.test.tsx` — hook unit tests
- `dashboard/vitest.config.ts` — jsdom + setup wiring for React testing

## Decisions Made

- **Probe pattern over HOC factory in tests.** First cut used `const C = withStoresCapture(capture); <C/>` which called C as a plain function → React's "Invalid hook call" rule fired. Switched to inline `<Capture capture={ref}/>` probe components that are actual JSX — passes the hook-only-in-component rule and still captures the shared store into an outer ref for test assertions.
- **`.not.toBeNull()` in place of `.toBeInTheDocument()`.** `@testing-library/jest-dom` matcher extension registers flakily under vitest 4's parallel runs (specifically when multiple test files ran concurrently). Using plain Chai nullness assertions sidesteps the registration dependency and the DOM query already returns null for missing elements, so semantics are preserved.
- **Empty Set auto-collapses to null filter.** Keeping `filter: Set<EventCategory> | null` with "null === no filter" avoids a subtle trap where an empty Set would hide every row. EventTypeFilter explicitly calls `setFilter(null)` when the last category is toggled off.
- **Single useEffect for WsClient with `[origin, stores]` deps.** Origin is stable across session; stores triple is stable per provider (memoized). The effect runs exactly once per page mount. Cleanup calls `offEvent() / offDropped() / abort.abort() / client.close()` in that order — abort first so in-flight refills don't write to a closed socket's store.
- **Refill advances lastSeenId even when refill returns empty.** If the ring buffer has trimmed past our window, `refillFromDropped` returns `[]`; we still call `client.bumpLastSeenId(frame.latestId)` so the next reconnect doesn't re-request the same gap.

## Deviations from Plan

None — plan executed as written. All auto-corrections were mechanical (test harness pattern, matcher compatibility) and stayed within the plan's file list.

## Issues Encountered

- **Vitest 4 / jest-dom matcher race.** Some parallel runs of the four new component test files showed `Invalid Chai property: toBeInTheDocument`. Resolved by converting assertions to `.not.toBeNull()` + `.toBeNull()`. Existing Task 1 tests (`hooks.test.tsx`) were not affected and left using their original matchers. If the phase lands a stable jest-dom setup later, these can be refactored back.
- **Hook call error (resolved).** Initial HOC probe pattern in tests threw "Invalid hook call" — swapped to inline JSX probes. See "Decisions Made" above.
- **Sandbox blocks `next build`.** `npx next build` was denied by the Bash sandbox policy. Not a project issue — the equivalent gates (tsc --noEmit + vitest run) are green, and `next build` will be exercised by the Phase 04 validation flow.

## User Setup Required

None — no external service configuration required.

The `/grid` page reads `NEXT_PUBLIC_GRID_ORIGIN` with a `http://localhost:8080` default; developers only need the Grid backend running on the default port to see live events.

## Next Phase Readiness

- **Plan 06 ready.** `regionMapPlaceholder` in grid-client.tsx is a single <section> — Plan 06 replaces it with `<RegionMap regions={...} connections={...}/>`. The PresenceStore is already populated by the shared WsClient wiring; no duplicate subscriptions needed.
- **Initial regions seed available.** page.tsx already fetches `/api/v1/grid/regions` and passes the typed `{regions, connections}` payload down; Plan 06 can thread it directly into the map component.
- **Phase 4 E2E checklist unlocked.** Playwright selectors are stable: `firehose-row`, `firehose-list`, `event-type-badge[data-category]`, `heartbeat-status[data-status]`, `heartbeat-tick`, `heartbeat-elapsed`, `region-map-placeholder`.
- **No blockers.**

## Verification

- `npx vitest run` → **98/98 passing** across 13 test files (Task 1 hooks baseline 83 + 15 new Task 2 component tests)
- `npx tsc --noEmit` → **clean** (no type errors)
- `next build` → blocked by sandbox; to be exercised by Phase 04 CI
- UI-SPEC §6 category colors honored: movement→blue-400, message→violet-400, trade→amber-400, law→pink-400, lifecycle→neutral-500 (see `CATEGORY_BADGE` in firehose-row.tsx, `DOT` in event-type-filter.tsx)
- Test-id convention honored: `firehose-row`, `firehose-list`, `heartbeat-status`, `event-type-badge`, plus supporting `heartbeat-tick`, `heartbeat-elapsed`, `region-map-placeholder`

## Self-Check: PASSED

**Files verified present:**
- `dashboard/src/app/grid/page.tsx` — FOUND
- `dashboard/src/app/grid/grid-client.tsx` — FOUND
- `dashboard/src/app/grid/components/firehose.tsx` — FOUND
- `dashboard/src/app/grid/components/firehose-row.tsx` — FOUND
- `dashboard/src/app/grid/components/heartbeat.tsx` — FOUND
- `dashboard/src/app/grid/components/event-type-filter.tsx` — FOUND
- `dashboard/src/app/grid/components/firehose.test.tsx` — FOUND
- `dashboard/src/app/grid/components/firehose-row.test.tsx` — FOUND
- `dashboard/src/app/grid/components/heartbeat.test.tsx` — FOUND
- `dashboard/src/app/grid/components/event-type-filter.test.tsx` — FOUND

**Commits verified:**
- `e56a858` (Task 1) — FOUND in `git log`
- Task 2 / Task 3 — intentionally uncommitted; orchestrator to atomize (sandbox blocked per-task commits this session)

---
*Phase: 03-dashboard-v1-firehose-heartbeat-region-map*
*Completed: 2026-04-18*
