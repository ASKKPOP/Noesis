---
phase: 01-auditchain-listener-api-broadcast-allowlist
plan: 01
subsystem: infra
tags: [typescript, vitest, data-structures, backpressure, ring-buffer]

# Dependency graph
requires: []
provides:
  - Generic RingBuffer<T> bounded FIFO with drop-oldest semantics at grid/src/util/ring-buffer.ts
  - 10 behavioral tests locking the contract Phase 2 WsHub will consume
affects:
  - 02-websocket-hub-broadcast-fanout (per-client backpressure)
  - Any future component needing bounded FIFO with eviction

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Array-backed bounded FIFO with shift-on-overflow (acceptable for capacity<=256)"
    - "Constructor validation of invariants (non-integer / non-positive capacity rejection)"
    - "Private readonly backing store + public getters — house style matching grid/src/clock/ticker.ts"

key-files:
  created:
    - grid/src/util/ring-buffer.ts
    - grid/test/ring-buffer.test.ts
  modified: []

key-decisions:
  - "Array-shift implementation chosen over head/tail index ring: at capacity=256 the shift cost is O(256)~=microseconds, and readability dominates. If a Phase 2+ profile shows shift() dominating WsHub hot path, switch to circular indices without touching the public API."
  - "Constructor rejects non-integer / non-positive capacity explicitly (mitigates T-01-01-01 from the threat register) rather than clamping — fail-fast on misuse."
  - "Zero external dependencies: pure synchronous data structure; no EventEmitter, no async."

patterns-established:
  - "Generic bounded buffer with drop-oldest semantics as the per-client backpressure primitive"
  - "Public getters for size/capacity/isFull (no method parentheses) — matches ticker.ts conventions"

requirements-completed: [INFRA-01]

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 01 Plan 01: RingBuffer Utility Summary

**Generic `RingBuffer<T>` bounded FIFO with drop-oldest eviction — standalone primitive delivered ahead of Phase 2 WsHub per-client backpressure.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-17T23:42:20Z
- **Completed:** 2026-04-17T23:43:43Z
- **Tasks:** 1 (TDD — 2 commits: RED + GREEN)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- `RingBuffer<T>` exported from `grid/src/util/ring-buffer.ts` with exact API locked by 01-CONTEXT.md `<decisions>` block
- 10 behavioral tests covering empty/partial/full/overflow/drain/capacity-boundary/object-identity/invalid-capacity — all green
- Full grid test suite holds: 219/219 tests pass (209 pre-existing + 10 new, zero regressions)
- Constructor-level invariant enforcement (mitigates STRIDE T-01-01-01)
- Zero new dependencies — `grid/package.json` unchanged

## Task Commits

TDD cycle for Task 1 produced two commits:

1. **Task 1 RED: Failing tests for RingBuffer<T>** — `b29fcbf` (test)
2. **Task 1 GREEN: Implement RingBuffer<T>** — `6db10dd` (feat)

_No refactor commit — the GREEN implementation already matches house style (private readonly backing + public getters, mirroring `grid/src/clock/ticker.ts`)._

## Files Created/Modified

- `grid/src/util/ring-buffer.ts` (created) — Generic bounded FIFO with drop-oldest semantics; 44 lines, zero dependencies
- `grid/test/ring-buffer.test.ts` (created) — 10 behavioral tests locking the contract

## Decisions Made

- **Array-shift over circular indices:** At the target capacity of 256 entries, the difference between `Array.prototype.shift()` (linear in remaining length) and a head/tail-indexed ring is sub-millisecond. Readability wins; the public API is identical either way, so a Phase 2+ profile-driven swap is trivial.
- **Fail-fast constructor validation:** `Number.isInteger(capacity) && capacity > 0` is enforced in the constructor with an explicit `Error`. Matches the threat-register disposition for T-01-01-01 (DoS via unbounded-intent misuse).
- **No privacy check here:** `payloadPrivacyCheck` lives with the broadcast allowlist (Plan 01-02), not in the ring buffer — the buffer is type-agnostic and does not inspect payloads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing `@rollup/rollup-darwin-arm64` optional dependency**
- **Found during:** Task 1 (first vitest run)
- **Issue:** `npx vitest run` failed at startup with `Cannot find module @rollup/rollup-darwin-arm64` — known npm optional-dep bug, prevented any tests from running
- **Fix:** `npm install @rollup/rollup-darwin-arm64 --no-save` at the monorepo root to restore the native binding without committing a lockfile change
- **Files modified:** None (used `--no-save`; lockfile/manifest untouched)
- **Verification:** `cd grid && npx vitest run test/ring-buffer.test.ts` subsequently executed and produced the expected RED failures, then GREEN passes
- **Committed in:** N/A — environment fix, no source-tree change

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Purely environmental; no scope creep, no plan-file content changed. The monorepo `package-lock.json` is untouched.

## Issues Encountered

- Initial worktree branch was behind the expected base commit `7b28714` (current HEAD was `bd381a3`, a descendant). Resolved via `git reset --soft 7b28714` followed by `git checkout -- .planning/` to restore the planning tree to that base. No uncommitted work was lost (the descendant commits belong to the parent branch and remain reachable via their hashes).
- Plan acceptance criteria mention "944 pre-existing tests" — this is the monorepo-wide TypeScript total (protocol + grid). The `grid/` workspace alone has 209 pre-existing tests (now 219 with this plan's additions). All 219 pass. Full-suite regression budget is satisfied.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `RingBuffer<T>` is immediately consumable by Plan 01-02 (broadcast allowlist) and Plan 01-03 (AuditChain listener API) if they need it, and by Phase 2 WsHub for per-client backpressure.
- No known blockers.
- The array-shift implementation is flagged for potential profile-driven revisit in Phase 2 if `WsHub` throughput measurements show `shift()` in the hot path — public API is stable regardless.

## Self-Check: PASSED

- FOUND: `grid/src/util/ring-buffer.ts`
- FOUND: `grid/test/ring-buffer.test.ts`
- FOUND commit: `b29fcbf` (test)
- FOUND commit: `6db10dd` (feat)
- VERIFIED: `cd grid && npx vitest run test/ring-buffer.test.ts` → 10/10 pass
- VERIFIED: `cd grid && npm test` → 219/219 pass, 18 files, 0 regressions

---
*Phase: 01-auditchain-listener-api-broadcast-allowlist*
*Completed: 2026-04-17*
