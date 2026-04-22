---
phase: 09-relationship-graph-derived-view
plan: 08
subsystem: operator-api/relationships
tags: [gap-closure, ME-02, H5, security, hardening, audit-integrity]
gap_closure: true
closed_gaps: [Gap-2-ME-02]
requires: []
provides:
  - "H5 edge_key resolution via full 64-char SHA-256 hash strict equality only"
  - "Regression test battery pinning shortened edge_key → 400 invalid_edge_key"
  - "target_did ≠ counterparty_did invariant proven for full-hash lookups"
affects:
  - "grid/src/api/operator/relationships.ts — H5 route validation + resolver"
  - "grid/test/api/relationships-privacy.test.ts — +3 ME-02 tests, +1 Rule 1 fix"
tech-stack:
  patterns:
    - "full-hash-only lookup (supersedes prefix match; eliminates prefix-collision wrong-edge class)"
    - "regex validation gate before side effects (audit emission short-circuited on bad input)"
key-files:
  modified:
    - grid/src/api/operator/relationships.ts
    - grid/test/api/relationships-privacy.test.ts
decisions:
  - "D-9-10 reaffirmed: edge_hash is full 64-char SHA-256 hex at every endpoint boundary; no prefix acceptance"
  - "Strict equality on lowercased input — case-insensitive match preserved without regex-driven string search"
metrics:
  duration_minutes: 4
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 2
  lines_added: 92
  lines_removed: 5
  commits:
    - "c512bc7 fix(09-08): harden H5 edge_key resolution — full-hash strict equality only"
    - "4ed438a test(09-08): add ME-02 regression tests — shortened edge_key rejection + target_did integrity"
requirements_satisfied:
  - REL-02
---

# Phase 09 Plan 08: H5 Edge Key Resolution Hardening — ME-02 Gap Closure Summary

Gap 2 (finding ME-02 from 09-REVIEW.md) is closed: the H5 operator-inspection
route now accepts only full 64-char SHA-256 edge_hashes, resolves via strict
equality on a lowercased key, and has three regression tests proving that
shortened edge_keys short-circuit at the validation gate before any edge
lookup, operator_id check, or `operator.inspected` audit emission.

## One-liner

Tightened the H5 `edge_key` regex from `{16,64}` to `{64}`, replaced the
`startsWith`-based resolver with strict equality on a lowercased key, removed
the dead `|| edgeHash(e) === edgeKey` clause, and added ME-02 regression
tests that pin the 16-char/63-char rejection path and the full-hash happy
path with a `target_did !== counterparty_did` invariant assertion.

## What changed

### Source (`grid/src/api/operator/relationships.ts`, lines 341-374)

| | Before | After |
|---|---|---|
| Regex | `/^[a-f0-9]{16,64}$/i` | `/^[a-f0-9]{64}$/i` |
| Resolver | `edgeHash(e).startsWith(edgeKey) \|\| edgeHash(e) === edgeKey` | `edgeHash(e) === normalizedKey` |
| Input normalization | none | `const normalizedKey = edgeKey.toLowerCase()` |
| Comment (step 3) | "Edge resolution by hash prefix" | "Edge resolution by full canonical hash" |

No other logic changed: tier validation, operator_id validation, tombstone
check, audit chain scan, self-loop guard, and the `operator.inspected`
emission (tier=H5, action=inspect_edge_events, target_did=did_a,
counterparty_did=did_b) are all byte-identical to pre-hardening.

### Tests (`grid/test/api/relationships-privacy.test.ts`)

**Three new ME-02 regression tests** (inserted after Test 11, in the existing
H5 test cluster):

1. **`H5 rejects 16-char edge_key prefix with 400 invalid_edge_key (ME-02)`** —
   asserts status 400 AND zero `operator.inspected` entries appended, proving
   short-circuit happens before the audit boundary.
2. **`H5 rejects 63-char edge_key (one short of full hash) with 400 (ME-02)`** —
   boundary test: the string is hex-valid but one char short; must still be
   rejected and must not emit.
3. **`H5 accepts 64-char full edge_hash and emits operator.inspected with
   correct target_did (ME-02)`** — happy path; asserts exactly one
   `operator.inspected` appended, `payload.target_did ∈ {DID_A, DID_B}`,
   `payload.counterparty_did ∈ {DID_A, DID_B}`, and
   `payload.target_did !== payload.counterparty_did`. The last inequality is
   the load-bearing assertion — it is the canary for any future regression to
   prefix-match (which could silently collapse to the same DID on collision).

**One pre-existing test fixture updated (Rule 1 auto-fix):** Test 9 previously
used `'0'.repeat(16)` to assert the "unknown edge_key → 404" path. After the
regex tightening, a 16-char input returns 400 at the gate rather than falling
through to edge resolution. Changed the fixture to `'0'.repeat(64)` so the
test preserves its original semantic (well-formed hash with no matching edge
→ 404 edge_not_found). Comment added explaining the change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – Bug] Test 9 fixture incompatible with tightened regex**
- **Found during:** Task 2 test execution planning.
- **Issue:** Pre-existing Test 9 (`H5 GET unknown edge_key → 404`) used
  `'0'.repeat(16)` as the fixture key. Post-Task-1, a 16-char hex input hits
  the regex gate and returns 400 invalid_edge_key, not 404 edge_not_found —
  the test would have regressed.
- **Fix:** Changed fixture to `'0'.repeat(64)`. The test's semantic intent
  (well-formed full hash with no matching edge → 404) is preserved; only the
  fixture length changed. Added an inline comment noting the ME-02 rationale.
- **File modified:** `grid/test/api/relationships-privacy.test.ts`
- **Commit:** `4ed438a` (same commit as the three new ME-02 tests)

**2. [Rule 3 – Stale comment] "Edge resolution by hash prefix" comment misleading**
- **Found during:** Task 1 implementation (comment on line 361 said "by hash
  prefix" immediately above the new strict-equality resolver).
- **Fix:** Updated to "Edge resolution by full canonical hash (D-9-10)".
- **Commit:** `c512bc7` (same commit as Task 1).

No Rule 4 architectural deviations. No CLAUDE.md invariants affected (broadcast
allowlist unchanged at 18, zero-diff audit chain unbroken, sole-producer
boundaries preserved — operator route only reads `relationships.allEdges()`,
does not mutate).

## Verification Results

All commands from plan `<verify>` section executed in
`.claude/worktrees/agent-09-08-1776833453/grid`:

```
$ npx tsc --noEmit 2>&1 | grep -E "(operator|relationships-privacy)"
(no matches — typecheck clean in scope)

$ npx vitest run test/api/relationships-privacy.test.ts
Test Files  1 passed (1)
     Tests  19 passed (19)

$ grep -n "startsWith" src/api/operator/relationships.ts
(zero matches — expected)

$ grep -n "16,64" src/api/operator/relationships.ts
(zero matches — expected)

$ grep -c "ME-02" test/api/relationships-privacy.test.ts
5
```

### Regression suite (plan's recommended gate)

```
$ npx vitest run test/relationships test/api/relationships-privacy.test.ts
Test Files  13 passed (13)
     Tests  84 passed (84)
```

### Full grid suite (sanity)

```
$ npx vitest run
Test Files  81 passed (81)
     Tests  740 passed (740)
```

### Invariant tests (explicit re-run)

```
$ npx vitest run \
    test/relationships/allowlist-frozen.test.ts \
    test/audit/allowlist-eighteen.test.ts \
    test/relationships/producer-boundary.test.ts
Test Files  3 passed (3)
     Tests  12 passed (12)
```

All green. Zero regressions outside scope.

## Threat Model Outcomes

| Threat ID | Category | Disposition | Outcome |
|-----------|----------|-------------|---------|
| T-09-ME02-01 | Spoofing (I) via prefix-ambiguity | mitigate | Closed. Regex `{64}` eliminates the prefix-ambiguity class entirely; shortened hex inputs never reach the resolver. |
| T-09-ME02-02 | Tampering of operator.inspected audit payload | mitigate | Closed. Strict-equality resolver cannot silently swap target_did with a sibling edge on hash-prefix collision. |
| T-09-ME02-03 | Repudiation via audit-chain poisoning | mitigate | Closed. Regression tests assert zero `operator.inspected` emissions on rejected inputs — audit write short-circuits at the regex gate. |
| T-09-ME02-04 | Info Disclosure of wrong edge's events | mitigate | Closed. 400 and 404 paths return no edge data; positive response only for exact-match full hash. |

## Files Touched

| File | Lines +/- | Reason |
|---|---|---|
| grid/src/api/operator/relationships.ts | +10 / -4 | Regex tighten, strict-equality resolver, dead-clause removal, comment update |
| grid/test/api/relationships-privacy.test.ts | +82 / -1 | Three ME-02 regression tests + Test 9 fixture fix |

**Net:** 2 files changed, +92 lines, -5 lines.

## Known Stubs

None. No stub patterns introduced. No hardcoded empty fixtures, placeholder
text, or disconnected components.

## Threat Flags

None — no new security surface introduced. This plan strictly narrows an
existing route's accepted input space (from 16-64 chars to exactly 64) and
replaces a loose resolver with a strict one. Nothing new added at trust
boundaries, no new network endpoints, no new auth paths, no schema changes.

## TDD Gate Compliance

Plan-level type was `execute` (not `tdd`). Both tasks had `tdd="true"` at the
task level:

- **Task 1 (fix):** Single-commit implementation (`c512bc7`) with
  `npx tsc --noEmit` as the verification gate. No separate RED/GREEN commits
  — the task's verify block specified typecheck only. The regression tests
  for this change landed in Task 2.
- **Task 2 (test):** New tests PASS against the Task 1 implementation as
  designed (they prove the new behavior, not failing-first behavior from a
  hypothetical pre-Task-1 state). The 16-char/63-char tests WOULD have
  failed against the pre-ME-02 code (would have returned 200 with a
  wrong-edge `operator.inspected`) — executed against the Task-1 code they
  correctly pass.

No `refactor` commits. No gate violations.

## Self-Check: PASSED

- [x] `grid/src/api/operator/relationships.ts` exists and contains
  `/^[a-f0-9]{64}$/i` and `edgeHash(e) === normalizedKey`
- [x] `grid/test/api/relationships-privacy.test.ts` exists and contains
  5 `ME-02` markers
- [x] Commit `c512bc7` present in branch history
- [x] Commit `4ed438a` present in branch history
- [x] `grep -n "startsWith" src/api/operator/relationships.ts` returns zero matches
- [x] `grep -n "16,64" src/api/operator/relationships.ts` returns zero matches
- [x] Full grid suite green (740/740)
- [x] Privacy matrix green (19/19)
- [x] Invariant tests green (allowlist, producer-boundary)
