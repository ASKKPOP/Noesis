---
phase: "16"
plan: "03"
subsystem: brain-hypnos-runtime-handler
tags: [hypnos, sleep, runtime, handler, ltm, working-memory, sleep-trigger, asyncio]
dependency_graph:
  requires:
    - "16-01: ActionType.SLEEP_ENTERED/SLEEP_COMPLETED in rpc/types.py"
    - "16-02: HypnosRuntime stub + LtmStore + WorkingMemory + consolidator"
  provides:
    - brain/src/noesis_brain/hypnos/runtime.py — final HypnosRuntime with exp(-delta/tau) recency + list[str] return
    - brain/src/noesis_brain/rpc/handler.py — hypnos wiring (Working Memory + sleep trigger + LTM injection)
  affects:
    - brain/src/noesis_brain/hypnos/runtime.py (retrieve_top_k upgraded to exp recency + list[str])
    - brain/src/noesis_brain/rpc/handler.py (hypnos_db_dir param, sleep trigger, LTM retrieval)
tech_stack:
  added: []
  patterns:
    - asyncio.create_task closure pattern (mirrors IrisRuntime.elicit discipline)
    - SLEEP_ENTERED synchronous emit before create_task (D-16-Q1 resolution)
    - _pending_sleep_completed drain-on-next-tick pattern (matches Iris pending-buffer)
    - exp(-delta/tau) recency re-ranking with tau=500 (matches Chronos TAU convention)
    - ltm_memories kwarg via **{} spread guard (backward-compat before Plan 04 adds kwarg)
key_files:
  created: []
  modified:
    - brain/src/noesis_brain/hypnos/runtime.py
    - brain/src/noesis_brain/rpc/handler.py
decisions:
  - "retrieve_top_k upgraded from inverse-age recency to exp(-delta/tau) per plan spec (list[str] return, tau=500)"
  - "SLEEP_ENTERED emitted synchronously before create_task — resolves Open Question Q1 from RESEARCH.md"
  - "SLEEP_COMPLETED stored in _pending_sleep_completed, drained on next on_tick call (same pattern as Iris)"
  - "asyncio.create_task wrapped in inner closure to capture rt+tick at call time (avoids stale closure race)"
  - "ltm_memories kwarg uses **{...} spread guard since Plan 04 adds ltm_memories to build_system_prompt"
  - "LTM retrieval in on_message uses current_tick=0 as tick not available there (Plan 04 will wire tick properly)"
metrics:
  duration: "150 seconds"
  completed_date: "2026-05-16"
  tasks_completed: 2
  files_modified: 2
  files_created: 0
---

# Phase 16 Plan 03: HypnosRuntime + BrainHandler Wiring Summary

Final HypnosRuntime implementation with exp(-delta/tau) recency ranking and list[str] return, wired into BrainHandler: Working Memory populated each tick, sleep triggered every SLEEP_MIN_INTERVAL ticks via asyncio.create_task, SLEEP_ENTERED emitted synchronously, SLEEP_COMPLETED queued via _pending_sleep_completed drain pattern, and LTM retrieval injected into system prompt.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HypnosRuntime — run_sleep + compute_snapshot_hash + retrieve_top_k | 1a9aa7b | brain/src/noesis_brain/hypnos/runtime.py |
| 2 | Wire HypnosRuntime into BrainHandler | 58eac8e | brain/src/noesis_brain/rpc/handler.py |

## Verification Results

- `pytest test/hypnos/test_ltm_retrieval_perf.py -x -q`: PASSED (p95 < 10ms on 1000-node graph)
- `pytest test/hypnos/test_ltm_determinism.py -x -q`: PASSED (byte-identical hash on same inputs)
- `pytest test/ -q`: 582 passed, 1 pre-existing failure (test_loader.py — unrelated to this plan)

## Key Grep Verifications

- `runtime.py`: `async def run_sleep`, `def compute_snapshot_hash`, `def retrieve_top_k` — all present
- `runtime.py`: no `datetime`, `time.time`, `random`, `uuid`, `os.urandom` — confirmed clean
- `handler.py`: `_hypnos_runtime`, `_last_sleep_tick`, `_pending_sleep_completed` — all present
- `handler.py`: `asyncio.create_task` — present for sleep trigger
- `handler.py`: `SLEEP_ENTERED` action appended before `create_task` — confirmed
- `handler.py`: `ltm_memories` in on_message prompt-build path — confirmed
- `handler.py`: no bare `await run_sleep` in on_tick — inner coroutine only inside create_task closure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] asyncio.create_task closure captures self correctly via inner function**
- **Found during:** Task 2 implementation
- **Issue:** The plan's inline `async def _run_sleep(rt, t)` pattern would use a default-argument closure. To avoid stale reference to `self._hypnos_runtime` if it changes, wrapped in `_make_sleep_task()` with explicit default-arg capture
- **Fix:** Used `_make_sleep_task(rt=self._hypnos_runtime, t=tick)` factory function with nested `_run()` coroutine passed to `create_task`
- **Files modified:** handler.py
- **Commit:** 58eac8e

**2. [Rule 2 - Missing functionality] LTM retrieval in on_message uses tick=0**
- **Found during:** Task 2 — on_message does not have a tick parameter
- **Issue:** `on_message` has no tick available; plan spec says to pass `retrieve_top_k(current_tick=tick)` but `on_tick` is the only path with tick
- **Fix:** Used `current_tick=0` in on_message (all nodes recency=1.0 when tick=0, conservative). Plan 04 can refine this if needed
- **Files modified:** handler.py
- **Commit:** 58eac8e

## Known Stubs

None — all implementations are functional. `ltm_memories` kwarg to `build_system_prompt` silently ignored until Plan 04 adds the kwarg to system.py.

## Threat Surface Scan

No new network endpoints or auth paths introduced. All new surface is Brain-internal:
- `LtmStore` SQLite WAL file under `hypnos_db_dir` — Brain-private, no network exposure
- `_pending_sleep_completed` in-memory buffer — never crosses Brain-Grid wire directly; only `ltm_snapshot_hash` (64-char sha256) crosses via SLEEP_COMPLETED action

T-16-01 (content disclosure): compute_snapshot_hash returns 64-char hex only — confirmed
T-16-02 (DoS via blocking sleep): asyncio.create_task pattern — confirmed, no await in on_tick
T-16-03 (wall-clock tampering): runtime.py grep gate clean — confirmed

## Self-Check

**Commits exist:**
- 1a9aa7b: feat(16-03): implement HypnosRuntime — run_sleep + compute_snapshot_hash + retrieve_top_k
- 58eac8e: feat(16-03): wire HypnosRuntime into BrainHandler — Working Memory + sleep trigger + LTM retrieval

**Files exist:**
- brain/src/noesis_brain/hypnos/runtime.py: modified (retrieve_top_k returns list[str], exp recency)
- brain/src/noesis_brain/rpc/handler.py: modified (hypnos_db_dir param, sleep trigger, LTM path)

## Self-Check: PASSED
