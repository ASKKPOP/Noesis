---
phase: "16"
plan: "04"
subsystem: brain-system-prompt-observational-learner
tags: [hypnos, ltm, observational-learning, peer-voices, system-prompt, handler]
dependency_graph:
  requires:
    - "16-01: ActionType.SLEEP_ENTERED/SLEEP_COMPLETED in rpc/types.py"
    - "16-02: HypnosRuntime stub + LtmStore + WorkingMemory + consolidator"
    - "16-03: HypnosRuntime final + BrainHandler wiring (Working Memory + sleep trigger)"
  provides:
    - brain/src/noesis_brain/prompts/system.py — build_system_prompt with ltm_memories kwarg + _ltm_memories_section
    - brain/src/noesis_brain/rpc/handler.py — ObservationalLearner construction + observe_trade dispatch + peer_voices fetch
  affects:
    - brain/src/noesis_brain/prompts/system.py (ltm_memories kwarg in correct stack position D-16-08)
    - brain/src/noesis_brain/rpc/handler.py (ObservationalLearner + peer_voices wiring D-16-09)
tech_stack:
  added: []
  patterns:
    - Additive kwarg widening (ltm_memories before peer_voices — D-16-08 stack order)
    - SkillStore reuses MemoryStore._conn (shared SQLite, one file per Nous)
    - asyncio.create_task for observe_trade dispatch (non-blocking, Brain-local only)
    - wiki_pages_by_category(NOUS) + confidence >= 0.5 filter for peer_voices
    - Graceful no-op via try/except for peer_voices fetch failure
key_files:
  created: []
  modified:
    - brain/src/noesis_brain/prompts/system.py
    - brain/src/noesis_brain/rpc/handler.py
decisions:
  - "ltm_memories kwarg inserted BEFORE peer_voices in build_system_prompt signature (D-16-08 stack order: rules → reflections → skills → ltm_memories → peer_voices → ToM → directives)"
  - "_ltm_memories_section renders content_hash strings only — never raw prose (D-16-10 Brain-private invariant)"
  - "SkillStore constructed from self.memory._conn when memory is available (shared DB, no extra file handle)"
  - "ObservationalLearner set to None if memory is None (guards missing MemoryStore gracefully)"
  - "peer_voices fetch uses wiki_pages_by_category(NOUS) + list comprehension confidence filter (method lacks min_confidence param)"
  - "peer_voices fetch gated on _hypnos_runtime is not None (peer_voices enabled alongside Hypnos)"
  - "ltm_memories and peer_voices passed to build_system_prompt via **{} spread guard (same pattern as Plan 03)"
metrics:
  duration: "120 seconds"
  completed_date: "2026-05-16"
  tasks_completed: 2
  files_modified: 2
  files_created: 0
---

# Phase 16 Plan 04: system.py ltm_memories + handler ObservationalLearner + peer_voices Summary

Added `ltm_memories` kwarg to `build_system_prompt` in the correct D-16-08 stack position (after skills, before peer_voices), added `_ltm_memories_section` section builder rendering `## Long-Term Patterns`, and wired `ObservationalLearner` construction + `observe_trade` dispatch + `peer_voices` fetch into `BrainHandler` per D-16-09.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ltm_memories kwarg to build_system_prompt in correct stack position | 50cd5eb | brain/src/noesis_brain/prompts/system.py |
| 2 | Wire ObservationalLearner + peer_voices fetch in BrainHandler (D-16-09) | 34d24c9 | brain/src/noesis_brain/rpc/handler.py |

## Verification Results

- `pytest test/ -q`: 582 passed, 1 pre-existing failure (test_loader.py — same as Plan 03, unrelated)
- `python3 -c "from noesis_brain.prompts.system import build_system_prompt; r = build_system_prompt(psyche, mood, telos, ltm_memories=['hash1']); assert 'Long-Term Patterns' in r"` — PASSED
- ltm_memories line 99 < peer_voices line 105 in sections assembly block — ordering confirmed
- `grep "_obs_learner" handler.py` — shows construction + dispatch (3 occurrences)
- `grep "observe_trade" handler.py` — shows asyncio.create_task call
- `grep "peer_voices" handler.py` — shows fetch + pass to build_system_prompt
- `grep "build_system_prompt" handler.py` — shows ltm_memories and peer_voices in call

## Key Grep Verifications

- `system.py`: `ltm_memories` kwarg present BEFORE `peer_voices` kwarg — confirmed (line 32 vs line 36)
- `system.py`: `if ltm_memories:` section assembly at line 99, `if peer_voices:` at line 105 — confirmed ordering
- `system.py`: `_ltm_memories_section` function defined — confirmed (line 223)
- `handler.py`: `ObservationalLearner` constructed in `__init__` when `hypnos_db_dir is not None` — confirmed
- `handler.py`: `asyncio.create_task(self._obs_learner.observe_trade(...))` — confirmed in `on_tick`
- `handler.py`: `peer_voices` fetched from `wiki_pages_by_category(NOUS)` — confirmed in `on_message`
- `handler.py`: `build_system_prompt` receives `ltm_memories` and `peer_voices` via `**{}` spread — confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] SkillStore constructed inline in handler __init__**
- **Found during:** Task 2 — handler.py had no `self.skills` or `SkillStore` attribute; plan said "reuses existing SkillStore reference" but no such reference existed
- **Issue:** Plan 03 did NOT add `_obs_learner = None` to handler; SkillStore was never instantiated in handler
- **Fix:** Constructed `SkillStore(self.memory._conn)` inline when `memory` is available and has `_conn`; guarded with `None` fallback if memory absent
- **Files modified:** handler.py
- **Commit:** 34d24c9

**2. [Rule 2 - Missing functionality] peer_voices confidence filter uses list comprehension not method param**
- **Found during:** Task 2 — `wiki_pages_by_category` has no `min_confidence` parameter
- **Issue:** Plan suggested `get_by_category("NOUS", limit=3, min_confidence=0.5)` but the actual method is `wiki_pages_by_category(WikiCategory.NOUS)` with no confidence/limit params
- **Fix:** Used `wiki_pages_by_category(NOUS)` then filtered in Python: `[p for p in nous_pages if getattr(p, "confidence", 1.0) >= 0.5][:3]`
- **Files modified:** handler.py
- **Commit:** 34d24c9

## Known Stubs

None — all implementations are functional. `build_system_prompt` now receives `ltm_memories` kwarg directly (not via `**{}` guard since Plan 04 added the kwarg to system.py).

## Threat Surface Scan

No new network endpoints or auth paths introduced. All new surface is Brain-internal:
- `ObservationalLearner` dispatches via `asyncio.create_task` — non-blocking, no Grid RPC (T-16-02 satisfied)
- `peer_voices` derives from `WikiCategory.NOUS` pages already in MemoryStore — Brain-private, never crosses wire
- `_ltm_memories_section` renders content_hash strings only — never raw episode prose (T-16-01 satisfied)
- `wiki_pages_by_category` read is wrapped in try/except — graceful no-op on failure (T-16-03 satisfied)

## Self-Check

**Commits exist:**
- 50cd5eb: feat(16-04): add ltm_memories kwarg to build_system_prompt — D-16-08
- 34d24c9: feat(16-04): wire ObservationalLearner + peer_voices in BrainHandler — D-16-09

**Files exist:**
- brain/src/noesis_brain/prompts/system.py: modified (ltm_memories kwarg + _ltm_memories_section)
- brain/src/noesis_brain/rpc/handler.py: modified (ObservationalLearner + observe_trade + peer_voices)
