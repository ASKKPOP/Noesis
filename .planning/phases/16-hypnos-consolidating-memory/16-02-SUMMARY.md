---
phase: "16"
plan: "02"
subsystem: brain-hypnos-module
tags: [hypnos, sleep, working-memory, ltm, hebbian, shy, consolidation, sqlite-wal]
dependency_graph:
  requires:
    - "16-01: RED test stubs for HYP-01..03, wall-clock grep gate"
  provides:
    - brain/src/noesis_brain/hypnos/ module (6 files)
    - WorkingMemory ring buffer cap=7 (HYP-01)
    - LtmStore SQLite WAL with ltm_nodes + ltm_edges (HYP-02)
    - hebbian_pass + shy_downscale pure functions (HYP-03)
    - HypnosRuntime with run_sleep + compute_snapshot_hash + retrieve_top_k
  affects:
    - brain/src/noesis_brain/hypnos/ (new module)
tech_stack:
  added: []
  patterns:
    - IrisStore constructor clone (WAL + directory auto-derive)
    - iris/config.py module-level constant discipline
    - Wall-clock-free: tick from caller only (T-16-03)
    - Canonical undirected edge: src < dst enforced in consolidator
    - Content-hash node ID: sha256(content)[:16]
    - Canonical JSON sha256 for deterministic snapshot hash
key_files:
  created:
    - brain/src/noesis_brain/hypnos/__init__.py
    - brain/src/noesis_brain/hypnos/config.py
    - brain/src/noesis_brain/hypnos/types.py
    - brain/src/noesis_brain/hypnos/working_memory.py
    - brain/src/noesis_brain/hypnos/ltm_store.py
    - brain/src/noesis_brain/hypnos/consolidator.py
    - brain/src/noesis_brain/hypnos/runtime.py
  modified: []
decisions:
  - "HypnosRuntime eta/sigma default to HYPNOS_ETA/HYPNOS_SIGMA from config — allows HypnosRuntime(store) calls in stubs without explicit args"
  - "retrieve_top_k added to HypnosRuntime (Plan 05 seam) — prevents TypeError in test_ltm_retrieval_perf.py stub"
  - "Docstrings must not mention forbidden walltime strings verbatim — grep gate catches comments too"
metrics:
  duration: "490 seconds"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_modified: 0
  files_created: 7
---

# Phase 16 Plan 02: Hypnos Brain Module Implementation Summary

SQLite-WAL LTM concept graph + WorkingMemory ring buffer + Hebbian consolidator + HypnosRuntime orchestrator — HYP-01, HYP-02, HYP-03 RED stubs all green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | config + types + working_memory + __init__ | c83a961 | 4 files created |
| 2 | ltm_store + consolidator + runtime | eeeee73 | 3 files created |

## Verification Results

- `pytest test/hypnos/test_working_memory.py -x -q`: 2 passed (cap=7, overflow evicts oldest)
- `pytest test/hypnos/test_ltm_determinism.py -x -q`: 1 passed (byte-identical hash on two fresh stores)
- `pytest test/hypnos/test_shy_boundedness.py -x -q`: 1 passed (max_weight <= 0.21 after 100 cycles)
- `pytest test/test_hypnos_no_walltime.py -x -q`: 1 passed (no wall-clock in hypnos/)
- `pytest test/hypnos/ test/test_hypnos_no_walltime.py -q`: 7 passed (all hypnos tests including Plan 05 stubs)
- Full brain suite: 582 passed, 1 pre-existing failure (ananke/test_loader.py — unrelated)

## Key Grep Verifications

- `config.py`: `HYPNOS_ETA: float = 0.01` and `SLEEP_MIN_INTERVAL: int = 30` confirmed
- `working_memory.py`: `CAP = 7` and `deque(maxlen=self.CAP)` confirmed
- `ltm_store.py`: `PRAGMA journal_mode=WAL` and `scale_all_edges` confirmed
- `consolidator.py`: `hebbian_pass` and `shy_downscale` with `store.scale_all_edges` delegation confirmed
- `runtime.py`: no `datetime`/`time.time`/`random`/`uuid`/`os.urandom` confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HypnosRuntime required positional eta/sigma broke Plan 01 stubs**
- **Found during:** Task 2 verification (running full hypnos test suite)
- **Issue:** Plan 01 stubs `test_zero_diff.py` and `test_ltm_retrieval_perf.py` call `HypnosRuntime(store)` without eta/sigma; plan spec showed explicit args only in `test_ltm_determinism.py`
- **Fix:** Made `eta` and `sigma` default to `HYPNOS_ETA`/`HYPNOS_SIGMA` from config; added `retrieve_top_k` method (Plan 05 seam used by `test_ltm_retrieval_perf.py`)
- **Files modified:** `runtime.py`
- **Commit:** eeeee73

**2. [Rule 1 - Bug] Docstring mentions of forbidden walltime strings triggered grep gate**
- **Found during:** Task 1 wall-clock test run
- **Issue:** Docstrings in `__init__.py`, `config.py`, `types.py` listed forbidden patterns verbatim (e.g. "datetime, time.time, os.urandom") — the grep gate is a simple substring match, not import-only
- **Fix:** Reworded docstrings to say "Wall-clock FORBIDDEN: no wall-clock imports allowed (see T-16-03)" without listing the forbidden strings
- **Files modified:** `__init__.py`, `config.py`, `types.py`
- **Commit:** c83a961

## Known Stubs

`retrieve_top_k` in `runtime.py` is a functional implementation (not a stub), added to satisfy the `test_ltm_retrieval_perf.py` Plan 05 test. It uses `store.retrieve_candidates` with recency re-ranking. Full integration into prompt-build path is Plan 03.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All new surface is Brain-private SQLite WAL stores under `ltm_{did_safe}.db`. Content never crosses the Brain-Grid wire — only `ltm_snapshot_hash` (sha256 hexdigest) will cross in Plan 03 emitters.

T-16-03 (wall-clock tampering) mitigated: `test_hypnos_no_walltime.py` grep gate passes (all 7 hypnos source files clean).
T-16-01 (content_hash storage) mitigated: `ltm_nodes.content_hash` stores SHA-256 hexdigest, not episode prose.

## Self-Check

**Commits exist:**
- c83a961: feat(16-02): hypnos config + types + working_memory — HYP-01 green
- eeeee73: feat(16-02): ltm_store + consolidator + runtime — HYP-02 HYP-03 green

**Files exist:**
- brain/src/noesis_brain/hypnos/__init__.py: created
- brain/src/noesis_brain/hypnos/config.py: created
- brain/src/noesis_brain/hypnos/types.py: created
- brain/src/noesis_brain/hypnos/working_memory.py: created
- brain/src/noesis_brain/hypnos/ltm_store.py: created
- brain/src/noesis_brain/hypnos/consolidator.py: created
- brain/src/noesis_brain/hypnos/runtime.py: created
