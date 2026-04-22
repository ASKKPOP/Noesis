---
phase: 10a-ananke-drives-inner-life-part-1
plan: 04
subsystem: grid-ananke-dispatcher
tags: [ananke, drive-crossed, nous-runner, dispatcher, drive-03, drive-05]
dependency_graph:
  requires:
    - 10a-02 (appendAnankeDriveCrossed sole-producer emitter + allowlist)
  provides:
    - "Grid-side wire path: Brain drive_crossed Action → ananke.drive_crossed chain entry"
    - "BrainAction.drive_crossed TypeScript variant for brain-bridge contract"
  affects:
    - "grid/src/integration/* BrainAction union (now 7 variants)"
    - "NousRunner.executeActions dispatcher (now handles drive_crossed)"
tech_stack:
  added: []
  patterns:
    - "Sole-producer dispatcher (Phase 7 telos_refined clone)"
    - "try/catch-and-drop for producer-boundary rejections (T-10a-18)"
    - "Structured console.warn for dispatcher rejections (ananke.dispatch.rejected)"
key_files:
  created:
    - grid/test/integration/nous-runner-ananke.test.ts
    - grid/test/integration/brain-action-to-audit.test.ts
  modified:
    - grid/src/integration/types.ts
    - grid/src/integration/nous-runner.ts
decisions:
  - "Tick source: executeActions tick parameter (world-clock upstream) — no WorldClock injection needed on NousRunner"
  - "Logger: console.warn JSON.stringify (matches existing grid patterns, no new logger dependency)"
  - "Extra keys in action.metadata are silently ignored by the dispatcher — appendAnankeDriveCrossed's closed-tuple check is the structural guarantee"
metrics:
  duration_min: 25
  completed_date: 2026-04-22
  tasks_completed: 2
  files_created: 2
  files_modified: 2
  tests_added: 10
requirements:
  - DRIVE-03 (wire path complete)
  - DRIVE-05 (dispatcher enforcement)
---

# Phase 10a Plan 04: Nous-runner Ananke dispatcher wiring Summary

JSON-RPC `Action(action_type='drive_crossed')` returns from the Brain now land on the Grid's AuditChain as `ananke.drive_crossed` entries via the sole-producer emitter, with the Grid authoritatively injecting `did` (runner self) and `tick` (world-clock from executeActions).

## What shipped

1. **`grid/src/integration/types.ts`** — Added `BrainActionDriveCrossed` interface (3-key metadata: `drive`, `level`, `direction`, closed-enum types imported from `../ananke/types.js`), extended `BrainAction` discriminated union from 6 → 7 variants.
2. **`grid/src/integration/nous-runner.ts`** — Added `case 'drive_crossed':` branch inside `executeActions`. The branch:
   - Imports `appendAnankeDriveCrossed` from `../ananke/index.js`.
   - Calls the sole-producer emitter with `{did: this.nousDid, tick, drive, level, direction}` where `tick` comes from the existing `executeActions(actions, tick)` parameter (same tick source used by `nous.spoke`, `nous.moved`, etc.).
   - Wraps the call in try/catch: rejections emit a structured `console.warn({event: 'ananke.dispatch.rejected', did, reason})` and drop the action — sibling actions in the same tick batch still dispatch (T-10a-18).
3. **`grid/test/integration/nous-runner-ananke.test.ts`** (6 tests) — dispatcher unit tests: happy path, multi-action batches, enum-mismatch log+drop, non-drive_crossed pass-through, mixed-batch sibling resilience, and a forgery-attempt scenario proving `did`/`tick` smuggled into metadata cannot override runner context.
4. **`grid/test/integration/brain-action-to-audit.test.ts`** (4 tests) — E2E: 10-tick stream produces 10 correctly-shaped entries with per-tick values preserved; broadcast allowlist membership; regression no-stray-event-types; intra-tick arrival order preserved.

## Commits

| Hash     | Subject                                                          | Files                                                                                               |
| -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 56deadb  | feat(10a-04): wire nous-runner dispatcher for ananke.drive_crossed | `grid/src/integration/types.ts`, `grid/src/integration/nous-runner.ts`                              |
| f2efc5e  | test(10a-04): dispatcher + E2E tests for ananke.drive_crossed wire path | `grid/test/integration/nous-runner-ananke.test.ts`, `grid/test/integration/brain-action-to-audit.test.ts` |

## Invariants verified

- ✅ `BrainActionDriveCrossed` has `action_type: 'drive_crossed'`, `channel: ''`, `text: ''`, and `metadata` with exactly 3 keys `{drive, level, direction}` — all closed-enum types from `grid/src/ananke/types.ts`.
- ✅ Dispatcher calls `appendAnankeDriveCrossed(this.audit, this.nousDid, {did, tick, drive, level, direction})` — 5-key payload after Grid injection.
- ✅ `tick` is sourced from the `executeActions(actions, tick)` parameter (upstream from `NousRunner.tick`'s world-clock argument). No `Date.now()` / `performance.now()` / `setInterval` introduced by this plan. Verified via `git diff` grep.
- ✅ `did` is `this.nousDid` — never read from `action.metadata.did` (verified by forgery-attempt test).
- ✅ try/catch around `appendAnankeDriveCrossed`: on throw, logs structured `ananke.dispatch.rejected` at warn and `break`s. Does NOT rethrow — sibling actions continue (verified by mixed-batch test).
- ✅ No existing dispatcher branch modified. `telos_refined`, `speak`, `move`, `trade_request`, `direct_message`, `noop` all untouched (diff contained).
- ✅ `pnpm tsc --noEmit` clean in `grid/`.
- ✅ Full grid vitest suite: **87 test files / 810 tests PASS** — zero regressions.
- ✅ New integration-test subset: **10/10 PASS** across the two new test files.

## Deviations from Plan

### Reconciliations (field-name mapping — planner used interface-level names; actual runner uses existing field names)

**1. Tick accessor: `worldClock.getTick()` → `tick` parameter**
- **Plan pseudocode:** `tick: this.worldClock.getTick()` inside the dispatcher.
- **Reality:** `NousRunner` has no `worldClock` field. `tick` is already a parameter of `executeActions(actions, tick)`, passed in from `NousRunner.tick(tick, epoch, ...)` which receives it from the grid `WorldClock.onTick` callback upstream (see `grid/src/clock/ticker.ts`). Same upstream source as the plan intended — just accessed via the parameter rather than a field.
- **Rationale:** The plan's Task 1 action step 3 explicitly anticipated this: "If the runner does not expose `worldClock.getTick()` directly but has, say, `this.clock.getTick()` or `this.tick`, use the existing name."
- **Invariant preserved:** Tick is still a monotonically-increasing world-clock integer; never `Date.now()`.

**2. Runner field names: `this.did` / `this.auditChain` / `this.logger` → `this.nousDid` / `this.audit` / `console.warn`**
- **Plan pseudocode:** `appendAnankeDriveCrossed(this.auditChain, this.did, ...)` and `this.logger.warn(...)`.
- **Reality:** The existing runner uses `this.nousDid` and `this.audit` (from `grid/src/integration/nous-runner.ts:53,59`). There is no `this.logger` abstraction — the grid codebase uses `console.warn(JSON.stringify(...))` for structured warnings (see `grid/src/main.ts:165`, `grid/src/db/persistent-chain.ts:35`, `grid/src/relationships/storage.ts:75`).
- **Adaptation:** Used the existing names consistently. Plan intent — "log warn with event: 'ananke.dispatch.rejected'" — preserved structurally: the warning is JSON-serialized with `{event: 'ananke.dispatch.rejected', did, reason}`.
- **No new dependency introduced.** Matches the house style.

### Out-of-scope observations (NOT fixed)

- Pre-existing untracked file `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-PATTERNS.md` was present in the working tree before this plan started. Left alone per scope-boundary rule.

## Threat-model coverage

All five threats in the plan's STRIDE register (T-10a-16..T-10a-20) are structurally mitigated and covered by tests:

| Threat   | Coverage                                                                                   |
| -------- | ------------------------------------------------------------------------------------------ |
| T-10a-16 | "enum-mismatch metadata" test asserts log+drop; chain unchanged.                             |
| T-10a-17 | `git diff` confirms zero `Date.now`/`performance.now`/`setInterval` introduced.             |
| T-10a-18 | "mixed batch (good+bad+good)" test asserts bad dropped, goods still land.                    |
| T-10a-19 | Forgery-attempt test smuggles `did` into metadata — asserts runner's `did` wins.             |
| T-10a-20 | Single runner = single DID (constructor binds once, never mutated).                          |

## Self-Check: PASSED

**Files created — all exist:**
- ✅ `grid/test/integration/nous-runner-ananke.test.ts`
- ✅ `grid/test/integration/brain-action-to-audit.test.ts`
- ✅ `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-04-SUMMARY.md` (this file)

**Commits — all present in `git log`:**
- ✅ `56deadb` — feat(10a-04): wire nous-runner dispatcher for ananke.drive_crossed
- ✅ `f2efc5e` — test(10a-04): dispatcher + E2E tests for ananke.drive_crossed wire path
