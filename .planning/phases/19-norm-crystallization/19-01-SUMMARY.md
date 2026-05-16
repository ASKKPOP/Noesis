---
phase: 19-norm-crystallization
plan: "01"
subsystem: brain-fingerprint + grid-audit + grid-test-norms
tags: [norm-crystallization, fingerprint, allowlist, safety-gate, red-test-stubs]
dependency_graph:
  requires: []
  provides:
    - compute_norm_fingerprint in brain/src/noesis_brain/learning/rules.py
    - NORM_FORBIDDEN_KEYS in grid/src/audit/broadcast-allowlist.ts
    - norm.candidate (pos 40) + norm.crystallized (pos 41) in ALLOWLIST_MEMBERS
    - grid/test/norms/zero-diff.test.ts (RED stub)
    - grid/test/norms/norm-producer-boundary.test.ts (RED stub)
    - brain/test/learning/test_rules.py (8 GREEN fingerprint determinism tests)
  affects:
    - grid/src/audit/broadcast-allowlist.ts (FORBIDDEN_KEY_PATTERN extended)
    - grid/test/audit/* (6 count assertions updated 39→41)
tech_stack:
  added: []
  patterns:
    - n-gram fingerprint (D-19-03): sorted word-trigrams → SHA-256 → 6-char hex
    - NORM_FORBIDDEN_KEYS pattern (follows SKILL_FORBIDDEN_KEYS / HYPNOS_FORBIDDEN_KEYS)
    - RED stub pattern: import from non-existent module to enforce Nyquist gate
key_files:
  created:
    - grid/test/norms/zero-diff.test.ts
    - grid/test/norms/norm-producer-boundary.test.ts
    - brain/test/learning/__init__.py
    - brain/test/learning/test_rules.py
  modified:
    - brain/src/noesis_brain/learning/rules.py
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/audit/allowlist-twenty-six.test.ts
    - grid/test/audit/allowlist-twenty-two.test.ts
    - grid/test/audit/skill-allowlist.test.ts
    - grid/test/audit/skill-allowlist-baseline.test.ts
    - grid/test/audit/operator-exported-allowlist.test.ts
decisions:
  - "Used brain/test/learning/ (singular test, not tests) to match project convention; plan said tests/ but actual dir is test/"
  - "Updated 6 existing allowlist count tests from 39 to 41 (Rule 1 fix — tests tracking allowlist growth)"
  - "norm-producer-boundary.test.ts is currently RED because emitter files don't exist; will pass when Plan 03 ships"
metrics:
  duration: "5 minutes"
  completed: "2026-05-16T22:41:58Z"
  tasks_completed: 3
  files_created: 4
  files_modified: 9
---

# Phase 19 Plan 01: Wave 0 Safety Gate Summary

Wave 0 safety gate: Brain fingerprint computation added, FORBIDDEN_KEY_PATTERN extended with norm-private keys, allowlist grown from 39→41 with norm.candidate and norm.crystallized, RED test stubs created to enforce Nyquist on later plans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Trace revision_hash origin and fix Brain fingerprint computation | 05f99c0 | brain/src/noesis_brain/learning/rules.py |
| 2 | Extend broadcast-allowlist.ts — NORM_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN | 29cc34f | grid/src/audit/broadcast-allowlist.ts + 6 test files |
| 3 | Create RED test stubs and Brain fingerprint determinism tests | 0576eed | grid/test/norms/*.ts + brain/test/learning/test_rules.py |

## What Was Built

### Task 1 — Brain fingerprint computation (D-19-03)

Added `compute_norm_fingerprint(rule_text: str) -> str` to `brain/src/noesis_brain/learning/rules.py` as a module-level function. The algorithm (locked per D-19-03):

1. Extract `[a-z]+` tokens from lowercased rule text
2. Build sorted set of unique word-trigrams
3. SHA-256 of trigrams joined by space, truncated to 6 hex chars
4. Fallback for <3-word rules: SHA-256 of lowercased words joined by space

The function is ready to be called from the `nous.self_model_revised` emitter when it lands in a later plan. No existing code was changed — pure addition.

**Injection point finding:** The grep for `revision_hash` across `grid/src/` and `brain/src/` confirmed that `nous.self_model_revised` is currently a stub allowlist entry (pos 29, added in Phase 15) with no active emitter yet. The `RuleStore.add()` method stores wiki pages but does not compute a hash — confirmed by source inspection. `compute_norm_fingerprint` is now ready to provide the `revision_hash` value when the sole-producer emitter is wired in Phase 19 Plan 03.

### Task 2 — broadcast-allowlist.ts extensions (D-19-11)

Three changes to `grid/src/audit/broadcast-allowlist.ts`:

1. **NORM_FORBIDDEN_KEYS** — new exported constant with 3 keys: `norm_text`, `fingerprint_text`, `rule_content`. Follows the SKILL_FORBIDDEN_KEYS / HYPNOS_FORBIDDEN_KEYS export pattern.

2. **FORBIDDEN_KEY_PATTERN extended** — appended `|norm_text|fingerprint_text|rule_content` to the existing regex. Brain-private rule text cannot leak via any audit payload.

3. **ALLOWLIST_MEMBERS grown 39→41** — added `norm.candidate` (pos 40) and `norm.crystallized` (pos 41) with sole-producer comments per D-19-06.

Six existing audit test files asserted `ALLOWLIST.size === 39` and needed updating to 41. These were updated as a Rule 1 fix (the tests must track the allowlist's growth).

### Task 3 — RED test stubs + GREEN fingerprint tests

**grid/test/norms/zero-diff.test.ts** (RED — imports NormDetector which doesn't exist yet):
- Proves attaching NormDetector does not mutate any entry's `eventHash`
- Structural clone of `grid/test/relationships/zero-diff.test.ts`
- Uses `nous.self_model_revised` events with 6-char hex `revision_hash` payloads
- Will turn GREEN when Plan 03 ships `grid/src/norms/NormDetector.ts`

**grid/test/norms/norm-producer-boundary.test.ts** (RED — emitter files missing):
- Grep gate: `norm.candidate` must appear only in `norms/appendNormCandidate.ts` + allowlist
- Grep gate: `norm.crystallized` must appear only in `norms/appendNormCrystallized.ts` + allowlist
- Structural clone of `grid/test/skills/skill-producer-boundary.test.ts`
- Will turn GREEN when Plan 03 ships the sole-producer emitter files

**brain/test/learning/test_rules.py** (GREEN — all 8 pass):
- `test_same_text_same_fingerprint` — determinism invariant
- `test_output_is_6_char_hex` — format validation
- `test_punctuation_invariance` — `[a-z]+` tokenization removes punctuation
- `test_case_invariance` — lowercasing before processing
- `test_short_rule_fallback` — <3-word fallback returns valid hex
- `test_empty_string_fallback` — empty string fallback returns valid hex
- `test_different_texts_may_differ` — distinct inputs return distinct outputs (probabilistic)
- `test_word_order_in_trigrams_matters` — trigram sets differ for different orderings

## Verification Results

```
Brain fingerprint tests:    8/8 passed  (cd brain && uv run pytest test/learning/test_rules.py -k fingerprint)
Grid audit tests:         239/239 passed (cd grid && npx vitest run test/audit/)
Full brain suite:         682/682 passed (cd brain && uv run pytest)
norm-producer-boundary:   RED (2 fail — expected; emitters not yet shipped)
zero-diff.test.ts:         RED (cannot find module — expected; NormDetector not yet shipped)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Six existing allowlist count tests asserted 39 but allowlist is now 41**
- **Found during:** Task 2 verification
- **Issue:** `skill-allowlist.test.ts`, `skill-allowlist-baseline.test.ts`, `allowlist-twenty-six.test.ts`, `allowlist-twenty-two.test.ts`, `broadcast-allowlist.test.ts`, `operator-exported-allowlist.test.ts` all asserted `length === 39`. Adding 2 norm events grew the count to 41, making them fail.
- **Fix:** Updated all 6 tests to assert 41 (or `>= 39` for the baseline regression guard), matching the new allowlist state.
- **Files modified:** 6 test files in `grid/test/audit/`
- **Commits:** 29cc34f

**2. [Rule 3 - Blocking] Plan specified brain/tests/learning/ (plural) but actual project uses brain/test/ (singular)**
- **Found during:** Task 3 setup
- **Issue:** Plan referenced `brain/tests/learning/test_rules.py` but the brain project's `pyproject.toml` configures `testpaths = ["test"]` (singular). The `tests/` directory does not exist.
- **Fix:** Created `brain/test/learning/__init__.py` and `brain/test/learning/test_rules.py` at the correct path.
- **Impact:** None — pytest discovers the tests correctly at the right path.
- **Commits:** 0576eed

## Known Stubs

None — this plan is a safety gate; it adds the fingerprint function and test stubs but does not create any stubs that prevent plan goals from being achieved. The RED test stubs are intentional Nyquist gates.

## Self-Check: PASSED
