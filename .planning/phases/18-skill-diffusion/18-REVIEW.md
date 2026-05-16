---
phase: 18-skill-diffusion
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - brain/src/noesis_brain/learning/observational.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/rpc/types.py
  - brain/src/noesis_brain/skills/peer_filter.py
  - brain/src/noesis_brain/skills/quarantine.py
  - brain/src/noesis_brain/skills/store.py
  - brain/test/test_observational_filter.py
  - brain/test/test_quarantine_store.py
  - brain/test/test_skill_diffusion_wiring.py
  - brain/test/test_skill_lineage.py
  - brain/test/test_skill_quarantine.py
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/skills/appendSkillInferred.ts
  - grid/src/skills/appendSkillRejected.ts
  - grid/src/skills/appendSkillTaught.ts
  - grid/src/skills/index.ts
  - grid/src/skills/types.ts
  - grid/test/audit/skill-allowlist.test.ts
  - grid/test/skills/appendSkillInferred.test.ts
  - grid/test/skills/appendSkillRejected.test.ts
  - grid/test/skills/appendSkillTaught.test.ts
  - grid/test/skills/skill-privacy.test.ts
  - grid/test/skills/skill-producer-boundary.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This phase introduces skill diffusion wiring across the Brain and Grid: a `QuarantineStore` holding inbound peer skills for a trust re-check window, a `PeerSkillFilter` for admission control, `ObservationalLearner` routing to quarantine instead of the active store, three new `ActionType` members, and three sole-producer Grid emitters (`appendSkillTaught`, `appendSkillInferred`, `appendSkillRejected`). The architecture is well-structured and the security model is sound. All privacy invariants and sole-producer boundaries are correctly enforced.

Four warnings and four info items were found. No critical issues.

## Warnings

### WR-01: Duplicate method definitions in `handler.py` — `hash_state`, `query_memory`, `force_telos`, `_build_refined_telos`, `_dialogue_driven_goal_set`

**File:** `brain/src/noesis_brain/rpc/handler.py:858-895` and `brain/src/noesis_brain/rpc/handler.py:1143-1354`

**Issue:** `BrainHandler` contains verbatim duplicate definitions of five methods: `hash_state` (lines 858 and 881), `query_memory` (lines 922 and 1143), `force_telos` (lines 973 and 1194), `_build_refined_telos` (lines 1022 and 1243), and `_dialogue_driven_goal_set` (lines 1082 and 1303). In Python, later definitions silently shadow earlier ones. The earlier copy of each method is dead code and will never execute. This is a copy-paste artifact that creates a maintenance hazard: edits to the first copy have no effect, which can cause silent regressions when someone modifies the wrong copy.

**Fix:** Remove the first occurrence of each duplicated method (lines 858–1133 of the file are entirely duplicated below). Keep only the second (latter) block. Run `grep -n "def hash_state\|def query_memory\|def force_telos\|def _build_refined_telos\|def _dialogue_driven_goal_set" handler.py` to verify exactly one definition of each.

---

### WR-02: `SKILL_REJECTED` action returned from `observe_trade()` carries wrong type — it returns an `Action` where a `Skill | None` is declared

**File:** `brain/src/noesis_brain/learning/observational.py:181-186`

**Issue:** `observe_trade()` is typed to return `Skill | None`. When the structural-invalid filter triggers, the method returns an `Action` object instead:

```python
return Action(
    action_type=ActionType.SKILL_REJECTED,
    metadata={"rejection_reason": "structural_invalid"},
)
```

This violates the declared return type. Any caller relying on `result is None` or `isinstance(result, Skill)` will silently get an `Action` that passes both checks (it is not `None` and not a `Skill`). In `handler.py` line 433, the return value of `observe_trade` is created as a task and discarded, so currently harmless — but the type mismatch is a latent bug that will become a real one the moment any caller inspects the return value.

**Fix:** Change the return type annotation to `Skill | Action | None` and update callers to handle all three cases, or — preferably — log the rejection and return `None` from `observe_trade`, then route the `SKILL_REJECTED` action through the same mechanism used by the quarantine path (i.e., append it to an output list rather than returning it).

---

### WR-03: `_peer_is_known` swallows all exceptions silently, masking DB errors as "peer not known"

**File:** `brain/src/noesis_brain/learning/observational.py:304-313`

**Issue:** The bare `except Exception` in `_peer_is_known` returns `False` on any error, including `sqlite3.OperationalError` (schema mismatch, connection closed) or an attribute error on a malformed `WikiPage`. This means a broken DB connection silently prevents ALL observational learning without any log entry at any severity level higher than debug.

```python
except Exception:  # noqa: BLE001
    pass
return False
```

This is a case where the `pass` is genuinely masking operational failures, not gracefully degrading — the caller cannot distinguish "peer not in DB" from "DB is broken."

**Fix:** Add at minimum a `logger.warning` in the except branch:

```python
except Exception as exc:  # noqa: BLE001
    logger.warning("ObservationalLearner: _peer_is_known lookup failed: %s", exc)
return False
```

---

### WR-04: `on_message` skill-share path returns `[]` when `_peer_filter` or `_quarantine_store` is `None` — rejected payload is silently dropped, no `SKILL_REJECTED` action emitted

**File:** `brain/src/noesis_brain/rpc/handler.py:155-181`

**Issue:** When a `__skill_share:` message arrives but either `_peer_filter` or `_quarantine_store` is `None` (e.g., `hypnos_db_dir` was not set), the handler exits with `return []` at line 181 without emitting a `SKILL_REJECTED` action. This means the Grid-side NousRunner never learns that the skill was not processed. The comment at line 181 ("__skill_share is never a conversational reply") is correct for the intent, but the early-exit at line 156–181 when the components are absent is a silent drop, not a rejection.

For the `_peer_filter is None` branch specifically, no audit trail of the incoming skill share exists — an operator watching the audit chain cannot distinguish "skill was received and rejected" from "no skill was received."

**Fix:** When `_peer_filter is None` or `_quarantine_store is None`, log at warning level and return `[]` (current behavior is acceptable to not emit `SKILL_REJECTED` since the filter was simply not wired, but the silent absence should be logged):

```python
if self._peer_filter is None or self._quarantine_store is None:
    logger.debug(
        "on_message: __skill_share received but skill components not wired "
        "(hypnos_db_dir not set) — dropping silently"
    )
    return []
```

## Info

### IN-01: Duplicate `import re` at module level in `observational.py`

**File:** `brain/src/noesis_brain/learning/observational.py:29` and `brain/src/noesis_brain/learning/observational.py:75`

**Issue:** `re` is imported twice — once as `_re_ol` on line 29 and once as `_re` on line 75, both at module level. Both are used for different compiled regex objects (`_STRUCTURAL_INVALID_RE` and `_SLUG_RE` respectively). Using two aliases for the same standard library module is confusing and unnecessarily splits the import block.

**Fix:** Remove the line 75 `import re as _re` and change line 76 to use the already-imported alias: `_SLUG_RE = _re_ol.compile(r"[^a-z0-9]+")`.

---

### IN-02: Deferred `import` statements inside hot-path methods in `observational.py`

**File:** `brain/src/noesis_brain/learning/observational.py:181-182` and `229-230`

**Issue:** `from noesis_brain.rpc.types import ActionType, Action` is imported inside `observe_trade()` at two separate locations (structural-invalid rejection branch and quarantine path). The comment says this avoids a circular import. The circular import issue should be resolved properly — deferred imports inside a hot-path async method are a code smell that makes dependency graph analysis harder and adds marginal overhead on each call.

**Fix:** Verify whether the circular import is real (it may be solvable with a `TYPE_CHECKING` guard or by moving `Action`/`ActionType` to a separate `types` module that neither `observational.py` nor `quarantine.py` imports from). If the circular import cannot be broken cleanly, consolidate the two deferred imports into a single block at the top of `observe_trade()`.

---

### IN-03: `skill-producer-boundary.test.ts` sole-producer check will include test files that contain the event string literals under `/src`

**File:** `grid/test/skills/skill-producer-boundary.test.ts:20`

**Issue:** The `walk()` function in this test starts from `GRID_SRC` (`grid/src`), so it only scans `src/` — test files under `grid/test/` are not in scope for the sole-producer check. This is correct and intentional. However, if a future file under `grid/src/` (e.g., a middleware or logging helper) imports and re-exports the event string for reasons other than production emit, the test would catch it. The test is well-written, but the regex used for the second invariant:

```ts
`\\b(?:audit|chain|this\\.audit|this\\.chain)\\.append[^;]{0,200}['"\`]${escapedEvent}['"\`]`
```

uses a dot-separated multiline scan with `'s'` flag. If an `audit.append` call spans more than 200 characters of arguments before the event literal, the match will silently miss it. This could allow a non-sole-producer emit to go undetected.

**Fix:** Increase the `[^;]{0,200}` character budget or use a lookahead on the event literal rather than a fixed-width prefix: e.g., scan for the event literal anywhere in the same statement as `audit.append`.

---

### IN-04: `QuarantineStore.enqueue` silently drops DB errors including `sqlite3.Error` with no log

**File:** `brain/src/noesis_brain/skills/quarantine.py:103-104`

**Issue:** The `except sqlite3.Error: pass` at line 103 is completely silent — not even a `logger.debug` entry. When a quarantine enqueue fails (e.g., due to schema incompatibility or a locked WAL), the caller receives no indication. Since `enqueue` is called from the on_tick hot path as well as from the skill-share handler, silent failures here mean accepted skills are silently lost.

**Fix:** Add a debug log in the except branch:

```python
except sqlite3.Error as exc:
    logger.debug("QuarantineStore.enqueue: DB error (skill silently dropped): %s", exc)
```

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
