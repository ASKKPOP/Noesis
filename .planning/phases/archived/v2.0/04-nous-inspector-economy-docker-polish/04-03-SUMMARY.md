---
phase: 04
plan: 03
subsystem: grid/api
tags: [rest, fastify, inspector, economy, privacy, w2-contract, tdd]
dependency-graph:
  requires:
    - grid/api/server (Fastify buildServer from Phase 1-3)
    - grid/registry (NousRegistry — Phase 1)
    - grid/economy (ShopRegistry — Plan 04-01)
    - grid/audit (AuditChain.query — Phase 1)
    - grid/integration (NousRunner — Phase 2, via optional getRunner lookup)
  provides:
    - REST route GET /api/v1/grid/nous (roster; Inspector prereq)
    - REST route GET /api/v1/nous/:did/state (Inspector brain proxy, all 5 status codes)
    - REST route GET /api/v1/economy/trades (audit-backed, W2 Unix-seconds timestamp contract)
    - REST route GET /api/v1/economy/shops (ShopRegistry projection with defensive copy)
    - TradeRecord / ShopsResponse / NousRosterEntry / ApiError types in api/types.ts
    - DID_REGEX export (/^did:noesis:[a-z0-9_\-]+$/i) for route-level validation
    - InspectorRunner interface + GridServices.getRunner optional hook
  affects:
    - grid/src/main.ts (buildServer call-site widened with registry, shops, getRunner)
tech-stack:
  added: []
  patterns:
    - "Fastify typed route handlers with Params/Querystring generics"
    - "DID regex validation at route entry (fail-fast, structured 400 error)"
    - "Privacy-preserving error handling (request.log.warn; never proxy err.message)"
    - "Defensive deep copy at API boundary (frozen ShopRegistry listings → plain objects)"
    - "Cross-plan unit contract via type comment + test assertion (W2: Unix seconds)"
    - "AuditChain total-count via double-query (paginated page + unpaginated count)"
    - "Optional-service guards (services.shops?, services.audit?, services.registry?)"
key-files:
  created:
    - grid/test/api/grid-nous.test.ts
    - grid/test/api/nous-state.test.ts
    - grid/test/api/economy-trades.test.ts
    - grid/test/api/economy-shops.test.ts
  modified:
    - grid/src/api/types.ts
    - grid/src/api/server.ts
    - grid/src/main.ts
decisions:
  - "Plan frontmatter named grid/src/api/routes.ts but the repo ships grid/src/api/server.ts with identical buildServer/buildServerWithHub semantics. Added the four new handlers there rather than fragmenting the route surface."
  - "TradeRecord.timestamp is Unix INTEGER SECONDS (W2 contract). AuditEntry.createdAt is Date.now() ms, so the mapper applies Math.floor(e.createdAt / 1000). Test asserts < 10_000_000_000 to lock the unit."
  - "Trade row schema is the strict 5-key allowlist { actorDid, amount, counterparty, nonce, timestamp } — T-04-14 privacy test enforces Object.keys(trade).sort() equality so future additions must be deliberate."
  - "ShopRegistry listings are frozen; the /economy/shops handler does a deep map-spread so the response is safe to mutate client-side and never exposes the frozen reference."
  - "getRunner is provided to buildServer as () => undefined in main.ts for now. Runners are wired by a future sub-plan that constructs GridCoordinator; until then the inspector proxy deterministically returns 404 unknown_nous (tested)."
  - "CORS broadcast-allowlist.ts was NOT modified (D9 lock); new routes inherit the existing CORS policy."
metrics:
  duration: "~30 min (RED+GREEN for 4 routes)"
  tasks-completed: 2
  files-created: 4
  files-modified: 3
  tests-added: 19
  tests-total: 346 (up from 327 baseline)
  completed: 2026-04-18
---

# Phase 4 Plan 03: Inspector + Economy REST Endpoints Summary

Added four Fastify REST routes that unblock the Inspector UI (Plan 04-05) and the Economy Widgets (Plan 04-06): Nous roster, Inspector brain proxy, audit-backed trade history with a Unix-seconds timestamp contract, and ShopRegistry projection.

## What Shipped

### 1. `GET /api/v1/grid/nous` — Roster (Inspector prereq)

Returns `{ nous: [{ did, name, region, ousia, lifecyclePhase, reputation, status }, ...] }` drawn from `services.registry.all()`. Empty registry → `{ nous: [] }`. Three tests seed 3 Nous across 3 regions and assert both field shape and typeof discipline (ousia/reputation as numbers, not stringified).

### 2. `GET /api/v1/nous/:did/state` — Inspector Brain Proxy

Five-status-code contract:

| Status | Condition                                                       | Body                               |
| ------ | --------------------------------------------------------------- | ---------------------------------- |
| 400    | DID fails `/^did:noesis:[a-z0-9_\-]+$/i`                         | `{ error: 'invalid_did' }`         |
| 404    | Well-formed DID, no runner registered                            | `{ error: 'unknown_nous' }`        |
| 503    | `runner.connected === false`                                     | `{ error: 'brain_unavailable' }`   |
| 503    | `runner.getState()` throws (error logged to fastify, not proxied)| `{ error: 'brain_unavailable' }`   |
| 200    | Success                                                          | Plan 02 widened state dict verbatim|

The throw branch uses `request.log.warn({ err }, 'brain getState failed')` — the raw `err.message` never reaches the client (asserted by a privacy test that injects a sensitive string into the thrown error and checks `res.payload` does not contain it).

### 3. `GET /api/v1/economy/trades?limit=N&offset=M` — W2 Timestamp Lock

Defaults: `limit=20`, `offset=0`. `limit` is clamped to `min(parsed, 100)`; invalid/negative → default. Source is `services.audit.query({ eventType: 'trade.settled', limit, offset })`, with `total` computed via a second unpaginated query (AuditChain.query returns `AuditEntry[]`, not `{entries,total}`).

**W2 cross-plan contract:** `TradeRecord.timestamp` is Unix **integer seconds**, not milliseconds. `AuditEntry.createdAt` is `Date.now()` (ms), so the mapper applies `Math.floor(e.createdAt / 1000)`. The type comment in `api/types.ts` documents the unit, and `economy-trades.test.ts:175` asserts `timestamp < 10_000_000_000` (anything ≥ 10^10 would be ms) to lock the contract before Plan 04-05 Memory section and Plan 04-06 TradesTable consume it.

**Privacy (T-04-14):** the test asserts `Object.keys(trade).sort()` strictly equals `['actorDid', 'amount', 'counterparty', 'nonce', 'timestamp']`. Any future addition to `AuditEntry.payload` cannot leak into the REST response — the response object is constructed via explicit field projection, not spread.

### 4. `GET /api/v1/economy/shops` — Frozen-listing-safe projection

Projects `services.shops.list()` via a deep map-spread so the caller receives plain serializable objects (not the frozen `ShopListing` references from Plan 04-01's `ShopRegistry`). A test pushes into `body.shops[0].listings` to prove the response is safe to mutate — this guards against a future regression where the handler might accidentally return the frozen reference.

## TDD Gate Compliance

Plan specified two tasks, each TDD (RED test-commit → GREEN feat-commit):

- **Task 1:** `/grid/nous` + `/nous/:did/state` — 9 failing tests written, then handlers added.
- **Task 2:** `/economy/trades` + `/economy/shops` — 10 failing tests written, then handlers added.

In practice, the `gsd-sdk query commit` handler in this sandbox stages ALL tracked files in the working tree before it commits (its arg-list filter is cosmetic, not a file filter). This collapsed Tasks 1 and 2 into two commits rather than four:

- `add29aa` — labelled `test(04-03): add failing tests for grid nous roster + inspector proxy`, but due to the SDK staging behavior, actually contains both the RED tests (types.ts + all four test files, 19 tests) AND the Task 1 GREEN implementation + main.ts wiring + the partial economy-shops handler.
- `f230338` — labelled `feat(04-03): complete economy trades + shops routes with W2 timestamp lock`, containing the 59-line remainder of the economy-trades + economy-shops handlers (Task 2 GREEN completion).

The TDD discipline was preserved in the working tree during execution (all RED tests written before any GREEN code; each RED test was verified to fail before the corresponding handler was written), but the git log does not reflect clean RED→GREEN separation because of the sandbox commit tool's staging behavior. Future plans should prefer `git commit -m ... -- file1 file2` over `gsd-sdk query commit` when atomic stage-subset commits matter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan referenced `grid/src/api/routes.ts`, repo ships `grid/src/api/server.ts`**
- **Found during:** Task 1 GREEN
- **Issue:** Plan frontmatter and artifact listings name a file that does not exist; the route surface actually lives in `server.ts` (with `buildServer` + `buildServerWithHub`).
- **Fix:** Added the four new handlers into `server.ts` before the `// --- Laws ---` section to preserve existing route ordering. Identical semantics to the planned `routes.ts` — no route-surface fragmentation.
- **Files modified:** grid/src/api/server.ts
- **Commits:** add29aa, f230338

**2. [Rule 1 - Bug] AuditChain.query signature mismatch**
- **Found during:** Task 2 GREEN
- **Issue:** Plan described `audit.query({...})` as returning `{ entries, total }`; actual signature returns `AuditEntry[]`.
- **Fix:** Compute `total` by running a second `audit.query({ eventType: 'trade.settled' })` without pagination and taking `.length`. Acceptable because trade counts in-memory are O(n) traversal and the handler is not hot-path.
- **Files modified:** grid/src/api/server.ts
- **Commits:** f230338

**3. [Rule 2 - Critical correctness] W2 timestamp unit conversion**
- **Found during:** Task 2 GREEN
- **Issue:** AuditEntry.createdAt is `Date.now()` (ms), but the W2 contract (consumed by 04-05 Memory + 04-06 TradesTable) requires Unix seconds.
- **Fix:** Applied `Math.floor(e.createdAt / 1000)` at the mapper with an inline comment. Test at `economy-trades.test.ts:175` locks the unit via `expect(row.timestamp).toBeLessThan(10_000_000_000)`.
- **Files modified:** grid/src/api/server.ts, grid/test/api/economy-trades.test.ts
- **Commits:** add29aa, f230338

**4. [Rule 2 - Critical correctness] Frozen-listing leak prevention**
- **Found during:** Task 2 GREEN
- **Issue:** Plan 04-01 `ShopRegistry.list()` returns entries whose `listings` arrays are `Object.freeze`'d. Returning them raw would force clients into defensive-copy patterns and break any downstream code that tries to push/sort.
- **Fix:** Handler does a deep map-spread so the response is a plain-object projection. Added a test that pushes into `body.shops[0].listings` to prove no freeze leaks through.
- **Files modified:** grid/src/api/server.ts, grid/test/api/economy-shops.test.ts
- **Commits:** add29aa, f230338

No Rule 4 (architectural) deviations. No scope creep: broadcast-allowlist.ts was NOT modified (D9 lock — verified via `git diff 1dd878a..HEAD -- grid/src/audit/broadcast-allowlist.ts` = 0 lines).

## Verification

- **Grid test suite:** 346/346 green (baseline 327 + 19 new).
  - `test/api/grid-nous.test.ts` — 3 tests
  - `test/api/nous-state.test.ts` — 6 tests
  - `test/api/economy-trades.test.ts` — 7 tests
  - `test/api/economy-shops.test.ts` — 3 tests
- **Typecheck:** Only pre-existing errors in `src/db/connection.ts` and `src/main.ts` DB bootstrap path (documented as unchanged in 04-01-SUMMARY.md). No new typecheck errors from this plan.
- **Broadcast allowlist:** `grid/src/audit/broadcast-allowlist.ts` has 0 diff lines across this plan — D9 honored.
- **W2 contract lock:** `grep -n "10_000_000_000" grid/test/api/economy-trades.test.ts` returns 3 hits including line 175 (`expect(row.timestamp).toBeLessThan(10_000_000_000)`).
- **DID regex:** `DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i` exported from server.ts, tested against malformed + wrong-namespace inputs (both → 400 invalid_did).
- **Privacy invariant:** nous-state test injects `SECRET_BRAIN_INTERNAL_PATH_/tmp/leak.sock` into a thrown Error and asserts `res.payload` does not contain it.

## Requirements Satisfied

- **NOUS-01** Nous roster endpoint exposed for Inspector
- **NOUS-02** Inspector brain proxy with strict DID validation + 5-code status contract
- **NOUS-03** Privacy-preserving error handling (never proxy raw err.message)
- **ECON-01** Audit-backed trade history endpoint
- **ECON-02** W2 Unix-seconds timestamp contract locked via test assertion
- **ECON-03** ShopRegistry projection with frozen-reference safety

## Self-Check: PASSED

- `grid/test/api/grid-nous.test.ts`: FOUND
- `grid/test/api/nous-state.test.ts`: FOUND
- `grid/test/api/economy-trades.test.ts`: FOUND
- `grid/test/api/economy-shops.test.ts`: FOUND
- `grid/src/api/types.ts`: FOUND (modified)
- `grid/src/api/server.ts`: FOUND (modified)
- `grid/src/main.ts`: FOUND (modified)
- Commit `add29aa`: FOUND
- Commit `f230338`: FOUND
