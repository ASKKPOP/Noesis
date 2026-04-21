---
phase: 05-reviewernous-objective-only-pre-commit-review
plan: 04
subsystem: grid/audit,grid/review,grid/integration
tags: [allowlist, privacy, zero-diff, regression, D-11, D-12, D-13, REV-02, SC-5]
requires:
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/audit/chain.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/review/index.ts
  - grid/src/review/types.ts
  - grid/src/review/Reviewer.ts
provides:
  - "trade.reviewed is a member of the frozen broadcast allowlist (11 events)"
  - "D-12 payload-privacy regression (1 pass + 5 fail variants clean, 2 literal guards)"
  - "D-13 zero-diff invariant regression (field-by-field chain comparison under fake timers)"
  - "NousRunnerConfig.reviewer optional type (test-only opt-out, production MUST pass)"
affects:
  - grid/test/broadcast-allowlist.test.ts
  - grid/test/review/payload-privacy.test.ts
  - grid/test/review/zero-diff.test.ts
tech-stack:
  added:
    - "vi.useFakeTimers / vi.setSystemTime pattern applied to reviewer regression test"
  patterns:
    - "ReviewFailureCode enumeration × FORBIDDEN_KEY_PATTERN static regression"
    - "Dual-run field-by-field chain comparison with trade.reviewed filter (RESEARCH §RQ5 Option 2)"
key-files:
  created:
    - .planning/phases/05-reviewernous-objective-only-pre-commit-review/05-04-SUMMARY.md
    - grid/test/review/payload-privacy.test.ts
    - grid/test/review/zero-diff.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/integration/nous-runner.ts
    - grid/test/broadcast-allowlist.test.ts
decisions:
  - "Allowlist extension: trade.reviewed inserted between trade.proposed and trade.settled (chronological trade-flow order)"
  - "Reviewer bypass: NousRunnerConfig.reviewer made optional (Plan Option (a), deviation documented) — enables D-13 dual-run without duplicating NousRunner internals"
  - "Zero-diff comparison strategy: field-by-field (eventType + actorDid + targetDid + payload + createdAt), NOT raw chain-hash (RESEARCH §RQ5 Option 2)"
  - "Fake-timer approach: vi.setSystemTime(FIXED_TIME) + vi.advanceTimersByTime(1) per tick — deterministic Date.now() both runs"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-20"
  commits: 3
  tests_added: 11
---

# Phase 5 Plan 04: Broadcast Allowlist + D-12 Payload Privacy + D-13 Zero-Diff Regression

One-line: Added `trade.reviewed` (11th event) to the frozen broadcast allowlist and locked in two critical regression tests — D-12 payload-privacy and D-13 zero-diff — that preserve sovereignty and chain-semantic invariants across the entire reviewer integration.

## What Shipped

### Task 1 — Allowlist extension + D-12 payload-privacy regression

**`grid/src/audit/broadcast-allowlist.ts`** — one member added:

- Line 25 comment updated: "v1 + Phase 5 — 11 event types"
- Line 31 inserted: `'trade.reviewed',      // Phase 5 (REV-02)` between `'trade.proposed'` and `'trade.settled'`
- `buildFrozenAllowlist`, `isAllowlisted`, `FORBIDDEN_KEY_PATTERN`, `payloadPrivacyCheck` all UNTOUCHED — v2.0-frozen contracts.

**`grid/test/broadcast-allowlist.test.ts`** — 3 edits:

- Line 10–12: size assertion `10 → 11`, description updated.
- Line 14–26: membership `it.each` table extended with `'trade.reviewed'` (inserted between `trade.proposed` and `trade.settled` to mirror source order).
- Line 41–46: frozen-mutation test now asserts add/**delete**/**clear** all throw TypeError (was only `add`); size assertion `10 → 11`.

**`grid/test/review/payload-privacy.test.ts`** — new file, 9 assertions:

- `it.each` over `VALID_REVIEW_FAILURE_CODES` exported from `grid/src/review/types.ts` — iterates the 5 fail codes, builds a `trade.reviewed{fail}` payload per code, asserts `payloadPrivacyCheck(...)` returns `{ ok: true }`.
- Dedicated pass-payload test (3-key shape: `trade_id`, `reviewer_did`, `verdict`).
- Static regression: for every `ReviewFailureCode`, `FORBIDDEN_KEY_PATTERN.test(code) === false`. Catches future reason-code additions that accidentally embed a forbidden keyword (e.g. `'bad_prompt_hash'`) at author-time, before the sovereignty leak can ship.
- Extra sanity: `FORBIDDEN_KEY_PATTERN.test('did:noesis:reviewer')` and `FORBIDDEN_KEY_PATTERN.test('pass'|'fail')` both false.

### Task 2 — D-13 zero-diff invariant regression

**`grid/test/review/zero-diff.test.ts`** — new file, 2 tests.

Test 1: `reviewer-enabled and reviewer-bypassed runs differ ONLY in trade.reviewed entries` — the core D-13 / SC #5 assertion.

- 100 ticks × 5 pass-path trades (amounts=1, well within bounds) through a single `NousRunner`.
- Run A: runner wired with `new Reviewer(audit, registry)` → chain has proposed + reviewed{pass} + settled per trade (15 trade events).
- Run B: runner wired with `reviewer: undefined` → chain has proposed + settled only (10 trade events).
- After filtering `eventType === 'trade.reviewed'` from Run A, both arrays have identical length (10 entries each).
- Field-by-field loop: for every non-reviewer entry index, `eventType`, `actorDid`, `targetDid`, `payload`, `createdAt` are deep-equal. **`id`, `prevHash`, `eventHash` are INTENTIONALLY NOT compared** per RESEARCH §RQ5 Option 2 — removing entries shifts downstream hash-chain pointers legitimately.
- Integrity check: `loadEntries(...)` + `.verify().valid === true` on both chains independently.

Test 2: `repeated runs are deterministic (no flakiness)` — runs `runSim(true)` twice in the same test. Every entry (including `eventHash`) is byte-identical across repetitions. Proves the fake-timer setup eliminates all nondeterminism and the test isn't just a lucky alignment.

### Fake-timer setup

- `beforeEach`: `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_TIME)` where `FIXED_TIME = new Date('2026-01-01T00:00:00.000Z')`.
- Inside `runSim`: `vi.setSystemTime(FIXED_TIME)` at the top of each run to re-pin the clock, then `vi.advanceTimersByTime(1)` after every `runner.tick(...)` call. Mirrors the pattern in `grid/test/genesis/launcher.tick-audit.test.ts` lines 79–107.
- `afterEach`: `Reviewer.resetForTesting()` + `vi.useRealTimers()`.

## Deviations from Plan

### [Authorized Option (a)] `NousRunnerConfig.reviewer` → optional

**Context**: The plan allowed either
(a) make `reviewer` optional in `NousRunnerConfig` with a `if (this.reviewer) ...` guard, OR
(b) script direct `audit.append` calls for Run B that mirror nous-runner.ts manually.

**Chosen**: Option (a). Rationale: Option (b) would require the test to duplicate the exact payload shapes of `trade.proposed` and `trade.settled` — a drift hazard. Option (a) keeps Run B exercising the SAME runner code path that production uses, minus the reviewer step — the invariant under test is more honest.

**What changed** (`grid/src/integration/nous-runner.ts`):

- `NousRunnerConfig.reviewer: Reviewer` → `reviewer?: Reviewer` with a ~15-line JSDoc block explaining the contract: production callers (main.ts / launcher) MUST pass a reviewer; the opt-out exists solely for D-13.
- `private readonly reviewer: Reviewer` → `private readonly reviewer: Reviewer | undefined`.
- Inside the `trade_request` case: wrapped the reviewer.review() call, the fail-branch `trade.reviewed{fail}` emit, and the pass-branch `trade.reviewed{pass}` emit in a single `if (this.reviewer) { ... }` block. When reviewer is undefined, control falls through directly from the `trade.proposed` emit to the existing bounds-check + `transferOusia` + `trade.settled` emit — the SAME code path, just without the reviewer step.

**Mitigation**: All 3 pre-existing integration tests (`trade-review-flow`, `trade-review-abort`, `trade-settlement`) pass `reviewer:` explicitly and all still green. Main.ts already constructs the `Reviewer` singleton and the TODO comment at line 85–87 reminds future authors to wire it into NousRunner construction sites. If a future code path forgets to pass reviewer in production, the `trade.reviewed` audit events will simply be absent — detectable by Phase 7+ integration tests that assert the 3-event flow.

## Verification

### Task 1

```bash
cd grid && npx vitest run test/broadcast-allowlist.test.ts test/review/payload-privacy.test.ts
# Test Files  2 passed (2)
# Tests  42 passed (42)
```

### Task 2

```bash
cd grid && npx vitest run test/review/zero-diff.test.ts
# Test Files  1 passed (1)
# Tests  2 passed (2)
```

### 5× flakiness check (zero-diff)

```
run 1: 2 passed
run 2: 2 passed
run 3: 2 passed
run 4: 2 passed
run 5: 2 passed
```

0 failures across 5 consecutive invocations — test is deterministic.

### Full grid suite

```bash
cd grid && npm test
# Test Files  42 passed (42)
# Tests  408 passed (408)
# Duration  3.30s
```

## Known Stubs

None — every line of production change is covered by a test assertion. The `reviewer?` optional field is the only production surface change and it is exercised by both the zero-diff test (undefined branch) and all prior integration tests (defined branch).

## Commits

- `b295fa1` — test(05-04): add failing allowlist size + trade.reviewed membership + D-12 privacy tests (RED)
- `c7c9c6c` — feat(05-04): add trade.reviewed to frozen broadcast allowlist (GREEN)
- `9d69c06` — feat(05-04): zero-diff invariant (D-13 / SC #5) regression + reviewer bypass affordance

## Self-Check: PASSED

- File `grid/src/audit/broadcast-allowlist.ts` present, `trade.reviewed` literal on line 31: FOUND.
- File `grid/test/review/payload-privacy.test.ts`: FOUND.
- File `grid/test/review/zero-diff.test.ts`: FOUND.
- File `grid/src/integration/nous-runner.ts` contains `reviewer?: Reviewer`: FOUND.
- Commit b295fa1: FOUND.
- Commit c7c9c6c: FOUND.
- Commit 9d69c06: FOUND.
- Full grid suite 408/408 green: CONFIRMED.
- 5× flakiness check 5/5 green: CONFIRMED.
