---
phase: 40
plan: 01
subsystem: test-scaffolding
tags: [wave-0, nyquist, tdd, local-ai, brain, grid]
dependency_graph:
  requires: []
  provides:
    - grid/test/operator-me-settings.test.ts
    - brain/test/test_startup_settings.py
    - brain/test/test_local_ai_http.py
  affects: []
tech_stack:
  added: []
  patterns:
    - vitest it.todo (Grid test stubs)
    - pytest.mark.skip with reason string (Brain test stubs)
key_files:
  created:
    - grid/test/operator-me-settings.test.ts
    - brain/test/test_startup_settings.py
    - brain/test/test_local_ai_http.py
  modified: []
decisions:
  - "Wave 0 stubs use it.todo (vitest) and @pytest.mark.skip (pytest) per plan spec — no it.skip used"
  - "Brain full suite: 759 passed + 9 skipped (includes new stubs), 0 failures"
  - "Grid pre-existing failures (62 files / 127 tests) are out-of-scope from Phase 39; my stub file contributes 6 todo only"
metrics:
  duration: "4m 31s"
  completed_date: "2026-05-27"
  task_count: 3
  file_count: 3
---

# Phase 40 Plan 01: Wave 0 Test Stubs Summary

**One-liner:** Three behavioral contract stubs (6 vitest it.todo + 9 pytest.mark.skip) scaffolding Phase 40 Local AI Integration Nyquist compliance before any implementation begins.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Grid settings route test stub | 2983fbc | grid/test/operator-me-settings.test.ts |
| 2 | Brain startup settings test stub | 112125c | brain/test/test_startup_settings.py |
| 3 | Brain HTTP endpoint test stub | 4c339a1 | brain/test/test_local_ai_http.py |

## What Was Built

### Task 1 — Grid settings route test stub

`grid/test/operator-me-settings.test.ts` — 6 `it.todo` stubs across 3 describe blocks:

- `GET /api/v1/operator/me/settings`: returns 200 + LocalAiSettings shape; returns 401 without cookie
- `PATCH /api/v1/operator/me/settings`: persists temperature update + returns updated shape; returns 401 without cookie
- `operator-settings-store (unit)`: getSettings() returns qwen3:4b defaults when no DB row; updateSettings() merges patch

File uses the exact `vi.mock('../../src/operator/data/operator-settings-store.js', ...)` pattern from the plan's `<interfaces>` block, matching the analog `operator-me-quota.test.ts`.

### Task 2 — Brain startup settings test stub

`brain/test/test_startup_settings.py` — 4 `@pytest.mark.skip` stubs across 2 test classes:

- `TestFetchOperatorSettings`: test_returns_settings_on_200, test_exits_on_non_200, test_exits_on_network_error (all: "Wave 0 stub — implemented in Plan 03")
- `TestRecoveryDetection`: test_logs_recovered_after_unavailable ("Wave 0 stub — implemented in Plan 04")

Includes `DEFAULT_SETTINGS` constant with full `LocalAiSettings` shape (D-40-02) pre-populated for Plan 03 use.

### Task 3 — Brain HTTP endpoint test stub

`brain/test/test_local_ai_http.py` — 5 `@pytest.mark.skip` stubs across 2 test classes:

- `TestLocalAiModelsEndpoint`: model_list_when_available, empty_list_when_offline (Pitfall 4), 401_wrong_secret
- `TestLocalAiStatusEndpoint`: ok_when_available, degraded_when_unavailable

## Verification Results

| Check | Result |
|-------|--------|
| `grid/test/operator-me-settings.test.ts` vitest run | 6 todo, 0 failures — EXIT 0 |
| `brain/test/test_startup_settings.py` pytest run | 4 skipped, 0 failures — EXIT 0 |
| `brain/test/test_local_ai_http.py` pytest run | 5 skipped, 0 failures — EXIT 0 |
| Brain full suite (`uv run pytest test/ -x -q`) | 759 passed, 9 skipped, 0 failures |
| Grid new stub only (`npx vitest run operator-me-settings`) | 6 todo, 0 failures |

**Note on pre-existing Grid failures:** The Grid full suite has 62 failing test files (127 tests) that pre-date this plan — they originate from Phase 39 and earlier. My plan 01 changes introduce no new failures. The new stub contributes exactly 6 todo tests and 0 failures. This is documented per SCOPE BOUNDARY rule.

## Deviations from Plan

None — plan executed exactly as written. All three test files match the spec in `<action>` blocks verbatim. The `vi.mock` hoisting, describe structure, it.todo syntax, pytest.mark.skip with reason strings, and DEFAULT_SETTINGS constant are all as specified.

## Known Stubs

All three files created in this plan are intentional Wave 0 stubs. Each stub is marked with its implementing plan in the skip/todo reason:

| File | Stub Count | Skip Reason | Implementing Plan |
|------|------------|-------------|-------------------|
| grid/test/operator-me-settings.test.ts | 6 (it.todo) | implicit (todo) | Plan 02 |
| brain/test/test_startup_settings.py | 3 (skip) | "Wave 0 stub — implemented in Plan 03" | Plan 03 |
| brain/test/test_startup_settings.py | 1 (skip) | "Wave 0 stub — implemented in Plan 04" | Plan 04 |
| brain/test/test_local_ai_http.py | 5 (skip) | "Wave 0 stub — implemented in Plan 04" | Plan 04 |

These stubs do NOT prevent the plan's goal from being achieved — the goal of Plan 01 IS to create these stubs.

## Threat Flags

None. This plan creates test-only files with no production code, no network endpoints, no auth paths, and no schema changes.

## Self-Check: PASSED

- `grid/test/operator-me-settings.test.ts`: FOUND
- `brain/test/test_startup_settings.py`: FOUND
- `brain/test/test_local_ai_http.py`: FOUND
- Commit 2983fbc (Task 1): FOUND in git log
- Commit 112125c (Task 2): FOUND in git log
- Commit 4c339a1 (Task 3): FOUND in git log
