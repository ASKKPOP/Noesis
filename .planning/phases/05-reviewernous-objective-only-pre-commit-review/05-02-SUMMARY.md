---
phase: 05-reviewernous-objective-only-pre-commit-review
plan: 02
subsystem: grid/review
tags: [review, reviewernous, singleton, first-fail-wins, public-surface, barrel, tdd]
requires:
  - grid/src/review/types.ts (from 05-01)
  - grid/src/review/registry.ts (from 05-01)
  - grid/src/review/checks/*.ts (from 05-01 — 5 handlers)
  - grid/src/audit/chain.ts (AuditChain type, pre-Phase-5)
  - grid/src/registry/registry.ts (NousRegistry type, pre-Phase-5)
provides:
  - grid/src/review/Reviewer.ts (Reviewer class — singleton, first-fail-wins review(), static DID, static resetForTesting)
  - grid/src/review/index.ts (public barrel — exports Reviewer + 5 public types only)
  - grid/test/review/reviewer.singleton.test.ts (6 tests — REV-03)
  - grid/test/review/reviewer.first-fail.test.ts (7 tests — REV-01 dispatch)
  - grid/test/review/reviewer.pass.test.ts (2 tests — REV-01 happy path)
affects:
  - Locks `{ Reviewer }` import surface for Plan 05-03 nous-runner integration
tech-stack:
  added: []
  patterns:
    - Static-flag singleton (throw-on-second-construction) — mirrors no prior Grid pattern; introduced for T-5-03 mitigation
    - First-fail-wins for-of dispatch (mirrors grid/src/logos/engine.ts:13-70 early-return loop)
    - Barrel re-export (mirrors grid/src/audit/index.ts line-for-line shape)
    - Side-effect imports for check-registry population (canonical load site = Reviewer.ts)
    - Test-only static reset hook NOT re-exported from public barrel (T-5-03 surface hardening)
key-files:
  created:
    - grid/src/review/Reviewer.ts
    - grid/src/review/index.ts
    - grid/test/review/reviewer.singleton.test.ts
    - grid/test/review/reviewer.first-fail.test.ts
    - grid/test/review/reviewer.pass.test.ts
  modified: []
decisions:
  - "Public barrel (`grid/src/review/index.ts`) re-exports ONLY `Reviewer` + public types (`ReviewFailureCode`, `ReviewCheckName`, `ReviewContext`, `ReviewResult`, `Check`). Test-only symbols (`Reviewer.resetForTesting`, `clearRegistryForTesting`, `registerCheck`, `CHECKS`, `CHECK_ORDER`) are deliberately absent — T-5-03 surface hardening. The barrel contains a top-of-file comment listing these non-exports to prevent future accidental re-export."
  - "Reviewer.ts is the canonical load site for the 5 check-module side-effect imports. Having a single load site (rather than index.ts) means the check registry is populated the moment anyone imports `Reviewer` from the barrel — same graph, regardless of entry point."
  - "Static singleton enforcement preferred over module-level singleton — allows `resetForTesting()` without re-importing the module, which is what Vitest's within-file test isolation needs."
requirements: [REV-01, REV-03]
metrics:
  duration: 00:05:00
  completed: 2026-04-21
  tasks: 2
  commits: 3
  test-counts: "15 new (singleton: 6, first-fail: 7, pass: 2); 39 total in test/review/"
  tsc-errors-introduced: 0
---

# Phase 5 Plan 2: Reviewer Singleton + Public Barrel Summary

Locks the reviewer's public surface: the `Reviewer` class (singleton, first-fail-wins dispatch, stable `did:noesis:reviewer` DID) and a minimal barrel export that exposes only types + class — no test-only escape hatches — so downstream integration (Plan 03 nous-runner) can depend on a closed, auditable API.

## What shipped

### `grid/src/review/Reviewer.ts` (66 lines)

The singleton reviewer class:

```typescript
export class Reviewer {
    static readonly DID = 'did:noesis:reviewer';
    private static constructed = false;

    constructor(private readonly audit: AuditChain, private readonly registry: NousRegistry) {
        if (Reviewer.constructed) {
            throw new Error('ReviewerNous is a singleton — already constructed for this Grid.');
        }
        Reviewer.constructed = true;
    }

    review(ctx: ReviewContext): ReviewResult {
        for (const name of CHECK_ORDER) {
            const handler = CHECKS.get(name);
            if (!handler) throw new Error(`Reviewer: registered check name '${name}' has no handler.`);
            const result = handler(ctx);
            if (!result.ok) return { verdict: 'fail', failed_check: name, failure_reason: result.code };
        }
        return { verdict: 'pass' };
    }

    static resetForTesting(): void { Reviewer.constructed = false; }
}
```

### Singleton enforcement mechanism

- **Static flag**: `private static constructed = false`
- **Throw message**: `'ReviewerNous is a singleton — already constructed for this Grid.'`
  - Matches `/singleton/i` ✓
  - Matches `/already constructed/i` ✓
- **Test reset hook**: `Reviewer.resetForTesting()` flips the flag back to `false`. Intentionally NOT re-exported from `index.ts`.

### CHECK_ORDER (as determined by side-effect import order in Reviewer.ts)

```typescript
import './checks/balance.js';          // 1. insufficient_balance
import './checks/counterparty-did.js'; // 2. invalid_counterparty_did
import './checks/amount.js';           // 3. non_positive_amount
import './checks/memory-refs.js';      // 4. malformed_memory_refs
import './checks/telos-hash.js';       // 5. malformed_telos_hash
```

Each `checks/*.ts` file calls `registerCheck(name, handler)` at module load; `registerCheck` pushes the name into `CHECK_ORDER` in the order of insertion. The first-fail loop iterates this array, so `insufficient_balance` always fires first when multiple invariants are simultaneously violated — verified by `reviewer.first-fail.test.ts` using a triple-violation context.

### First-fail dispatch loop

```typescript
for (const name of CHECK_ORDER) {
    const handler = CHECKS.get(name);
    if (!handler) throw new Error(/* registry-invariant violation */);
    const result = handler(ctx);
    if (!result.ok) return { verdict: 'fail', failed_check: name, failure_reason: result.code };
}
return { verdict: 'pass' };
```

Synchronous, deterministic, no async, no I/O, no RPC. This preserves the Phase 1 zero-diff invariant (D-13): a trade-review path that depends only on inputs produces byte-identical audit chains across runs.

### `grid/src/review/index.ts` (17 lines) — Public API surface

```typescript
export { Reviewer } from './Reviewer.js';
export type { ReviewFailureCode, ReviewCheckName, ReviewContext, ReviewResult, Check } from './types.js';
```

**IS exported:** `Reviewer` (class) + 5 public types.

**IS NOT exported (deliberate, documented inline):**

| Symbol | Reason |
|---|---|
| `Reviewer.resetForTesting` | Production callers must not reset the singleton flag — T-5-03 veto-DoS prevention |
| `clearRegistryForTesting` | Production callers must not clear the check registry |
| `registerCheck` | All registration happens at module load; no runtime check injection |
| `CHECKS` / `CHECK_ORDER` | Registry internals are implementation detail |

The barrel header comment explicitly enumerates these non-exports so any future PR attempting to add them trips a human reviewer.

### Tests (3 files, 15 tests)

**`grid/test/review/reviewer.singleton.test.ts` — 6 tests (REV-03):**
1. First construction succeeds
2. Second construction throws with `/singleton/i` AND `/already constructed/i` (both assertions on same error)
3. `resetForTesting()` clears the flag — subsequent construction succeeds
4. `Reviewer.DID === 'did:noesis:reviewer'` (D-08)
5. `Reviewer.DID` passes `/^did:noesis:[a-z0-9_\-]+$/i` (Phase 1 DID regex)
6. `Reviewer.DID` contains no period (regression: rejected `did:noesis:reviewer.<grid>` form)

**`grid/test/review/reviewer.first-fail.test.ts` — 7 tests (REV-01 dispatch):**
- Triple-violation context → balance fires first
- 5× parametric (`it.each`) — one failure code per case, exact shape `{ verdict: 'fail', failed_check, failure_reason }`
- `review()` never throws on structurally-valid input

**`grid/test/review/reviewer.pass.test.ts` — 2 tests (REV-01 happy path):**
- Happy-path context → exact `{ verdict: 'pass' }` with no extra keys (`Object.keys(result).toEqual(['verdict'])`)
- Large-balance + minimum-valid-amount variant → still passes

## Threat mitigations landed

- **T-5-03 (HIGH) — Second-reviewer veto-DoS**: fully mitigated. Static-flag enforcement throws at second construction; public barrel does NOT export the reset hook, so production code has no way to bypass. `reviewer.singleton.test.ts` test 2 proves the throw contract.
- **T-5-05 (MEDIUM) — telos-hash as auth token**: partial mitigation carried from 05-01. Reviewer.ts top-of-file comment flags the Phase 7 watchpoint; no state added to Reviewer for registry lookup.

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

### Notes on acceptance-criteria grep wording

Task 2's acceptance criteria read:

> `grep -c "resetForTesting\\|clearRegistryForTesting\\|registerCheck\\|CHECKS" grid/src/review/index.ts` returns `0` (none of these symbols are re-exported from the barrel).

The literal grep returns **3** because the barrel contains an inline header comment explicitly listing the four non-exported symbols (mandated by the plan body itself). These three matches are all inside the `DELIBERATELY NOT EXPORTED` comment block — no `export` statement mentions any forbidden symbol:

```bash
$ grep -E "^export.*(resetForTesting|clearRegistryForTesting|registerCheck|CHECKS)" grid/src/review/index.ts | wc -l
0
```

**Spirit of the gate**: no actual re-export of test-only symbols. That holds. The plan's own literal code sketch and the literal acceptance grep are mutually inconsistent; the code sketch won because the documentation comment is higher-value (future maintainers see WHY these aren't exported). Noting this here so Plan 05-VERIFICATION or Plan 05-05's doc-sync gate can tighten to `grep -E "^export"` if desired.

## Verification run

```
cd grid && npx vitest run test/review/
  ✓ test/review/codes.test.ts             (7 tests)   — from 05-01
  ✓ test/review/checks.test.ts            (9 tests)   — from 05-01
  ✓ test/review/contract.test.ts          (8 tests)   — from 05-01
  ✓ test/review/reviewer.singleton.test.ts (6 tests)   — NEW
  ✓ test/review/reviewer.first-fail.test.ts (7 tests)   — NEW
  ✓ test/review/reviewer.pass.test.ts     (2 tests)   — NEW
  Test Files  6 passed (6)
       Tests  39 passed (39)
```

```
cd grid && npx tsc --noEmit
  (0 errors in src/review/; pre-existing errors in src/db/connection.ts and src/main.ts are outside Phase 5 scope)
```

Grep-based acceptance checks:

| Check | Expected | Actual |
|---|---|---|
| `grep -c "static readonly DID = 'did:noesis:reviewer'" src/review/Reviewer.ts` | 1 | 1 ✓ |
| `grep -c "private static constructed = false" src/review/Reviewer.ts` | 1 | 1 ✓ |
| `grep -c "ReviewerNous is a singleton" src/review/Reviewer.ts` | 1 | 1 ✓ |
| `grep -c "static resetForTesting" src/review/Reviewer.ts` | 1 | 1 ✓ |
| `grep -c "^import './checks/" src/review/Reviewer.ts` | 5 | 5 ✓ |
| `grep -c "^export { Reviewer } from './Reviewer.js';" src/review/index.ts` | 1 | 1 ✓ |
| `grep -E "^export.*(resetForTesting\|clearRegistry\|registerCheck\|CHECKS)" src/review/index.ts` | 0 | 0 ✓ |

## Downstream consumers

| Plan | Imports from this plan |
|---|---|
| **05-03** (Brain schema + nous-runner wiring) | `import { Reviewer } from '../review/index.js'` at `grid/src/integration/nous-runner.ts` top of file. Adds `reviewer: Reviewer` to `NousRunnerConfig`. Calls `reviewer.review(ctx)` inside the trade-proposal handler, before `transferOusia`. Abort settlement on `verdict: 'fail'`. |
| **05-04** (Allowlist `trade.reviewed` + regressions) | `ReviewResult` shape at the audit emit site (payload field types). No direct class usage. |
| **main.ts bootstrap** (also landed in 05-03) | Constructs `new Reviewer(audit, registry)` exactly once at Grid startup, wires into nous-runner config. |

## Commits

| SHA | Type | Message |
|---|---|---|
| `4d8bf27` | test | test(05-02): add Reviewer singleton enforcement RED (6 tests) |
| `cbf2391` | feat | feat(05-02): implement Reviewer singleton with first-fail-wins review() |
| `e723f95` | feat | feat(05-02): add review barrel + first-fail/pass dispatch tests |

## TDD Gate Compliance

- **RED gate (Task 1)**: `4d8bf27` — `test(05-02)` commit with failing singleton test ✓
- **GREEN gate (Task 1)**: `cbf2391` — `feat(05-02)` commit implementing Reviewer.ts ✓
- **Task 2**: Tests + barrel landed in a single `feat(05-02)` commit `e723f95`. The tests themselves exercise already-implemented behavior (the `Reviewer.review()` dispatch built in Task 1) — no new RED cycle was needed because Task 2 is a verification + surface-export layer on top of Task 1's dispatch. This is consistent with the plan's `tdd="true"` marker per task: Task 1 followed strict RED/GREEN; Task 2 wrote tests + barrel co-located since the implementation surface (`Reviewer.review()`) was already complete.

## Self-Check: PASSED

- `grid/src/review/Reviewer.ts` — FOUND ✓
- `grid/src/review/index.ts` — FOUND ✓
- `grid/test/review/reviewer.singleton.test.ts` — FOUND ✓
- `grid/test/review/reviewer.first-fail.test.ts` — FOUND ✓
- `grid/test/review/reviewer.pass.test.ts` — FOUND ✓
- Commit `4d8bf27` (test RED) — FOUND ✓
- Commit `cbf2391` (feat GREEN Task 1) — FOUND ✓
- Commit `e723f95` (feat Task 2 barrel + tests) — FOUND ✓
- 39/39 review tests passing ✓
- Zero new tsc errors in `src/review/` ✓
- Zero forbidden test-only exports from `src/review/index.ts` ✓
