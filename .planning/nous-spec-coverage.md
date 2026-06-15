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
| Visibility (choose visible/hidden from other agents) | 🟡 PARTIAL | structure-level open/private + operator quarantine only — **no agent-controlled toggle** |

## §2 Settings

| Item | Status | Where / gap |
|---|---|---|
| Owns a Nous House | ✅ FULL | `grid/.../civic/parcel-registry.ts` |
| Joined Grid | 🟡 PARTIAL | single-grid only; no join/leave or membership list |
| Service Portal Access (search active Grids / orgs / Houses) | 🟡 PARTIAL | profiles/parcels exposed; **no discovery/search endpoint** |

## §3 Task & Autonomy Engine

| Item | Status | Where / gap |
|---|---|---|
| Autonomous Drive | 🟡 PARTIAL | `brain/.../ananke/` per-tick drives; reactive, never self-initiates |
| Goal Management | 🟡 PARTIAL | tracked (now incl. economic); no evolution loop |
| Reminder & Wake-Up | 🟡 PARTIAL | deterministic sleep/wake (`hypnos`); no condition/schedule reminders |
| Job Scheduler | 🟡 PARTIAL | tick + peer cowork board; no self-scheduled queue |
| Task Plan → Build → QA | 🔼 🟡 | **`TaskRunner` plan→build→QA lifecycle built (Phase 74 Brain slice)** over `run_code`. Remaining: real runs need Docker + live LLM (orchestration unit-tested with fixtures). |
| Reporting with Visualization | 🔼 🟡 | **`ActivityReport` + markdown render built (Phase 74)**. Remaining: live **Grid-side** visualization rides Phase 72b. |

## §4 Research & Connected Resources

| Item | Status | Where / gap |
|---|---|---|
| Skills | ✅ FULL | `brain/.../skills/store.py` |
| Knowledge Base | ✅ FULL | `brain/.../episteme/wiki.py` |
| Web Search | 🔼 🟡 | **`web_search` tool built (Phase 72, callable/live)**; default-loop activation = Phase 72b |
| Connected Resources | 🟡 PARTIAL | `web_fetch` tool now exists; no pluggable API/DB connectors |
| Local AI + Online | 🟡 PARTIAL | Ollama→Claude fallback; no knowledge-level seamlessness |

## §5 Brain (Local) ↔ Grid (Mirror)

| Item | Status | Where / gap |
|---|---|---|
| Brain is Local | ✅ FULL | local Python process; all cognition local |
| Mirror to Grid | 🟡 PARTIAL | one-way Brain→Grid actions |
| Visualization to Grid | 🟡 PARTIAL | presence/map only; no live render of Brain output |
| Local ↔ Grid sync | 🟡 PARTIAL | event-driven, not continuous |
| Nous Can Program Locally | 🔼 🟡 | **`run_code` Docker sandbox built (Phase 73 Brain slice)**: no-network, read-only FS, time/mem caps, Docker-gated (off if absent). Remaining: container exec unverified on this machine (no Docker); Grid `tool.code_run` audit mirror = Phase 72b. |

---

## No fully-absent spec items remain

After the Phase 74 Brain slice, **every Nous-spec sub-item is now FULL or PARTIAL — none are absent.** The "Nous-as-builder" arc (Phases 72–74) is built Brain-side. What's left is **activation + the Grid-side mirror**, not missing capability:

- **Phase 72b** — Grid audit mirror (`tool.*` sole-producer) + AAU-learner activation + **live Grid visualization** of activity reports.
- **Verify on Docker** — Phases 73/74 container + end-to-end runs need a Docker host + live LLM (this build machine has neither).
- The notable PARTIALs below remain product decisions, not absences.

## Notable PARTIALs worth deciding on (not absent, but below spec intent)

- Agent-controlled **visibility toggle** (§1)
- **Condition-based reminders** + **self-initiated tasks** + **goal evolution** (§3)
- **Service Portal discovery** + **multi-Grid / Joined Grid** (§2) — note: multi-Grid conflicts with D-V3-30 ("v3.0 ships 1 Grid"); resolve before building
- Live **Mirror / Visualization to Grid** (§5)

## Shipped this session (2026-06-15)

- **Phase 72 (Brain slice)** — tool-use loop + `web_search`/`web_fetch` → §4 Web Search/Connected Resources. (Phase 72b carries the Grid audit mirror + AAU-learner activation.)
- **Economic goal** — §1 Target & Goals "earning money" target, seeded at spawn for all Nous.
- **Phase 73 (Brain slice)** — `run_code` Docker sandbox → §5 Nous Can Program Locally. Container exec unverified here (no Docker); container tests `skipif`-guarded, ready to run on a Docker host.
- **Phase 74 (Brain slice)** — `TaskRunner` plan→build→QA lifecycle + `ActivityReport` → §3 Task pipeline + Reporting. Orchestration fixture-tested; real runs need Docker + live LLM; Grid-side report visualization rides Phase 72b.
