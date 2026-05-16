---
phase: 18-skill-diffusion
plan: "02"
subsystem: brain/skills
tags: [quarantine, peer-skill-reception, trust-gate, lineage, wave-1]
dependency_graph:
  requires: [18-01]
  provides: [QuarantineStore, skill-share-dispatch, quarantine-sweep, lineage-parent-hash]
  affects:
    - brain/src/noesis_brain/rpc/handler.py
    - brain/src/noesis_brain/rpc/types.py
    - brain/src/noesis_brain/skills/quarantine.py
    - brain/src/noesis_brain/skills/store.py
    - brain/src/noesis_brain/skills/peer_filter.py
tech_stack:
  added: []
  patterns:
    - quarantine-then-promote (D-18-02 trust re-check on sweep)
    - idempotent-ALTER-TABLE (lineage_parent_hash migration)
    - non-conversational-dispatch (__skill_share: returns [] never SPEAK)
    - flood-gate-quarantine-aware (_count_peer_skills counts active + quarantine)
key_files:
  created:
    - brain/src/noesis_brain/skills/quarantine.py
    - brain/test/test_skill_quarantine.py
    - brain/test/test_skill_diffusion_wiring.py
  modified:
    - brain/src/noesis_brain/rpc/types.py
    - brain/src/noesis_brain/rpc/handler.py
    - brain/src/noesis_brain/skills/store.py
    - brain/src/noesis_brain/skills/peer_filter.py
    - brain/test/ananke/test_loader.py
decisions:
  - "PeerSkillFilter.evaluate() no longer calls store.add() — returns Skill for caller routing (Phase 18 quarantine-first discipline)"
  - "QuarantineStore shares the same MemoryStore SQLite connection (one file per Nous)"
  - "_sweep_tick parsed from params directly in quarantine block to avoid forward reference to tick variable"
  - "PeerSkillFilter._count_peer_skills() now counts quarantine rows to close T-18-03 flood gate bypass"
  - "test_loader.py ActionType count updated 11 -> 23 (Phase 18 adds 3 members)"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-16T16:09:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 5
requirements: [SKILL-01, SKILL-04]
---

# Phase 18 Plan 02: Brain Skill Reception Pipeline (Wave 1) Summary

**One-liner:** Brain-side __skill_share: dispatch wired in on_message(); QuarantineStore module created with 5-column skills_quarantine table; quarantine sweep added to on_tick() before ObservationalLearner; lineage_parent_hash column added to skills table; PeerSkillFilter flood gate closed to quarantine rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ActionType members + create QuarantineStore module | ffa72dc | types.py, quarantine.py, test_skill_quarantine.py |
| 2 | Wire __skill_share: in on_message() + quarantine sweep in on_tick() + lineage column | 2f18859 | handler.py, store.py, peer_filter.py, test_skill_diffusion_wiring.py, test_loader.py |

## What Was Built

**Task 1 (TDD RED/GREEN):**
- Added `SKILL_TAUGHT = "skill_taught"`, `SKILL_INFERRED = "skill_inferred"`, `SKILL_REJECTED = "skill_rejected"` to `ActionType` enum in `types.py` with Phase 18 D-18-09 comment block matching established style.
- Created `brain/src/noesis_brain/skills/quarantine.py` with:
  - `QUARANTINE_TICKS` env-configurable constant (defaults to 5 per D-18-01)
  - `QuarantineStore._ensure_table()` creates `skills_quarantine` with 5-column schema (D-18-03): `skill_hash TEXT PRIMARY KEY`, `source_did`, `received_tick`, `promote_at_tick`, `payload_json`
  - `enqueue()`: INSERT OR IGNORE; `promote_at_tick = tick + QUARANTINE_TICKS`
  - `sweep()`: re-checks trust on every call; promotes (INSERT into skills + DELETE) or evicts (DELETE only); never raises
  - `has(skill_hash)`: dedup gate (Pitfall 6)
  - Imports `TRUST_THRESHOLD_SKILL` from `peer_filter` — single source of truth
- 26 tests in `test_skill_quarantine.py` all passing.

**Task 2 (TDD RED/GREEN):**
- `SkillStore.__init__()`: idempotent `ALTER TABLE skills ADD COLUMN lineage_parent_hash TEXT` migration (SKILL-04).
- `BrainHandler.__init__()`: inside `hypnos_db_dir` guard, after `_skill_store`, added `_cached_peer_weights: dict[str,float]`, `_peer_filter: PeerSkillFilter`, `_quarantine_store: QuarantineStore`. All three default to `{}` / `None` when hypnos_db_dir is absent.
- `BrainHandler.on_message()`: `__skill_share:` prefix check runs BEFORE `thymos.apply_triggers()`. On match: parses JSON, calls `_peer_filter.evaluate()`, enqueues to quarantine on accept, returns `[]` always (non-conversational).
- `BrainHandler.on_tick()`: quarantine sweep at start of method body (before ObservationalLearner block). Updates `_cached_peer_weights` from `relationship_context` edges. Appends `SKILL_TAUGHT` on promotion, `SKILL_REJECTED` on eviction.
- `PeerSkillFilter.evaluate()`: no longer calls `self._store.add()` — returns validated `Skill` for caller to route. Phase 18 quarantine-first discipline.
- `PeerSkillFilter._count_peer_skills()`: now counts `active + quarantine` rows (T-18-03 flood gate bypass closed).
- `test_loader.py`: updated ActionType member count assertion `11 -> 23`.
- 13 tests in `test_skill_diffusion_wiring.py` all passing.
- Full Brain suite: **626 passed**.

## Verification

```
grep -n "__skill_share" brain/src/noesis_brain/rpc/handler.py   # 2 hits
grep -n "_quarantine_store" brain/src/noesis_brain/rpc/handler.py  # hits in __init__ + on_tick
grep -n "SKILL_TAUGHT\|SKILL_INFERRED\|SKILL_REJECTED" brain/src/noesis_brain/rpc/types.py  # 3 hits
grep -n "lineage_parent_hash" brain/src/noesis_brain/skills/store.py  # ALTER TABLE hit
uv run python -m pytest test/ -q  # 626 passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PeerSkillFilter.evaluate() stored skill directly — bypassed quarantine**
- **Found during:** Task 2 (test `test_skill_share_enqueues_to_quarantine` failed)
- **Issue:** Phase 16 implementation of `evaluate()` called `self._store.add(skill)` internally. In Phase 18, the caller owns routing to quarantine. Skill was going directly to active store, bypassing quarantine entirely.
- **Fix:** Removed `self._store.add()` call from `evaluate()`; method now returns the validated `Skill` without storing it. Caller enqueues to `QuarantineStore`.
- **Files modified:** `brain/src/noesis_brain/skills/peer_filter.py`
- **Commit:** 2f18859

**2. [Rule 1 - Bug] `tick` variable referenced before assignment in quarantine sweep**
- **Found during:** Task 2 (UnboundLocalError in on_tick test)
- **Issue:** Quarantine sweep block inserted before the `tick = int(tick_raw)` parsing block, so `current_tick=tick` raised `UnboundLocalError`.
- **Fix:** Replaced `current_tick=tick` with `_sweep_tick = int(params.get("tick", 0) or 0)` computed inline.
- **Files modified:** `brain/src/noesis_brain/rpc/handler.py`
- **Commit:** 2f18859

**3. [Rule 1 - Bug] test_loader.py ActionType member count was stale**
- **Found during:** Task 2 full suite run
- **Issue:** `assert len(list(ActionType)) == 11` — count was set at Phase 12 and never updated as Phase 15/16/17 added members.
- **Fix:** Updated to `== 23` with breakdown comment (11 + 2 + 3 + 4 + 3).
- **Files modified:** `brain/test/ananke/test_loader.py`
- **Commit:** 2f18859

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-18-01: Untrusted __skill_share: payloads bypass PeerSkillFilter | `__skill_share:` dispatch calls `_peer_filter.evaluate()` with all 3 gates; sole entry point | Mitigated |
| T-18-02: Trust eviction after quarantine acceptance | `_cached_peer_weights` updated from `relationship_context` every tick; sweep re-checks | Mitigated |
| T-18-03: Flood gate bypass via quarantine | `_count_peer_skills()` counts active + quarantine rows combined | Mitigated |

## Known Stubs

None — all data paths are wired. Skills flow: `__skill_share:` → PeerSkillFilter → QuarantineStore → on_tick sweep → active skills table.

## Threat Flags

None — no new network endpoints or auth paths. All changes are within the existing Brain RPC boundary. QuarantineStore is Brain-internal SQLite only.

## Self-Check: PASSED

- `brain/src/noesis_brain/skills/quarantine.py` — exists ✓
- `brain/src/noesis_brain/rpc/types.py` contains SKILL_TAUGHT ✓
- `brain/src/noesis_brain/skills/store.py` contains lineage_parent_hash ✓
- `brain/src/noesis_brain/rpc/handler.py` contains __skill_share ✓
- `brain/src/noesis_brain/rpc/handler.py` contains _quarantine_store ✓
- Commit ffa72dc exists ✓
- Commit 2f18859 exists ✓
- 626 tests passing ✓
