# Nous Spec — Coverage Tracker

**Source of truth for the spec:** `docs/nous_spec.md` (Nous — Autonomous AI Agent Specification).
**Purpose:** one place to see, at a glance, how much of the Nous spec is actually built — so nothing is silently missed. Update this in the same turn whenever a spec item's status changes.

**Last updated:** 2026-06-15 (after Phase 72 tool-use foundation + economic-goal increment).

## Legend

| Mark | Meaning |
|---|---|
| ✅ FULL | Implemented and tested. |
| 🟡 PARTIAL | Present but degraded / not the full spec intent. |
| ❌ MISSING | No implementation. |
| 🔼 | Moved forward this session. |

---

## §1 Identity & Visibility

| Item | Status | Where / gap |
|---|---|---|
| Character (personality, style) | ✅ FULL | `brain/.../psyche/` |
| Rules (sets/manages own rules) | ✅ FULL | `brain/.../learning/rules.py` (RuleStore) |
| Target & Goals — incl. earning money | 🔼 🟡 | `brain/.../telos/`; **economic "earn a living" goal seeded at spawn (2026-06-15)**. Remaining: goals don't self-*evolve* over time. |
| Not Programmed (changes own behavior / creates new rules at runtime) | 🟡 PARTIAL | learns rules reactively; cannot author new goal categories proactively |
| Visibility (choose visible/hidden from other agents) | 🔼 🟡 | **Agent `set_visibility` toggle built (2026-06-16)**: `registry.hiddenFlag` excluded from peer-discovery (`inRegion`) while operators still see it; `nous.visibility_changed` audit (allowlist→106). Remaining: the LLM *deciding when* to hide is activation, like other autonomous actions. |

## §2 Settings

| Item | Status | Where / gap |
|---|---|---|
| Owns a Nous House | ✅ FULL | `grid/.../civic/parcel-registry.ts` |
| Joined Grid | 🟡 PARTIAL | single-grid only; no join/leave or membership list |
| Service Portal Access (search active Grids / orgs / Houses) | 🔼 🟡 | **Discovery endpoint built (2026-06-16)**: `GET /api/v1/portal/discover` lists organizations (Groups) with `?q=`/`?domain=` search + pointer to the open-Houses feed. Remaining: **multi-Grid** "search active *Grids*" (deferred — D-V3-30 single grid). |

## §3 Task & Autonomy Engine

| Item | Status | Where / gap |
|---|---|---|
| Autonomous Drive | 🟡 PARTIAL | `brain/.../ananke/` per-tick drives; reactive, never self-initiates |
| Goal Management | 🔼 🟡 | tracked (incl. economic) + **time-driven evolution built (2026-06-16)**: `TelosManager.evolve(tick)` demotes long-stale, unprogressed goals so attention shifts (economic exempt); called from `on_tick`. Remaining: LLM-driven goal *reframing/creation* (activation; dialogue-refinement path already exists). |
| Reminder & Wake-Up | 🔼 🟡 | **Tick-scheduled + condition-based reminders built (2026-06-16)**: `ReminderStore` + `ReminderCondition` (signal/op/value vs. live drive levels); `brain.scheduleReminder` RPC; `on_tick` fires due reminders (tick OR condition met), recording each to memory so the Nous wakes to it. Plus deterministic sleep/wake (`hypnos`). Mechanism complete — remaining: the LLM *deciding* to set one (activation). |
| Job Scheduler | 🟡 PARTIAL | tick + peer cowork board; no self-scheduled queue |
| Task Plan → Build → QA | 🔼 🟡 | **`TaskRunner` plan→build→QA lifecycle built (Phase 74 Brain slice)** over `run_code`. Remaining: real runs need Docker + live LLM (orchestration unit-tested with fixtures). |
| Reporting with Visualization | 🔼 🟡 | **`ActivityReport` + markdown render built (Phase 74)**. Remaining: live **Grid-side** visualization rides Phase 72b. |

## §4 Research & Connected Resources

| Item | Status | Where / gap |
|---|---|---|
| Skills | ✅ FULL | `brain/.../skills/store.py` |
| Knowledge Base | ✅ FULL | `brain/.../episteme/wiki.py` |
| Web Search | 🔼 ✅ | `web_search` + `web_fetch` (clean extraction) — **verified LIVE 2026-06-17**: a real Nous on Claude searched + fetched + synthesized end-to-end. Default-tick activation still = Phase 72b. |
| Connected Resources | 🟡 PARTIAL | `web_fetch` tool now exists; no pluggable API/DB connectors |
| Local AI + Online | 🟡 PARTIAL | Ollama→Claude fallback; no knowledge-level seamlessness |

## §5 Brain (Local) ↔ Grid (Mirror)

| Item | Status | Where / gap |
|---|---|---|
| Brain is Local | ✅ FULL | local Python process; all cognition local |
| Mirror to Grid | 🟡 PARTIAL | one-way Brain→Grid actions |
| Visualization to Grid | 🟡 PARTIAL | presence/map only; no live render of Brain output |
| Local ↔ Grid sync | 🟡 PARTIAL | event-driven, not continuous |
| Nous Can Program Locally | 🔼 ✅ | `run_code` Docker sandbox — **verified LIVE on real Docker (colima) 2026-06-17**: executes code, kills infinite loops, blocks network, caps memory; a real Nous ran code in it during the agentic loop. Remaining: Grid `tool.code_run` audit mirror = Phase 72b. |

---

## No fully-absent spec items remain

After the Phase 74 Brain slice, **every Nous-spec sub-item is now FULL or PARTIAL — none are absent.** The "Nous-as-builder" arc (Phases 72–74) is built Brain-side. What's left is **activation + the Grid-side mirror**, not missing capability:

- **Phase 72b** — Grid audit mirror (`tool.*` sole-producer) + AAU-learner activation + **live Grid visualization** of activity reports.
- ~~**Verify on Docker**~~ — **DONE 2026-06-17**: colima installed, all sandbox container tests pass, full agentic loop + plan→build→QA verified live with Claude. (Ollama `qwen3:4b` also installed as the local default; key in gitignored `brain/.env`.)
- The notable PARTIALs below remain product decisions, not absences.

## Notable PARTIALs worth deciding on (not absent, but below spec intent)

- ~~Agent-controlled **visibility toggle** (§1)~~ — **built 2026-06-16** (the *when-to-hide* decision is LLM activation)
- ~~**Condition-based** reminders~~ · ~~**goal evolution**~~ (both built 2026-06-16) · **self-initiated tasks** (§3, LLM-gated)
- **Service Portal discovery** (orgs + Houses built 2026-06-16) + **multi-Grid / Joined Grid** (§2) — note: multi-Grid conflicts with D-V3-30 ("v3.0 ships 1 Grid"); resolve before building
- Live **Mirror / Visualization to Grid** (§5)

## Shipped this session (2026-06-15)

- **Phase 72 (Brain slice)** — tool-use loop + `web_search`/`web_fetch` → §4 Web Search/Connected Resources. (Phase 72b carries the Grid audit mirror + AAU-learner activation.)
- **Economic goal** — §1 Target & Goals "earning money" target, seeded at spawn for all Nous.
- **Phase 73 (Brain slice)** — `run_code` Docker sandbox → §5 Nous Can Program Locally. Container exec unverified here (no Docker); container tests `skipif`-guarded, ready to run on a Docker host.
- **Phase 74 (Brain slice)** — `TaskRunner` plan→build→QA lifecycle + `ActivityReport` → §3 Task pipeline + Reporting. Orchestration fixture-tested; real runs need Docker + live LLM; Grid-side report visualization rides Phase 72b.
- **Visibility toggle (2026-06-16)** — §1 Visibility. Brain `ActionType.SET_VISIBILITY` + grid `registry.hiddenFlag` (peer-discovery suppression, operators still see) + `nous.visibility_changed` audit. Brain+grid suites green.
- **Reminder & Wake-Up (2026-06-16)** — §3. `ReminderStore` + `brain.scheduleReminder` RPC; `on_tick` fires due reminders → memory (the Nous wakes to it). Tick-scheduled; condition-based deferred. 8 brain tests.
- **Service Portal discovery (2026-06-16)** — §2. `GET /api/v1/portal/discover` (public) — search organizations (Groups) + Houses feed pointer. `groupStore` wired onto `GridServices` + hoisted in `main.ts`. 4 route tests; grid suite green; tsc clean (also fixed a latent `set_visibility` union type error).
- **Condition-based reminders (2026-06-16)** — §3. `ReminderCondition` (signal/op/value vs. live drive levels); completes the §3 Reminder sentence. 15 brain tests.
- **Goal evolution (2026-06-16)** — §3 Goal Management. `TelosManager.evolve(tick)` demotes stale unprogressed goals (economic exempt); Brain-only + deterministic (telos hash only compared at telos events). 6 tests.
- **Local env + LIVE agentic run (2026-06-17)** — installed Docker (colima) + Ollama (`qwen3:4b`); `build_agentic_registry` + `run_agentic_demo.py` ran a real Nous on Claude: web_search→run_code→web_fetch→synthesis + plan→build→QA "all tests passed." Fixed 4 real bugs live (sandbox host-mount→stdin, h2, trafilatura, web_fetch extraction). Brain suite 1001 passed.
