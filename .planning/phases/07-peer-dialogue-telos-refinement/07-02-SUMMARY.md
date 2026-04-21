---
phase: 07-peer-dialogue-telos-refinement
plan: 02
subsystem: brain-telos-refinement
tags: [brain, action-type, telos, hash-authority, dialogue-context, tdd, additive-widening]

requires:
  - phase: 07-peer-dialogue-telos-refinement
    plan: 01
    provides: "TickParams.dialogue_context? additive widening + TelosRefinedAction variant in BrainAction union — Brain can now read the new field and emit the new action type without grid-side type errors"
  - phase: 06-operator-agency-foundation-h1-h4
    provides: "compute_active_telos_hash SOLE authority (D-05 / hashing.py) + force_telos hash-before/mutate/hash-after pattern (handler.py:376-413) — cloned verbatim for _build_refined_telos"
provides:
  - "ActionType.TELOS_REFINED = 'telos_refined' (Brain-side enum, Nous-initiated, distinct from operator-driven force_telos RPC)"
  - "BrainHandler._build_refined_telos(ctx) — Optional[Action], validates dialogue_id, runs heuristic, hashes BEFORE then AFTER TelosManager swap, returns None on no-op / malformed / opt-out"
  - "BrainHandler._dialogue_driven_goal_set(ctx) — deterministic substring-match heuristic over utterance text; promotes matched goals, demotes unmatched; draws descriptions ONLY from Nous's own active goals (T-07-16 mitigation)"
  - "BrainHandler.on_tick — additive widening: consumes optional params['dialogue_context'], iterates non-None refinements, falls through to pre-Phase-7 NOOP path otherwise"
  - "brain/test/dialogue_fixtures.py — make_dialogue_context() + make_dialogue_context_no_match() factories for downstream Brain tests (deterministic per D-23)"
affects:
  - 07-03 (Grid `case 'telos_refined'` handler + allowlisted telos.refined audit event — consumes the 3-key metadata tuple Brain emits here and injects `did` at the nous-runner boundary)
  - 07-04 (Dashboard Inspector Telos badge — reads the same hashes and dialogue_id Brain ships via the audit event)

tech-stack:
  added:
    - "(none — reuses existing compute_active_telos_hash, TelosManager.from_yaml)"
  patterns:
    - "Hash-before/mutate/hash-after SOLE authority (clone of Phase 6 force_telos; same compute_active_telos_hash calls, same atomic swap)"
    - "Closed N-key metadata tuple (D-20) — explicit key enumeration in the Action construction, no spread/**kwargs, makes plaintext leak impossible by design"
    - "Opt-in sovereign cognition (D-15) — helper returns Optional[Action] so on_tick can silently drop when Brain decides not to refine (no audit emit, no wire traffic)"
    - "Additive widening at the tick handler (D-10) — params.get('dialogue_context') default-None keeps every existing Phase 6 caller unchanged"
    - "Deterministic-heuristic-first (Claude's Discretion) — substring match, no LLM, no eval; defers prompt-injection attack surface to a future review"

key-files:
  created:
    - "brain/test/dialogue_fixtures.py (79 lines)"
    - "brain/test/test_telos_refined_action.py (198 lines, 10 tests including 5 parametrized malformed-id cases)"
    - "brain/test/test_dialogue_context_consumption.py (194 lines, 8 tests)"
  modified:
    - "brain/src/noesis_brain/rpc/types.py (+1 enum line)"
    - "brain/src/noesis_brain/rpc/handler.py (+~130 lines — on_tick widened, _build_refined_telos + _dialogue_driven_goal_set appended after force_telos)"

key-decisions:
  - "Single-goal happy-path fixture is a silent no-op — by design. One already-short_term goal rebuilds identically (same priority, same goal_type) → before_hash == after_hash → helper returns None. The happy-path tests were updated to use TWO goals (one matched, one not) so promotion genuinely mutates the bucket → canonical hash shifts. This aligns with D-22 (silent-no-op is correct behavior; the TEST must construct a scenario where refinement actually changes state)."
  - "_build_refined_telos lives AFTER force_telos in handler.py — adjacent to the only other SOLE-hash-authority method. File read order: on_tick → force_telos → _build_refined_telos → _dialogue_driven_goal_set → existing snapshot helpers."
  - "Closed metadata tuple is 3 keys on the Brain side (before_goal_hash, after_goal_hash, triggered_by_dialogue_id). The 4th key `did` is injected by Grid's nous-runner in Plan 03 (it knows which Nous's handler emitted the action — Brain is single-tenant per process and does not self-identify in the payload). Hand-off to Plan 03: READ these 3 keys, INJECT did = this.nousDid before appendTelosRefined(...)."
  - "Heuristic draws goal descriptions from self.telos.active_goals() ONLY. Utterance text is used solely as substring-match input; it is never written into a goal description. This makes T-07-16 (adversarial prompt injection via dialogue text rewriting goals) structurally impossible — no path exists from utterance.text to the TelosManager.from_yaml input strings."
  - "Malformed dialogue_id guard requires exactly 16-char string (matches computeDialogueId /^[0-9a-f]{16}$/ regex shape — checked by length, not regex, because the Brain trusts Grid's canonical format; an attacker-controlled Grid is out of scope per T-07-10 accept disposition)."
  - "Test layout deviation: plan specified brain/tests/unit/*.py + brain/tests/fixtures/dialogue_contexts.py; actual brain pyproject.toml has testpaths = ['test'] (singular, flat). Colocated new files under brain/test/ matching existing convention (test_handler_agency.py, test_rpc_handler.py, etc.). No test discovery changes needed."

patterns-established:
  - "Clone-of-force_telos for Nous-initiated hash-authority mutations: same pre-hash → atomic swap → post-hash sequence, but returning Optional[Action] instead of a dict. Future Brain helpers that mutate Telos follow this shape."
  - "Hash-change as emission gate: if pre==post, silently return None. This makes 'no meaningful change' invisible end-to-end (no action, no wire, no audit) — distinct from Phase 6 force_telos which ALWAYS returns a hash pair because operator-driven mutations are always audited regardless of state change."
  - "Structural privacy by enumeration: the Action() construction literal has exactly 3 metadata keys. No dict merge, no spread, no dynamic key assignment. Makes the D-18 forbidden-plaintext-keys test a tautology that nevertheless catches a class of regression (future refactor introducing `**extra_kwargs`)."

requirements-completed: [DIALOG-02]

duration: ~35m
completed: 2026-04-21
---

# Phase 07 Plan 02: Brain `ActionType.TELOS_REFINED` + `_build_refined_telos` + `dialogue_context` Consumption Summary

**Brain-side peer-dialogue-driven telos refinement shipped: new ActionType enum member, cloned-from-force_telos hash-before/mutate/hash-after helper, opt-in on_tick branch, and 18 Brain tests (295/295 green).**

## Performance

- **Duration:** ~35m (single session, no context compaction)
- **Started:** 2026-04-21T~02:00Z
- **Completed:** 2026-04-21T~02:35Z
- **Tasks:** 2 (both TDD, merged into RED→GREEN single-task flow matching Plan 07-01 execution style)
- **Files created:** 3 (1 fixture module + 2 test files)
- **Files modified:** 2 (types.py enum widening + handler.py on_tick rewrite + 2 new methods)
- **Tests added:** 18 (10 in test_telos_refined_action.py including 5 parametrized; 8 in test_dialogue_context_consumption.py)
- **Full Brain suite:** 295 passed (277 baseline + 18 new), 0.38s

## Accomplishments

- **DIALOG-02 satisfied at the Brain layer.** `on_tick` now consumes `params["dialogue_context"]` (optional, list of dicts); for each well-formed entry it calls `_build_refined_telos(ctx)`; when that returns a non-None Action, the action is appended to the response list. When `dialogue_context` is absent / empty / non-list / or every entry is a no-op, the handler falls through to the pre-Phase-7 NOOP path verbatim (strict backward compatibility — extends the Phase 6 test_get_state_widening additive-widening contract).
- **SOLE hash authority cloned.** `_build_refined_telos` calls `compute_active_telos_hash(self.telos.all_goals())` BEFORE mutating `self.telos` and AGAIN AFTER — identical pattern to `force_telos` (handler.py:400 + 408). Grep count: 5 hash-call sites in handler.py (1 import + 2 in force_telos + 2 in _build_refined_telos), matching the plan's expected ≥4.
- **Closed 3-key metadata tuple (D-20) enforced.** Brain emits `metadata = {"before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id"}` — nothing else. Test `test_no_forbidden_plaintext_keys_in_metadata` asserts the 9-key forbidden set (new_goals, goals, telos_yaml, prompt, response, wiki, reflection, thought, emotion_delta) is disjoint from the emitted metadata. Grid-side Plan 03 adds `did` → 4-key on-wire payload per D-20.
- **Silent no-op honoured (D-22).** If `before_goal_hash == after_goal_hash`, helper returns None → no action emitted → no audit traffic. Verified by `test_no_op_refinement_returns_no_action` using `make_dialogue_context_no_match()` (unrelated utterance topic → heuristic returns None before hashing even runs).
- **Sovereign opt-in (D-15).** Heuristic returns None whenever no active goal is mentioned in the utterance pool → helper returns None → action silently dropped. Brain can refuse refinement for any reason without leaking a decision trace.
- **Malformed dialogue_id drops silently (D-16 Brain mirror).** `ctx["dialogue_id"]` must be a 16-char string. `""`, `"abc"`, `"A"*17`, integers, and None all return None. Parametrized across 5 cases in `test_malformed_dialogue_id_drops_silently`.
- **T-07-16 mitigated by construction.** The heuristic uses utterance text ONLY for substring match; goal descriptions in the proposed set are drawn from `self.telos.active_goals()`. There is no path from `utterance.text` to `TelosManager.from_yaml` input strings — adversarial prompt injection cannot rewrite goals through the dialogue channel.
- **mypy clean.** `uv run mypy src/noesis_brain/rpc/handler.py src/noesis_brain/rpc/types.py` reports "Success: no issues found in 2 source files" (strict mode per pyproject.toml).

## Task Commits

Each gate was committed atomically with `{type}(phase-07-plan-02):` prefix and a `Co-Authored-By: Claude Sonnet 4.6` trailer.

1. **Task 1+2 RED: failing tests authored for both tasks** — `5a2ddec` (test) — 3 files created (fixtures + 2 test files), 18 tests red against the Phase 6 on_tick stub.
2. **Task 1+2 GREEN: enum + helper + on_tick branch + fixture fix** — `ba518d3` (feat) — 4 files modified (types.py, handler.py, and the two test files with the 2-goal fixture tweak). 18/18 new tests green, full Brain suite 295/295.

**Plan metadata:** _pending — final metadata commit (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)_

## Files Created/Modified

### Created (Tests — 3 files)
- `brain/test/dialogue_fixtures.py` — `make_dialogue_context(**overrides)` + `make_dialogue_context_no_match()`. Default utterances substring-match "Survive the day" so the heuristic fires. 79 lines.
- `brain/test/test_telos_refined_action.py` — 10 tests (5 contract + 5 parametrized malformed-id): happy-path closed-tuple, D-18 forbidden-plaintext-keys, D-22 no-op silence, D-16 malformed dialogue_id (parametrized ×5), D-14 hash-before-then-after ordering, D-13 enum widening. 198 lines.
- `brain/test/test_dialogue_context_consumption.py` — 8 tests: absent dialogue_context (Phase 6 NOOP preserved), empty list → NOOP, non-list → NOOP, non-match → NOOP, match → telos_refined, multi-ctx per tick (D-11), boundary-length utterance, non-dict entries ignored. 194 lines.

### Modified (Production — 2 files)
- `brain/src/noesis_brain/rpc/types.py` — added `TELOS_REFINED = "telos_refined"` to `ActionType` enum between `TRADE_REQUEST` and `NOOP` (NOOP stays last per action-continuum ordering). +1 line.
- `brain/src/noesis_brain/rpc/handler.py` — widened `on_tick` to consume `params["dialogue_context"]` with additive fall-through; appended `_build_refined_telos(ctx) → Action | None` (clone of force_telos hash-before/mutate/hash-after) and `_dialogue_driven_goal_set(ctx)` (deterministic substring heuristic) after `force_telos`. +~130 lines.

### Modified (Tests — 2 files, fixture fix during GREEN)
- `brain/test/test_telos_refined_action.py` — happy-path + forbidden-keys + malformed-id tests now use `["Survive the day", "Make allies"]` (2 goals) instead of `["Survive the day"]`. A single already-short_term goal is a silent no-op by design; the happy-path MUST construct a scenario where promotion actually shifts a bucket.
- `brain/test/test_dialogue_context_consumption.py` — `test_on_tick_matching_dialogue_produces_telos_refined` and `test_on_tick_ignores_non_dict_entries_in_list` updated with 2-goal fixture for the same reason.

## Decisions Made

Six decisions — all captured in frontmatter for transitive discovery by Plans 07-03/04:

1. **Single-goal happy path is a silent no-op (D-22 at play).** Discovered during first GREEN run: `TelosManager.from_yaml({"short_term": ["X"]})` rebuilds with identical priority (0.8) and identical goal_type (SHORT_TERM) → identical canonical hash → no-op. Fix: use 2 goals so promotion (one matched, one unmatched) moves the unmatched goal from short_term to medium_term, mutating priority + goal_type. This is correct Brain behavior, not a bug — the test fixture adjustment aligns the happy-path scenario with the invariant D-22 is meant to filter.
2. **_build_refined_telos placement AFTER force_telos in handler.py.** Adjacent to the only other SOLE-hash-authority method. File order: on_tick → on_event → get_state → snapshot helpers → _instinct_response → Phase 6 (query_memory + force_telos) → Phase 7 (_build_refined_telos + _dialogue_driven_goal_set).
3. **Brain emits 3 metadata keys; Grid injects the 4th (`did`).** Hand-off to Plan 03: nous-runner.ts `case 'telos_refined':` reads `action.metadata.{before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` and calls `appendTelosRefined({did: this.nousDid, ...action.metadata})`. Closed 4-key tuple on wire per D-20.
4. **Heuristic goal-description source is closed.** `self.telos.active_goals()` is the only input to `promoted`/`demoted` lists. Utterance text is substring-match input only. No code path exists from `utterance.text` → `from_yaml` input — T-07-16 prompt-injection threat is structurally impossible, not merely defended-against.
5. **Malformed dialogue_id check is length-16 string, not regex.** Grid upstream guarantees `/^[0-9a-f]{16}$/` (Plan 01's `computeDialogueId`). Brain checks `isinstance(str) AND len == 16` — a byte-level spoofed Grid is out of scope (T-07-10 accept disposition). Regex check would be redundant for the threat model.
6. **Test layout: brain/test/ not brain/tests/unit/.** Plan spec called for `brain/tests/unit/*.py` + `brain/tests/fixtures/dialogue_contexts.py`. Actual brain layout is flat `brain/test/` (pyproject.toml `testpaths = ["test"]`). Colocated new files under `brain/test/` with module name `dialogue_fixtures.py` (no `fixtures/` subpackage) to match existing convention. Rule 3 blocking-path deviation documented below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking path] Test directory structure differs from plan spec**
- **Found during:** Task 2 file creation
- **Issue:** Plan specified `brain/tests/unit/test_telos_refined_action.py`, `brain/tests/unit/test_dialogue_context_consumption.py`, and `brain/tests/fixtures/dialogue_contexts.py`. Actual Brain test layout (per `brain/pyproject.toml [tool.pytest.ini_options] testpaths = ["test"]`) is a flat singular `brain/test/` directory with no `unit/` or `fixtures/` subpackages. Existing test files (`test_handler_agency.py`, `test_rpc_handler.py`, etc.) all live flat.
- **Fix:** Colocated the three new files under `brain/test/` with the fixture module renamed to `dialogue_fixtures.py` (avoiding the non-existent `fixtures/` package). Imports are `from test.dialogue_fixtures import ...` (pyproject's testpaths makes `test` the root package).
- **Files modified:** All three new files created under `brain/test/` instead of plan's `brain/tests/unit/|fixtures/`.
- **Verification:** 18/18 new tests discovered and run; 277 existing tests continue to pass.
- **Committed in:** `5a2ddec` (RED), `ba518d3` (GREEN).

**2. [Rule 1 — Bug in test fixture, not implementation] Single-goal happy path was silent no-op**
- **Found during:** Task 1 first GREEN run
- **Issue:** `test_happy_path_returns_telos_refined_with_closed_tuple` used `["Survive the day"]` (one goal). The heuristic promoted it (matched), demoted=[]. `TelosManager.from_yaml({"short_term": ["Survive the day"], ...})` produced an identical canonical goal set → `before_hash == after_hash` → silent no-op → helper returned None → on_tick fell through to NOOP. Test failed because it expected a `telos_refined` action, not NOOP.
- **Fix:** Updated the 3 affected happy-path tests in `test_telos_refined_action.py` (happy, forbidden-keys, malformed-id) and 2 in `test_dialogue_context_consumption.py` (matching, non-dict-entries) to use 2 goals `["Survive the day", "Make allies"]`. Now promotion moves "Make allies" from short_term (initial) to medium_term (demoted) — priority shifts 0.8 → 0.5, goal_type shifts SHORT_TERM → MEDIUM_TERM — canonical hash differs.
- **Classification:** This is a TEST FIXTURE bug, NOT an implementation bug. The Brain's silent-no-op behavior is correct per D-22. The test merely needed a scenario that would actually mutate the canonical goal set.
- **Files modified:** `brain/test/test_telos_refined_action.py`, `brain/test/test_dialogue_context_consumption.py`.
- **Verification:** After fixture fix, 18/18 new tests green.
- **Committed in:** `ba518d3` (GREEN — fixture adjustment bundled with implementation since RED commit already had the "wrong" single-goal fixture).

### Deferred (None)

No out-of-scope issues were found during this plan's execution. The Brain layer was clean: no pre-existing mypy errors, no regression risks in Phase 6 tests, no import-cycle issues from the new method.

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking-path, 1 Rule 1 test-fixture bug). 0 deferred. 0 architectural (no Rule 4 escalations).

**Impact on plan:** Both auto-fixes were necessary for correctness. The test-layout adaptation preserves plan intent (same fixture factories, same test coverage, same test assertions) — only the file paths changed. The 2-goal fixture fix revealed that D-22 silent-no-op is genuinely load-bearing: a single-goal scenario really IS a no-op, and the implementation correctly refuses to emit an action for it.

## Issues Encountered

- **None significant.** Single-session execution; no context-window compaction; no environmental blockers; no tooling surprises. The only friction point was the silent-no-op fixture debug which was resolved in one diagnostic round (direct `python -c` reproduction of the hash equality).

## Invariants Preserved

- **Phase 6 additive-widening contract** — `on_tick({"tick": N, "epoch": N})` (no dialogue_context key) still returns a single-element NOOP list. Phase 6 `test_get_state_widening` (the strict-superset rule) extends cleanly here: new field is optional, default behavior unchanged, existing callers unaffected.
- **SOLE hash authority** — `compute_active_telos_hash` called exactly twice in `_build_refined_telos` (before + after the `self.telos = rebuilt` swap), matching `force_telos`'s identical shape. No alternative hash computation anywhere in `handler.py`.
- **Zero plaintext across RPC boundary (D-18)** — `Action` construction literal has exactly 3 metadata keys. No spread operator, no `**kwargs`, no dynamic key assignment. Forbidden-plaintext-keys test asserts 9-key disjointness (new_goals, goals, telos_yaml, prompt, response, wiki, reflection, thought, emotion_delta).
- **Silent no-op (D-22)** — if `before_goal_hash == after_goal_hash`, helper returns None. No action emitted → no wire traffic → no audit event generated in Plan 03.
- **Sovereign opt-in (D-15, PHILOSOPHY §1)** — heuristic can refuse refinement for any reason; there is no path from "Grid delivers dialogue_context" to "Brain mutates Telos" that bypasses the Brain's decision.
- **Broadcast allowlist still at 16** — Plan 07-02 adds NO new allowlist events. `telos.refined` addition lands in Plan 07-03 per the freeze-except-by-explicit-addition rule (STATE.md Accumulated Context, line 57).
- **T-07-16 structural impossibility** — utterance text → match check ONLY; promoted/demoted descriptions drawn from `self.telos.active_goals()`. No prompt-injection attack surface.

## Seams Exposed for Downstream Plans

- **Plan 07-03 (Grid handler + `telos.refined` audit event)** — consumes Brain's `action.metadata = {before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`. Must:
  1. Add `case 'telos_refined':` branch to `NousRunner.actOn` (reminder: Plan 01 deliberately left this out per its commit `edac3c8`).
  2. Check `this.recentDialogueIds.has(action.metadata.triggered_by_dialogue_id)` for authority — Brain can only refine off a dialogue this Nous actually participated in (forgery prevention).
  3. Call `appendTelosRefined({did: this.nousDid, before_goal_hash, after_goal_hash, triggered_by_dialogue_id})` — the 4th key (`did`) is Grid-injected per D-20.
  4. Add `telos.refined` to broadcast allowlist (grows 16 → 17; phase quota per STATE.md Accumulated Context).
- **Plan 07-04 (Dashboard Inspector Telos badge)** — queries audit firehose by `triggered_by_dialogue_id` to link the "↻ refined via dialogue" badge to the triggering dialogue entries. The dialogue_id is stable across Brain emit → Grid audit → firehose query — no translation needed.

## Next Phase Readiness

- **Plan 07-03 ready.** Brain emits the exact 3-key metadata Plan 03's nous-runner handler expects. `TelosRefinedAction` variant already in `BrainAction` union (Plan 01 `edac3c8`), no grid type errors when Brain returns the new action.
- **Plan 07-04 unblocked** on Brain side; waits on Plan 07-03 for the audit event to query.
- **No open blockers.**

## Hand-off Note to Plan 07-03

Brain emits this exact metadata shape:
```python
metadata = {
    "before_goal_hash": "<64-hex>",
    "after_goal_hash":  "<64-hex>",
    "triggered_by_dialogue_id": "<16-hex>",
}
```
Grid's `NousRunner.actOn` `case 'telos_refined':` must:
1. READ these 3 keys.
2. VERIFY `this.recentDialogueIds.has(triggered_by_dialogue_id)` (forgery guard).
3. INJECT `did: this.nousDid` when calling `appendTelosRefined({did, ...action.metadata})` — producing the 4-key on-wire payload per D-20.
4. Emit allowlisted `telos.refined` event (Plan 03 will be the allowlist addition).

The `did` is Grid-side-injected because Brain is single-tenant per process and does not self-identify in its action payload — Grid's nous-runner knows which Nous this handler is wired to.

## TDD Gate Compliance

Plan-level gate (per 2 tasks with `tdd="true"`):

1. **RED phase (commit `5a2ddec`, type `test`):** Created fixtures + 2 test files with 18 assertions targeting the Phase 6 on_tick stub. Confirmed failing with representative failure: `expected 'telos_refined' action, got [{action_type: 'noop', ...}]`. No implementation existed yet.
2. **GREEN phase (commit `ba518d3`, type `feat`):** Added enum member, _build_refined_telos helper, _dialogue_driven_goal_set helper, widened on_tick. Plus one in-flight fixture fix (2-goal vs 1-goal — see Deviation 2). 18/18 new tests pass; full Brain suite 295/295 (277 baseline + 18 new).
3. **No REFACTOR phase needed.** Implementation was clean on first GREEN (modulo the test-fixture fix which is not a refactor of production code).

Git log verification:
- `test(phase-07-plan-02): RED ...` (5a2ddec) — RED gate commit.
- `feat(phase-07-plan-02): GREEN ...` (ba518d3) — GREEN gate commit.
- Correct order: test → feat.

## Self-Check: PASSED

Verified all claims:

- [x] `brain/test/dialogue_fixtures.py` — FOUND (79 lines)
- [x] `brain/test/test_telos_refined_action.py` — FOUND (198 lines)
- [x] `brain/test/test_dialogue_context_consumption.py` — FOUND (194 lines)
- [x] `brain/src/noesis_brain/rpc/types.py` contains `TELOS_REFINED` — FOUND (line 15)
- [x] `brain/src/noesis_brain/rpc/handler.py` contains `_build_refined_telos` — FOUND (2 refs: def + call site in on_tick)
- [x] `brain/src/noesis_brain/rpc/handler.py` contains `dialogue_context` — FOUND (3 refs: on_tick docstring + params.get + variable name)
- [x] Commit `5a2ddec` — FOUND in `git log --oneline`
- [x] Commit `ba518d3` — FOUND in `git log --oneline`
- [x] `uv run pytest -q` → 295 passed, 0 failed, 0.38s
- [x] `uv run mypy src/noesis_brain/rpc/handler.py src/noesis_brain/rpc/types.py` → "Success: no issues found in 2 source files"
- [x] `uv run python -c "from noesis_brain.rpc.types import ActionType; assert ActionType.TELOS_REFINED.value == 'telos_refined'; print('OK')"` → prints "OK"
- [x] `grep -c compute_active_telos_hash brain/src/noesis_brain/rpc/handler.py` → 5 (≥4 expected: 1 import + 2 in force_telos + 2 in _build_refined_telos)
- [x] Structural AST check: `_build_refined_telos`, `_dialogue_driven_goal_set`, `on_tick`, `force_telos` all present as methods on `BrainHandler`

---
*Phase: 07-peer-dialogue-telos-refinement*
*Plan: 02*
*Completed: 2026-04-21*
