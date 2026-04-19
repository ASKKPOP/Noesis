---
phase: 4
slug: nous-inspector-economy-docker-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
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
| _tbd_ | _planner fills_ | _planner fills_ | NOUS-01 / NOUS-02 / NOUS-03 / ECON-01 / ECON-02 / ECON-03 | T-4-XX | _expected secure behavior or "N/A"_ | unit / integration / smoke | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Required REQ-ID coverage** (every ID below MUST appear in at least one row after planning):
- NOUS-01 — Clickable Nous → side panel with Psyche/Telos/Thymos
- NOUS-02 — 5 most recent episodic memories, fetched at open-time
- NOUS-03 — Inspector accessible from firehose + map + roster
- ECON-01 — Ousia balance per Nous, refreshed on `trade.settled`
- ECON-02 — Last 20 completed trades with counterparties/amounts/timestamps
- ECON-03 — Active shops with their listings

**Required integrity tests (SC-7 Phase Goal):**
- Chain-hash determinism regression: 100-tick sim, hash unchanged when observers attached (grid)
- Broadcast allowlist frozen: snapshot test of `broadcast-allowlist.ts` Set contents (grid)
- Listener try/catch isolation: thrown listener cannot crash append (grid, already covered Phase 1 — re-run)
- `app.close()` clean shutdown: Fastify server closes WS connections without unhandled errors (grid)

---

## Wave 0 Requirements

Authored by planner in the earliest wave. If any Per-Task row's "File Exists" is ❌ W0, the referenced file must be created here.

- [ ] `grid/test/unit/shop-registry.test.ts` — ShopRegistry stubs per D7
- [ ] `grid/test/integration/trade-settlement.test.ts` — NousRunner.trade_request → trade.settled emission + balance transfer
- [ ] `grid/test/integration/introspection-proxy.test.ts` — `/api/v1/nous/:did/introspect` route + brain RPC mocking
- [ ] `brain/tests/test_get_state_widening.py` — backward-compat + new Psyche/Thymos/Telos/memory_highlights fields
- [ ] `dashboard/src/lib/stores/selection-store.test.ts` — SelectionStore singleton + hash sync + clear
- [ ] `dashboard/src/app/grid/inspector-sections/__tests__/*.test.tsx` — one test file per sub-panel (Psyche, Telos, Thymos, Memory)
- [ ] `dashboard/src/app/grid/economy/__tests__/*.test.tsx` — balance, trades, shops rendering + trade.settled invalidation
- [ ] `dashboard/src/app/grid/__tests__/tab-bar.test.tsx` — tab switching + `?tab=economy` URL sync
- [ ] `docker/test/smoke-compose.sh` (optional) — `docker compose up -d && curl grid health && curl dashboard health` tear-down
- [ ] `dashboard/src/app/api/dash/health/route.ts` + test — static `{ok:true}` handler

*If none exist after planning: planner must either create these Wave-0 plans or justify "existing infrastructure covers" per requirement.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full `docker compose up` smoke from clean checkout | SC-6 | Sandbox cannot run Docker; requires developer/CI host | 1) `git clean -fdx`, 2) `docker compose up`, 3) verify grid healthy, 4) browse `http://localhost:3001/grid`, 5) verify WS connects first try, 6) click a Nous marker — drawer opens, 7) switch to Economy tab — panel renders |
| Inspector UX smoothness (focus trap, ESC closes, URL hash stable) | NOUS-01, NOUS-03 | Keyboard + screen-reader validation cannot be scripted in jsdom at this fidelity | Open drawer via keyboard nav from firehose row, verify focus lands inside drawer, ESC closes and restores focus to trigger, reload with `#nous=...` hash re-opens |
| Playwright E2E of tab-bar + drawer | NOUS-01..03, ECON-01..03 | Sandbox blocked Playwright in Phase 3; carry-forward to developer/CI | Plans may include a Playwright smoke file gated behind `SKIP_E2E=0` env var |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (tests must be `--run` / `-q` for deterministic CI)
- [ ] Feedback latency < 90s per workspace
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills table

**Approval:** pending

---

*Validation strategy scaffolded 2026-04-18 by /gsd-plan-phase step 5.5 from template. Planner populates task rows; executor updates Status.*
