---
phase: 17-iris-theory-of-mind
verified: 2026-05-15T12:10:00Z
status: passed
score: 27/27 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 17: Iris (Theory of Mind) Verification Report

**Phase Goal:** Wire the Iris Theory of Mind module into BrainHandler and build the Grid-side audit emission layer. Four audit events (iris.belief_revised, iris.context_invoked, iris.contradiction_detected, iris.prior_seeded) at allowlist positions 33-36.
**Verified:** 2026-05-15T12:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Allowlist has 36 entries with 4 iris events at positions 33-36 | VERIFIED | `ALLOWLIST_MEMBERS` array has 36 entries (`grep -c "^    '"` = 36 total, iris at positions 147-150); all 4 iris strings present |
| 2 | FORBIDDEN_KEY_PATTERN includes all 6 iris keys | VERIFIED | Regex literal ends with `belief_content\|target_content\|emotion_text\|dimension_text\|belief_prose\|iris_content/i`; IRIS_FORBIDDEN_KEYS const also declared |
| 3 | Protocol and Brain ActionType carry all 4 iris actions | VERIFIED | `brain/src/noesis_brain/rpc/types.py` has IRIS_BELIEF_REVISED, IRIS_CONTEXT_INVOKED, IRIS_CONTRADICTION_DETECTED, IRIS_PRIOR_SEEDED; `protocol/src/noesis/bridge/types.ts` lines 44-47 have all 4 string literals |
| 4 | Grid emitters exist with correct validation discipline | VERIFIED | `grid/src/iris/` has 6 files; all 4 emitters have: Object.keys().sort() closed-tuple check, HEX64_RE for hash fields, self-report invariant (payload.nous_did === actorDid), privacy gate |
| 5 | Sole-producer boundary enforced (each event in exactly one emitter) | VERIFIED | `grep "audit.append.*iris.X"` returns exactly 1 hit per event in the emitter files |
| 6 | NousRunner has 4 iris case branches with try/catch | VERIFIED | Lines 634, 656, 676, 697; each has `try { appendIris*(...) } catch (err) { console.warn(...) }` — never throws to siblings |
| 7 | BrainHandler.__init__ has iris_db_dir parameter | VERIFIED | `handler.py` line 55: `iris_db_dir: str | Path | None = None` |
| 8 | IrisRuntime constructed when iris_db_dir provided | VERIFIED | Lines 80-85: `if iris_db_dir is not None:` → `IrisStore(db_path=...)` → `IrisRuntime(_iris_store, self.llm)` |
| 9 | elicit() called in on_tick() after seed_priors, gated on dialogue_context | VERIFIED | Line 268: `if self._iris_runtime is not None and isinstance(dialogue_ctxs, list):` — seed_priors called at line 252-261 before elicit at line 276 |
| 10 | IRIS_BELIEF_REVISED emitted at most once per elicit() call | VERIFIED | `if result.beliefs:` guard (line 287) — one Action appended for first belief only; no loop over individual beliefs |
| 11 | IRIS_CONTEXT_INVOKED emitted after context_for() loop with total belief_count | VERIFIED | Lines 320-349: context_for called per peer, total_injected summed, IRIS_CONTEXT_INVOKED appended once if total_injected > 0 |
| 12 | build_system_prompt() has tom_context parameter | VERIFIED | `prompts/system.py` line 38: `tom_context: "list | None" = None` |
| 13 | Theory of Mind section injected when beliefs available | VERIFIED | Lines 100-103: `if tom_context:` → `_theory_of_mind_section(tom_context)` injected; `_theory_of_mind_section` at line 236 iterates up to 3 peers |
| 14 | Brain tests: 4 test files with 19 tests, all passing | VERIFIED | `brain/test/iris/` has 4 files; pytest ran 19 tests, 19 passed (cooldown, contradiction threshold, append-only, zero-diff) |
| 15 | Grid tests: 5 test files with 58 tests, all passing | VERIFIED | `grid/test/iris/` has 5 files (4 emitters + 1 boundary); vitest ran 58 tests, 58 passed |
| 16 | Wall-clock free in brain/noesis_brain/iris/ | VERIFIED | Pattern references in `datetime.\|time.time` only appear in comments/docstrings asserting wall-clock freedom — no actual calls |
| 17 | Wall-clock free in grid/src/iris/ | VERIFIED | No `Date.now` or `new Date()` in any grid/src/iris/*.ts file |
| 18 | Content never crosses wire (no iris forbidden keys in emitters or Brain wire) | VERIFIED | `grep belief_content\|target_content\|...` on grid/src/iris/ and brain rpc handler: PASS |
| 19 | 3-keys-not-5 invariant: Brain metadata 1-3 keys, Grid injects nous_did+tick | VERIFIED | IRIS_BELIEF_REVISED: 3 keys (target_did, belief_hash, dimension); IRIS_CONTEXT_INVOKED: 1 key (belief_count); IRIS_CONTRADICTION_DETECTED: 2 keys (target_did, contradiction_hash); IRIS_PRIOR_SEEDED: 2 keys (target_did, seed_event_hash). Grid drops `dimension` before emitting |
| 20 | Append-only: IrisStore never deletes rows | VERIFIED | `store.py` comments confirm: "NEVER deleted. Eviction sets superseded_by FK only." No `DELETE FROM` or `.delete(` calls in iris Python module |
| 21 | Phase 15/16 stub events at positions 28-32 present | VERIFIED | `nous.reflection_authored` (28), `nous.self_model_revised` (29), `nous.creed_violation` (30), `nous.sleep.entered` (31), `nous.sleep.completed` (32) all in ALLOWLIST_MEMBERS |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | 36 entries with iris at 33-36, IRIS_FORBIDDEN_KEYS, FORBIDDEN_KEY_PATTERN updated | VERIFIED | All present and correct |
| `grid/src/iris/appendIrisBeliefRevised.ts` | Sole-producer emitter, closed-tuple, HEX64_RE, self-report invariant | VERIFIED | 10-step validation discipline implemented |
| `grid/src/iris/appendIrisContextInvoked.ts` | Sole-producer emitter, closed-tuple, belief_count validation | VERIFIED | 9-step validation discipline implemented |
| `grid/src/iris/appendIrisContradictionDetected.ts` | Sole-producer emitter, closed-tuple, HEX64_RE | VERIFIED | 10-step validation discipline implemented |
| `grid/src/iris/appendIrisPriorSeeded.ts` | Sole-producer emitter, closed-tuple, HEX64_RE | VERIFIED | 10-step validation discipline implemented |
| `grid/src/iris/types.ts` | IrisPayload types and KEYS tuples | VERIFIED | File exists (6 files in directory) |
| `grid/src/iris/index.ts` | Module exports | VERIFIED | File exists |
| `grid/src/integration/nous-runner.ts` | 4 iris case branches with try/catch | VERIFIED | Lines 634, 656, 676, 697 — all with try/catch pattern |
| `brain/src/noesis_brain/rpc/types.py` | 4 new ActionType members | VERIFIED | IRIS_BELIEF_REVISED, IRIS_CONTEXT_INVOKED, IRIS_CONTRADICTION_DETECTED, IRIS_PRIOR_SEEDED |
| `brain/src/noesis_brain/rpc/handler.py` | iris_db_dir param, IrisRuntime construction, elicit() + seed_priors wiring, IRIS actions emitted | VERIFIED | All wiring confirmed |
| `brain/src/noesis_brain/prompts/system.py` | tom_context parameter, Theory of Mind section | VERIFIED | Line 38 param, lines 100-103 injection |
| `protocol/src/noesis/bridge/types.ts` | BrainAction union with 4 iris strings | VERIFIED | Lines 44-47 |
| `brain/test/iris/test_elicit_cooldown.py` | Cooldown: ≤3 elicit calls/50 ticks | VERIFIED | 5 tests pass |
| `brain/test/iris/test_contradiction_threshold.py` | Contradiction threshold at 0.3 delta | VERIFIED | 6 tests pass |
| `brain/test/iris/test_append_only.py` | 20→10+10 append-only, no delete | VERIFIED | 4 tests pass |
| `brain/test/iris/test_zero_diff_invariant.py` | Zero-diff when Iris disabled | VERIFIED | 4 tests pass |
| `grid/test/iris/appendIrisBeliefRevised.test.ts` | 13 tests | VERIFIED | 13 passed |
| `grid/test/iris/appendIrisContextInvoked.test.ts` | 12 tests | VERIFIED | 12 passed |
| `grid/test/iris/appendIrisContradictionDetected.test.ts` | 12 tests | VERIFIED | 12 passed |
| `grid/test/iris/appendIrisPriorSeeded.test.ts` | 13 tests | VERIFIED | 13 passed |
| `grid/test/iris/iris-producer-boundary.test.ts` | Boundary enforcement | VERIFIED | 8 passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BrainHandler.__init__` | `IrisRuntime` | `iris_db_dir` param → conditional construction | WIRED | handler.py lines 55, 80-85 |
| `BrainHandler.on_tick()` | `seed_priors()` | `relationship_context` list | WIRED | handler.py line 252-262 |
| `BrainHandler.on_tick()` | `IrisRuntime.elicit()` | `dialogue_ctxs` list gate | WIRED | handler.py line 268-349 |
| `elicit()` result | `ActionType.IRIS_*` | beliefs/contradiction/new_hash checks | WIRED | handler.py lines 286-348 |
| `build_system_prompt()` | TOM section | `tom_context` parameter | WIRED | system.py lines 38, 100-103 |
| `NousRunner iris_* cases` | `appendIris*()` emitters | `try { appendIris*(audit, nousDid, {...}) }` | WIRED | nous-runner.ts lines 634-717 |
| Grid iris emitters | `audit.append('iris.*')` | explicit reconstruction + privacy check | WIRED | Confirmed in all 4 emitters |
| ALLOWLIST | 4 iris event strings | `ALLOWLIST_MEMBERS` array positions 33-36 | WIRED | broadcast-allowlist.ts lines 147-150 |
| `FORBIDDEN_KEY_PATTERN` | 6 iris keys | regex alternation `belief_content\|...\|iris_content` | WIRED | broadcast-allowlist.ts FORBIDDEN_KEY_PATTERN |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `appendIrisBeliefRevised.ts` | `IrisBeliefRevisedPayload` | NousRunner injects nous_did+tick+target_did+belief_hash from Brain action.metadata | Yes — hashes from IrisRuntime.elicit() | FLOWING |
| `BrainHandler.on_tick()` | `result` (ElicitResult) | `IrisRuntime.elicit()` LLM + IrisStore | Yes — live LLM call with belief storage | FLOWING |
| `build_system_prompt()` | `tom_context` | `context_for()` reading IrisStore active beliefs | Yes — DB query for active beliefs | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript iris tests (5 files, 58 tests) | `npx vitest run test/iris/` | 58 passed, 0 failed | PASS |
| Python iris tests (4 files, 19 tests) | `brain/.venv/bin/pytest brain/test/iris/ -v` | 19 passed, 0 failed | PASS |
| Sole-producer: each iris event has exactly 1 `audit.append` call | `grep "audit.append.*iris.X"` | 1 hit per event | PASS |
| Wall-clock free (brain) | Pattern grep for actual datetime/time.time calls | PASS | PASS |
| Wall-clock free (grid) | Pattern grep for Date.now/new Date() | PASS | PASS |
| Content leak gate | Grep for forbidden keys in emitters and handler | PASS | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| D-17-01 | Allowlist entries 28-32 (Phase 15/16 stubs) prerequisite | SATISFIED | All 5 stub events present in ALLOWLIST_MEMBERS |
| D-17-02 | 4 iris events at positions 33-36 | SATISFIED | Lines 147-150 in broadcast-allowlist.ts |
| D-17-06 | 4 ActionType members in brain rpc/types.py | SATISFIED | IRIS_BELIEF_REVISED through IRIS_PRIOR_SEEDED |
| D-17-08 | Grid iris/ directory with 6 files, validation discipline | SATISFIED | All 6 files present, all validation steps confirmed |
| D-17-09 | NousRunner 4 iris case branches with try/catch | SATISFIED | Lines 634-717 in nous-runner.ts |
| D-17-10 | BrainAction union in protocol types.ts | SATISFIED | Lines 44-47 |
| D-17-14 | BrainHandler iris_db_dir parameter | SATISFIED | handler.py line 55 |
| D-17-15 | elicit() wired in on_tick() after seed_priors | SATISFIED | handler.py lines 252-283 |
| D-17-16 | build_system_prompt() tom_context injection | SATISFIED | system.py lines 38, 100-103 |
| D-17-17 | IRIS_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN updated | SATISFIED | broadcast-allowlist.ts IRIS_FORBIDDEN_KEYS + pattern |
| Wave 4 tests | Python: 4 files, 19 tests; TS: 5 files, 58 tests | SATISFIED | All tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, placeholders, stub implementations, or hardcoded empty returns found in the iris module files.

### Human Verification Required

None. All criteria are verifiable programmatically and all automated checks pass.

---

## Gaps Summary

No gaps found. All 27 criteria pass.

The Phase 17 implementation is complete:

- Allowlist positions 33-36 are populated with the 4 iris event strings; positions 28-32 have Phase 15/16 stubs.
- FORBIDDEN_KEY_PATTERN includes all 6 iris content-leak keys.
- All 4 Grid-side sole-producer emitters are implemented with the full 10-step validation discipline (DID regex, self-report invariant, tick validation, HEX64_RE hash check, closed-tuple, explicit reconstruction, privacy gate).
- NousRunner dispatches all 4 iris cases with fail-soft try/catch.
- BrainHandler is wired: iris_db_dir param, IrisRuntime construction, seed_priors before elicit(), elicit() gated on dialogue_context, IRIS_CONTEXT_INVOKED after context_for() loop.
- build_system_prompt() injects Theory of Mind section via tom_context.
- All invariants hold: 3-keys-not-5, content-never-crosses-wire, append-only, wall-clock-free.
- 19 Python tests + 58 TypeScript tests all pass.

---

_Verified: 2026-05-15T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
