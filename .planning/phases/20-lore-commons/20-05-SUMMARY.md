---
phase: 20-lore-commons
plan: "20-05"
subsystem: brain-lore-injection, grid-lore-wiring
tags: [gap-closure, lore-commons, brain, grid, LORE-02, LORE-03]
dependency_graph:
  requires: [20-04]
  provides: [LORE-02-gap-closed, LORE-03-gap-closed]
  affects: [brain/rpc/handler.py, grid/genesis/launcher.ts]
tech_stack:
  patterns: [instance-cache-pattern, conditional-kwarg-injection, FTS5-retrieval, LoreQuotaTracker-wiring]
key_files:
  modified:
    - brain/src/noesis_brain/rpc/handler.py
    - grid/src/genesis/launcher.ts
  created:
    - brain/test/lore/test_lore_prompt_injection.py
    - grid/test/lore/lore-wiring.test.ts
decisions:
  - "Used FTS5-compatible lore content in on_tick test (words overlapping with TelosManager.describe() → 'No active goals.') to ensure LoreStore.retrieve() returns non-empty results in test context"
  - "Followed ltm_memories/peer_voices conditional kwarg injection pattern exactly for lore_entries"
  - "Used TEST_CONFIG preset for GenesisLauncher construction in wiring test (same pattern as existing genesis tests)"
metrics:
  duration: ~12 minutes
  completed: 2026-05-17
  tasks_completed: 3
  files_changed: 4
requirements: [LORE-02, LORE-03]
---

# Phase 20 Plan 05: Lore Gap Closure Summary

Gap closure for LORE-02 and LORE-03 partial failures identified in 20-VERIFICATION.md — wiring `lore_entries_for_prompt` to `build_system_prompt` via instance cache, and exposing `LoreQuotaTracker` from `GenesisLauncher` so quota enforcement is live at runtime.

## What Was Built

### Gap 1 — LORE-02: lore_entries_for_prompt never reached build_system_prompt

Three surgical changes to `brain/src/noesis_brain/rpc/handler.py`:

1. `__init__`: Added `self._cached_lore_entries: "list | None" = None` alongside existing lore state fields (after `self._pending_actions`).
2. `on_tick()`: After the LORE_CITED action loop, assigned `self._cached_lore_entries = lore_entries_for_prompt if lore_entries_for_prompt else None` inside the `if self._lore_store is not None:` block.
3. `on_message()`: Added `**({"lore_entries": self._cached_lore_entries} if self._cached_lore_entries else {})` to the `build_system_prompt()` call — mirroring the exact `ltm_memories`/`peer_voices` conditional kwarg pattern.

### Gap 2 — LORE-03: loreDeps undefined at runtime

Three changes to `grid/src/genesis/launcher.ts`:

1. Import: `import { LoreQuotaTracker } from '../lore/LoreQuotaTracker.js';`
2. Property: `readonly loreQuotaTracker: LoreQuotaTracker;` declared after `governanceStore`.
3. Constructor: `this.loreQuotaTracker = new LoreQuotaTracker();` added after `GovernanceEngine` construction.

### Tests

- `brain/test/lore/test_lore_prompt_injection.py` — 6 tests:
  - 4 direct `build_system_prompt` tests: None/[]/[entry] lore_entries behavior + body text appearance
  - 2 handler tests: `_cached_lore_entries` is None on init; non-empty after `on_tick()` with matching LoreStore entry
- `grid/test/lore/lore-wiring.test.ts` — 4 tests:
  - `loreQuotaTracker` is defined, instanceof LoreQuotaTracker, enforces K=3, resets at epoch boundary

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d767f56 | fix | Wire _cached_lore_entries to build_system_prompt in handler.py |
| 2c7d4e9 | test | Brain test — assert '## Lore Commons' in build_system_prompt when LoreStore has entries |
| 80f1a7c | feat | Add loreQuotaTracker to GenesisLauncher + wiring test |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LoreEntry field names in test template were wrong**
- **Found during:** Task 2
- **Issue:** Plan template used `body` and `tick` as LoreEntry fields; actual fields are `content` and `received_tick`
- **Fix:** Used correct field names (`title`, `content`, `received_tick`) per `brain/src/noesis_brain/lore/types.py`
- **Files modified:** brain/test/lore/test_lore_prompt_injection.py

**2. [Rule 1 - Bug] Handler on_tick test params template was overly complex**
- **Found during:** Task 2
- **Issue:** Plan template showed `params = {"did": ..., "tick": 1, "runtime": MagicMock(...)}` but actual `on_tick` signature only uses `{"tick": N, "epoch": N}`
- **Fix:** Used the simple dict form consistent with all existing handler tests
- **Files modified:** brain/test/lore/test_lore_prompt_injection.py

**3. [Rule 1 - Bug] FTS5 retrieve() returns empty for query "No active goals." against "Patience is strength."**
- **Found during:** Task 2
- **Issue:** `test_cached_lore_entries_populated_after_on_tick_with_entries` failed because `TelosManager().describe()` returns `"No active goals."` and FTS5 doesn't match it against `"Patience is strength."` — so `_cached_lore_entries` stayed None
- **Fix:** Changed lore content to `"No goals are more active than shared wisdom."` — words overlapping with the telos query text ensure FTS5 returns a match
- **Files modified:** brain/test/lore/test_lore_prompt_injection.py

**4. [Rule 1 - Bug] Plan template used NousRpcHandler class name; actual class is BrainHandler**
- **Found during:** Task 2
- **Issue:** Import `from noesis_brain.rpc.handler import NousRpcHandler` failed; class is `BrainHandler`
- **Fix:** Corrected to `from noesis_brain.rpc.handler import BrainHandler`
- **Files modified:** brain/test/lore/test_lore_prompt_injection.py

**5. [Rule 2 - Pattern] Used TEST_CONFIG preset instead of hand-rolled minimal config**
- **Found during:** Task 3
- **Issue:** Plan template proposed a `makeMinimalConfig()` helper; existing genesis tests use `TEST_CONFIG` from `presets.js` which already handles all required fields
- **Fix:** Used `TEST_CONFIG` to match existing test conventions and avoid maintaining a parallel minimal config
- **Files modified:** grid/test/lore/lore-wiring.test.ts

## Verification Results

```
Brain lore suite:  16 passed (0.04s)
Brain full suite:  698 passed (2.46s) — was 692 + 6 new
Grid lore suite:   46 passed (0.48s) — includes 4 new wiring tests
Grid full suite:  1584 passed (6.88s) — was 1580 + 4 new
```

## Known Stubs

None — all data paths are wired. `_cached_lore_entries` flows from `LoreStore.retrieve()` → `on_tick()` → `build_system_prompt()` in `on_message()`. `loreQuotaTracker` is constructed and functional at launcher startup.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. Changes are internal to Brain asyncio event loop (single-threaded, no sync needed) and Grid constructor initialization (D-20-02/D-20-03 invariants preserved).

## Self-Check: PASSED

All created/modified files exist. All task commits verified. No unexpected deletions.
