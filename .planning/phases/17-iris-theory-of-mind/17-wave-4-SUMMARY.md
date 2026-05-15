---
phase: 17-iris-theory-of-mind
plan: wave-4
subsystem: iris-tests
tags: [tests, ci-gates, invariants, python, typescript, theory-of-mind]
dependency_graph:
  requires: [wave-0, wave-1, wave-2, wave-3]
  provides: [iris-invariant-tests, iris-ci-gates]
  affects: [brain/test/iris, grid/test/iris, grid/test/ci]
tech_stack:
  added: []
  patterns: [vitest-sole-producer-boundary, pytest-mock-llm-adapter, bash-ci-gate]
key_files:
  created:
    - brain/test/iris/__init__.py
    - brain/test/iris/test_elicit_cooldown.py
    - brain/test/iris/test_contradiction_threshold.py
    - brain/test/iris/test_append_only.py
    - brain/test/iris/test_zero_diff_invariant.py
    - grid/test/iris/appendIrisBeliefRevised.test.ts
    - grid/test/iris/appendIrisContextInvoked.test.ts
    - grid/test/iris/appendIrisContradictionDetected.test.ts
    - grid/test/iris/appendIrisPriorSeeded.test.ts
    - grid/test/iris/iris-producer-boundary.test.ts
    - grid/test/ci/iris-wallclock-gate.sh
    - grid/test/ci/iris-content-leak-gate.sh
  modified: []
decisions:
  - "Used brain/test/iris/ (not brain/tests/iris/) to match existing pytest testpaths=['test'] in pyproject.toml"
  - "Shell CI gates use --include=*.py / --include=*.ts to exclude __pycache__ .pyc binary files"
  - "Wall-clock grep patterns match call-site syntax (datetime., time.time(), ...) not plain words to avoid false positives from docstring comments"
  - "HEX64_RE requires 64-char sha256 hex; plan description of 32-char was incorrect — actual emitters enforce 64-char per HEX64_RE constant"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-15T19:00:34Z"
  tasks: 2
  files: 12
---

# Phase 17 Plan wave-4: Iris Wave 4 Tests + CI Gates Summary

Wave 4 of Phase 17 delivers 77 machine-readable tests and 2 CI grep gates that encode Phase 17's invariants as executable specifications. Covers IRIS_ELICIT_COOLDOWN=20, IRIS_CONTRADICTION_THRESHOLD=0.3, append-only discipline (superseded_by FK only), zero-diff isolation, closed-tuple emitter boundaries, sole-producer enforcement, wall-clock freedom, and content-never-crosses-wire for all four iris.* audit events.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Python invariant tests | 8545649 | brain/test/iris/ (5 files, 19 tests) |
| 2 | TypeScript emitter tests + CI grep gates | 09d7239 | grid/test/iris/ (5 files, 58 tests), grid/test/ci/ (2 scripts) |

## Test Results

### Python Tests (brain/test/iris/)

| File | Tests | Result |
|------|-------|--------|
| test_elicit_cooldown.py | 5 | PASSED |
| test_contradiction_threshold.py | 6 | PASSED |
| test_append_only.py | 4 | PASSED |
| test_zero_diff_invariant.py | 4 | PASSED |
| **Total** | **19** | **ALL PASSED** |

Key assertions verified:
- `test_cooldown_exact_fire_ticks`: 50 ticks → exactly 3 LLM calls (ticks 0, 20, 40)
- `test_near_identical_no_contradiction`: delta 0.05 < 0.3 → `result.contradiction is False`
- `test_threshold_boundary_below`: delta exactly 0.3 does NOT trigger (strictly `>` not `>=`)
- `test_append_only_20_beliefs_cap`: 20 inserts → 20 total rows, 10 active, ≥10 superseded
- `test_10_active_after_20_inserts`: active count == IRIS_BELIEFS_CAP exactly
- `test_zero_diff_iris_enabled_vs_disabled`: filter(iris.*) of enabled == disabled
- `test_enabled_path_produces_iris_actions`: iris.* entries exist (test is non-vacuous)

### TypeScript Tests (grid/test/iris/)

| File | Tests | Result |
|------|-------|--------|
| appendIrisBeliefRevised.test.ts | 13 | PASSED |
| appendIrisContextInvoked.test.ts | 12 | PASSED |
| appendIrisContradictionDetected.test.ts | 12 | PASSED |
| appendIrisPriorSeeded.test.ts | 13 | PASSED |
| iris-producer-boundary.test.ts | 8 | PASSED |
| **Total** | **58** | **ALL PASSED** |

Key assertions verified per emitter:
- Happy path: valid payload commits to chain, `entry.eventType` matches
- Closed-tuple: missing key and extra key each throw `TypeError`
- Self-report invariant: `payload.nous_did !== actorDid` throws `TypeError`
- Negative tick: throws `TypeError`
- Invalid DID (`target_did`): throws `TypeError`
- Invalid hash (not 64-char lowercase hex): throws `TypeError`
- 32-char hash rejected (must be full sha256 = 64 chars)
- `belief_count < 0` and fractional: throws `TypeError` (context_invoked)
- Producer boundary: each `iris.*` event string appears in exactly 2 files (allowlist + sole emitter)

### CI Grep Gates

| Script | Result |
|--------|--------|
| grid/test/ci/iris-wallclock-gate.sh | OK — no wall-clock patterns found |
| grid/test/ci/iris-content-leak-gate.sh | OK — no content leak patterns found |

Wall-clock gate covers `brain/src/noesis_brain/iris/*.py` and `grid/src/iris/*.ts`. Uses `--include=*.py` / `--include=*.ts` to exclude `__pycache__`, `.pyc` binaries, and non-source files.

Content leak gate covers three tiers: `grid/src/iris/`, `brain/src/noesis_brain/rpc/`, `dashboard/src/`. Checks for forbidden keys: `belief_content`, `target_content`, `emotion_text`, `dimension_text`, `belief_prose`, `iris_content`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used brain/test/iris/ instead of brain/tests/iris/**
- **Found during:** Task 1
- **Issue:** Plan specified `brain/tests/iris/` but the project uses `brain/test/` (pyproject.toml `testpaths = ["test"]`). A `brain/tests/` directory would not be discovered by pytest.
- **Fix:** Created `brain/test/iris/` to match the existing convention.
- **Files modified:** All 4 Python test files placed in `brain/test/iris/`

**2. [Rule 1 - Bug] Fixed wall-clock CI gate false positives from docstring comments**
- **Found during:** Task 2 (running iris-wallclock-gate.sh)
- **Issue:** Initial script used bare grep patterns like `"datetime"` which matched comment text `"NEVER use datetime, time.time..."` present in every iris module docstring, and also matched binary `.pyc` files in `__pycache__/`.
- **Fix:** Changed patterns to match call-site syntax (`datetime.`, `time.time(`, etc.) and added `--include=*.py` / `--include=*.ts` to exclude binary files and __pycache__.

**3. [Rule 1 - Note] HEX64_RE requires 64-char hash, not 32-char**
- **Found during:** Task 2 (reading actual emitter code)
- **Issue:** Plan description mentioned "32-char hash" but the actual `appendIrisBeliefRevised.ts` exports `HEX64_RE = /^[0-9a-f]{64}$/` — the Brain emits full sha256 hexdigests (64 chars).
- **Fix:** Tests use `'a'.repeat(64)` for valid hashes and assert that `'a'.repeat(32)` throws TypeError.

## Known Stubs

None — all tests wire to actual implementations (IrisStore, IrisRuntime, appendIris* emitters).

## Threat Flags

None — this plan contains test files and CI scripts only; no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

Files exist:
- brain/test/iris/test_elicit_cooldown.py: FOUND
- brain/test/iris/test_contradiction_threshold.py: FOUND
- brain/test/iris/test_append_only.py: FOUND
- brain/test/iris/test_zero_diff_invariant.py: FOUND
- grid/test/iris/appendIrisBeliefRevised.test.ts: FOUND
- grid/test/iris/iris-producer-boundary.test.ts: FOUND
- grid/test/ci/iris-wallclock-gate.sh: FOUND
- grid/test/ci/iris-content-leak-gate.sh: FOUND

Commits exist:
- 8545649 (Task 1 — Python tests): FOUND
- 09d7239 (Task 2 — TS tests + CI gates): FOUND
