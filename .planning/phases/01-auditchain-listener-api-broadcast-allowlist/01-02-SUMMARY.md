---
phase: 01-auditchain-listener-api-broadcast-allowlist
plan: 02
subsystem: audit
tags: [audit-chain, listener-api, observability-seam, determinism, benchmark]
requires: []
provides:
  - "AuditChain.onAppend(listener): Unsubscribe — fires after commit, per-listener try/catch isolated"
  - "AppendListener + Unsubscribe type exports from grid/src/audit/types.ts"
  - "Determinism regression test: 0-vs-10 listeners byte-identical chain.head over 100 appends"
  - "Performance budget regression: per-listener p99 overhead <100µs over 10_000 appends"
affects:
  - "grid/src/audit/chain.ts (AuditChain — new onAppend, modified append with fan-out)"
  - "grid/src/audit/types.ts (+ AppendListener, + Unsubscribe)"
  - "grid/test/audit.test.ts (+ 11 regression tests, no assertions modified)"
tech-stack:
  added: []
  patterns:
    - "WorldClock.onTick fire-and-forget + per-listener try/catch (mirrored verbatim)"
    - "Fire-after-commit ordering (entries.push → lastHash = eventHash → fan-out → return)"
    - "Silent restore path (loadEntries does NOT iterate appendListeners)"
key-files:
  created: []
  modified:
    - grid/src/audit/types.ts
    - grid/src/audit/chain.ts
    - grid/test/audit.test.ts
decisions:
  - "Listener errors are silently swallowed in v1 (matches WorldClock.onTick precedent; observability deferred to Phase 2+ per 01-CONTEXT.md)"
  - "Fan-out runs in insertion order via Set iteration — matches JS Set iteration contract"
  - "Date.now is frozen via vi.spyOn for the determinism test so both runs see identical createdAt sequences"
metrics:
  duration: "~30 minutes"
  completed: 2026-04-17
  tasks: 2
  files_modified: 3
  tests_added: 11
  tests_total_grid: 220
---

# Phase 01 Plan 02: AuditChain Listener API Summary

**One-liner:** Ships `AuditChain.onAppend()` with fire-after-commit semantics, per-listener try/catch isolation, silent restore path, and regression tests enforcing determinism and a <100µs p99 per-listener budget — the critical seam that Phase 2 WsHub subscribes to.

## What was built

**Task 1** — API surface (commit `1414ee1`):
- Added `AppendListener = (entry: AuditEntry) => void` and `Unsubscribe = () => void` type exports to `grid/src/audit/types.ts`.
- Added `private readonly appendListeners: Set<AppendListener>` field to `AuditChain`.
- Added `onAppend(listener): Unsubscribe` method returning a delete-closure (mirrors `WorldClock.onTick` exactly).
- Modified `append()` to fan out synchronously to all registered listeners AFTER `this.entries.push(entry)` AND `this.lastHash = eventHash`. Fan-out is wrapped in a per-listener `try { ... } catch { /* swallow */ }` block.
- Added a docstring line to `loadEntries` making the silent-restore contract explicit. No behavioral change to `loadEntries`, `verify`, `query`, `head`, `length`, `at`, `all`, or `computeHash`.

**Exact fan-out placement** (`grid/src/audit/chain.ts`):
- Line 45: `this.entries.push(entry);`
- Line 46: `this.lastHash = eventHash;`
- Lines 48-58: fan-out loop with per-listener try/catch
- Line 60: `return entry;`

Commit happens BEFORE fan-out. Listener executing inside the loop observes `chain.head === entry.eventHash` and `chain.length` already includes the new entry — verified by the `listener observes committed chain state` regression test.

**Task 2** — Regression tests (commit `a9769a8`):
Four new `describe` blocks appended to `grid/test/audit.test.ts` (11 tests total). Only single existing-line change: the vitest import added `vi` (required for `Date.now` spy in the determinism test). No existing assertion was modified.

## Regression tests

1. **`AuditChain.onAppend`** (7 tests): fires-after-commit, observes committed state, unsubscribe, insertion-order fan-out, throwing listener does not corrupt chain or escape `append()`, throwing listener does not block subsequent listeners, `verify()` remains valid with 0/1/10 listeners attached over 20 appends.
2. **`AuditChain.loadEntries silence`** (2 tests): `loadEntries` does NOT fire attached listeners; subsequent `append` after `loadEntries` DOES fire listeners exactly once.
3. **`AuditChain determinism with listeners`** (1 test): 100 appends with 0 vs 10 listeners produce byte-identical `chain.head` at every step (Date.now frozen via `vi.spyOn`).
4. **`AuditChain.append p99 overhead`** (1 test, skippable via `CI_SKIP_BENCH=1`): 10_000 appends with 0 vs 10 listeners; asserts per-listener p99 overhead < 100µs.

## Measured p99 numbers

Benchmark run locally on this machine (darwin-arm64, Node v25.9.0), 10_000 iterations, sampled three times:

| Run | p99 (0 listeners) | p99 (10 listeners) | Per-listener overhead |
|-----|-------------------|---------------------|-----------------------|
| 1   | 2.209 µs          | 1.042 µs            | -0.117 µs             |
| 2   | 0.833 µs          | 1.667 µs            | +0.083 µs             |
| 3   | 1.458 µs          | 0.584 µs            | -0.087 µs             |

Per-listener overhead is indistinguishable from scheduler noise at this sub-µs scale — the 100µs budget is met by roughly three orders of magnitude. The benchmark test passes cleanly and can remain on by default; `CI_SKIP_BENCH=1` exists for future noisy-CI escapes.

**Noise note:** At sub-µs per-op, `performance.now()` resolution and GC jitter dominate. Negative "overhead" readings reflect ordering-of-runs noise, not a real speedup. The invariant we actually enforce (p99 diff < 100µs) is rock-solid.

## Determinism confirmation

The determinism test (`AuditChain determinism with listeners`) executes 100 appends twice — once with 0 listeners, once with 10 no-op listeners — while `Date.now` is mocked to return a deterministic monotonic sequence. It then asserts `withTen === withNone` over all 100 head hashes. **Passes.** Attaching listeners provably cannot alter the chain's byte-identical output.

## Invariants preserved

- [x] Listeners fire AFTER `entries.push` AND `lastHash = eventHash` — never before (verified in code layout and `listener observes committed chain state` test).
- [x] `loadEntries` does NOT fire listeners — restore path silent (verified by `loadEntries does NOT fire attached listeners` test).
- [x] All pre-existing grid tests pass unchanged — 17 AuditChain tests + 192 others = **209 baseline tests**, all green. (Plan frontmatter says "944"; actual current grid suite is 209; this is a documentation artifact from the plan, not a regression.)
- [x] With 11 new tests added, total grid suite is **220 tests, all passing**.
- [x] `verify()` returns `{valid: true}` with listeners attached (explicitly tested with 0, 1, and 10 listeners over 20 appends).
- [x] Per-listener p99 overhead < 100µs budget (~3 orders of magnitude below budget on dev machine).

## git diff verification

`git diff grid/test/audit.test.ts` (against the pre-Task-2 baseline): one `-` line and one `+` line, both the vitest import — adding `vi`. All other changes are appended lines. **No pre-existing assertion was modified or deleted.**

`git diff grid/src/audit/chain.ts` (against HEAD~2): adds import fragment (`AppendListener`, `Unsubscribe`), `appendListeners` private Set field, try/catch fan-out loop inside `append()` AFTER the commit lines, new `onAppend` method, and a one-line docstring addition on `loadEntries`. No existing method signature or body semantic was changed.

`git diff grid/src/audit/types.ts` (against HEAD~2): two appended type export lines only.

## Deviations from Plan

None — plan executed exactly as written. The plan's claim of "944 existing tests" is a documentation quirk (current grid suite is 209 tests); the invariant that matters — **no existing test assertion was modified and all existing tests still pass** — is upheld.

## Commits

- `1414ee1` — feat(01-02): add AuditChain.onAppend listener API with fire-after-commit
- `a9769a8` — test(01-02): add AuditChain listener semantics, determinism, and p99 bench

## Self-Check: PASSED
- FOUND: grid/src/audit/types.ts (AppendListener and Unsubscribe exports)
- FOUND: grid/src/audit/chain.ts (appendListeners field, onAppend method, fan-out after commit)
- FOUND: grid/test/audit.test.ts (4 new describe blocks, 11 tests)
- FOUND: commit 1414ee1
- FOUND: commit a9769a8
- FOUND: full grid suite green (220/220)
