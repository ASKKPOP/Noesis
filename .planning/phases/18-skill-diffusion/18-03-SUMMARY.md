---
phase: 18-skill-diffusion
plan: "03"
subsystem: brain/learning
tags: [security, skill-diffusion, quarantine, did-filter, observational-learner, wave-1, tdd]
dependency_graph:
  requires: [18-01]
  provides: [OL-DID-filter, OL-quarantine-redirect, SKILL_INFERRED-action, SKILL_REJECTED-structural_invalid, QuarantineStore-module]
  affects:
    - brain/src/noesis_brain/learning/observational.py
    - brain/src/noesis_brain/skills/quarantine.py
    - brain/src/noesis_brain/rpc/types.py
tech_stack:
  added: []
  patterns: [DID-numeric-filter, quarantine-redirect, tdd-red-green, skill-lifecycle-actions]
key_files:
  created:
    - brain/src/noesis_brain/skills/quarantine.py
    - brain/test/skills/__init__.py
    - brain/test/skills/test_ol_filter_and_quarantine.py
  modified:
    - brain/src/noesis_brain/learning/observational.py
    - brain/src/noesis_brain/rpc/types.py
    - brain/test/ananke/test_loader.py
decisions:
  - "source_event_hash synthesised as sha256(buyer|seller|item|tick) — observe_trade() receives no raw audit event hash, so a deterministic canonical form is used (D-18-10 compliant)"
  - "ActionType.SKILL_TAUGHT/SKILL_INFERRED/SKILL_REJECTED added here (parallel to Plan 02) — merge will reconcile identical additions"
  - "QuarantineStore created here (parallel to Plan 02) — merge will reconcile identical file"
  - "test_loader.py ActionType count gate updated from 11 to 23 to reflect Phase 18 additions"
  - "asyncio.run() used instead of deprecated asyncio.get_event_loop().run_until_complete() for Python 3.12 compatibility"
metrics:
  duration: "~18 minutes"
  completed: "2026-05-16T17:00:00Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 3
  files_modified: 3
requirements: [SKILL-02]
---

# Phase 18 Plan 03: OL DID/Numeric Filter + Quarantine Redirect Summary

**One-liner:** ObservationalLearner extended with `_STRUCTURAL_INVALID_RE` DID/numeric filter and QuarantineStore redirect — OL-inferred skills now go through quarantine before becoming active, with SKILL_REJECTED on filter hit and SKILL_INFERRED on enqueue.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for OL filter + quarantine | 969c9ed | test/skills/test_ol_filter_and_quarantine.py |
| 1 (GREEN) | OL DID/numeric filter + quarantine redirect | 4a5a0bf | observational.py, quarantine.py, types.py, test_loader.py |

## What Was Built

**Task 1 (TDD — RED/GREEN):**

**RED phase** — 15 failing tests covering:
- `TestStructuralInvalidRegex`: 6 tests verifying `_STRUCTURAL_INVALID_RE` at module level matches DID references and 4+ digit integers, passes clean text and 3-digit numbers.
- `TestOLDIDFilter`: 3 tests — SKILL_REJECTED on DID text, SKILL_REJECTED on numeric text, SKILL_INFERRED on clean text.
- `TestOLQuarantineRedirect`: 3 tests — quarantine.enqueue called not skill_store.add, SKILL_INFERRED action has skill_hash + source_event_hash (64-char hex), offline mode returns Skill not Action.
- `TestOLDedupCheck`: 1 test — dedup against quarantine (Pitfall 6: pre-populated quarantine returns None).
- `TestOLRateLimitPreserved`: 2 tests — MIN_OBSERVATIONS_BEFORE_EXTRACT == 2, first observation defers.

**GREEN phase** — Implementation:

1. `brain/src/noesis_brain/rpc/types.py` — Added `SKILL_TAUGHT`, `SKILL_INFERRED`, `SKILL_REJECTED` ActionType members after `IRIS_PRIOR_SEEDED` with Phase 18 comment block (D-18-09).

2. `brain/src/noesis_brain/skills/quarantine.py` (new) — `QuarantineStore` class:
   - `_ensure_table()`: creates `skills_quarantine` table (5-column D-18-03 schema)
   - `enqueue()`: INSERT OR IGNORE with promote_at_tick = tick + QUARANTINE_TICKS
   - `sweep()`: re-checks trust per D-18-02; promotes or evicts
   - `has()`: dedup gate for Pitfall 6
   - `QUARANTINE_TICKS` env-configurable (D-18-01), default 5
   - Imports `TRUST_THRESHOLD_SKILL` from peer_filter (single source of truth)

3. `brain/src/noesis_brain/learning/observational.py` — Three changes:
   - Added `_STRUCTURAL_INVALID_RE = re.compile(r'\bdid:noesis:\S+\b|\b\d{4,}\b')` at module level after imports
   - Added `quarantine_store: QuarantineStore | None = None` parameter to `__init__`, stored as `self._quarantine_store`
   - In `observe_trade()`, after LLM extraction:
     1. Filter check → returns `Action(SKILL_REJECTED, {rejection_reason: structural_invalid})` on match
     2. Dedup against quarantine (`has()` check) after active-store slug check
     3. Quarantine path → `_quarantine_store.enqueue()` + returns `Action(SKILL_INFERRED, {skill_hash, source_event_hash})`
     4. Offline path (quarantine_store=None) → original `_skill_store.add()` preserved

## Verification

```
grep -n "STRUCTURAL_INVALID_RE" brain/src/noesis_brain/learning/observational.py
# Line 44: module-level definition
# Line 176: search() call in observe_trade()

grep -n "_quarantine_store.enqueue" brain/src/noesis_brain/learning/observational.py
# Line 219: quarantine enqueue call

grep -n "SKILL_INFERRED" brain/src/noesis_brain/learning/observational.py
# Line 237: ActionType.SKILL_INFERRED returned

Full suite: 602 passed, 0 failed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] asyncio.get_event_loop() deprecated in Python 3.12**
- **Found during:** GREEN phase test run in full suite (after other async tests ran)
- **Issue:** `asyncio.get_event_loop().run_until_complete()` raises RuntimeError in Python 3.12 when no current event loop exists
- **Fix:** Replaced all occurrences in test file with `asyncio.run()`
- **Files modified:** `brain/test/skills/test_ol_filter_and_quarantine.py`
- **Commit:** 4a5a0bf

**2. [Rule 2 - Missing critical] ActionType count gate in test_loader.py**
- **Found during:** GREEN phase full test suite run
- **Issue:** `test_action_type_drive_crossed_present` asserted `len(ActionType) == 11` — outdated since Phase 12 (pre-existing brittle test that already failed in main with 20 members); adding 3 Phase 18 members makes it 23
- **Fix:** Updated assertion comment and count from 11 to 23
- **Files modified:** `brain/test/ananke/test_loader.py`
- **Commit:** 4a5a0bf

**3. [Rule 3 - Blocking] ActionType.SKILL_INFERRED/SKILL_REJECTED not yet present**
- **Found during:** Pre-implementation analysis (Plan 02 not yet run — parallel wave)
- **Issue:** Plan 03 depends on SKILL_INFERRED/SKILL_REJECTED from Plan 02, but Plan 02 runs in parallel
- **Fix:** Added all 3 ActionType members (SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED) and created QuarantineStore here; merge will reconcile identical additions from Plan 02
- **Files modified:** `brain/src/noesis_brain/rpc/types.py`, `brain/src/noesis_brain/skills/quarantine.py`
- **Commit:** 4a5a0bf

**4. [Rule 1 - Bug] source_event_hash not passed to observe_trade()**
- **Found during:** Implementation — `observe_trade()` signature has no `source_event_hash` parameter
- **Issue:** Plan specified `source_event_hash` in SKILL_INFERRED metadata from the trade.settled event hash, but the call site doesn't pass one
- **Fix:** Synthesised deterministically as `sha256(buyer|seller|item|tick)` — canonical and reproducible from the trade identity tuple (D-18-10 compliant); no raw audit event hash needed
- **Files modified:** `brain/src/noesis_brain/learning/observational.py`
- **Commit:** 4a5a0bf

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-18-01: DID injection in OL-extracted text | `_STRUCTURAL_INVALID_RE` applied synchronously before quarantine entry; emits SKILL_REJECTED(structural_invalid) on match | Mitigated |
| T-18-02: OL inference loop bypass via dedup skip | Dedup checks both active SkillStore (slug) AND quarantine (skill_hash.has()) | Mitigated |
| T-18-03: OL skill body on wire | SKILL_INFERRED metadata carries only skill_hash + source_event_hash — no instructions text | Mitigated |

## Known Stubs

None — all code paths are wired. The quarantine sweep path (Plan 02) is a separate plan; Plan 03 only wires the OL enqueue side.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Changes are Brain-internal only (quarantine is a Brain-local SQLite table).

## Self-Check: PASSED

- `brain/src/noesis_brain/learning/observational.py` — exists, contains _STRUCTURAL_INVALID_RE at line 44 ✓
- `brain/src/noesis_brain/skills/quarantine.py` — exists, QuarantineStore importable ✓
- `brain/src/noesis_brain/rpc/types.py` — SKILL_INFERRED, SKILL_REJECTED present ✓
- `brain/test/skills/test_ol_filter_and_quarantine.py` — 15 tests all pass ✓
- Commit 969c9ed (RED) exists ✓
- Commit 4a5a0bf (GREEN) exists ✓
- Full Brain test suite: 602 passed, 0 failed ✓
