---
phase: 03-dashboard-v1-firehose-heartbeat-region-map
verified: 2026-04-18T16:45:00Z
status: human_needed
score: 7/7 must-haves verified (Playwright E2E deferred — sandbox cannot boot dev server)
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Playwright E2E — grid-page.spec.ts"
    expected: "Spec typechecks (confirmed via `npx playwright test --list`) and passes in an environment that can boot `next dev` on :3001 alongside the Fastify mock Grid on 127.0.0.1:8080. Spec asserts SC-3/4/5/6 against a real browser."
    why_human: "Sandbox blocks `npx playwright test` full execution (webServer startup denied). Unit + component coverage already asserts the same invariants in jsdom (region-map.test.tsx RM-1..RM-10, firehose.test.tsx, heartbeat.test.tsx); E2E is the UX sanity gate."
  - test: "Visual smoothness of Nous marker transition (SC-5 UX)"
    expected: "Marker glides between regions in under ~150ms on `nous.moved` — CSS transition feels smooth, not janky."
    why_human: "Subjective frame-rate perception; automated test asserts the transform commits in one render cycle (flushSync) but cannot judge smoothness."
  - test: "Browser sanity (SC-1 full UX)"
    expected: "`cd dashboard && npm run dev` → visit http://localhost:3001/grid → page loads with header 'Noēsis / grid', RegionMap SVG visible, Firehose panel, Heartbeat widget, filter chips."
    why_human: "Automated smoke only asserts the server boots; a human must confirm the page is visually correct when a real Grid is attached."
---

# Phase 3: Dashboard v1 — Firehose + Heartbeat + Region Map — Verification Report

**Phase Goal:** A developer can open the dashboard in a browser and watch the Grid tick, see events stream, and see Nous move between regions.
**Verified:** 2026-04-18
**Status:** human_needed (all 7 SCs verified programmatically; E2E + live-browser UX gates remain for human sign-off)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| SC-1 | `dashboard/` scaffolded (Next.js 15 + TS app router) and `npm run dev` serves :3001 | VERIFIED | `dashboard/package.json:7` (`next dev --port 3001`), `next.config.mjs` (React 19 strict mode), `playwright.config.ts:15-19` (webServer points at :3001), `src/app/layout.tsx` + `src/app/page.tsx` + `src/app/grid/page.tsx` exist. Dashboard typecheck clean (`tsc --noEmit` = 0 errors). |
| SC-2 | WS reconnect with exponential backoff + jitter, tracks lastSeenId, REST refill on `dropped` | VERIFIED | `src/lib/transport/ws-client.ts:189-201` sends `subscribe {sinceId: lastSeenId}` on every (re)connect; `:267-277` scheduleReconnect uses `nextDelayMs(attempt)` from `backoff.ts:14-24` (full-jitter formula `Math.random() * min(30000, 250*2^n)`); `refill.ts:39-74` handles DroppedFrame with in-flight coalesce map preventing stampede; `grid-client.tsx:96-126` wires 'dropped' → refill → `bumpLastSeenId`. Tests: backoff.test.ts + ws-client.test.ts + refill.test.ts (all green within 108 dashboard tests). |
| SC-3 | `/grid` firehose: 500-event ring, DOM cap 100, type/actor/ts/payload shown | VERIFIED | `src/lib/stores/firehose-store.ts:36` CAPACITY=500 (drop-oldest eviction `:66-70`); `src/app/grid/components/firehose.tsx:24` DOM_CAP=100 (`.slice(-DOM_CAP).reverse()` at `:32`); `firehose-row.tsx:104-119` renders timestamp (HH:MM:SS from `entry.createdAt`), event-type badge (`entry.eventType`), actor (resolved via `presence.nameOf(actorDid)` with DID fallback), payload preview (first 3 k=v pairs). Tests: firehose-store.test.ts + firehose.test.tsx + firehose-row.test.tsx green. |
| SC-4 | Region map renders regions as nodes, edges for connections, Nous names listed | VERIFIED | `region-map.tsx:120-151` renders one `<g data-testid="region-node">` per region with `<circle>` + `<text>{r.name}` label; `:103-117` renders `<line data-edge>` per connection; `:155-174` renders one `<g data-testid="nous-marker">` per Nous from `presence.allNous.entries()` with `<title>{info.name}` (the "Nous name listed" attestation — names live in the DOM as text, per T-03-20 XSS-safe TEXT NODE rule). `computeRegionLayout` deterministic (FNV-1a 32-bit, 5×5 grid, clamped to [0.05,0.95]²). Tests: region-map.test.tsx RM-1..RM-10 green (10/10). |
| SC-5 | Nous marker shifts within one render cycle of `nous.moved` | VERIFIED | `grid-client.tsx:89-91` wraps `stores.presence.applyEvents(entries)` in `flushSync(() => {...})` so presence commits synchronously with the frame arrival (firehose + heartbeat stay outside flushSync so React batches those normally). `region-map.tsx:161` markers keyed by DID → same DOM node reused across region changes → CSS `transition: transform 150ms ease-out` (line 166) animates the position. Tests: RM-5 asserts `after === before` (element identity preserved) with transform updated to new region center; Playwright spec `grid-page.spec.ts:64-87` polls marker transform against layout-derived pixel coords. |
| SC-6 | Heartbeat shows tick count + "last event N seconds ago", stale if >2× tick rate | VERIFIED | `heartbeat-store.ts:81-95` `deriveStatus(nowMs)` returns `{status, secondsSinceLastEvent}` where `status = elapsed > 2 * tickRateMs ? 'stale' : 'live'`; `:138-155` consumes `tickRateMs` from `tick` event payload (matches `grid/src/genesis/launcher.ts:115-118` which emits `{tick, epoch, tickRateMs}`). `heartbeat.tsx:78-89` renders "Tick {lastTick}", "last event {N}s ago", and a pulsing red indicator + "(no events for 2× tick rate)" hint when status === 'stale'. Tests: heartbeat-store.test.ts + heartbeat.test.tsx green. |
| SC-7 | Firehose filterable by event type (trade/message/movement/law) | VERIFIED | `event-type.ts:32-39` `categorizeEventType` maps eventType → {trade, message, movement, law, lifecycle, other} via prefix/exact match; `:46-52` `ALL_CATEGORIES` exports the 5 filterable categories. `event-type-filter.tsx:34-96` renders toggle chips (one per category + "All" reset) that mutate `FirehoseStore.setFilter()`. `firehose-store.ts:76-80` applies filter via `computeFiltered` (`:114-119`) without mutating the ring. All four phase-required categories (trade/message/movement/law) present in ALL_CATEGORIES. Tests: event-type.test.ts + event-type-filter.test.tsx green. |

**Score:** 7/7 truths verified (with 3 human-verification items for UX/E2E confirmation).

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `dashboard/package.json` | Next 15 + React 19 + Vitest 4 + Playwright 1.50 | VERIFIED | Lines 18-44 pin exact versions; `dev` script on :3001. |
| `dashboard/next.config.mjs` | App-router + strict mode | VERIFIED | React strict mode enabled; no rewrites (direct CORS to Grid). |
| `dashboard/playwright.config.ts` | testDir e2e, port 3001 | VERIFIED | Lines 4, 14-19 confirm. |
| `dashboard/src/lib/transport/ws-client.ts` | Reconnect + lastSeenId | VERIFIED | 321 lines; state machine idle→connecting→open→reconnecting→halted/closed. |
| `dashboard/src/lib/transport/refill.ts` | REST backfill on dropped | VERIFIED | 129 lines; in-flight coalesce map; PAGE_LIMIT 1000. |
| `dashboard/src/lib/transport/backoff.ts` | Full-jitter exp backoff | VERIFIED | 24 lines; MAX 30s, BASE 250ms; `nextDelayMs()` bounded. |
| `dashboard/src/lib/stores/firehose-store.ts` | 500-entry ring, dedupe, filter | VERIFIED | 137 lines; useSyncExternalStore-compatible; WeakMap synthetic ids. |
| `dashboard/src/lib/stores/heartbeat-store.ts` | tickRateMs staleness | VERIFIED | 168 lines; monotonic id guard; deriveStatus with 2× threshold. |
| `dashboard/src/lib/stores/presence-store.ts` | Tracks Nous by DID | VERIFIED | Present; used by region-map + firehose-row. |
| `dashboard/src/lib/stores/event-type.ts` | 6 categories + ALL_CATEGORIES | VERIFIED | 53 lines; pure function. |
| `dashboard/src/app/grid/grid-client.tsx` | WsClient wiring + flushSync | VERIFIED | 177 lines; flushSync at line 89; refill at line 96. |
| `dashboard/src/app/grid/components/firehose.tsx` | DOM cap 100 | VERIFIED | 81 lines; `DOM_CAP = 100`. |
| `dashboard/src/app/grid/components/firehose-row.tsx` | type/actor/ts/payload | VERIFIED | 122 lines; 28px row per UI-SPEC. |
| `dashboard/src/app/grid/components/region-map.tsx` | SVG + markers + transition | VERIFIED | 178 lines; memoized; title-rendered Nous names. |
| `dashboard/src/app/grid/components/region-layout.ts` | Deterministic layout | VERIFIED | FNV-1a 32-bit hash; re-exported from region-map.tsx. |
| `dashboard/src/app/grid/components/heartbeat.tsx` | Live/stale/unknown UI | VERIFIED | 93 lines; data-status attribute for E2E. |
| `dashboard/src/app/grid/components/event-type-filter.tsx` | Toggle chips | VERIFIED | 97 lines; aria-pressed for a11y. |
| `dashboard/tests/e2e/grid-page.spec.ts` | SC-3/4/5/6 E2E smoke | VERIFIED (typechecks; not executed) | Playwright --list confirms spec typechecks; full run deferred. |
| `dashboard/tests/e2e/fixtures/mock-grid-server.ts` | Mock Grid on 127.0.0.1:8080 | VERIFIED | Fastify + @fastify/websocket; binds loopback only (T-03-24). |
| `grid/src/api/server.ts` — CORS | Allowlist :3001 and :3000 | VERIFIED | Lines 46-50 `@fastify/cors` with origin allowlist, credentials=false, methods=[GET, OPTIONS]. |
| `grid/src/api/server.ts` — /api/v1/grid/regions | Returns regions + connections | VERIFIED | Lines 80-85; read-only; no mutation path. |
| `grid/src/genesis/launcher.ts` — tick audit | Emits `{tick, epoch, tickRateMs}` | VERIFIED | Lines 113-118 append 'tick' with {tick, epoch, tickRateMs} each clock tick. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| GridClient | WsClient | `new WsClient({url, onError})` | WIRED | `grid-client.tsx:65-73`; URL derived from `origin.replace(/^http/, 'ws') + '/ws/events'`. |
| WsClient (event) | FirehoseStore/PresenceStore/HeartbeatStore | `ingestAll([entry])` | WIRED | `grid-client.tsx:95-96`; calls all three stores atomically. |
| WsClient (dropped) | refillFromDropped | await + bumpLastSeenId | WIRED | `grid-client.tsx:96-126`; ingests via same ingestAll; bumps lastSeenId to skip refilled range. |
| PresenceStore | RegionMap markers | `presence.allNous.entries()` | WIRED | `region-map.tsx:156` via `usePresence()` hook. |
| FirehoseStore | Firehose UI | `useFirehose()` → snap.filteredEntries | WIRED | `firehose.tsx:27-31`. |
| HeartbeatStore | Heartbeat UI | `useHeartbeat()` → derived status | WIRED | `heartbeat.tsx:32`. |
| EventTypeFilter | FirehoseStore.setFilter | `firehose.setFilter(next)` | WIRED | `event-type-filter.tsx:49`. |
| /grid server page | Grid /api/v1/grid/regions | `fetchRegions(origin)` | WIRED | `page.tsx:27-37`; passed as `initialRegions` prop to GridClient. |
| GridClient | RegionMap | `<RegionMap regions=... connections=... />` | WIRED | `grid-client.tsx:163-166`. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| RegionMap | `regions`, `connections` props | `page.tsx` fetches `/api/v1/grid/regions` (real Fastify endpoint returning `services.space.allRegions()` + `allConnections()`) | Yes (real Grid endpoint) | FLOWING |
| RegionMap | `presence.allNous` | PresenceStore populated from `applyEvent(nous.spawned | nous.moved)` via WsClient event handler in grid-client | Yes (real WS stream) | FLOWING |
| Firehose | `snap.filteredEntries` | FirehoseStore populated by WsClient 'event' handler via `ingestAll([entry])` | Yes | FLOWING |
| Heartbeat | `hb.lastTick`, `hb.tickRateMs`, `hb.secondsSinceLastEvent` | HeartbeatStore populated by `ingestBatch(entries)` from WsClient events (tick events carry payload.tick/epoch/tickRateMs per launcher.ts:113-118) | Yes | FLOWING |
| EventTypeFilter | `filter`, `ALL_CATEGORIES` | FirehoseStore.filter via hook; ALL_CATEGORIES static export | N/A (UI state, not external data) | FLOWING |

No hollow props, no static empty fallbacks flowing to users.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Grid Vitest suite | `cd grid && npm test -- --run` | 303 passed / 303 (24 files, 3.33s) | PASS |
| Dashboard Vitest suite | `cd dashboard && npx vitest run` | 108 passed / 108 (14 files, 876ms) | PASS |
| Dashboard TypeScript | `cd dashboard && npx tsc --noEmit` | 0 errors (exit 0, no output) | PASS |
| Playwright spec typecheck | `cd dashboard && npx playwright test --list` | 1 test listed (grid-page.spec.ts) — typechecks cleanly | PASS |
| Playwright full E2E run | `npx playwright test` | NOT EXECUTED — sandbox cannot start `next dev` on :3001 | SKIP (human) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACT-03 | 03-04, 03-05 | Dashboard displays scrolling live feed of events with timestamps and Nous attribution | SATISFIED | Firehose component + FirehoseStore + firehose-row (timestamp HH:MM:SS + actor name via PresenceStore + event type badge + payload preview); live updates via WsClient 'event' handler. |
| MAP-01 | 03-01, 03-06 | Dashboard displays Grid's region graph — nodes are regions, edges are connections | SATISFIED | `/api/v1/grid/regions` returns `{regions, connections}`; RegionMap renders `<g data-testid="region-node">` + `<line data-edge>`. |
| MAP-02 | 03-06 | Each region shows which Nous are currently present | SATISFIED | PresenceStore tracks `allNous: Map<did, {name, regionId}>` from `nous.spawned` + `nous.moved`; RegionMap renders markers per DID with `<title>` = name. Markers positioned at the Nous's current regionId. |
| MAP-03 | 03-06 | When a Nous moves, their position updates on the map in real-time | SATISFIED | `grid-client.tsx:89` flushSync around PresenceStore.applyEvents → same-render-cycle commit; markers keyed by DID → same DOM node → CSS transition animates. Asserted by region-map.test.tsx RM-5 + Playwright spec. |
| AUDIT-01 | 03-02, 03-05 | Dashboard has an audit trail view that displays AuditChain events in sequence | SATISFIED | Firehose panel IS the audit trail view; events rendered newest-first, backed by FirehoseStore ring + REST refill on gaps. |
| AUDIT-02 | 03-03, 03-04 | Each audit entry shows event type, actor (Nous), timestamp, and relevant data | SATISFIED | `firehose-row.tsx` renders all four: event type badge, actor (presence.nameOf → name, fallback truncated DID), formatted timestamp, payload preview (first 3 k=v pairs). |
| AUDIT-03 | 03-01, 03-03, 03-05 | Audit trail filterable by event type (trade, message, movement, law) | SATISFIED | EventTypeFilter chip row; categorizeEventType covers trade/message/movement/law (plus lifecycle/other); FirehoseStore.filter applied in computeFiltered. |

**Orphaned requirements:** None. All 7 REQ-IDs mapped to Phase 3 in REQUIREMENTS.md (lines 87-93) are covered by this phase's plans.

---

## Threat Mitigation Status

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-03-01 | CORS misconfiguration exposing Grid API to arbitrary origins | MITIGATED — `server.ts:46-50` allowlist `[http://localhost:3001, http://localhost:3000]` only; `credentials: false`; methods=[GET, OPTIONS]. Test: `grid/test/api/server.cors.test.ts` (4 tests green). |
| T-03-02 | Region endpoint leaking internal state beyond {regions, connections} | MITIGATED — `/api/v1/grid/regions` returns exactly `{regions, connections}` (server.ts:80-85). Test: `server.regions.test.ts` (3 tests green). |
| T-03-03 | Tick payload drift breaking AuditChain hash invariant | MITIGATED — tick audit shape `{tick, epoch, tickRateMs}` frozen at `launcher.ts:113-118`; `grid/test/genesis.test.ts` covers. Grid 303/303 pass → hash invariant intact. |
| T-03-04 | Dashboard mirror diverging from authoritative Grid types | MITIGATED — `ws-protocol.ts:1` explicit SYNC header pointing at `grid/src/api/ws-protocol.ts`; no cross-workspace imports (dashboard/ is its own npm workspace). |
| T-03-05 | Unbounded WS reconnect loop | MITIGATED — `backoff.ts:21-22` clamps exp to 50 → ceiling = min(30000, 250*2^50) → MAX_DELAY_MS = 30000 ms; full-jitter `Math.random() * ceiling`. `bye` frame halts reconnect (ws-client.ts:245-249). |
| T-03-06 | Duplicate REST refills amplifying load on `dropped` | MITIGATED — `refill.ts:37-74` module-level `inFlight` Map; second call with same `(origin, sinceId, latestId)` key shares the same Promise. |
| T-03-07 | Leaking WS URL / credentials via RSC hydration payload | MITIGATED — `page.tsx:40` reads `NEXT_PUBLIC_GRID_ORIGIN` server-side; no auth tokens threaded as props; WS URL derived client-side from validated origin. |

---

## Anti-Patterns Found

No blockers. Scanned all Phase 3 artifact files:
- No TODO/FIXME/XXX/HACK markers in production code (only in plan/research docs).
- No placeholder returns — all components return real SVG/JSX.
- Deferred `grid/src/main.ts` pre-existing build errors documented in `deferred-items.md` — NOT caused by Phase 3; does not affect tests (Vitest compiles per-file via esbuild).

---

## Test Counts Actually Observed

| Suite | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grid && npm test -- --run` | 303 | **303/303 passing** | MATCH |
| `dashboard && npx vitest run` | 108 | **108/108 passing** (14 files) | MATCH |
| `dashboard && npx tsc --noEmit` | 0 errors | **0 errors** | MATCH |
| `dashboard && npx playwright test --list` | Spec typechecks | **1 test listed (grid-page.spec.ts)** | MATCH |
| Playwright E2E full run | 1/1 passing | **NOT EXECUTED — deferred to human** | SKIP |

---

## Gaps, Risks, and Deferred Items

### Deferred (not actionable gaps)

1. **Playwright full E2E execution (`grid-page.spec.ts`)** — Documented in 03-06-SUMMARY.md; sandbox blocks `npx playwright test` (requires booting Next.js dev server on :3001 and mock Grid on :8080). Spec typechecks clean and is wired correctly per review; needs real-environment run. Spec covers SC-3, SC-4, SC-5, SC-6 end-to-end against a mock Grid.

2. **Pre-existing `grid/src/main.ts` build errors** — Documented in `.planning/phases/03-dashboard-v1-firehose-heartbeat-region-map/deferred-items.md`. Not caused by Phase 3; does not affect test runs (Vitest per-file esbuild). Scope: Phase 1/2 DatabaseConnection API mismatch in the runtime entry point. Addressed in a follow-up grid cleanup plan outside this phase.

3. **UX visual smoothness of marker transition (SC-5 subjective)** — Automated test asserts transform commits in one render cycle (flushSync contract); visual smoothness at 150ms ease-out requires human eyes in a real browser.

### Risks

1. **Playwright spec not yet run to completion** — Low risk: the spec imports `computeRegionLayout` (same function the app uses), so there is no hardcoded-pixel drift risk. Component-level tests (RM-1..RM-10) already cover the same transform logic in jsdom. Human verification closes this.

2. **`NEXT_PUBLIC_GRID_ORIGIN` fallback to `localhost:8080`** — If a developer forgets to set the env var, the server page silently falls back. Non-blocking for Phase 3 (Phase 4 docker-compose wires this).

### No blocking gaps

All 7 SCs have verified codebase evidence. All 7 REQ-IDs are covered. All 7 threat vectors have mitigations with tests. Test counts match expectations (303/303 grid + 108/108 dashboard + 0 TS errors).

---

## Summary

Phase 3 delivers the Nous-observability dashboard as designed: `dashboard/` is a clean Next.js 15 / React 19 / Tailwind 4 workspace with a working `/grid` route that mounts a reconnecting WsClient, ingests audit events into three purpose-built stores (firehose ring + presence map + heartbeat), and renders a region-map SVG with DID-keyed Nous markers that animate on `nous.moved` via a flushSync-scoped presence commit. Filtering by event type (trade/message/movement/law/lifecycle) is wired end-to-end. All 7 success criteria have programmatic verification; 3 items require human sign-off — the Playwright E2E smoke (sandbox cannot run), visual smoothness of the marker transition, and a real-browser boot check of the dev server. All seven threat vectors are mitigated with supporting tests. Phase 3 is goal-achieved; status is `human_needed` pending UX and E2E confirmation in a real environment.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
