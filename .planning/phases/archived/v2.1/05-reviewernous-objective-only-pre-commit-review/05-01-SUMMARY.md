---
phase: 05-reviewernous-objective-only-pre-commit-review
plan: 01
subsystem: grid/review
tags: [review, reviewernous, closed-enum, contract-surface, wave-0, tdd]
requires: []
provides:
  - grid/src/review/types.ts (ReviewFailureCode closed union + runtime Set + Check/ReviewContext/ReviewResult types)
  - grid/src/review/registry.ts (CHECKS Map + CHECK_ORDER array + registerCheck/clearRegistryForTesting)
  - grid/src/review/checks/balance.ts (insufficient_balance handler)
  - grid/src/review/checks/counterparty-did.ts (invalid_counterparty_did handler with frozen DID regex)
  - grid/src/review/checks/amount.ts (non_positive_amount handler)
  - grid/src/review/checks/memory-refs.ts (malformed_memory_refs handler with /^mem:\d+$/)
  - grid/src/review/checks/telos-hash.ts (malformed_telos_hash handler with /^[a-f0-9]{64}$/)
affects: []
tech-stack:
  added: []
  patterns:
    - self-registering handler modules (mirrors grid/src/audit/chain.ts Set pattern)
    - closed string-literal union + runtime ReadonlySet parity (mirrors grid/src/audit/broadcast-allowlist.ts)
    - TDD cycle with RED/GREEN per task (test commits precede impl commits)
key-files:
  created:
    - grid/src/review/types.ts
    - grid/src/review/registry.ts
    - grid/src/review/checks/balance.ts
    - grid/src/review/checks/counterparty-did.ts
    - grid/src/review/checks/amount.ts
    - grid/src/review/checks/memory-refs.ts
    - grid/src/review/checks/telos-hash.ts
    - grid/test/review/codes.test.ts
    - grid/test/review/checks.test.ts
    - grid/test/review/contract.test.ts
  modified: []
decisions:
  - "Registry exposes a TEST-ONLY clearRegistryForTesting() helper — required because handler modules self-register at load; contract.test.ts and the 5-check checks.test.ts block call it in beforeAll() to guarantee a clean slate. Plan 02 MUST NOT re-export this from any public index."
  - "Handler filename naming (balance, counterparty-did, amount, memory-refs, telos-hash) is decoupled from check-name identifiers via the explicit CHECK_FILES map in contract.test.ts — the map is the source of truth, filenames chosen for readability only."
metrics:
  duration: 00:10:00
  completed: 2026-04-21
  tasks: 3
  commits: 5
  test-counts: "24 passing (codes: 7, checks: 9, contract: 8)"
  tsc-errors-introduced: 0
---

# Phase 5 Plan 1: ReviewerNous Contract Surface (types + registry + 5 checks) Summary

Establishes the typed and runtime-validated contract wall of the reviewer: a 5-member closed failure-code enum, a self-registering check map, 5 pure-function objective check handlers, and the REV-04 subjective-keyword lint gate — all with zero dependencies on Reviewer.ts, the nous-runner, or the broadcast allowlist, so downstream plans (02/03/04) can import from here without weakening the contract.

## What shipped

### `grid/src/review/types.ts` (54 lines)

Exports:

- `ReviewFailureCode` — closed string-literal union, **exactly 5 members**:
  - `'insufficient_balance'`
  - `'invalid_counterparty_did'`
  - `'non_positive_amount'`
  - `'malformed_memory_refs'`
  - `'malformed_telos_hash'`
- `ReviewCheckName = ReviewFailureCode` (1:1 by construction)
- `ReviewContext { proposerDid, proposerBalance, counterparty, amount, memoryRefs, telosHash }` — all readonly
- `ReviewResult` — discriminated union `{verdict:'pass'} | {verdict:'fail'; failed_check; failure_reason}`
- `Check` — `(ctx) => {ok:true} | {ok:false; code: ReviewFailureCode}` function type
- `VALID_REVIEW_FAILURE_CODES: ReadonlySet<ReviewFailureCode>` — runtime JSON-boundary backstop, built from a `readonly … as const` tuple, parity with the TS union enforced by `codes.test.ts` and `contract.test.ts`.

### `grid/src/review/registry.ts` (30 lines)

- `CHECKS: Map<ReviewCheckName, Check>` — populated by handler-module side-effects
- `CHECK_ORDER: ReviewCheckName[]` — insertion-order array mirroring `CHECKS.keys()`
- `registerCheck(name, handler)` — throws `Error /already registered/i` on duplicate name
- `clearRegistryForTesting()` — `@internal` test-only helper; **must not** be re-exported from any public index (flagged for Plan 02)

### `grid/src/review/checks/*.ts` (5 × ≤20 lines each)

Each handler is a single `registerCheck(name, (ctx) => …)` side-effect call at module load. Patterns:

| File | Check | Logic |
|---|---|---|
| `balance.ts` | `insufficient_balance` | `ctx.proposerBalance >= ctx.amount` |
| `counterparty-did.ts` | `invalid_counterparty_did` | Frozen `/^did:noesis:[a-z0-9_\-]+$/i` + self-transfer rejection |
| `amount.ts` | `non_positive_amount` | `Number.isInteger(ctx.amount) && ctx.amount > 0` |
| `memory-refs.ts` | `malformed_memory_refs` | Non-empty array + each entry matches `/^mem:\d+$/` (per RQ3) |
| `telos-hash.ts` | `malformed_telos_hash` | `/^[a-f0-9]{64}$/` — lowercase hex only |

### Tests (3 files, 24 passing)

- `grid/test/review/codes.test.ts` (7 tests) — size parity, membership, no-extra-members.
- `grid/test/review/checks.test.ts` (9 tests) — unit-level `registerCheck` behavior + duplicate guard + after-dynamic-import functional matrix for all 5 handlers.
- `grid/test/review/contract.test.ts` (8 tests) — enum parity, CHECK_ORDER uniqueness, **REV-04 subjective-keyword gate** that greps each handler source via `readFileSync` on every CI run.

## Union ⇄ Runtime Set parity — verified

Committed both:

```typescript
// compile-time gate
export type ReviewFailureCode =
  | 'insufficient_balance'
  | 'invalid_counterparty_did'
  | 'non_positive_amount'
  | 'malformed_memory_refs'
  | 'malformed_telos_hash';

// runtime backstop
export const VALID_REVIEW_FAILURE_CODES: ReadonlySet<ReviewFailureCode> = new Set<ReviewFailureCode>([
  'insufficient_balance',
  'invalid_counterparty_did',
  'non_positive_amount',
  'malformed_memory_refs',
  'malformed_telos_hash',
] as const);
```

`contract.test.ts` asserts `CHECKS.size === VALID_REVIEW_FAILURE_CODES.size` (both 5) AND every `CHECKS.keys()` entry is a member of the set — a third attack vector (stringly-typed payload with unknown code) is caught at the next boundary by using `VALID_REVIEW_FAILURE_CODES.has(...)` at the emit site (Plan 03 scope).

## REV-04 regex as committed

```typescript
const FORBIDDEN = /\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b/i;
```

Applied in `contract.test.ts` via `readFileSync` against each of the 5 handler source files. Any future subjective word added to a handler source → test fails. The regex is intentionally broad — the point of REV-04 is that if someone tries to smuggle "quality" reasoning into a handler, the gate fires regardless of intent.

Current state: `grep -riE '\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b' grid/src/review/checks/` returns zero matches. ✓

## Handler registration pattern (for downstream plans)

Each `checks/*.ts` file contains **only** a single `registerCheck(name, fn)` call at module scope — no default export, no named export of the handler function. Registration happens as a side-effect of module load.

**Consumers must explicitly import each handler file** (direct `import` or `await import(...)`). Plan 02's `Reviewer.ts` will do this by importing `./review/index.js`, which will re-export registry types AND side-effect-import all 5 handler files. Plan 01 deliberately does NOT create `index.ts` — that belongs to Plan 02, which owns the public Reviewer surface.

In `contract.test.ts` and the 5-check block of `checks.test.ts`, `beforeAll()` calls `clearRegistryForTesting()` first, then dynamically imports all 5 handlers. This works because Vitest's worker isolates module state per test file but not per describe block — hence the `clearRegistryForTesting()` call, which is why that helper exists at all.

## Downstream consumers

| Plan | Imports from this plan |
|---|---|
| **05-02** (Reviewer class + nous-runner hook) | `ReviewFailureCode`, `ReviewContext`, `ReviewResult`, `VALID_REVIEW_FAILURE_CODES`, `CHECKS`, `CHECK_ORDER`. Plan 02 creates `grid/src/review/index.ts` that re-exports these AND side-effect-imports all 5 `checks/*.ts` files. **MUST NOT** re-export `clearRegistryForTesting`. |
| **05-03** (trade.reviewed audit event) | `ReviewFailureCode` at the emit site — payload `failure_reason` field is typed as `ReviewFailureCode` (not `string`), and broadcast allowlist logic validates against `VALID_REVIEW_FAILURE_CODES.has(...)` at the JSON boundary. |
| **05-04** (integration + dashboard wiring) | `ReviewResult` for WebSocket payloads. |

## Deviations from Plan

None — plan executed exactly as written. The literal code sketches in `05-PATTERNS.md` were reproduced verbatim; regex invariants, keyword list, and acceptance criteria all passed first try after RED/GREEN.

## Notes & watchpoints for future plans

- **Phase 7 WATCHPOINT (telos-hash)**: `telos-hash.ts` currently does structural-only validation. Phase 7 (`telos.refined` event + TelosRegistry) will need to upgrade this to verify the hash matches the latest-seen `telosHash` for `proposerDid`. **Do NOT** add registry lookup in Phase 5 — it breaks the "objective-only, no external state read" invariant (D-05).
- **Memory ref format**: Format is `mem:<int>` (not `mem:<uuid>`) per RQ3 — this aligns with the brain-side `Memory.id` primary-key column. If brain's Memory schema ever switches to UUID, the regex in `memory-refs.ts` must follow.
- **Handler source scan scope**: `contract.test.ts` scans only `grid/src/review/checks/*.ts`. The gate does NOT scan `types.ts`, `registry.ts`, or any future shared helper under `grid/src/review/`. Rationale: forbidden keywords *could* legitimately appear in doc comments describing what the gate forbids. If Plan 02 adds shared logic under `grid/src/review/`, consider extending the scan list — but do so deliberately.
- **Duplicate registerCheck guard**: Throws at module load time. If a handler file is accidentally imported twice (e.g., from both `index.ts` and a direct `./checks/balance.js` import in the same process), the second import throws. This is intentional — it prevents silent override. Plan 02 must ensure exactly one import path.

## Self-Check: PASSED

- `grid/src/review/types.ts` — FOUND ✓
- `grid/src/review/registry.ts` — FOUND ✓
- `grid/src/review/checks/balance.ts` — FOUND ✓
- `grid/src/review/checks/counterparty-did.ts` — FOUND ✓
- `grid/src/review/checks/amount.ts` — FOUND ✓
- `grid/src/review/checks/memory-refs.ts` — FOUND ✓
- `grid/src/review/checks/telos-hash.ts` — FOUND ✓
- `grid/test/review/codes.test.ts` — FOUND ✓
- `grid/test/review/checks.test.ts` — FOUND ✓
- `grid/test/review/contract.test.ts` — FOUND ✓
- Commit `68652ea` (feat types.ts) — FOUND ✓
- Commit `714181a` (test codes+checks RED) — FOUND ✓
- Commit `ff524cc` (feat registry GREEN) — FOUND ✓
- Commit `2b5ff17` (test contract+amended checks RED) — FOUND ✓
- Commit `c5aeb6f` (feat 5 handlers GREEN) — FOUND ✓
- All 24 tests passing ✓
- Zero new tsc errors in `src/review/` ✓
- Zero forbidden keywords in `src/review/checks/` ✓
