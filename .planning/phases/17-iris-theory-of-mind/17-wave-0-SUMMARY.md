---
phase: 17-iris-theory-of-mind
plan: wave-0
subsystem: brain/grid
tags: [iris, theory-of-mind, allowlist, attribution-error-fix]
dependency_graph:
  requires: []
  provides: [_iris_runtime-field, allowlist-36-entries, IRIS_FORBIDDEN_KEYS]
  affects: [brain/rpc/handler.py, grid/audit/broadcast-allowlist.ts]
tech_stack:
  added: []
  patterns: [optional-dep-injection, sole-producer-allowlist, forbidden-key-regex]
key_files:
  modified:
    - brain/src/noesis_brain/rpc/handler.py
    - grid/src/audit/broadcast-allowlist.ts
decisions:
  - Phase 15/16 allowlist entries (28-32) were absent — added as stubs per D-17-01; no emitter files existed
  - IRIS_FORBIDDEN_KEYS added as new export (6 keys) per D-17-17 threat mitigation
metrics:
  duration: ~10min
  completed: 2026-05-15
  tasks_completed: 2
  files_modified: 2
---

# Phase 17 Plan Wave-0: Fix _iris_runtime AttributeError + Extend Allowlist 27→36 Summary

Wave 0 resolved two pre-execution blockers: the `AttributeError` on every `on_tick()` call caused by an uninitialized `_iris_runtime` field, and the allowlist gap (27 entries instead of the 36 required before Wave 2 emitters can register).

## What Was Done

### Task 1: Fix AttributeError in BrainHandler.__init__

`brain/src/noesis_brain/rpc/handler.py` referenced `self._iris_runtime` at line 217 (guard: `if self._iris_runtime is not None`) but never assigned the field in `__init__`. This caused `AttributeError: 'BrainHandler' object has no attribute '_iris_runtime'` on every `on_tick()` invocation.

Added one line immediately after `self._bios_birth_ticks: dict[str, int] = {}` (line 71):

```python
self._iris_runtime = None  # Phase 17 D-17-14: declared here; initialized in Wave 3 Task 1
```

The field now lives at line 72, before the first guard at line 218. Wave 3 Task 1 will replace this `None` with the full `IrisRuntime` initialization.

**Verification run:**
```
python3 -m py_compile brain/src/noesis_brain/rpc/handler.py
# → py_compile ok

grep -n "_iris_runtime" brain/src/noesis_brain/rpc/handler.py | head -6
# → 72: self._iris_runtime = None  (declaration)
# → 216-225: guard + store/dispatcher access (5 total references, ≥3 required)
```

### Task 2: Extend broadcast-allowlist.ts — positions 28-36 + FORBIDDEN_KEY_PATTERN

`grid/src/audit/broadcast-allowlist.ts` had 27 entries ending at `'operator.exported'`. Phase 15 and 16 were not separately executed, so their 5 events were absent.

**Decision (D-17-01):** Phase 15/16 emitter files do NOT exist in `grid/src/` (`grid/src/reflexion/` and `grid/src/sleep/` directories are absent). Added their allowlist entries as documented stubs per D-17-01 instructions.

Four changes made:

1. **Header comment** updated: summary line changed from "exactly these 27 event types" to "exactly these 36 event types"; version stamp extended to include Phase 15 + Phase 16 + Phase 17; entries 28-36 documented with payload shapes.

2. **ALLOWLIST_MEMBERS array** extended with 9 new entries appended after `'operator.exported'`:
   - 28: `'nous.reflection_authored'` — Phase 15 stub
   - 29: `'nous.self_model_revised'` — Phase 15 stub
   - 30: `'nous.creed_violation'` — Phase 15 stub
   - 31: `'nous.sleep.entered'` — Phase 16 stub
   - 32: `'nous.sleep.completed'` — Phase 16 stub
   - 33: `'iris.belief_revised'` — `{nous_did, tick, target_did, belief_hash}`
   - 34: `'iris.context_invoked'` — `{nous_did, tick, belief_count}`
   - 35: `'iris.contradiction_detected'` — `{nous_did, tick, target_did, contradiction_hash}`
   - 36: `'iris.prior_seeded'` — `{nous_did, tick, target_did, seed_event_hash}`

3. **FORBIDDEN_KEY_PATTERN** extended before the `/i` flag with 6 iris-specific keys:
   `|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content`

4. **IRIS_FORBIDDEN_KEYS** new export added after `GOVERNANCE_FORBIDDEN_KEYS` — `Object.freeze` array of the same 6 keys, per D-17-17 (belt-check in per-emitter boundaries in later waves).

**Verification run:**
```
# Manual array count: 36 indented string entries in ALLOWLIST_MEMBERS (lines 71-150)
grep -n "^\s*'" grid/src/audit/broadcast-allowlist.ts | head -36
# → entries 1-36 confirmed in order

# Node parse check:
# ALLOWLIST_MEMBERS: 36 actual event entries
# FORBIDDEN_KEY_PATTERN includes: belief_content ✓, iris_content ✓, emotion_text ✓,
#   dimension_text ✓, belief_prose ✓, target_content ✓
# IRIS_FORBIDDEN_KEYS count: 6 ✓
```

## Commit

- **c15094e** `feat(17-wave-0): fix _iris_runtime AttributeError; extend allowlist 27→36`

## Decisions Made

| Decision | Outcome |
|----------|---------|
| Phase 15/16 emitter files existence | Absent — `grid/src/reflexion/` and `grid/src/sleep/` do not exist. Added allowlist stubs 28-32 without emitter files per D-17-01. |
| IRIS_FORBIDDEN_KEYS placement | Added after GOVERNANCE_FORBIDDEN_KEYS, before WHISPER_FORBIDDEN_KEYS (follows document order by phase). |

## Current Allowlist State

36 entries total. Tuple order locked. Positions:
- 1-11: v1 core events
- 12-16: Phase 6 operator.*
- 17: Phase 7 telos.refined
- 18: Phase 8 operator.nous_deleted
- 19: Phase 10a ananke.drive_crossed
- 20-21: Phase 10b bios.*
- 22: Phase 11 nous.whispered
- 23-26: Phase 12 governance
- 27: Phase 13 operator.exported
- 28-30: Phase 15 stubs (nous.reflection_authored, nous.self_model_revised, nous.creed_violation)
- 31-32: Phase 16 stubs (nous.sleep.entered, nous.sleep.completed)
- 33-36: Phase 17 iris.* events

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Decisions Made vs. Plan Instructions

**Phase 15/16 emitters absent (expected per D-17-01):** The plan anticipated this and instructed adding entries without emitters if absent. No deviation — this was the documented fallback path.

## Known Stubs

- `grid/src/audit/broadcast-allowlist.ts` entries 28-32 are allowlist stubs for Phase 15/16 events. No sole-producer emitter files exist yet for `nous.reflection_authored`, `nous.self_model_revised`, `nous.creed_violation`, `nous.sleep.entered`, `nous.sleep.completed`. These will be wired in future phases (15/16 backfill or explicitly noted as deferred).

## Self-Check: PASSED

- `brain/src/noesis_brain/rpc/handler.py` — modified, committed at c15094e ✓
- `grid/src/audit/broadcast-allowlist.ts` — modified, committed at c15094e ✓
- `self._iris_runtime = None` at line 72, before guard at line 218 ✓
- 36 ALLOWLIST_MEMBERS entries in locked tuple order ✓
- FORBIDDEN_KEY_PATTERN includes all 6 iris forbidden keys ✓
- IRIS_FORBIDDEN_KEYS exported with 6 entries ✓
- No files deleted in commit ✓
- Pushed to origin/main ✓
