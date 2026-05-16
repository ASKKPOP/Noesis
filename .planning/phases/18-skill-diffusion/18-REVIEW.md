---
phase: 18-skill-diffusion
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - brain/src/noesis_brain/learning/observational.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/rpc/types.py
  - brain/src/noesis_brain/skills/peer_filter.py
  - brain/src/noesis_brain/skills/quarantine.py
  - brain/src/noesis_brain/skills/store.py
  - brain/test/ananke/test_loader.py
  - brain/test/skills/__init__.py
  - brain/test/skills/test_ol_filter_and_quarantine.py
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
  - grid/test/audit/skill-allowlist-baseline.test.ts
  - grid/test/audit/skill-allowlist.test.ts
  - grid/test/skills/appendSkillInferred.test.ts
  - grid/test/skills/appendSkillRejected.test.ts
  - grid/test/skills/appendSkillTaught.test.ts
  - grid/test/skills/skill-privacy.test.ts
  - grid/test/skills/skill-producer-boundary.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 18 skill-diffusion wiring is well-structured. The three-path skill lifecycle (peer-taught via quarantine, observational via quarantine, rejected) is correctly separated. The `QuarantineStore` design (promote-at-tick, live trust re-check, atomic promotion) is sound. The Brain↔Grid boundary is correctly enforced: DID regex, HEX64 hash validation, closed-tuple assertion, prototype-pollution-resistant reconstruction, and privacy gate are all in place for all three sole-producer emitters. The sole-producer boundary is structurally enforced by a grep-style test that walks `grid/src/`.

Five warnings were found. The two most significant are: (1) the `ObservationalLearner` is constructed in `handler.py` without its `quarantine_store` reference, meaning all OL-inferred skills silently route through the offline/test path regardless of whether quarantine is wired; and (2) `handler.py` contains verbatim duplicated method blocks that create dead code and a maintenance hazard. Three additional correctness warnings concern a `NameError` lurking in the on_tick sweep path, a return type violation in `observe_trade()`, and a `return` where `break` is needed in `nous-runner.ts`.

---

## Warnings

### WR-01: `ObservationalLearner` constructed without `quarantine_store` despite one being available

**File:** `brain/src/noesis_brain/rpc/handler.py:103-109`

**Issue:** In `BrainHandler.__init__`, the `ObservationalLearner` is constructed at lines 104–111 **before** `_QuarantineStore` is constructed at lines 122–124. The `quarantine_store` parameter is therefore never passed:

```python
# lines 104-111
self._obs_learner = ObservationalLearner(
    store=self.memory,
    skill_store=_skill_store,
    llm=self.llm,
    my_name=self.psyche.name,
    # quarantine_store is missing — never passed
)
# ...
# lines 122-124
self._quarantine_store = _QuarantineStore(self.memory._conn)
```

As a result, `observe_trade()` always takes the `else` branch at line 244 (`_skill_store.add(skill)` — the offline/test path) and never routes through quarantine. SKILL-02 (OL skills routed via quarantine) is broken in production even though all the quarantine machinery is wired and tested correctly. The tests in `test_ol_filter_and_quarantine.py` pass because they construct `ObservationalLearner` directly with an explicit `quarantine_store=` argument.

**Fix:** Move `QuarantineStore` construction before `ObservationalLearner`, then pass it in:

```python
# Construct quarantine first
self._quarantine_store: _QuarantineStore | None = _QuarantineStore(
    self.memory._conn
)
# Then pass to OL
self._obs_learner = ObservationalLearner(
    store=self.memory,
    skill_store=_skill_store,
    llm=self.llm,
    my_name=self.psyche.name,
    quarantine_store=self._quarantine_store,
)
```

---

### WR-02: Duplicate method definitions in `handler.py` — dead code hazard

**File:** `brain/src/noesis_brain/rpc/handler.py:858-913` and `brain/src/noesis_brain/rpc/handler.py:1143-1371`

**Issue:** `BrainHandler` contains verbatim duplicate definitions of five methods: `hash_state` (lines 876 and 899), `query_memory` (lines 940 and 1161), `force_telos` (lines 991 and 1212), `_build_refined_telos` (lines 1040 and 1261), and `_dialogue_driven_goal_set` (lines 1100 and 1321). In Python the later definition silently shadows the earlier one; the first copy of each method is dead code. If someone patches the first copy of `query_memory`, the live second copy is unchanged — the fix has no effect at runtime.

**Fix:** Remove the duplicate block. Run:
```
grep -n "def hash_state\|def query_memory\|def force_telos\|def _build_refined_telos\|def _dialogue_driven_goal_set" brain/src/noesis_brain/rpc/handler.py
```
and delete the first occurrence of each.

---

### WR-03: `NameError` in on_tick quarantine sweep when OL-path payload JSON is malformed

**File:** `brain/src/noesis_brain/rpc/handler.py:319-323`

**Issue:** Inside the `on_tick()` quarantine sweep, `json` is imported with the alias `_json` at line 319:

```python
import json as _json
```

But the `except` clause on line 323 references the unaliased `json.JSONDecodeError`:

```python
except (json.JSONDecodeError, ValueError):
```

`json` is not bound at module level in `handler.py`. This raises `NameError: name 'json' is not defined` at runtime whenever a quarantined OL-path skill's `payload_json` is malformed, converting a recoverable data error into a crash of the entire on_tick path.

**Fix:**
```python
except (_json.JSONDecodeError, ValueError):
    source_event_hash = result.skill_hash
```

---

### WR-04: `observe_trade()` return type violation — returns `Action` where `Skill | None` is declared

**File:** `brain/src/noesis_brain/learning/observational.py:119` and `181-185`

**Issue:** The method signature declares `-> Skill | None`, but when the structural-invalid filter triggers (line 176), it returns an `Action` object:

```python
return Action(
    action_type=ActionType.SKILL_REJECTED,
    metadata={"rejection_reason": "structural_invalid"},
)
```

Any caller that does `if result is None: ...` or `isinstance(result, Skill)` receives an `Action` that satisfies neither condition — it is truthy and not a `Skill`. The test `test_ol_filter_and_quarantine.py:139` correctly tests for `isinstance(result, Action)`, which means the tests accept the current behavior, but this is a type contract violation. The docstring and signature mislead readers.

Additionally, the quarantine-success path at line 237 also returns an `Action`. The effective return type is `Skill | Action | None`.

**Fix:** Update the return type annotation to `Skill | Action | None` and update the docstring to describe all three return cases clearly.

---

### WR-05: `return` instead of `break` in `nous-runner.ts` whisper_send case drops subsequent actions

**File:** `grid/src/integration/nous-runner.ts:454`

**Issue:** In the `whisper_send` case of `executeActions`, the rate-limited drop path uses `return` rather than `break`:

```typescript
if (!accepted) {
    // Silent drop — tombstone or rate-limit. NO log, NO retry.
    return;   // ← exits executeActions entirely
}
```

`executeActions` iterates over all actions returned by the Brain in a single tick. A `return` exits the whole iteration loop. If the Brain emits `[whisper_send (rate-limited), skill_inferred]`, the `skill_inferred` action is never dispatched and no `skill.inferred` audit entry is written. All subsequent actions in the same batch are silently dropped.

**Fix:**
```typescript
if (!accepted) {
    break;  // drop only this action, continue with the rest
}
```

---

## Info

### IN-01: `re` module imported twice under different aliases in `observational.py`

**File:** `brain/src/noesis_brain/learning/observational.py:29` and `75`

**Issue:** `re` is imported as `_re_ol` at line 29 and again as `_re` at line 75, both at module level. Both aliases are used for module-level compiled regex objects. Using two aliases for the same standard library module adds confusion without benefit.

**Fix:** Remove the line 75 `import re as _re` and change `_SLUG_RE = _re.compile(...)` to `_SLUG_RE = _re_ol.compile(...)`.

---

### IN-02: Deferred `Action`/`ActionType` imports inside `observe_trade()` hot path

**File:** `brain/src/noesis_brain/learning/observational.py:181-182` and `236-237`

**Issue:** `from noesis_brain.rpc.types import ActionType, Action` appears twice inside `observe_trade()` (structural-invalid rejection path and quarantine-success path). Python caches module imports so the repeated `from ... import` is not expensive, but deferred imports inside a hot-path async method make static analysis and `TYPE_CHECKING` guard patterns harder to apply consistently.

**Fix:** Move both to module level. `Action` and `ActionType` are already partially imported at line 27; consolidate into a single top-level import. Verify the circular import concern is real before doing this — if it is, consolidate the two in-method imports into one at the top of `observe_trade()`.

---

### IN-03: `_peer_is_known` swallows all exceptions without logging

**File:** `brain/src/noesis_brain/learning/observational.py:311-313`

**Issue:**
```python
except Exception:  # noqa: BLE001
    pass
return False
```
A broken DB connection or attribute error on a malformed `WikiPage` silently appears as "peer not known." There is no log entry, making it impossible to distinguish a DB failure from a genuine absence of a peer wiki page during operation.

**Fix:**
```python
except Exception as exc:  # noqa: BLE001
    logger.warning("ObservationalLearner: _peer_is_known lookup failed: %s", exc)
return False
```

---

### IN-04: `QuarantineStore.enqueue` silently drops DB errors with no log

**File:** `brain/src/noesis_brain/skills/quarantine.py:108-109`

**Issue:**
```python
except sqlite3.Error:
    pass  # duplicate or DB error — silent drop per Brain discipline
```
The comment conflates two very different cases: "duplicate" (expected, safe to drop) and "DB error" (unexpected, should at minimum be logged at debug level). Silent swallowing of a schema mismatch or locked DB at this point causes accepted skills to be lost without any operational signal.

**Fix:**
```python
except sqlite3.Error as exc:
    logger.debug("QuarantineStore.enqueue: DB error (skill dropped): %s", exc)
```

---

### IN-05: `skill-producer-boundary.test.ts` 200-char argument window in regex may miss multi-line emits

**File:** `grid/test/skills/skill-producer-boundary.test.ts:65-68`

**Issue:** The sole-producer audit.append check uses:
```ts
`\\b(?:audit|chain|this\\.audit|this\\.chain)\\.append[^;]{0,200}['"\`]${escapedEvent}['"\`]`
```
The `[^;]{0,200}` budget of 200 characters before the event literal can silently miss an `audit.append` call whose argument list is long or multi-line before the event type string. A non-sole-producer emit could go undetected if the event literal is more than 200 chars past the `.append(` token.

**Fix:** Restructure to scan for the event literal first, then look backwards for `audit.append` on the same logical statement — or increase the budget significantly (e.g., 2000 chars) to cover realistic multi-line payloads.

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
