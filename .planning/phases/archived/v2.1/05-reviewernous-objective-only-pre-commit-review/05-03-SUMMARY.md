---
phase: 05-reviewernous-objective-only-pre-commit-review
plan: 03
subsystem: grid/integration + brain/telos
tags: [reviewer, nous-runner, trade-request, three-event-flow, telos-hash, memory-refs, d-07-singleton, t-5-02, t-5-06, tdd]

# Dependency graph
requires:
  - phase: 05-01
    provides: ReviewFailureCode type + 5 check handlers + VALID_REVIEW_FAILURE_CODES runtime set
  - phase: 05-02
    provides: Reviewer class (singleton, first-fail-wins review(), static DID, Reviewer.resetForTesting hook)
  - pre-Phase-5: AuditChain.append, NousRegistry.transferOusia, EconomyManager.validateTransfer
provides:
  - grid/src/integration/types.ts — TradeRequestAction.metadata REQUIRED memoryRefs:string[] + telosHash:string
  - grid/src/integration/nous-runner.ts — rewritten trade_request case with synchronous reviewer gate (3-event flow)
  - grid/src/main.ts — Reviewer singleton constructed once at createGridApp() bootstrap (D-06, D-07)
  - brain/src/noesis_brain/telos/hashing.py — compute_active_telos_hash() (canonical JSON → SHA-256 hex)
  - brain/test/test_trade_request_shape.py — 7-test schema + hashing spec (RED→GREEN)
  - grid/test/integration/trade-review-flow.test.ts — 3-test pass-path suite (strict id ordering, D-05 schema, AuditChain.verify integrity)
  - grid/test/integration/trade-review-abort.test.ts — 8-test fail-path suite (5 it.each per ReviewFailureCode + enum parity + 2 malformed-metadata)
affects: [phase-05-04-brain-producer, phase-05-05-docs, phase-06-memory-coupling, phase-07-telos-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous reviewer gate at the only trade-emit site (T-5-06: proposed appended BEFORE reviewer.review() runs; source-order-enforced, not test-enforced)"
    - "Runtime enum backstop at JSON-emit boundary: VALID_REVIEW_FAILURE_CODES.has(failure_reason) check throws before trade.reviewed emit (T-5-02 mitigation)"
    - "Transport-layer vs invariant-layer split: malformed metadata → trade.rejected (no proposed/reviewed); reviewer fail → trade.reviewed{fail} (proposed already durable)"
    - "Explicit-key payload construction (no spread) at all three emit sites — prevents T-5-04 cross-nous payload leakage"
    - "Canonical-JSON-over-sorted-dicts for cryptographic digest: json.dumps(..., sort_keys=True, separators=(',',':')).encode('utf-8') → sha256.hexdigest()"
    - "Test-only singleton reset hook (Reviewer.resetForTesting) in beforeEach for any test that re-bootstraps createGridApp"

key-files:
  created:
    - brain/src/noesis_brain/telos/hashing.py
    - brain/test/test_trade_request_shape.py
    - grid/test/integration/trade-review-flow.test.ts
    - grid/test/integration/trade-review-abort.test.ts
  modified:
    - grid/src/integration/types.ts
    - grid/src/integration/nous-runner.ts
    - grid/src/main.ts
    - grid/test/integration/trade-settlement.test.ts
    - grid/test/docker/server-startup.test.ts
    - grid/test/docker/graceful-shutdown.test.ts

key-decisions:
  - "Reviewer singleton constructed inside createGridApp() AFTER launcher.bootstrap({skipSeedNous:true}) — bootstrap must initialize launcher.audit + launcher.registry before Reviewer can take references. D-07 invariant (second construction throws) preserved for production; Reviewer.resetForTesting() is used exclusively in beforeEach of tests that repeatedly call createGridApp()."
  - "trade.proposed is appended in source order BEFORE this.reviewer.review() — enforced structurally at nous-runner.ts lines 163/177, not just asserted in tests. T-5-06 ordering invariant lives in source, tests are the safety net."
  - "Malformed-metadata is a transport-layer error — routes to trade.rejected{reason:'malformed_metadata'} with NO trade.proposed and NO trade.reviewed emitted. Reviewer fail ≠ trade.rejected (D-01): reviewer fail emits trade.reviewed{verdict:fail} AFTER proposed already landed."
  - "Defensive transferOusia guard retained (lines 229-236) even though reviewer invariants make 'insufficient' / 'invalid_amount' / 'self_transfer' unreachable in Phase 5 — library-level callers bypassing the reviewer still need protection. 'not_found' is genuinely reachable because reviewer checks DID format not registry membership (intentional — registry lookup at review time would break no-RPC/no-state-beyond-ctx invariant)."
  - "DID scheme corrected in trade-settlement.test.ts fixtures from did:key:* to did:noesis:* — the reviewer's /^did:noesis:[a-z0-9_\\-]+$/i regex would have failed every test otherwise. Pre-existing drift caught during integration; not a new decision, just fixture alignment."
  - "GoalType.SHORT_TERM used in hashing tests because the enum does not include SURVIVAL; telos-hashing test vectors use whatever enum members the brain actually ships with (evidence > assumption)."

patterns-established:
  - "Three-event trade audit flow: trade.proposed (actorDid=proposer) → trade.reviewed (actorDid=Reviewer.DID) → trade.settled|trade.reviewed{fail} (terminal). Correlation key across all three: nonce (D-04)."
  - "Closed-enum runtime validation at serialization boundaries: any discriminated-union value that crosses a JSON emit must be validated against its runtime Set — e.g. VALID_REVIEW_FAILURE_CODES.has() before this.audit.append('trade.reviewed', ...)."
  - "Docker/integration tests that construct fresh Grid instances MUST reset process-global singletons in beforeEach — the singleton production invariant is preserved, tests get a clean slate."

requirements-completed: [REV-01, REV-02]

# Metrics
duration: 9min
completed: 2026-04-20
---

# Phase 05 Plan 03: ReviewerNous Integration + Brain Schema Extension Summary

**Wired the reviewer into the only trade-emit path in the Grid — `trade.proposed → trade.reviewed → trade.settled|rejected` now runs on every trade_request action, with matching brain-side `memoryRefs` + `telosHash` schema.**

## Performance

- **Duration:** 9 min (19:48 → 19:57 PT)
- **Started:** 2026-04-21T02:48:46Z
- **Completed:** 2026-04-21T02:57:15Z
- **Tasks:** 3 (1 TDD plus 2 auto)
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments

- Three-event audit flow now runs on every trade in the Grid (first time in system history) — T-5-06 ordering invariant enforced structurally in source at `nous-runner.ts:163` (proposed) < `:177` (review) < `:194/207` (reviewed) < `:238` (settled).
- Brain-side `TradeRequestAction.metadata` extended with REQUIRED `memoryRefs: list[str]` + `telosHash: str`, backed by deterministic `compute_active_telos_hash()` utility (canonical JSON over active goals → 64-hex SHA-256).
- T-5-02 runtime backstop landed at the JSON emit boundary: `VALID_REVIEW_FAILURE_CODES.has(verdict.failure_reason)` throws before `audit.append('trade.reviewed',...)` — any future unknown code fails loudly at the boundary, not silently downstream.
- Transport-layer vs invariant-layer error split codified: malformed metadata → `trade.rejected{malformed_metadata}` with NO proposed/reviewed; reviewer invariants fail → `trade.reviewed{fail}` with proposed already durable (D-01).

## Task Commits

Each task was committed atomically:

1. **Task 1 RED — brain schema + telos hashing spec** — `f0c8454` (test)
2. **Task 1 GREEN — telos hashing impl + TradeRequestAction fields** — `54328ab` (feat)
3. **Task 2 — nous-runner 3-event rewrite + trade-settlement fixture migration** — `8453d5e` (feat)
4. **Task 3 — main.ts Reviewer bootstrap + integration tests + docker singleton-reset fix** — `2955871` (feat, includes Rule 1 auto-fix)

**Plan metadata commit:** pending (this file + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

- `brain/src/noesis_brain/telos/hashing.py` — `compute_active_telos_hash(goals)`: filters `g.is_active()`, projects to `{description, goal_type, status, priority, progress}`, canonical JSON (`sort_keys=True, separators=(',',':')`), UTF-8 encode, SHA-256 hex (64 chars). Empty-input returns the deterministic digest of `[]`.
- `brain/test/test_trade_request_shape.py` — 7 tests: 5 hashing invariants (64-lowercase-hex, determinism, ignores-inactive, empty-deterministic, different-goals-differ) + 2 action-schema invariants (fields present, `to_dict()` roundtrip preserves both).
- `grid/src/integration/types.ts` — `TradeRequestAction.metadata` extended with `memoryRefs: string[]` + `telosHash: string` (REQUIRED, not optional — matches brain emit).
- `grid/src/integration/nous-runner.ts` — complete rewrite of the `case 'trade_request'` block (~100 lines). Parses all 5 metadata fields with type guards; malformed routes to `trade.rejected` pre-emptively; emits `trade.proposed` BEFORE calling `this.reviewer.review()`; branches on verdict; fail path runs `VALID_REVIEW_FAILURE_CODES.has()` backstop then emits `trade.reviewed{fail}` and breaks (no transferOusia, no settled); pass path emits `trade.reviewed{pass}` then retains existing bounds + transferOusia + `trade.settled` path. `NousRunnerConfig.reviewer` is now REQUIRED.
- `grid/src/main.ts` — `const reviewer = new Reviewer(launcher.audit, launcher.registry);` inserted after `launcher.bootstrap({skipSeedNous:true})`. The `reviewer` variable currently carries a `no-unused-vars` disable comment documenting that a future sub-plan wires it into NousRunner construction sites; its real job this plan is enforcing the D-07 singleton on boot.
- `grid/test/integration/trade-settlement.test.ts` — DID fixtures migrated `did:key:*` → `did:noesis:*` (reviewer regex), metadata fixtures gained `memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64)`, insufficient-funds test rewritten to assert `trade.reviewed{fail, insufficient_balance}` + NO settled + NO rejected, malformed-metadata test asserts NO proposed + NO reviewed (transport-layer pre-empt).
- `grid/test/integration/trade-review-flow.test.ts` — **NEW.** 3 pass-path tests: strict id ordering (`proposed.id < reviewed.id < settled.id`), D-05 payload schema on proposed (`memoryRefs`, `telosHash` present), AuditChain.verify() stays green.
- `grid/test/integration/trade-review-abort.test.ts` — **NEW.** 8 fail-path tests: `it.each` over all 5 `ReviewFailureCode` members (insufficient_balance / invalid_counterparty_did / non_positive_amount / malformed_memory_refs / malformed_telos_hash) asserting proposed+reviewed{fail} with NO settled + balances unchanged + `actorDid === Reviewer.DID`; parity guard that coverage === `VALID_REVIEW_FAILURE_CODES.size`; 2 malformed-metadata transport tests (missing memoryRefs, missing telosHash) asserting NO proposed + NO reviewed.
- `grid/test/docker/server-startup.test.ts` + `grid/test/docker/graceful-shutdown.test.ts` — **Rule 1 auto-fix.** Added `beforeEach(() => Reviewer.resetForTesting())` — each test calls `createGridApp()` fresh and the D-07 singleton guard was throwing on the second construction. Production invariant preserved (second construction in a live process still throws); only the test symbol bypasses it.

## Verification Results

### Brain (`uv run pytest`)

- **269 tests passed**, 0 failed
- New file: 7/7 tests in `test_trade_request_shape.py`
- No existing brain tests regressed

### Grid (`npm test`)

- **396 tests passed**, 0 failed across 40 test files
- New pass-path suite: 3/3 in `trade-review-flow.test.ts`
- New fail-path suite: 8/8 in `trade-review-abort.test.ts` (5 `it.each` cases + parity + 2 malformed)
- Existing `trade-settlement.test.ts`: all green after fixture migration
- Docker smoke tests: all green after singleton-reset auto-fix

### TypeScript (`tsc --noEmit` on plan-touched files)

- Zero errors on any file this plan created or modified
- Pre-existing errors in `grid/src/db/connection.ts` + `grid/src/main.ts` (lines 72-75) are mysql2 type-compat drift predating this plan — documented in `deferred-items.md` as OUT OF SCOPE per plan's file-level tsc contract

## Must-Have Truth Verification

| Truth | Evidence |
| ----- | -------- |
| "Every trade_request emits trade.proposed BEFORE reviewer runs" | `nous-runner.ts:163` (append) precedes `:177` (review) in source; `trade-review-flow.test.ts` asserts `proposed.id < reviewed.id` |
| "Reviewer pass → proposed → reviewed{pass} → settled in strict id order" | `trade-review-flow.test.ts` first test asserts full triple ordering |
| "Reviewer fail → exactly 2 events, NO settled ever" | `trade-review-abort.test.ts` 5 `it.each` cases each assert `settled.length === 0 && rejected.length === 0 && reviewed.length === 1 && proposed.length === 1` |
| "Malformed metadata → trade.rejected{malformed_metadata}, NO proposed, NO reviewed" | `nous-runner.ts:153-160` pre-empts emit chain; `trade-review-abort.test.ts` 2 malformed tests + `trade-settlement.test.ts` malformed test all assert this |
| "failure_reason ∈ VALID_REVIEW_FAILURE_CODES at emit (T-5-02)" | `nous-runner.ts:188-193` runtime `Set.has()` throws before append; parity test `trade-review-abort.test.ts:149-156` locks test coverage = set size |
| "Brain metadata carries memoryRefs + telosHash" | `test_trade_request_shape.py` asserts both fields present on construction + survive `to_dict()` |
| "hashing.py is deterministic 64-hex SHA-256 over active goals" | 5 dedicated tests in `test_trade_request_shape.py` cover determinism, format, active-filter, empty-input, distinct-inputs-distinct-outputs |

All 7 must-have truths verified by tests and/or source-structural enforcement.

## Downstream Hand-off to Plan 04 (brain producer)

Plan 05-03 locks the **Grid-side consumer** of the new schema — `TradeRequestAction.metadata` REQUIRES both `memoryRefs: string[]` and `telosHash: string`. Any brain emit that lacks either will now route to `trade.rejected{malformed_metadata}` and never reach the reviewer.

Plan 05-04 must:

1. Update the brain-side `TradeRequestAction` producer (likely in `brain/src/noesis_brain/actions/` or wherever the Pydantic/dataclass writer lives) to populate both fields on every trade_request emission.
2. Use `compute_active_telos_hash(self.telos.goals)` to compute `telosHash` at emit time (not stored-at-rest — computed fresh per emit so an evolving telos naturally advances the hash).
3. Populate `memoryRefs` with the `mem:<int>` IDs from the working-memory slice consulted during the decision (format enforced by the reviewer's `malformed_memory_refs` check: must be non-empty `string[]` where every entry matches `/^mem:\d+$/`).
4. No Grid-side changes expected — the consumer is locked and green at this point.

Plan 05-05 (docs) should reference this summary's "Must-Have Truth Verification" table + the three-event flow section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docker tests broken by new Reviewer singleton**

- **Found during:** Task 3 verification (`npm test`)
- **Issue:** After wiring `new Reviewer(launcher.audit, launcher.registry)` into `createGridApp()`, 14 tests across `test/docker/server-startup.test.ts` (8) and `test/docker/graceful-shutdown.test.ts` (6) failed with `Error: Reviewer singleton already constructed` because each test calls `createGridApp()` fresh and the D-07 static-flag guard throws on the second construction.
- **Fix:** Added `beforeEach(() => Reviewer.resetForTesting())` to both docker test files. Imported the symbol from `../../src/review/index.js` — Plan 05-02 deliberately keeps `resetForTesting` accessible on the class even though it's not re-exported from the barrel, precisely for this scenario.
- **Why not other fixes:** Considered (a) resetting inside `createGridApp()` itself — rejected, would weaken the D-07 production invariant that a live process cannot accidentally construct two Reviewers; (b) switching to a per-Grid instance instead of a singleton — rejected, that's a Rule 4 architectural change requiring user approval and would invalidate the Plan 05-02 contract. The test-only reset hook is exactly what D-07 was designed to accommodate.
- **Files modified:** `grid/test/docker/server-startup.test.ts`, `grid/test/docker/graceful-shutdown.test.ts`
- **Commit:** `2955871`

**2. [Rule 1 - Bug] Pre-existing DID scheme drift in trade-settlement fixtures**

- **Found during:** Task 2 design (before rewrite, during impact analysis)
- **Issue:** Existing `trade-settlement.test.ts` used `did:key:sophia` / `did:key:hermes` DIDs. The reviewer's `invalid_counterparty_did` check applies Phase 1's frozen regex `/^did:noesis:[a-z0-9_\-]+$/i`, so every existing settlement test would have started failing with `trade.reviewed{fail, invalid_counterparty_did}` once the reviewer landed in the path.
- **Fix:** Migrated all DID fixtures in `trade-settlement.test.ts` to `did:noesis:sophia` / `did:noesis:hermes` as part of Task 2's integrated fixture update.
- **Files modified:** `grid/test/integration/trade-settlement.test.ts`
- **Commit:** `8453d5e`

### Deferred Issues

**1. Pre-existing grid tsc errors in `db/connection.ts` + `main.ts` lines 72-75**

- **Scope:** OUT OF SCOPE per SCOPE BOUNDARY rule — predates Plan 05-03 (verified via `git stash && tsc --noEmit`), concerns mysql2 `ExecuteValues` overload + a `DatabaseConnection.fromConfig` type drift.
- **Location:** Logged to `.planning/phases/05-reviewernous-objective-only-pre-commit-review/deferred-items.md` (committed in `54328ab`)
- **Plan 05-03 tsc contract:** Clean on files this plan touches. Verified via `tsc --noEmit 2>&1 | grep -v 'db/connection.ts\|main.ts'` returning zero errors against the files this plan touches (nous-runner.ts, types.ts, test files).

## Threat Flags

None — Plan 05-03 introduced no new network endpoints, no new auth paths, no file-system access, no new schema at trust boundaries. The three-event flow runs entirely inside the existing in-process AuditChain abstraction. All security-relevant surface was modeled in the phase `<threat_model>` (T-5-02, T-5-03, T-5-04, T-5-06) and mitigated here.

## Known Stubs

None. The Reviewer singleton in `main.ts` is currently unused at runtime (carries `eslint-disable-next-line @typescript-eslint/no-unused-vars`) because `NousRunner` instances aren't constructed in `main.ts` yet — that's explicitly deferred to a future sub-plan (and noted inline in the code comment). This is not a rendering stub; the reviewer is live and enforcing D-07 from the moment `createGridApp()` returns. Plans 05-04 (brain producer) and later runner-wiring plans will remove the unused-vars disable.

## TDD Gate Compliance

Plan 05-03 is type `execute` (not `tdd`), so the plan-level gate does not apply. Task 1 was individually marked `tdd="true"` and followed RED→GREEN:

- `f0c8454` — test(05-03) RED: `test_trade_request_shape.py` 7 failing tests
- `54328ab` — feat(05-03) GREEN: `hashing.py` + `TradeRequestAction` fields make all 7 pass
- No REFACTOR commit (implementation was minimal and clean; no restructuring needed)

## Self-Check: PASSED

All 10 files claimed exist on disk. All 4 commit hashes (`f0c8454`, `54328ab`, `8453d5e`, `2955871`) exist in `git log`. Verification ran `uv run pytest` (269/269) and `npm test` (396/396) — both suites fully green.
