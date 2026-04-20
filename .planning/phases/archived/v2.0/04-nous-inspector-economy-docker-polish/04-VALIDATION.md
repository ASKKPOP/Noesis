---
phase: 4
slug: nous-inspector-economy-docker-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
updated: 2026-04-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Planner fills the Per-Task Verification Map as plans are authored; executor updates the Status column.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | vitest 4.1 (dashboard + grid TS), pytest 8.x (brain), tsc for type-check |
| **Config files** | `dashboard/vitest.config.ts`, `grid/vitest.config.ts`, `brain/pyproject.toml`, `dashboard/tsconfig.json` |
| **Quick run commands** | Dashboard: `cd dashboard && npm run test -- --run` · Grid: `cd grid && npm run test -- --run` · Brain: `cd brain && uv run pytest -q` · Types: `cd dashboard && npm run typecheck`, `cd grid && npm run typecheck` |
| **Full suite command** | `./scripts/test-all.sh` (if exists) else three workspace `npm run test -- --run` runs + brain pytest |
| **Estimated runtime** | ~60s per workspace quick run · ~3min for full suite across all three workspaces |

---

## Sampling Rate

- **After every task commit:** Run the workspace-specific quick run that owns the file(s) edited (dashboard → `npm run test`, grid → `npm run test`, brain → `uv run pytest`). If a task touches multiple workspaces, run each.
- **After every plan wave:** Run full workspace suite for any workspace touched in the wave, plus `tsc --noEmit` for TS workspaces.
- **Before `/gsd-verify-work`:** All three suites green + tsc clean + any Playwright smoke the plans declare (deferred to CI per D13).
- **Max feedback latency:** 90 seconds per workspace quick run.

---

## Per-Task Verification Map

> Planner populates this table when authoring PLAN.md files. Every task MUST map to at least one automated verify OR a Wave-0 dependency that adds the missing test file.
> Status column is updated by the executor and `/gsd-verify-work`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 04-01 | 1 | ECON-01, ECON-03 | T-04-01, T-04-02, T-04-03 | ShopRegistry rejects unknown seller DID; transferOusia enforces non-negative balance invariant | unit | `cd grid && npm run test -- --run test/unit/shop-registry.test.ts` | ✅ (W0) | ⬜ pending |
| 01-T2 | 04-01 | 1 | ECON-01, ECON-02 | T-04-04, T-04-05 | trade_request validates counterparty exists, amount > 0, nonce unique; emits trade.settled event | integration | `cd grid && npm run test -- --run test/integration/trade-settlement.test.ts` | ✅ (W0) | ⬜ pending |
| 01-T3 | 04-01 | 1 | ECON-03 | T-04-06 | Sample shops registered at genesis; registry immutable after boot | unit | `cd grid && npm run test -- --run test/unit/genesis-shops.test.ts` | ✅ | ⬜ pending |
| 02-T1 | 04-02 | 1 | NOUS-01, NOUS-02 | T-04-07, T-04-08 | BrainHandler.get_state returns widened payload with psyche/telos/thymos/memory_highlights; DID scoping prevents cross-nous leakage | unit | `cd brain && uv run pytest -q tests/test_get_state_widening.py` | ✅ (W0) | ⬜ pending |
| 02-T2 | 04-02 | 1 | NOUS-01, NOUS-02 | T-04-09 | main.py wires per-DID memory + identity; handler construction rejects missing DID | unit | `cd brain && uv run pytest -q tests/test_main_construction.py` | ✅ | ⬜ pending |
| 03-T1 | 04-03 | 2 | NOUS-01, NOUS-03 | T-04-10, T-04-11, T-04-12 | `/api/v1/grid/nous` + `/api/v1/nous/:did/state` return typed discriminated errors (404 unknown-did, 502 brain-unreachable); no stack traces leaked | integration | `cd grid && npm run test -- --run test/integration/introspection-proxy.test.ts` | ✅ (W0) | ⬜ pending |
| 03-T2 | 04-03 | 2 | ECON-01, ECON-02, ECON-03 | T-04-13, T-04-14, T-04-15, T-04-16, T-04-17 | Trades/shops endpoints: timestamps in INTEGER Unix seconds (W2 contract, `< 10_000_000_000`); pagination capped at 20; counterparty DIDs redacted if private | integration | `cd grid && npm run test -- --run test/integration/economy-routes.test.ts` | ✅ | ⬜ pending |
| 04-T1 | 04-04 | 1 | NOUS-01, NOUS-03 | T-04-18, T-04-19 | SelectionStore singleton exposes stable `getSnapshot`; clear() resets to null; useSelection subscribes via useSyncExternalStore (tear-free) | unit | `cd dashboard && npm run test -- --run src/lib/stores/selection-store.test.ts` | ✅ (W0) | ⬜ pending |
| 04-T2 | 04-04 | 1 | NOUS-03 | T-04-20 | useHashSync rejects non-DID hash payloads; bidirectional sync without infinite loops (push + popstate dedup) | unit | `cd dashboard && npm run test -- --run src/lib/hooks/use-hash-sync.test.ts` | ✅ | ⬜ pending |
| 04-T3 | 04-04 | 1 | NOUS-01, NOUS-03, ECON-01, ECON-02, ECON-03 | T-04-20b | Shared primitives (Chip/EmptyState/MeterRow) at `dashboard/src/components/primitives/` with barrel; zero consumers of `@/app/grid/inspector/primitives` | unit | `cd dashboard && npm run test -- --run src/components/primitives/__tests__` && grep -r "@/app/grid/inspector/primitives" dashboard/src/ \| wc -l \| grep -qx "0" | ✅ | ⬜ pending |
| 04-T4 | 04-04 | 1 | NOUS-03 | T-04-21 | TabBar syncs `?tab=economy` URL param; grid-client renders tab via next/navigation without full reload | unit | `cd dashboard && npm run test -- --run src/app/grid/__tests__/tab-bar.test.tsx` | ✅ (W0) | ⬜ pending |
| 05-T1 | 04-05 | 3 | NOUS-01, NOUS-02 | T-04-22, T-04-23 | fetchNousState returns discriminated `{ok:true;data} \| {ok:false;error}`; network/parse errors surfaced as typed error, not thrown | unit | `cd dashboard && npm run test -- --run src/lib/api/fetch-nous-state.test.ts` | ✅ | ⬜ pending |
| 05-T2 | 04-05 | 3 | NOUS-01, NOUS-02 | T-04-24, T-04-25, T-04-27 | Four inspector sub-sections render under D15 paths `components/inspector-sections/*.tsx`; Memory section converts timestamp × 1000 before Date() (W2 contract); `timestamp: 1700000000` renders a 2023 date, NOT 1970 | unit | `cd dashboard && npm run test -- --run src/app/grid/components/inspector-sections/__tests__` | ✅ (W0) | ⬜ pending |
| 05-T3 | 04-05 | 3 | NOUS-01, NOUS-03 | T-04-26 | Inspector drawer at `components/inspector.tsx` manages fetch lifecycle, WAI-ARIA focus trap, ESC close restores focus to trigger | unit | `cd dashboard && npm run test -- --run src/app/grid/components/__tests__/inspector.test.tsx` | ✅ | ⬜ pending |
| 06-T1 | 04-06 | 3 | ECON-01, ECON-02, ECON-03 | T-04-28, T-04-29 | fetchRoster/fetchTrades/fetchShops wrappers use typed `{ok,data} \| {ok,error}` shape; never throw on HTTP errors; import `TradeRecord` with W2 timestamp-seconds contract | unit | `cd dashboard && npm run test -- --run src/lib/api/fetch-economy.test.ts` | ✅ | ⬜ pending |
| 06-T2 | 04-06 | 3 | ECON-01, ECON-02, ECON-03 | T-04-30, T-04-31, T-04-33 | BalancesTable/TradesTable/ShopsList import primitives from `@/components/primitives` only; TradesTable applies `timestamp * 1000` per W2; `timestamp: 1700000000` does NOT render '1970' | unit | `cd dashboard && npm run test -- --run src/app/grid/economy/__tests__` && grep -r "@/app/grid/inspector/primitives" dashboard/src/app/grid/economy/ \| wc -l \| grep -qx "0" | ✅ (W0) | ⬜ pending |
| 06-T3 | 04-06 | 3 | ECON-01, ECON-02, ECON-03 | T-04-32 | EconomyPanel gates on `?tab=economy`; invalidates queries on `trade.settled` event from WS feed | unit | `cd dashboard && npm run test -- --run src/app/grid/economy/__tests__/economy-panel.test.tsx` | ✅ | ⬜ pending |
| 07-T1 | 04-07 | 4 | SC-6 | T-04-34, T-04-35 | `/api/dash/health` returns static `{ok:true}` with 200; Next standalone output config emits `.next/standalone/` for Docker copy | unit | `cd dashboard && npm run test -- --run src/app/api/dash/health/__tests__/route.test.ts` | ✅ (W0) | ⬜ pending |
| 07-T2 | 04-07 | 4 | SC-6 | T-04-36, T-04-37, T-04-38 | Dockerfile multi-stage: `ARG NEXT_PUBLIC_GRID_ORIGIN` + `ENV NEXT_PUBLIC_GRID_ORIGIN` both appear BEFORE `RUN npm run build` (W3 grep line-order check); optional live build gated on `command -v docker` | smoke | `bash -c 'arg_line=$(grep -n "^ARG NEXT_PUBLIC_GRID_ORIGIN" docker/Dockerfile.dashboard \| cut -d: -f1); env_line=$(grep -n "^ENV NEXT_PUBLIC_GRID_ORIGIN" docker/Dockerfile.dashboard \| cut -d: -f1); build_line=$(grep -n "^RUN npm run build" docker/Dockerfile.dashboard \| cut -d: -f1); test -n "$arg_line" && test -n "$env_line" && test -n "$build_line" && test "$arg_line" -lt "$build_line" && test "$env_line" -lt "$build_line"'` | ✅ | ⬜ pending |
| 07-T3 | 04-07 | 4 | SC-6 | T-04-39 | docker-compose.yml dashboard service declares depends_on grid + healthcheck; `.env.example` documents required NEXT_PUBLIC_GRID_ORIGIN; compose config validates (sandbox-optional) | smoke | `bash -c 'grep -E "^[[:space:]]+dashboard:" docker/docker-compose.yml && grep -E "NEXT_PUBLIC_GRID_ORIGIN" docker/.env.example && (command -v docker >/dev/null 2>&1 && docker compose -f docker/docker-compose.yml config >/dev/null 2>&1 \|\| echo "docker CLI absent — SKIPPED")'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity audit:** No 3 consecutive tasks without automated verify — every row above has an `<automated>` command. ✅

**Required REQ-ID coverage** (every ID below MUST appear in at least one row after planning):
- NOUS-01 — Clickable Nous → side panel with Psyche/Telos/Thymos → rows 02-T1, 02-T2, 03-T1, 04-T1, 04-T3, 05-T1, 05-T2, 05-T3 ✅
- NOUS-02 — 5 most recent episodic memories, fetched at open-time → rows 02-T1, 02-T2, 03-T1, 05-T1, 05-T2 ✅
- NOUS-03 — Inspector accessible from firehose + map + roster → rows 03-T1, 04-T1, 04-T2, 04-T3, 04-T4, 05-T3 ✅
- ECON-01 — Ousia balance per Nous, refreshed on `trade.settled` → rows 01-T1, 01-T2, 03-T2, 04-T3, 06-T1, 06-T2, 06-T3 ✅
- ECON-02 — Last 20 completed trades with counterparties/amounts/timestamps → rows 01-T2, 03-T2, 04-T3, 06-T1, 06-T2, 06-T3 ✅
- ECON-03 — Active shops with their listings → rows 01-T1, 01-T3, 03-T2, 04-T3, 06-T1, 06-T2, 06-T3 ✅

**Required integrity tests (SC-7 Phase Goal):**
- Chain-hash determinism regression: 100-tick sim, hash unchanged when observers attached (grid) — covered by existing Phase 1 test re-run in pre-verify sweep
- Broadcast allowlist frozen: snapshot test of `broadcast-allowlist.ts` Set contents (grid) — existing Phase 2 snapshot re-run
- Listener try/catch isolation: thrown listener cannot crash append (grid, already covered Phase 1 — re-run)
- `app.close()` clean shutdown: Fastify server closes WS connections without unhandled errors (grid) — existing Phase 2 test re-run

---

## Wave 0 Requirements

Authored by planner in the earliest wave. If any Per-Task row's "File Exists" is ❌ W0, the referenced file must be created here. Below marked ✅ are created by plans in Wave 1/2 RED tasks before any GREEN implementation.

- [x] `grid/test/unit/shop-registry.test.ts` — ShopRegistry stubs per D7 → authored in 04-01 Task 1 RED step
- [x] `grid/test/integration/trade-settlement.test.ts` — NousRunner.trade_request → trade.settled emission + balance transfer → authored in 04-01 Task 2 RED step
- [x] `grid/test/integration/introspection-proxy.test.ts` — `/api/v1/nous/:did/introspect` route + brain RPC mocking → authored in 04-03 Task 1 RED step
- [x] `brain/tests/test_get_state_widening.py` — backward-compat + new Psyche/Thymos/Telos/memory_highlights fields → authored in 04-02 Task 1 RED step
- [x] `dashboard/src/lib/stores/selection-store.test.ts` — SelectionStore singleton + hash sync + clear → authored in 04-04 Task 1 RED step
- [x] `dashboard/src/app/grid/components/inspector-sections/__tests__/*.test.tsx` — one test file per sub-panel (Psyche, Telos, Thymos, Memory) → authored in 04-05 Task 2 RED step (D15 path)
- [x] `dashboard/src/app/grid/economy/__tests__/*.test.tsx` — balance, trades, shops rendering + trade.settled invalidation → authored in 04-06 Task 2 RED step
- [x] `dashboard/src/app/grid/__tests__/tab-bar.test.tsx` — tab switching + `?tab=economy` URL sync → authored in 04-04 Task 4 RED step
- [ ] `docker/test/smoke-compose.sh` (optional) — `docker compose up -d && curl grid health && curl dashboard health` tear-down — deferred to CI per D13 (sandbox cannot run docker daemon)
- [x] `dashboard/src/app/api/dash/health/route.ts` + test — static `{ok:true}` handler → authored in 04-07 Task 1 RED step

*All non-deferred Wave-0 files are created in-plan by their respective RED steps. Docker smoke script is explicitly manual-only per D13.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full `docker compose up` smoke from clean checkout | SC-6 | Sandbox cannot run Docker daemon; requires developer/CI host | 1) `git clean -fdx`, 2) `docker compose up`, 3) verify grid healthy, 4) browse `http://localhost:3001/grid`, 5) verify WS connects first try, 6) click a Nous marker — drawer opens, 7) switch to Economy tab — panel renders |
| Inspector UX smoothness (focus trap, ESC closes, URL hash stable) | NOUS-01, NOUS-03 | Keyboard + screen-reader validation cannot be scripted in jsdom at this fidelity | Open drawer via keyboard nav from firehose row, verify focus lands inside drawer, ESC closes and restores focus to trigger, reload with `#nous=...` hash re-opens |
| Playwright E2E of tab-bar + drawer | NOUS-01..03, ECON-01..03 | Sandbox blocked Playwright in Phase 3; carry-forward to developer/CI | Plans may include a Playwright smoke file gated behind `SKIP_E2E=0` env var |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every row has automated command)
- [x] Wave 0 covers all MISSING references (all created in-plan RED steps; only Docker smoke deferred per D13)
- [x] No watch-mode flags (all tests use `--run` / `-q` for deterministic CI)
- [x] Feedback latency < 90s per workspace
- [x] `nyquist_compliant: true` set in frontmatter after planner fills table

**Approval:** ready for execution

---

*Validation strategy scaffolded 2026-04-18 by /gsd-plan-phase step 5.5 from template. Per-task rows populated 2026-04-18 in revision pass (B2 resolution). Executor updates Status column during execution.*
