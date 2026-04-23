---
phase: 10b
plan: "04"
subsystem: brain-chronos
tags: [chronos, subjective-time, memory-retrieval, bios-handler, inner-life]
dependency_graph:
  requires: [10b-02]
  provides: [chronos-subsystem, tick-based-retrieval, bios-handler-wiring]
  affects: [brain/chronos, brain/memory/retrieval, brain/rpc/handler, brain/prompts/system]
tech_stack:
  added: [noesis_brain.chronos, noesis_brain.rpc.types.BIOS_DEATH]
  patterns: [compute_multiplier, recency_score_by_tick, score_with_chronos, _get_or_create_bios]
key_files:
  created:
    - brain/src/noesis_brain/chronos/__init__.py
    - brain/src/noesis_brain/chronos/types.py
    - brain/src/noesis_brain/chronos/subjective_time.py
  modified:
    - brain/src/noesis_brain/memory/retrieval.py
    - brain/src/noesis_brain/rpc/handler.py
    - brain/src/noesis_brain/rpc/types.py
    - brain/src/noesis_brain/prompts/system.py
    - brain/test/chronos/test_retrieval_with_chronos.py
    - brain/test/ananke/test_loader.py
decisions:
  - "compute_multiplier (not compute_subjective_multiplier) — matched existing Wave 0 test import"
  - "EPOCH_UTC sentinel in retrieval.py — removes datetime.now() call while preserving legacy signature"
  - "BIOS_DEATH added to ActionType enum (count: 7 → 8)"
  - "set_birth_tick(did, tick) on handler — Grid spawner can record birth tick for epoch accuracy"
  - "bios.on_tick passes no ananke ref — handler wires it separately via _get_or_create_ananke"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-22"
  tasks: 3
  files_created: 3
  files_modified: 7
---

# Phase 10b Plan 04: Brain Chronos Retrieval Summary

**One-liner:** Chronos subjective-time subsystem: tick-based memory recency modulated by curiosity/boredom multiplier [0.25, 4.0], BiosRuntime wired into handler tick loop with starvation death signal, Bios + epoch + multiplier injected into system prompt.

## What Was Built

### Task 1: Chronos Subsystem (subjective_time formula)

Created `brain/src/noesis_brain/chronos/` with three files:

- **types.py**: `CURIOSITY_BOOST` + `BOREDOM_PENALTY` lookup tables + `SUBJECTIVE_MULT_MIN/MAX` bounds per D-10b-05 (locked).
- **subjective_time.py**: Three pure functions exported as top-level symbols:
  - `compute_multiplier(curiosity_level, boredom_level) → float` — formula: `clamp(1.0 + boost[curiosity] - penalty[boredom], 0.25, 4.0)`
  - `recency_score_by_tick(memory, current_tick, decay_rate=0.99) → float` — `decay_rate ** max(0, current_tick - memory.tick)`
  - `score_with_chronos(memory, current_tick, multiplier, decay_rate=0.99) → float` — `min(1.0, recency * multiplier)`
- **__init__.py**: Re-exports all three functions and the constants.

Formula anchor values (all pinned by test_subjective_time.py):
- LOW/LOW → 1.0 (neutral)
- HIGH/LOW → 4.0 (max curiosity, no boredom)
- LOW/HIGH → 0.25 (no curiosity, max boredom)
- HIGH/HIGH → 3.25 (1+3-0.75)

### Task 2: Tick-based recency in retrieval.py

Added to `RetrievalScorer`:
- `recency_score_by_tick(memory, current_tick)` — tick-based, no wall-clock.
- `score_with_chronos(memory, query, current_tick, chronos_multiplier=1.0)` — full Stanford score with Chronos-biased recency.

Removed internal `datetime.now()` call from the legacy `recency_score` path; replaced with `_EPOCH_UTC` sentinel (returns near-zero score when caller omits `now`, preserving the signature without any wall-clock reads in this module).

Fixed `test_retrieval_with_chronos.py`'s `_make_memory` helper — the Wave 0 stub used wrong field names (`kind`, `text`, `speaker`) not matching the actual `Memory` dataclass (`memory_type`, `content`).

### Task 3: Handler + System Prompt wiring

**rpc/types.py**: Added `BIOS_DEATH = "bios_death"` to `ActionType` (8th member). Grid plan 10b-05 will consume this to emit the `bios.death` audit event.

**rpc/handler.py**:
- Added `_bios_loader: BiosLoader`, `_bios_runtimes: dict[str, BiosRuntime]`, `_bios_birth_ticks: dict[str, int]`.
- `_get_or_create_bios(did)` — mirrors `_get_or_create_ananke` pattern (SHA-256 seed, lazy memoization).
- `set_birth_tick(did, birth_tick)` — Grid spawner records birth tick for `epoch_since_spawn` accuracy.
- `on_tick`: after Ananke step, calls `bios.on_tick(tick)` + `bios.drain_death()` → enqueues `BIOS_DEATH` action with `cause=starvation` (T-10b-04-03: flag consumed on drain, no re-fire).
- `on_message`: computes `subjective_multiplier` and `epoch_since_spawn`, passes to `build_system_prompt`.

**prompts/system.py**:
- `build_system_prompt` extended with keyword-only args `bios_snapshot`, `epoch_since_spawn`, `subjective_multiplier` (all default `None` — backward-compatible).
- `_context_section` extended to inject Bios need levels (bucket strings only, never floats — T-10b-04-01), epoch ticks, and rounded multiplier string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture used wrong Memory field names**
- **Found during:** Task 2
- **Issue:** `test_retrieval_with_chronos.py:38` `_make_memory` used `kind`, `text`, `speaker`, `channel` args — not fields on the actual `Memory` dataclass (`memory_type`, `content`). Wave 0 stub was written speculatively.
- **Fix:** Updated `_make_memory` to `Memory(memory_type=MemoryType.OBSERVATION, content="x", tick=tick)`.
- **Files modified:** `brain/test/chronos/test_retrieval_with_chronos.py`
- **Commit:** d0b7a33

**2. [Rule 1 - Bug] ActionType count assertion stale after BIOS_DEATH addition**
- **Found during:** Task 3
- **Issue:** `test_loader.py:65` asserted `len(list(ActionType)) == 7`; adding `BIOS_DEATH` made it 8.
- **Fix:** Updated assertion to `== 8` with updated comment.
- **Files modified:** `brain/test/ananke/test_loader.py`
- **Commit:** 49585e2

**3. [Rule 2 - Missing critical functionality] datetime.now() still present in retrieval.py legacy path**
- **Found during:** Task 2 verification
- **Issue:** Plan required zero wall-clock reads; the legacy `recency_score(now=None)` default called `datetime.now()`.
- **Fix:** Replaced `datetime.now()` with `_EPOCH_UTC` constant sentinel. Legacy callers that pass explicit `now` are unaffected (all existing tests do). Internal wall-clock reads eliminated.
- **Files modified:** `brain/src/noesis_brain/memory/retrieval.py`
- **Commit:** d0b7a33

## Verification Results

```
brain tests: 385 passed, 0 failed
chronos + bios + memory + rpc + prompts: 139 passed
rg "datetime.now(|time.time()" brain/src/noesis_brain/memory/retrieval.py brain/src/noesis_brain/chronos/: CLEAN
rg "chronos\.\w+" grid/src/audit/broadcast-allowlist.ts: no event entries (comment only)
_get_or_create_bios in handler.py: 4 matches
epoch_since_spawn in prompts/system.py: 5 matches
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | d2d1f48 | feat(10b-04): add Chronos subjective-time subsystem |
| Task 2 | d0b7a33 | feat(10b-04): replace datetime recency with tick-based + Chronos multiplier |
| Task 3 | 49585e2 | feat(10b-04): wire BiosRuntime + Chronos into handler and system prompt |

## Known Stubs

None — all three tasks fully wired with passing tests. The `epoch_since_spawn` in `on_message` defaults to `bios_rt.epoch_since_spawn(0)` (tick=0) until the Grid spawner calls `set_birth_tick(did, spawn_tick)`. This is a known limitation documented in the code comment; plan 10b-05 wires the spawn side.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes were introduced. All new surface is Brain-local (per D-10b-07). The `BIOS_DEATH` ActionType is a Brain→Grid signal that traverses the existing RPC channel — no new trust boundary.

## Self-Check: PASSED
