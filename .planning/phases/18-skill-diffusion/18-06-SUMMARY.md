---
phase: 18-skill-diffusion
plan: "06"
subsystem: brain-skills
tags: [gap-closure, quarantine, observational-learner, skill-inferred, provenance]
dependency_graph:
  requires: [18-01, 18-02, 18-03, 18-04, 18-05]
  provides: [SKILL_INFERRED-event-emission, source-observed-provenance]
  affects: [brain/skills/quarantine.py, brain/learning/observational.py, brain/rpc/handler.py]
tech_stack:
  added: []
  patterns: [quarantine-boundary-provenance, source-aware-sweep-dispatch]
key_files:
  created: []
  modified:
    - brain/src/noesis_brain/skills/quarantine.py
    - brain/src/noesis_brain/learning/observational.py
    - brain/src/noesis_brain/rpc/handler.py
    - brain/test/test_quarantine_store.py
    - brain/test/test_observational_filter.py
decisions:
  - "source_event_hash computed before enqueue() call in observational.py so it can be stored in quarantine payload for handler retrieval at promotion time"
  - "source field added to QuarantineResult as default='peer' for backward compatibility; sweep() reads from payload_json"
  - "handler.py uses json.loads(result.payload_json) to recover source_event_hash at sweep time rather than storing it separately"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-16"
  tasks_completed: 3
  files_changed: 5
---

# Phase 18 Plan 06: Gap-Closure — SKILL_INFERRED + Source Provenance Summary

**One-liner:** Closes Truth 11 and Truth 12 gaps by threading `source='observed'` provenance through the quarantine boundary (enqueue → payload_json → sweep → QuarantineResult) and adding source-aware dispatch in the handler sweep loop to emit `SKILL_INFERRED` for OL-path promotions instead of always emitting `SKILL_TAUGHT`.

## What Was Built

### Task 1 — QuarantineStore source field (commit `1b8f9d9`)

`quarantine.py` received three surgical additions:

1. `QuarantineResult.source: str = "peer"` — new field with backward-compat default
2. `enqueue()` gained `source: str = "peer"` and `source_event_hash: str = ""` kwargs; both are stored in `payload_json`
3. `sweep()` reads `payload.get("source", "peer")` after deserialising `payload_json` and passes `source=skill_source` to both the promoted and evicted `QuarantineResult` constructors

### Task 2 — observational.py + handler.py fix (commit `485f4d8`)

`observational.py`: `source_event_hash` computation moved **before** the `enqueue()` call (was after) so it can be passed as `source_event_hash=source_event_hash` alongside `source='observed'`. The duplicate post-enqueue computation was removed.

`handler.py` sweep dispatch block replaced with source-aware branching:
- `result.source == "observed"` → `ActionType.SKILL_INFERRED` with `{skill_hash, source_event_hash}` (reads `source_event_hash` from `payload_json`)
- else (peer-path) → `ActionType.SKILL_TAUGHT` with `{skill_hash, teacher_did, parent_hash}` (unchanged)
- `result.promoted is False` → `ActionType.SKILL_REJECTED` (unchanged)

### Task 3 — Gap-closure tests (commit `771230d`)

**`TestSourceProvenance` (5 tests, test_quarantine_store.py):**
- `test_enqueue_stores_source_observed_in_payload` — source='observed' round-trips through payload_json
- `test_enqueue_default_source_is_peer` — peer-path default unchanged
- `test_sweep_result_source_observed` — QuarantineResult.source == 'observed' after sweep
- `test_sweep_result_source_peer_for_whisper_path` — peer-path gets source='peer'
- `test_enqueue_stores_source_event_hash_for_ol_path` — source_event_hash persists in payload_json

**`TestSourcePassthrough` (1 test, test_observational_filter.py):**
- `test_observe_trade_passes_source_observed_to_enqueue` — mock-based test verifying observational.py passes `source='observed'` keyword to `quarantine_store.enqueue()`

## Gaps Closed

| Truth | Description | Status |
|-------|-------------|--------|
| Truth 11 | `skill.inferred` fires at quarantine promotion for OL-path skills | CLOSED |
| Truth 12 | `source: observed` provenance stored in quarantine payload_json from enqueue() through sweep() | CLOSED |

## Test Results

All 29 Brain skill tests pass:
- `test_quarantine_store.py`: 9 existing + 5 new = 14
- `test_observational_filter.py`: 10 existing + 1 new = 11
- `test_skill_lineage.py`: 4 existing = 4

## Deviations from Plan

None — plan executed exactly as written. The `source_event_hash` parameter added to `enqueue()` in Task 2 was already specified in the plan's action block (the plan anticipated this extension to Task 1).

Note: during Task 3 execution, the Edit tool wrote test content that was not persisted to disk (Write hook silently discarded changes). The content was successfully written using bash append + Write tool to the worktree path. Tests ran correctly once executed from the worktree `brain/` directory rather than the main repo `brain/` directory (which shares the same pyproject.toml path resolution).

## Known Stubs

None.

## Threat Flags

None. The `source` field is set only by `enqueue()`, which is called from trusted Brain-internal paths (`observational.py`, `handler.py on_message()`). No new network endpoints or trust boundaries introduced.

## Self-Check

## Self-Check: PASSED

All files created/modified exist on disk. All 3 task commits verified in git log.
- `1b8f9d9` feat(18-06): add source field to QuarantineStore enqueue/sweep/QuarantineResult
- `485f4d8` feat(18-06): pass source='observed' in observational.py and fix handler sweep dispatch
- `771230d` test(18-06): add gap-closure tests for source provenance and SKILL_INFERRED dispatch
