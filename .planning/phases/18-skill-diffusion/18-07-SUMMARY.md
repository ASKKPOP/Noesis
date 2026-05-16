---
plan: 18-07
phase: 18-skill-diffusion
status: complete
gap_closure: true
requirements: [SKILL-02]
---

## Summary

Added a tick-based epoch gate (`SLEEP_EPOCH_TICKS = 30`) to `ObservationalLearner.observe_trade()` to rate-limit LLM skill extraction and prevent cost runaway during burst observation windows.

## What Was Built

**`brain/src/noesis_brain/learning/observational.py`**
- Added `SLEEP_EPOCH_TICKS: int = 30` module constant alongside `MIN_OBSERVATIONS_BEFORE_EXTRACT`
- Added `self._last_extraction_tick: int = 0` instance variable in `__init__`
- Inserted Gate 2b between the count gate and slug-exists gate: silently returns `None` (no event emitted) when `tick - self._last_extraction_tick < SLEEP_EPOCH_TICKS`
- Added `self._last_extraction_tick = tick` immediately before `skill = Skill(...)` so both code paths (quarantine and offline/test) reset the gate on successful extraction

**`brain/test/test_observational_filter.py`**
- Added `class TestTickGate` with 4 tests: `test_extraction_allowed_after_30_ticks`, `test_extraction_blocked_before_30_ticks`, `test_count_gate_blocks_regardless_of_tick_gap`, `test_last_extraction_tick_updated_after_extraction`
- Updated `TestSourcePassthrough` to use tick=0/tick=30 so the triggering observation clears the tick gate

## Test Results

```
15 passed in 0.06s (11 prior + 4 new TestTickGate)
```

## Key Files

- `brain/src/noesis_brain/learning/observational.py` — tick gate implementation
- `brain/test/test_observational_filter.py` — TestTickGate class

## Self-Check: PASSED

- ✅ `SLEEP_EPOCH_TICKS: int = 30` present on line 58
- ✅ `_last_extraction_tick: int = 0` initialized in `__init__` (line 117)
- ✅ Tick gate at line 163–170 (after count gate, before slug-exists gate)
- ✅ `_last_extraction_tick = tick` assigned on line 222 before `skill = Skill(`
- ✅ All 15 tests pass, 0 regressions
- ✅ SKILL-02 UAT gap closed
