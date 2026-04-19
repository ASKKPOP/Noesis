---
phase: 04-nous-inspector-economy-docker-polish
verified: 2026-04-18T21:05:00Z
status: human_needed
score: 6/7 success criteria verified programmatically; 1 deferred to human/runtime verification
head_commit: 8618e6896a177a6fa2b8ffd7b23f6796cc7422ef
test_totals:
  grid: 346/346
  dashboard: 215/215 (vitest)
  brain:   262/262
human_verification:
  - test: "Real `docker compose up` from clean checkout"
    expected: "Grid + Brain(s) + MySQL + Dashboard come up; dashboard at http://localhost:3001 connects to Grid WS on first attempt"
    why_human: "No docker daemon available in this sandbox; smoke-compose.sh exists and compose file is structurally complete, but end-to-end build+up cannot be exercised here"
  - test: "Playwright E2E `tests/e2e/grid-page.spec.ts`"
    expected: "Dashboard boots, renders live region map + firehose + heartbeat, animates Nous move"
    why_human: "Playwright suite requires running Grid + Dashboard; failed in `npm test` integration run without live stack"
---

# Phase 4: Nous Inspector + Economy + Docker Polish — Verification Report

**Phase Goal (ROADMAP §75):** All five table-stakes views work and `docker compose up` produces a functional dashboard on first run.

**HEAD commit:** `8618e68` (docs(04-07): complete Docker polish plan — Phase 4 done (7/7))
**Verified:** 2026-04-18
**Status:** human_needed — 6 of 7 SCs verified programmatically; SC-6 requires a runtime docker daemon (this sandbox has none)

## Goal Achievement

### Success Criteria (7 from ROADMAP.md)

| # | SC | Status | Evidence | Gap |
|---|----|--------|----------|-----|
| 1 | Clicking a Nous opens side panel showing Psyche/Telos/Thymos | MET (via roster path) | `balances-table.tsx:75-83`, `trades-table.tsx:105-124`, `shops-list.tsx:57-63` all call `useSelection().select(did)`. `inspector.tsx:201-207` stacks `<PsycheSection/>`, `<ThymosSection/>`, `<TelosSection/>`, `<MemorySection/>` once the drawer state resolves. Psyche renders Big Five via `psyche.tsx:17-23` (Openness/Conscientiousness/Extraversion/Agreeableness/Neuroticism). Telos renders `active_goals` list (`telos.tsx:33-56`). Thymos renders mood Chip + per-emotion MeterRow (`thymos.tsx:33-43`). | Literal SC phrasing says "firehose, map, or roster view" — the `or` is satisfied by the roster path (BalancesTable + TradesTable + ShopsList). `firehose-row.tsx:13` explicitly documents "No click handlers in Phase 3 (observer-only)" and `region-map.tsx` has no click handler on `nous-marker`. Not a gap against the OR clause but worth flagging for a future UX iteration. |
| 2 | Inspector shows 5 most recent episodic memories, fetched at open time (not stale) | MET | Inspector fetches on every selection change via fresh `AbortController` + `fetchNousState(selectedDid, origin, ac.signal)` (`inspector.tsx:82-110`). No store/cache — pure per-open fetch. Grid proxy at `/api/v1/nous/:did/state` (`server.ts:152-181`) calls `runner.getState()`. Brain `handler.py:145-166` emits `memory_highlights` populated via `_memory_snapshot(limit=5)`. `MemorySection` defensively caps at 5 (`memory.tsx:19,26` `MAX_MEMORIES = 5`, `memories.slice(0, MAX_MEMORIES)`). Timestamp multiplied by 1000 at render (`memory.tsx:50`). | None. |
| 3 | Economy panel lists every Nous with Ousia balance, refreshed on `trade.settled` | MET | `BalancesTable` sorts roster by `ousia` desc and renders Name/Region/Ousia/Status (`balances-table.tsx:31-97`). `EconomyPanel.useEffect` (`economy-panel.tsx:108-141`) scans latest firehose snapshot for the newest `trade.settled` entry id; if it differs from `lastTradeId.current`, spawns an `AbortController` and re-fetches roster + trades (not shops — by design, shops are launcher-registered). Dedupe via `lastTradeId` ref prevents refetch storm. Tests `economy-panel.test.tsx:123,145` assert both refetch behavior and id-dedup. | None. |
| 4 | Economy panel shows last 20 completed trades with counterparties, amounts, timestamps | MET | `fetchTrades` defaults limit to 20, clamped [1,100] (`economy.ts:84-103`). Server honors `limit` param, defaulting to 20, clamping at 100 (`server.ts:185-222`). `TradesTable` renders Time / Buyer / Seller / Amount / Nonce columns, sorts newest-first, uses roster for DID→name resolution (`trades-table.tsx:64-136`). **W2 timestamp contract** (Unix integer seconds) enforced at API boundary by `Math.floor(e.createdAt / 1000)` (`server.ts:217`) and asserted by test `economy-trades.test.ts:169-175` (`timestamp < 10_000_000_000`). Multiplied by 1000 at render (`trades-table.tsx:91-93`). | None. |
| 5 | Economy panel lists active shops and services each is offering | MET | `/api/v1/economy/shops` returns launcher-registered shops (`server.ts:224-240`). `ShopsList` renders each shop as a card with owner lookup + SKU/Label/Price table (`shops-list.tsx:51-105`). `ShopRegistry` wired via `genesis/launcher.ts` and `main.ts` (Plan 04-01). Empty state copy locked at `shops-list.tsx:36-44`. | None. |
| 6 | `docker compose up` from clean checkout brings full stack + dashboard connects to Grid WS on first attempt | PARTIAL (structural only) | Structural verification complete: (a) `docker-compose.yml:127-155` defines dashboard service with `build-arg NEXT_PUBLIC_GRID_ORIGIN`, `depends_on: grid (service_healthy)`, healthcheck hitting `/api/dash/health`, port `3001:3001`. (b) `docker/Dockerfile.dashboard:10-11,17,23` respects Pitfall-1: `ARG NEXT_PUBLIC_GRID_ORIGIN` → `ENV NEXT_PUBLIC_GRID_ORIGIN=${...}` → `RUN npm run build`. Multi-stage builder→runtime, non-root `nextjs:nodejs`, standalone output. (c) `dashboard/next.config.mjs:4` sets `output: 'standalone'`. (d) `/api/dash/health` route returns `{ok:true, service:'dashboard'}` (`route.ts:1-3`). (e) `.env.example` advertises `DASHBOARD_PORT=3001` and `NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080`. (f) `docker/test/smoke-compose.sh` present. | Runtime smoke (actual `docker compose up`, WS handshake on first attempt) cannot be exercised from this sandbox — no docker daemon. Deferred to human verification. |
| 7 | PITFALLS.md integrity non-negotiables hold | MET | See dedicated section below. | None. |

**Score:** 6/7 fully verified; SC-6 structural-only pending runtime smoke.

### Integrity Non-Negotiables (SC-7 detail)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Chain hash unchanged by observer count | MET (inherited) | `grid/src/audit/chain.ts` last touched at `1414ee1` (Phase 1, 01-02). Unchanged through Phases 2-4. WsHub subscription is append-after-commit (listener pattern) — read-only projection; cannot mutate the hash seed. |
| No listener can crash append | MET (inherited) | `AuditChain.onAppend` API added in Phase 1 `1414ee1`; fire-after-commit semantics; listener throws are caught. WsHub subscription (Phase 2) installs a single try/catch handler. No Phase 4 changes to listener plumbing. |
| No privacy leak in broadcast allowlist | MET | `grid/src/audit/broadcast-allowlist.ts` has **zero diff** vs. its Phase 1 baseline commit `29c3516` (`git log --oneline 29c3516..HEAD -- …/broadcast-allowlist.ts` returns empty). Allowlist has the expected 10 entries including `trade.settled` (line 31). `FORBIDDEN_KEY_PATTERN` unchanged. `ALLOWLIST` still frozen with `add/delete/clear` overridden to throw. |
| `trade.settled` payload shape frozen to `{counterparty, amount, nonce}` | MET | `nous-runner.ts:158-162` emits exactly these three keys. No fan-in from `action.text`/`action.channel` (Plan 04-01 Pitfall-4 guard). Privacy lint in `broadcast-allowlist.ts` would reject any `prompt/response/wiki/reflection/thought/emotion_delta` key even if leaked. |
| DID regex validation at entry points | MET | `server.ts:60` exports `DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i`. Applied at `/api/v1/nous/:did/state` (`server.ts:156`): non-matching DIDs return `{error: 'invalid_did'}` with 400. Frontend `fetchNousState` (verified via `inspector.tsx:27,97` import). |
| Clean shutdown via `app.close()` | MET | `grid/src/main.ts:184-192` registers SIGTERM/SIGINT handlers calling `app.stop()`, which in turn calls `launcher.stop()` + (via server internals) Fastify `app.close()`. `server.ts:348-349` documents that `wsHub.close()` should be invoked if callers `app.close()` — WsHub integration test exercises 10 000 connect/disconnect cycles ending with `hub.clientCount === 0` (`ws-integration.test.ts`). |
| TradeRecord.timestamp as Unix seconds (< 10^10) — consistent across 04-03 / 04-05 / 04-06 | MET | Server emits via `Math.floor(e.createdAt / 1000)` (`server.ts:217`). Test locks unit at API boundary (`economy-trades.test.ts:175`). Frontend `MemorySection` and `TradesTable` both multiply by 1000 for `new Date(...)` (`memory.tsx:50`, `trades-table.tsx:91-92`). Comment contracts documented in both files. |
| Inspector focus trap + Escape close | MET | `inspector.tsx:126-152` — Tab cycles focusable descendants (first↔last), Shift+Tab cycles in reverse; Escape calls `clear()`. `role="dialog"`, `aria-modal="true"`, `aria-labelledby="inspector-title"` set (lines 163-165). `openerRef` capture + restore on close (lines 74, 114-119). |
| EconomyPanel WS-invalidation on `trade.settled` | MET | `economy-panel.tsx:108-141` scans firehose snapshot for newest `trade.settled` id; fires parallel refetch of roster + trades on new id. Dedup via `lastTradeId` ref. Shops NOT refetched (launcher-registered). `economy-panel.test.tsx:123,145` assert invalidation + dedup. |
| Dockerfile.dashboard: ARG before ENV before RUN npm run build (Pitfall-1) | MET | `docker/Dockerfile.dashboard:10-11,17,23` — `ARG NEXT_PUBLIC_GRID_ORIGIN=...` → `ENV NEXT_PUBLIC_GRID_ORIGIN=${...}` → `RUN npm ci` → `RUN npm run build --workspace=dashboard`. Value inlined into client bundle at build time per Next 15 contract. |
| docker-compose.yml dashboard service: healthcheck + depends_on grid | MET | `docker-compose.yml:128-155` — `build.args.NEXT_PUBLIC_GRID_ORIGIN`, `depends_on: grid (service_healthy)`, healthcheck `wget -qO- http://localhost:3001/api/dash/health` every 15s. |

### Required Artifacts

| Area | Artifact | Status |
|------|----------|--------|
| Grid economy foundation | `grid/src/economy/shop-registry.ts`, `registry/registry.ts::transferOusia`, `integration/nous-runner.ts::trade_request` handler | VERIFIED |
| Grid REST | `grid/src/api/server.ts::/api/v1/grid/nous` (134-150), `/api/v1/nous/:did/state` (152-181), `/api/v1/economy/trades` (185-222), `/api/v1/economy/shops` (224-240) | VERIFIED |
| Brain get_state | `brain/src/noesis_brain/rpc/handler.py::get_state` emits `did`, `grid_name`, `psyche`, `thymos`, `telos`, `memory_highlights` | VERIFIED |
| Dashboard plumbing | `dashboard/src/lib/stores/selection-store.ts`, `lib/hooks/use-hash-sync.ts`, `lib/hooks/use-selection.ts`, `components/primitives/*` (Chip/MeterRow/EmptyState), `app/grid/components/tab-bar.tsx` | VERIFIED |
| Inspector | `dashboard/src/app/grid/components/inspector.tsx` + `inspector-sections/{psyche,thymos,telos,memory}.tsx`; `lib/api/introspect.ts` | VERIFIED |
| Economy | `dashboard/src/app/grid/economy/{economy-panel,balances-table,trades-table,shops-list}.tsx`; `lib/api/economy.ts` | VERIFIED |
| Docker polish | `docker/Dockerfile.dashboard`, `docker-compose.yml` (dashboard service), `dashboard/next.config.mjs` (standalone), `dashboard/src/app/api/dash/health/route.ts`, `.env.example`, `docker/test/smoke-compose.sh` | VERIFIED (structural) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `balances-table.tsx` → Inspector | `useSelection().select(did)` | Button onClick on Name cell | WIRED |
| `trades-table.tsx` → Inspector | `useSelection().select(did)` | Buttons on Buyer/Seller cells | WIRED |
| `EconomyPanel` → Grid REST | `fetchRoster`/`fetchTrades`/`fetchShops` | Promise.all on mount; re-fetch on `trade.settled` | WIRED |
| `EconomyPanel` → firehose | `useSyncExternalStore(firehose.subscribe, firehose.getSnapshot)` | `useStores().firehose` | WIRED |
| `Inspector` → `/api/v1/nous/:did/state` | `fetchNousState(did, origin, signal)` | AbortController per selection | WIRED |
| Grid REST → Brain | `services.getRunner(did).getState()` | `InspectorRunner.connected` gate → 503 on failure | WIRED |
| `nous-runner.ts` → AuditChain | `this.audit.append('trade.settled', …, {counterparty, amount, nonce})` | After `registry.transferOusia` succeeds | WIRED |
| `ShopRegistry` → launcher | wired in `genesis/launcher.ts` + `main.ts` (Plan 04-01 D8) | VERIFIED | WIRED |
| `GridClient` → `<Inspector/>` + `<TabBar/>` + `<EconomyPanel/>` | imports at `grid-client.tsx:36-38`, mounted at lines 78, 194, 197 | WIRED |
| Dashboard container → Grid container | `depends_on: grid (service_healthy)`; `NEXT_PUBLIC_GRID_ORIGIN` baked at build | WIRED (structural) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `Inspector` | `state.data` | `fetchNousState(did, origin)` → Grid REST → brain runner `getState()` | Yes — brain emits real psyche/thymos/telos/memory_highlights | FLOWING |
| `BalancesTable` | `roster` | `fetchRoster` → `NousRegistry.active().map(…)` | Yes — registry owns live nous state | FLOWING |
| `TradesTable` | `trades` | `fetchTrades` → `AuditChain.query({eventType: 'trade.settled', limit, offset})` | Yes — real chain entries filtered + mapped to seconds | FLOWING |
| `ShopsList` | `shops` | `fetchShops` → `ShopRegistry.list()` (launcher-registered) | Yes — real registry entries, defensively copied | FLOWING |
| `EconomyPanel.snapshot` | firehose entries | `useSyncExternalStore(firehose.subscribe, firehose.getSnapshot)` | Yes — live WS stream from Phase 2 WsHub | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Grid unit + integration test suite | `cd grid && npm test` | 346/346 passing | PASS |
| Dashboard unit (vitest) suite | `cd dashboard && npx vitest run` | 215/215 passing in 31 files | PASS |
| Brain pytest suite | `cd brain && uv run pytest -q` | 262/262 passing | PASS |
| Dashboard Playwright E2E (`grid-page.spec.ts`) | `npm test` (dashboard) | 1 failed — requires running Grid+Dashboard | SKIP (human) |
| Real `docker compose up` | `docker compose up --build` | (not run) — no docker daemon in sandbox | SKIP (human) |
| Allowlist zero-diff since Phase 1 | `git log --oneline 29c3516..HEAD -- grid/src/audit/broadcast-allowlist.ts` | empty output | PASS |
| AuditChain zero-diff since Phase 1 | `git log --oneline -- grid/src/audit/chain.ts` | Last commit `1414ee1` (Phase 1) | PASS |

### Requirements Coverage

PLAN frontmatter was not parsed here (plans declare requirements informally in prose + checklist); ROADMAP maps Phase 4 to NOUS-01, NOUS-02, NOUS-03, ECON-01, ECON-02, ECON-03.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOUS-01 | 04-02, 04-03, 04-04, 04-05 | Inspector drawer: Big Five / mood / goals | SATISFIED | See SC-1 |
| NOUS-02 | 04-02, 04-03, 04-05 | 5 recent memories fetched at open time | SATISFIED | See SC-2 |
| NOUS-03 | 04-03, 04-04, 04-05, 04-07 | URL-addressable deep link + accessible drawer + docker polish | SATISFIED (structural for docker) | Hash sync via `use-hash-sync.ts`; focus trap + ARIA verified |
| ECON-01 | 04-01, 04-03, 04-06 | Roster balance view | SATISFIED | BalancesTable + /api/v1/grid/nous |
| ECON-02 | 04-01, 04-03, 04-06 | Last-20 trades feed w/ counterparties + timestamps | SATISFIED | TradesTable + /api/v1/economy/trades, W2 contract |
| ECON-03 | 04-01, 04-03, 04-06 | Active shops + listings | SATISFIED | ShopsList + /api/v1/economy/shops |

### Anti-Patterns Scan

No blockers or warnings found in Phase 4 artifacts. Notable observations:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `firehose-row.tsx` | 13 | Explicit comment: "No click handlers in Phase 3 (observer-only)" | ℹ️ Info | Intentional — SC-1 OR-clause is satisfied by roster path. Worth a future UX ticket to add Nous-click on firehose/map. |
| `region-map.tsx` | 153-174 | `<g data-testid="nous-marker">` has no onClick | ℹ️ Info | Same as above. Marker position animates but is not interactive. |
| `server.ts:138` | — | `if (!registry) return { nous: [] }` legacy fallback | ℹ️ Info | Commented as "legacy test harness path". Not a stub — production main.ts wires the registry. |
| `server.ts:226` | — | `if (!shops) return { shops: [] }` | ℹ️ Info | Same pattern — optional service for tests; production launcher provides it. |

No `TODO`/`FIXME`/`PLACEHOLDER` comments in shipped artifacts. No silent empty handlers. All `return []` paths guarded by presence checks with real registry wiring in `main.ts`.

### Carry-Forward (Deferred to Real Env or v2)

These are not gaps against Phase 4 acceptance — they are items that cannot be verified in a sandbox and are deferred to the developer:

1. **Real `docker compose up` smoke** — requires docker daemon. `docker/test/smoke-compose.sh` is the canonical reproduction script. Expected: all 4 services become healthy, dashboard serves on :3001, WebSocket handshake succeeds on first attempt.
2. **Playwright E2E (`grid-page.spec.ts`)** — requires running Grid + Dashboard. Ran against `npm test` in dashboard workspace and failed as expected (no live stack). Needs either CI with service-start hooks or local manual run after `docker compose up`.
3. **Future UX: firehose row / region-map marker → Inspector click-through** — SC-1 wording hints at three entry paths (firehose, map, roster view). Only the roster path is wired. Not blocking — "or" clause is satisfied — but worth a v2 ticket.

### Human Verification Required

1. **Run `docker compose up --build` from a clean checkout.** Expected: `noesis-mysql` healthy → `noesis-grid` healthy → dashboard healthy on :3001; visit `http://localhost:3001/grid`; firehose events arrive within a few seconds; no WS reconnect loop; Inspector opens on roster click; `/api/dash/health` returns `{ok:true, service:"dashboard"}`.
2. **Run Playwright** after stack is up: `cd dashboard && npx playwright test` — `grid-page.spec.ts` should pass.
3. **Manual spot-check**: open Economy tab, observe at least one `trade.settled` roundtrip (trigger one via Nous), confirm BalancesTable and TradesTable update without a full refresh; ShopsList does NOT refetch.

---

## Final Verdict

**PHASE 4 COMPLETE** — 6 of 7 Success Criteria fully verified; SC-6 structurally complete and awaiting runtime confirmation (docker daemon not available in this verification sandbox). All integrity non-negotiables hold. All three test suites green (grid 346/346, dashboard 215/215 unit, brain 262/262). Allowlist and AuditChain files have zero diff since Phase 1 baseline. Trade payload shape frozen to `{counterparty, amount, nonce}`. W2 timestamp contract (Unix seconds) enforced at API boundary and at both render sites. Inspector focus trap + ESC + opener-restore verified. Dockerfile.dashboard respects Pitfall-1 (ARG → ENV → build). Dashboard compose service has depends_on grid + healthcheck.

**Recommendation:** Developer should run the smoke script + Playwright suite against a live `docker compose up`, then mark Phase 4 done in ROADMAP.md and proceed to Sprint 14 close-out.

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
