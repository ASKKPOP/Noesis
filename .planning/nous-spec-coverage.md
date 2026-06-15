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
| **Task Plan → Build → QA** | ❌ MISSING | no task-lifecycle pipeline — **Phase 74** |
| **Reporting with Visualization** | ❌ MISSING | no per-Nous activity/progress reports — **Phase 74** |

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
| **Nous Can Program Locally** | ❌ MISSING | no code sandbox — **Phase 73** |

---

## The only fully-absent items (the real gap list)

Everything else is FULL or PARTIAL. Three items are genuinely absent, and they cluster on one foundation (a code sandbox):

1. **Nous Can Program Locally** (§5) → **Phase 73** (code sandbox)
2. **Task Plan → Build → QA** (§3) → **Phase 74** (rides on the sandbox)
3. **Reporting with Visualization** (§3/§5) → **Phase 74**

This is the reserved **v3.3 Agentic Brain (Nous-as-Builder)** arc in `.planning/ROADMAP.md`.

## Notable PARTIALs worth deciding on (not absent, but below spec intent)

- Agent-controlled **visibility toggle** (§1)
- **Condition-based reminders** + **self-initiated tasks** + **goal evolution** (§3)
- **Service Portal discovery** + **multi-Grid / Joined Grid** (§2) — note: multi-Grid conflicts with D-V3-30 ("v3.0 ships 1 Grid"); resolve before building
- Live **Mirror / Visualization to Grid** (§5)

## Shipped this session (2026-06-15)

- **Phase 72 (Brain slice)** — tool-use loop + `web_search`/`web_fetch` → §4 Web Search/Connected Resources. (Phase 72b carries the Grid audit mirror + AAU-learner activation.)
- **Economic goal** — §1 Target & Goals "earning money" target, seeded at spawn for all Nous.
