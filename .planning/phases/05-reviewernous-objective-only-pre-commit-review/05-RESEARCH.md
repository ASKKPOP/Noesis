# Phase 5: ReviewerNous — Objective-Only Pre-Commit Review — Research

**Researched:** 2026-04-20
**Domain:** Grid-side synchronous pre-commit event gating; audit-chain additions; TypeScript singleton enforcement; deterministic simulation regression testing
**Confidence:** HIGH across all RQs (every claim verified against the actual codebase; no web-search reliance)

---

## Summary

Phase 5 adds a **synchronous pre-commit gate** to the single trade-execution code path that exists in the Grid today (`grid/src/integration/nous-runner.ts` lines 117-164). The gate lives in a new module `grid/src/review/` that mirrors the existing one-concern-per-folder convention of `grid/src/audit/`, `grid/src/logos/`, and `grid/src/registry/`. A singleton `Reviewer` class — constructed once at `createGridApp()` boot in `grid/src/main.ts` and injected into every `NousRunner` via the existing `NousRunnerConfig` — runs five deterministic structural checks and emits a single `trade.reviewed` allowlist event between `trade.proposed` (newly emitted) and `transferOusia`.

Three pivotal facts surfaced by reading the actual codebase that override or refine the CONTEXT.md assumptions:

1. **`trade.proposed` has zero producers today.** The string appears only in `grid/src/audit/broadcast-allowlist.ts:30` and in test fixtures. Phase 5 is not just adding review — it is lighting up a producer that was reserved in v2.0 but never implemented. The handler rewrite emits `trade.proposed` for the first time in system history.
2. **`trade.countered` is genuinely phantom.** A ripgrep across `grid/`, `brain/`, `protocol/`, and `dashboard/` finds it in zero `.ts`/`.py` files — only in planning docs. D-11's diagnosis is correct: pure doc drift, no code migration needed.
3. **Brain memory IDs are `int` primary keys (`brain/src/noesis_brain/memory/types.py:40`), not `mem:xxx` strings.** The proposed `/^mem:[a-z0-9\-]+$/i` regex in D-05's "Claude's Discretion" section does not match the brain's actual store. Phase 5 must reconcile this **before** implementing the memory-ref check — see RQ3 below for the recommended resolution.

The headline risk is the **`createdAt: Date.now()` non-determinism in `AuditChain.computeHash()`** (`grid/src/audit/chain.ts:26,181`). "Byte-identical chain" is impossible across two real-time runs; the D-13 test must use `vi.useFakeTimers()` + `vi.setSystemTime()` (pattern already in use at `grid/test/genesis/launcher.tick-audit.test.ts:22`) and compare entries field-by-field with `trade.reviewed` filtered. This is not optional — it is the only way the zero-diff regression can exist.

**Primary recommendation:** Ship as 4 plans — (1) schema + types + allowlist addition (the wiring surface), (2) Reviewer singleton + check registry + 5 structural checks (the logic), (3) `nous-runner.ts` handler rewrite emitting the 3-event flow (the integration), (4) determinism + contract + privacy regression tests (the invariants). Plan 2's balance check **supersedes** transferOusia's `insufficient` result — see RQ2 for the rationale.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01**: 3-event flow — `trade.proposed` (actor: proposer DID) → `trade.reviewed` (actor: reviewer DID) → `trade.settled` (actor: proposer DID, on pass only). On `verdict: fail`, no `trade.settled` is emitted for that trade.

**D-02**: Synchronous reviewer call inside `nous-runner.ts` `trade_request` handler. Reviewer is injected at `NousRunner` construction as a dependency. No new `AuditChain` seam (zero-diff invariant preserved).

**D-03**: First-fail-wins on check results. `trade.reviewed` fail payload: `{trade_id, reviewer_did, verdict: 'fail', failure_reason: ReviewFailureCode, failed_check: ReviewCheckName}`. Pass payload: `{trade_id, reviewer_did, verdict: 'pass'}`.

**D-04**: `nonce` doubles as `trade_id`. No new field. Correlation key across all three events is `(proposer_did, nonce)`.

**D-05**: Brain pre-resolves cross-boundary data. Schema extension on `TradeRequestAction.metadata`: `memoryRefs: string[]` + `telosHash: string`. Reviewer verifies structurally only (non-empty; shape; 64-hex hash format). **Phase 7 watchpoint:** telosHash semantic match deferred until TelosRegistry ships.

**D-06**: Module-style placement at `grid/src/review/Reviewer.ts`. Mirrors `LogosEngine` pattern.

**D-07**: Singleton enforcement — `static constructed = false` flag. Second construction throws at Grid bootstrap.

**D-08**: Reviewer DID = `did:noesis:reviewer` (grid-agnostic). Passes v2.0 DID regex.

**D-09**: `ReviewFailureCode` as TypeScript string-literal union. 5 initial codes.

**D-10**: Self-registering check registry + regex-grep contract test for subjective keywords (`fairness|wisdom|taste|quality|novelty|good|bad|should`).

**D-11**: Phase 5 commit reconciles STATE.md allowlist drift (10 → 11 events; remove phantom `trade.countered`; add missing `nous.direct_message`).

**D-12**: `trade.reviewed` payload passes `payloadPrivacyCheck()` regression.

**D-13**: Zero-diff invariant regression — 100-tick reviewer-ON vs BYPASSED produces byte-identical chain except for `trade.reviewed` entries.

### Claude's Discretion

- Exact directory layout under `grid/src/review/` (flat vs `checks/` subdir)
- Whether `registerCheck()` exported from `Reviewer.ts` or separate `registry.ts`
- Fixture layout for contract test (inline vs external JSON)
- Memory-ID regex in D-05 — **research below finds the proposed regex incompatible with brain's actual Memory.id:int schema; see RQ3 for resolution options**
- Bootstrap location — `grid/src/main.ts`, `grid/src/genesis/launcher.ts`, or new `grid/src/review/bootstrap.ts`

### Deferred Ideas (OUT OF SCOPE)

- Grid-side `TelosRegistry` tracking latest-seen Telos hash per DID — Phase 7
- Opt-in peer review by any Nous (REVIEW-PEER-01) — deferred
- Full three-phase handshake (`trade.countered`) — deferred
- Dashboard surfacing of `trade.reviewed` fails — Phase 6+
- Auto-pause on invariant violation — permanent out-of-scope
- Sync RPC from reviewer to brain during review — permanently rejected

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REV-01 | ReviewerNous runs deterministic objective-invariant check on every `trade.proposed` event before `transferOusia` is called. 5 checks: balance ≥ amount, counterparty DID regex, positive-non-zero integer amount, memoryRefs existence, no active Telos contradiction. | RQ2 maps the exact insertion point in `nous-runner.ts`. RQ3 addresses how the two cross-boundary checks (#4, #5) become **structural-only** since D-05 locks them as brain-attestation. |
| REV-02 | `trade.reviewed` event in allowlist. Payload `{trade_id, reviewer_did, verdict, failure_reason?, failed_check?}`. On fail, no `trade.settled`. Closed-enum reason codes. | RQ4 shows the exact allowlist diff; RQ8 encodes the closed enum; RQ9 proves payload passes privacy check. |
| REV-03 | System-singleton deployment. Opt-in peer review unreachable from public API. | RQ1 + RQ6 — singleton pattern via `static constructed` flag + test isolation strategy. |
| REV-04 | Subjective check lint/test gate. Contract test enumerates allowed check names; red on subjective-keyword match. | RQ7 — Vitest regex-grep over check handler source files. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Emit `trade.proposed` | Grid (`nous-runner.ts`) | — | Producer finally wired at the only trade-request code path |
| Run 5 structural checks | Grid (`review/Reviewer.ts`) | — | Deterministic, in-tick, no I/O — belongs alongside AuditChain |
| Provide `memoryRefs` + `telosHash` | Brain (`noesis_brain/rpc/types.py` Action.metadata) | — | Sovereignty (PHILOSOPHY §1): brain self-attests; no sync RPC |
| Emit `trade.reviewed` | Grid (reviewer inside handler) | — | Reviewer DID actor; privacy-safe payload shape |
| Enforce subjective-keyword prohibition | CI (contract test under Vitest) | — | REV-04 is a test, not a runtime check |
| Singleton enforcement | Grid bootstrap (`main.ts`) | — | Throws at boot, never at runtime |
| Zero-diff regression | CI (deterministic harness with `vi.useFakeTimers`) | — | Cannot hold without mocked time; real `Date.now()` breaks it |

---

## Standard Stack

### Core (verified from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.5.0 | Compile-time type union for `ReviewFailureCode` | Already the grid's sole source language `[VERIFIED: grid/package.json:25]` |
| Vitest | ^2.0.0 | Test framework for unit + contract + integration | Sole test runner in grid — `"test": "vitest run"` `[VERIFIED: grid/package.json:9]` |
| Node `node:crypto` | built-in | Reused from `AuditChain.computeHash` — no new dependency | Already in use `[VERIFIED: grid/src/audit/chain.ts:8]` |
| Node `node:fs` (contract test only) | built-in | Read check-handler source files for regex-grep | Needed for REV-04 implementation; stdlib |

### Supporting (none)

No new dependencies. Phase 5 is pure-internal code.

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `readFileSync` for contract test | TypeScript AST (`typescript` compiler API) | AST parsing is more correct but 10× slower + new dep | Skip — regex-grep suffices for 5 handlers (D-10 already locked) |
| `Date.now()` in AuditChain | Fake timers via `vi.useFakeTimers()` | Only needed in test code; prod unchanged | **Adopt for D-13 test** — prod behavior untouched |
| Throwing on 2nd construction | Module-level export (`export const reviewer`) | Breaks multi-Grid test isolation | Reject — D-07 already excluded this |

**No installation needed.** No `npm install` step in Phase 5.

**Version verification (2026-04-20):** Both Vitest ^2.0 and TypeScript ^5.5 are current-supported as of research date. No version bump needed. `[VERIFIED: grid/package.json]`

---

## Architecture Patterns

### System Architecture Diagram

```
brain (sovereign, Python)
    │  returns TradeRequestAction with metadata:
    │  { counterparty, amount, nonce,  ← v2.0 shape
    │    memoryRefs: string[],         ← Phase 5 NEW
    │    telosHash: string }           ← Phase 5 NEW
    │
    ▼ (JSON-RPC over Unix socket, IBrainBridge.sendTick)
    │
NousRunner.executeActions (grid/src/integration/nous-runner.ts)
    │
    ├─[case 'trade_request']──────────────────────────────────┐
    │                                                          │
    │  1. Parse + validate metadata (existing)                 │
    │  2. audit.append('trade.proposed', proposerDid, {        │
    │         counterparty, amount, nonce,                     │
    │         memoryRefs, telosHash })  ← NEW EMITTER          │
    │                                                          │
    │  3. reviewer.review({                                    │
    │         proposerDid, proposerBalance,                    │
    │         counterparty, amount,                            │
    │         memoryRefs, telosHash })                         │
    │        │                                                  │
    │        ├── balance_check                                 │
    │        ├── counterparty_did_check                        │
    │        ├── amount_check                                  │
    │        ├── memory_refs_check (structural only)           │
    │        └── telos_hash_check (structural only)            │
    │              │                                            │
    │              └── first-fail-wins → verdict               │
    │                                                          │
    │  4. audit.append('trade.reviewed', Reviewer.DID, {...})  │
    │                                                          │
    │  5. if (verdict.fail) break; ← NO transferOusia          │
    │                              ← NO trade.settled          │
    │                              ← NO trade.rejected         │
    │                                                          │
    │  6. registry.transferOusia(...)  (existing, pass path)   │
    │  7. audit.append('trade.settled', proposerDid, {...})    │
    │                                                          │
    └──────────────────────────────────────────────────────────┘
                            │
                            ▼
                      AuditChain
                  (zero-diff invariant
                   since commit 29c3516)
                            │
                            ▼
                    payloadPrivacyCheck
                    (regression at producer
                     boundary; REV-02 payload
                     must pass)
```

### Recommended Project Structure

```
grid/src/review/                    # NEW — mirrors grid/src/audit/ layout
├── index.ts                        # Public re-exports (Reviewer, types)
├── Reviewer.ts                     # Singleton class, public API
├── types.ts                        # ReviewFailureCode union, ReviewContext, ReviewResult, Check
├── registry.ts                     # CHECKS map + registerCheck helper
└── checks/                         # One file per check for D-10 regex-grep
    ├── balance.ts                  # proposerBalance >= amount
    ├── counterparty-did.ts         # DID regex match
    ├── amount.ts                   # positive non-zero integer
    ├── memory-refs.ts              # structural: non-empty array, each a string
    └── telos-hash.ts               # structural: 64-hex format

grid/test/review/                   # NEW — mirrors grid/test/audit.test.ts pattern
├── reviewer.test.ts                # Unit tests: each check in isolation
├── reviewer-singleton.test.ts      # D-07 double-construction throws
├── contract.test.ts                # REV-04 subjective-keyword lint gate
└── determinism.test.ts             # D-13 zero-diff 100-tick regression

grid/test/integration/
└── trade-review.test.ts            # NEW — 3-event flow end-to-end
                                    #   (sister of trade-settlement.test.ts)
```

Rationale: the `checks/` subdirectory is specifically chosen so D-10's `readFileSync` lookup can locate each handler source by a predictable path (`checks/${name}.ts`). A flat layout would require a manifest.

### Pattern 1: Mirror `AuditChain` file layout

The `grid/src/audit/` folder has:
- `types.ts` (shared types)
- `chain.ts` (main class)
- `broadcast-allowlist.ts` (supporting pure-function module)
- `index.ts` (public re-exports)

Review module adopts the same shape. `Reviewer.ts` is the class; `types.ts` holds the closed union; `registry.ts` holds the check map; `checks/*.ts` hold handlers. `index.ts` re-exports what's public.

### Pattern 2: Constructor dependency injection (mirror `NousRunner`)

`[VERIFIED: grid/src/integration/nous-runner.ts:19-51]`

```ts
export interface NousRunnerConfig {
    nousDid: string;
    nousName: string;
    bridge: IBrainBridge;
    space: SpatialMap;
    audit: AuditChain;
    registry: NousRegistry;
    economy: EconomyManager;
}
```

Phase 5 adds **one** field: `reviewer: Reviewer`. `Reviewer` constructor takes `AuditChain` and `NousRegistry` (per the sketch in CONTEXT.md `<specifics>`). Wired exactly like `AuditChain` is today — constructed in `createGridApp` (`grid/src/main.ts`), passed through to `NousRunner` at its construction site.

### Pattern 3: Privacy-at-producer-boundary emit

`[VERIFIED: grid/src/integration/nous-runner.ts:117-164]` — current handler does exactly this for `trade.settled`: strictly-typed metadata parse, only the privacy-safe fields (`counterparty`, `amount`, `nonce`) appear in the audit payload. Phase 5 emitter for `trade.proposed` follows the same discipline, with `memoryRefs` and `telosHash` added as new safe fields (verified against FORBIDDEN_KEY_PATTERN — neither contains a forbidden substring).

### Anti-Patterns to Avoid

- **Reviewer via AuditChain listener hook** (explicitly rejected in D-02). Listener exceptions are swallowed `[VERIFIED: grid/src/audit/chain.ts:52-57]`, meaning a reviewer fail in a listener would commit `trade.proposed` *and* `trade.settled` with no rollback — the exact scenario the 3-event flow prevents.
- **`Date.now()` in the critical test path.** Any D-13 test that does not call `vi.useFakeTimers()` will be flaky. Use the launcher.tick-audit.test.ts:22 pattern as the canonical reference.
- **Mutating `ALLOWLIST` at runtime.** The frozen-set overrides throw on `.add/.delete/.clear` `[VERIFIED: grid/src/audit/broadcast-allowlist.ts:52-55]`. Phase 5 must modify `ALLOWLIST_MEMBERS` (line 25) at *source* before freezing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonical JSON serialization for telosHash (brain-side) | Custom sorter | Python `json.dumps(obj, sort_keys=True, separators=(",", ":"))` | Standard library; deterministic; the reviewer only verifies hex format anyway |
| Hash computation | Custom SHA-256 | `node:crypto.createHash('sha256')` (Grid) / `hashlib.sha256` (Brain) | Already in the Grid via AuditChain; already stdlib in Python |
| Contract test source-file reading | AST parse | `fs.readFileSync + RegExp.test` | 5 files, one regex; AST is overkill |
| Closed-enum validation at emit site | Runtime validator library (e.g., zod) | TypeScript string-literal union + one `includes` assertion in the contract test | The compiler is the validator for internal code; the privacy regression is the runtime backstop |
| Fake-timer infrastructure for D-13 | DIY clock mock | `vi.useFakeTimers()` + `vi.setSystemTime()` | Already in use at `grid/test/genesis/launcher.tick-audit.test.ts:22` |
| DID regex | Re-derive | Reuse the exact v2.0 regex `/^did:noesis:[a-z0-9_\-]+$/i` from audit/registry/genesis boundaries | Widening it breaks a Phase 1 invariant |

**Key insight:** Phase 5 ships with **zero new dependencies**. Every primitive it needs already exists in the codebase. Adding any library would be a smell.

---

## Runtime State Inventory

Phase 5 is **additive code** (new module, new handler branch, new allowlist entry, new tests, new optional fields on an existing dataclass). Not a rename/refactor/migration phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema migration. MySQL chain table is append-only; `trade.reviewed` entries are just new rows going forward. No historical rewrite. | None |
| Live service config | None. Docker env vars, Fastify routes, WsHub allowlist — all unchanged except the allowlist source constant. | None |
| OS-registered state | None. No systemd, no Task Scheduler, no pm2 on Noēsis today. | None |
| Secrets/env vars | None. Reviewer has no keys, no outbound calls. | None |
| Build artifacts | TypeScript recompilation only (`tsc` in `grid/`). No egg-info, no Docker image retag required for this phase alone. | Run `npm run build` in `grid/` after changes |

**Nothing found in most categories — verified by file-by-file search of `grid/src/`, `brain/src/`, and the planning docs.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥ 20 | Grid runtime + Vitest | ✓ | ≥ 20 required `[VERIFIED: grid/package.json:29]` | — |
| TypeScript 5.5 | Compile | ✓ | ^5.5 `[VERIFIED: grid/package.json:26]` | — |
| Vitest 2.0 | Test runner | ✓ | ^2.0 `[VERIFIED: grid/package.json:27]` | — |
| Python 3.10+ | Brain (for schema extension + brain tests) | Assumed (v2.0 shipped green) | per `brain/pyproject.toml` | — |

**Missing dependencies:** None. Phase 5 uses only what ships with v2.0.

---

## RQ1. Module pattern for `grid/src/review/` (Existing-module convention)

**Closest analog: `grid/src/audit/`** — a single-concern folder with one class, supporting types, a pure-function utility, and an index re-export.

### Audit folder shape (verified by `ls`)

```
grid/src/audit/
├── broadcast-allowlist.ts    (pure functions; default-deny + privacy check)
├── chain.ts                  (AuditChain class; the main API)
├── index.ts                  (public re-exports)
└── types.ts                  (AuditEntry, AuditQuery, AppendListener)
```

Review folder should be structurally identical. This exact symmetry is what lets planner tasks read like "mirror of audit/" for each file.

### Class construction site pattern (verified)

`[VERIFIED: grid/src/genesis/launcher.ts:41]`
```ts
this.audit = new AuditChain();
```

`[VERIFIED: grid/src/genesis/launcher.ts:40]`
```ts
this.logos = new LogosEngine();
```

Both are no-arg constructors on plain classes. Reviewer differs — it needs `audit` and `registry` to run its checks (balance check needs `NousRegistry.get`; emit hooks need `AuditChain`). So:

```ts
// In createGridApp or GenesisLauncher
this.reviewer = new Reviewer(this.audit, this.registry);
```

Wired after `this.audit` and `this.registry` are constructed — line order matters.

### Test structure pattern

`[VERIFIED: grid/test/`:
- `audit.test.ts` — AuditChain unit tests
- `broadcast-allowlist.test.ts` — pure-function tests
- `integration/trade-settlement.test.ts` — end-to-end with NousRunner

Review folder tests mirror this: `review/reviewer.test.ts` (unit), `review/contract.test.ts` (REV-04 lint), `review/determinism.test.ts` (D-13), `integration/trade-review.test.ts` (end-to-end 3-event flow). `[CITED]` from this codebase pattern.

**Exact file shapes recommended:**

- `grid/src/review/Reviewer.ts` — class with `static DID`, `static constructed`, `review(ctx)` method
- `grid/src/review/types.ts` — `ReviewFailureCode` union, `ReviewContext`, `ReviewResult`, `Check`
- `grid/src/review/registry.ts` — `CHECKS: Map<string, Check>` + `registerCheck(name, handler)` + `CHECK_ORDER: readonly string[]`
- `grid/src/review/checks/*.ts` — one file per check; each calls `registerCheck` at module load
- `grid/src/review/index.ts` — `export { Reviewer } from './Reviewer.js'` + type re-exports

---

## RQ2. nous-runner.ts trade_request handler rewrite shape

### Current handler (exact line range)

**`[VERIFIED: grid/src/integration/nous-runner.ts:117-164]`** — the `case 'trade_request'` block inside the switch in `executeActions`. 48 lines; 4 emit sites for `trade.rejected`, 1 for `trade.settled`. Zero for `trade.proposed`.

### `trade.proposed` is not currently emitted anywhere

`[VERIFIED]`: `grep -r "trade.proposed"` finds the string only in `grid/src/audit/broadcast-allowlist.ts:30` (allowlist) and test fixtures. Phase 5's very first task, after the allowlist addition, is to become the **first producer** of `trade.proposed` in system history. The 2026-04-18 "v2.0 shipped green" state includes this as an allowlisted-but-never-emitted event.

### Proposed handler shape (with exact insertion points)

```ts
case 'trade_request': {
    // Lines 122-139 unchanged: metadata parsing + malformed_metadata rejection
    //   (malformed metadata is a transport-layer error, not a review failure —
    //    we never reach the reviewer without well-formed data)
    const md = action.metadata ?? {};
    const counterpartyRaw = md['counterparty'];
    const amountRaw = md['amount'];
    const nonceRaw = md['nonce'];
    const memoryRefsRaw = md['memoryRefs'];      // NEW
    const telosHashRaw = md['telosHash'];        // NEW

    const counterparty = typeof counterpartyRaw === 'string' ? counterpartyRaw : null;
    const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : null;
    const nonce = typeof nonceRaw === 'string' ? nonceRaw : null;
    const memoryRefs = Array.isArray(memoryRefsRaw) && memoryRefsRaw.every(r => typeof r === 'string')
        ? memoryRefsRaw as string[] : null;    // NEW
    const telosHash = typeof telosHashRaw === 'string' ? telosHashRaw : null;  // NEW

    if (counterparty === null || amount === null || nonce === null ||
        memoryRefs === null || telosHash === null) {
        this.audit.append('trade.rejected', this.nousDid, {
            reason: 'malformed_metadata',
            nonce: nonce ?? null,
        });
        break;
    }

    // ── NEW: Emit propose BEFORE review (success criterion 1 requires this order)
    this.audit.append('trade.proposed', this.nousDid, {
        counterparty, amount, nonce, memoryRefs, telosHash,
    });

    // ── NEW: Synchronous review
    const proposer = this.registry.get(this.nousDid);
    const proposerBalance = proposer?.ousia ?? 0;
    const verdict = this.reviewer.review({
        proposerDid: this.nousDid,
        proposerBalance,
        counterparty,
        amount,
        memoryRefs,
        telosHash,
    });

    // Emit reviewed (pass or fail)
    this.audit.append('trade.reviewed', Reviewer.DID, {
        trade_id: nonce,
        reviewer_did: Reviewer.DID,
        verdict: verdict.verdict,
        ...(verdict.verdict === 'fail' ? {
            failed_check: verdict.failed_check,
            failure_reason: verdict.failure_reason,
        } : {}),
    });

    if (verdict.verdict === 'fail') break;  // NO transferOusia, NO trade.settled

    // ── EXISTING path from here (but bounds/transferOusia changes — see below)
    // ...
}
```

### Reviewer vs transferOusia overlap — RECOMMENDATION

**Three balance-check code paths exist today that Phase 5 must reconcile:**

1. Reviewer `balance_check` — REV-01 #1 (new, Phase 5)
2. `EconomyManager.validateTransfer(amount)` — bounds check `[VERIFIED: grid/src/integration/nous-runner.ts:140]` — rejects with `reason: 'bounds'`
3. `NousRegistry.transferOusia` — rejects with `error: 'insufficient' | 'not_found' | 'self_transfer' | 'invalid_amount'` `[VERIFIED: grid/src/registry/registry.ts:119-143]`

**Overlap analysis:**
- Reviewer's `amount_check` (positive non-zero integer) overlaps with `transferOusia`'s `invalid_amount` (Number.isInteger + > 0) — **identical logic**
- Reviewer's `balance_check` overlaps with `transferOusia`'s `insufficient` — **identical logic**
- Reviewer's `counterparty_did_check` is new — DID regex hasn't been enforced at this entry point before (v2.0 relied on `transferOusia`'s `not_found` to catch bad DIDs indirectly)
- `bounds` (EconomyManager min/max transfer limits) is **not** in REV-01 — it's a separate economic policy, not an invariant

**Recommendation:**
- **Reviewer replaces transferOusia's `insufficient` and `invalid_amount` paths in the trade code path.** After review passes, `transferOusia` is guaranteed to succeed on these two preconditions (balance, integer-positive-amount). But keep `transferOusia`'s defensive checks — they are the library-level guard for any other future caller.
- **Keep EconomyManager `bounds` check where it is.** It is policy (min/max per-transfer), not invariant. Runs after review passes, before transferOusia.
- **`self_transfer` and `not_found` in `transferOusia`** become **unreachable** if the reviewer's `counterparty_did_check` includes self-identity rejection and registry-existence check. But leave them in transferOusia as defensive — they cost nothing.

This means the **pass-path after review looks identical to today's code**, just with the reviewer-pass prefix and an `assert !result.error` guarantee (or the existing branch kept as a "should never fire" fail-safe).

### Does the rejection branch still emit `trade.rejected`?

Per D-01 and success criterion 1: on reviewer fail, we emit `trade.reviewed{fail}` and **nothing else**. No `trade.settled`, no `trade.rejected`.

**But:** the existing `malformed_metadata` and `bounds` rejection branches **stay** as they are — they are non-reviewer failures that occur before or after the review window. Malformed-metadata means the input never reached the reviewer; bounds means a policy check failed post-review. Both legitimately emit `trade.rejected` with their existing reason codes.

The handler emits:
- `trade.rejected` if metadata is malformed (before proposed/reviewed — emitted as today)
- `trade.proposed` + `trade.reviewed{fail}` if any REV-01 check fails (new path)
- `trade.proposed` + `trade.reviewed{pass}` + `trade.rejected` if `bounds` fails (rare — brain would have to propose an amount outside EconomyManager limits that also passed the reviewer's integer-positive check; happens if `bounds.maxTransfer < amount`)
- `trade.proposed` + `trade.reviewed{pass}` + `trade.rejected` if `transferOusia` defensively rejects (should be unreachable but keep the branch)
- `trade.proposed` + `trade.reviewed{pass}` + `trade.settled` on full success

**Planner note:** this gives the review event a clean semantic — it is *the* authority on invariant satisfaction. `trade.rejected` remains the authority on *policy* rejection (bounds) and *transport* rejection (malformed).

---

## RQ3. BrainAction.trade_request schema extension (D-05)

### Brain-side (Python)

**`[VERIFIED: brain/src/noesis_brain/rpc/types.py:87-102]`** — `Action` is a dataclass with `metadata: dict[str, Any] = field(default_factory=dict)`.

**No Python schema change required.** The `metadata` dict is already `dict[str, Any]`. Phase 5 adds convention: any brain module producing a `TRADE_REQUEST` action MUST populate `memoryRefs` and `telosHash` keys. This is enforced by:
1. Grid-side parse rejecting to `malformed_metadata` on missing keys (see RQ2 handler rewrite)
2. A brain-side contract test asserting shape

### Grid-side (TypeScript)

**`[VERIFIED: grid/src/integration/types.ts:44-54]`:**
```ts
export interface TradeRequestAction {
    action_type: 'trade_request';
    channel: string;
    text: string;
    metadata: {
        counterparty: string;
        amount: number;
        nonce: string;
        [key: string]: unknown;
    };
}
```

**Proposed diff:**
```ts
export interface TradeRequestAction {
    action_type: 'trade_request';
    channel: string;
    text: string;
    metadata: {
        counterparty: string;
        amount: number;
        nonce: string;
        memoryRefs: string[];      // NEW — pre-resolved memory IDs
        telosHash: string;         // NEW — 64-hex SHA-256
        [key: string]: unknown;
    };
}
```

**Migration strategy: required-from-day-one.** The discuss-phase locked `trade.proposed` as having zero current producers — there is no field-compat window to honor. Phase 5 is the first phase where brain actually emits trade actions with these fields. If v2.0 tests have trade-request fixtures, they must be updated to include the new fields.

`[VERIFIED: grid/test/integration/trade-settlement.test.ts:83,127,157]` — three test fixtures currently use `{ counterparty, amount, nonce }`. Each must add `memoryRefs` and `telosHash`.

### Memory ID format — CRITICAL FINDING

**D-05 "Claude's Discretion" proposed `/^mem:[a-z0-9\-]+$/i`** — this **does not match brain reality**.

**`[VERIFIED: brain/src/noesis_brain/memory/types.py:40]`:**
```python
id: int | None = None  # Database ID (set after storage)
```

Brain memories are **integer primary keys**, not string IDs. The proposed regex would never match a brain-emitted memory reference.

**Resolution options (planner must pick, then update CONTEXT.md D-05 via a follow-up commit):**

**Option A — String-coerce on brain side.** Brain emits `memoryRefs: ["mem:1", "mem:42"]` by prefixing the int ID. Reviewer validates `/^mem:\d+$/`. Cheap, cosmetic.

**Option B — Accept digit-strings or numbers.** Brain emits `memoryRefs: ["1", "42"]`. Reviewer validates `/^\d+$/`. Minimal brain change.

**Option C — Change brain's Memory.id to UUID-str.** Heavy — touches persistence schema, not appropriate for Phase 5.

**Recommendation: Option A.** Prefixing with `mem:` makes the string self-describing at the audit-chain level (you can visually tell it's a memory ref, not some random int) and matches the conceptual DID-ish "typed identifier" style used elsewhere in Noēsis (`did:noesis:...`, `nous://...`). Update the reviewer regex to `/^mem:\d+$/` and brain to prefix `f"mem:{memory.id}"`. This is a **5-line brain-side change** plus the reviewer regex.

### telosHash format

**`[VERIFIED: brain/src/noesis_brain/telos/types.py:22-48]`** — Telos is a dataclass `Goal` list; no intrinsic hash. Brain must compute the hash.

**Canonical computation recommendation:**
```python
import hashlib, json
def compute_telos_hash(goals: list[Goal]) -> str:
    # Only ACTIVE goals (what the reviewer cares about)
    active = [g.to_dict() if hasattr(g, 'to_dict') else {...} for g in goals if g.is_active()]
    canon = json.dumps(active, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()  # 64 hex chars
```

**Phase 5 reviewer validates only format:** `/^[a-f0-9]{64}$/`. Non-empty, lowercase hex, exactly 64 chars. Full semantic match (hash seen before for this DID) is deferred to Phase 7 TelosRegistry per D-05 watchpoint.

**Planner's watchpoint for Phase 7:** When Phase 7 ships `telos.refined` with `after_goal_hash`, the hash function MUST be identical to what Phase 5 trade_request uses, OR Phase 7 introduces a separate Grid-side canonicalization. Recommend Phase 5 document the canonical function in a `brain/src/noesis_brain/telos/hashing.py` module so Phase 7 can import it directly.

---

## RQ4. Broadcast allowlist addition mechanics

### Exact diff for `grid/src/audit/broadcast-allowlist.ts`

**Line to modify: `[VERIFIED: grid/src/audit/broadcast-allowlist.ts:25-36]`** — the `ALLOWLIST_MEMBERS` readonly array.

```ts
// BEFORE (10 entries)
const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message',
    'trade.proposed',
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
] as const;

// AFTER (11 entries — alphabetical within the 'trade.*' group)
const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message',
    'trade.proposed',
    'trade.reviewed',   // NEW — Phase 5 (REV-02)
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
] as const;
```

**Ordering:** insert between `trade.proposed` and `trade.settled` to reflect runtime emission order (proposed → reviewed → settled). The existing file is not strictly alphabetical (`law.triggered` is after `trade.*`), so grouped-by-domain-then-by-lifecycle is the established style.

**Why this doesn't fight the frozen-set invariant:** `ALLOWLIST_MEMBERS` (line 25) is frozen as `readonly`, but the freeze happens at **module load** when `buildFrozenAllowlist(ALLOWLIST_MEMBERS)` runs (line 59). Modifying the source constant before freeze is how all new events land. No runtime mutation, no bypass of `buildFrozenAllowlist`. `[VERIFIED: grid/src/audit/broadcast-allowlist.ts:48-57]`

### Tests that assert allowlist contents (all must update)

**`[VERIFIED: grid/test/broadcast-allowlist.test.ts:10-12,40-43]`:**
```ts
it('has exactly 10 locked v1 event types', () => {
    expect(ALLOWLIST.size).toBe(10);
});
```

**This count must change to 11** in the Phase 5 commit:
```ts
it('has exactly 11 allowlisted event types', () => {
    expect(ALLOWLIST.size).toBe(11);
});
```

And:
```ts
it('ALLOWLIST is frozen — runtime mutation throws', () => {
    expect(() => (ALLOWLIST as Set<string>).add('law.bypassed')).toThrow(TypeError);
    expect(ALLOWLIST.size).toBe(10);   // ← becomes 11
});
```

**`[VERIFIED: grid/test/broadcast-allowlist.test.ts:14-27]`:** `it.each` test iterates all 10 allowed event types. Phase 5 adds `'trade.reviewed'` to the list.

**No other tests in the codebase assert allowlist membership or size.** Verified by ripgrep for `ALLOWLIST.size`, `isAllowlisted`, and `allowlist`.

### STATE.md doc drift (D-11)

**`[VERIFIED]`** — `trade.countered` appears in:
- `.planning/STATE.md` (Accumulated Context section — the thing D-11 fixes)
- `.planning/REQUIREMENTS.md` (Out of Scope — listed as deferred)
- Archived v2.0 phase docs

**Zero occurrences in `grid/`, `brain/`, `protocol/`, `dashboard/` source or tests.** The phantom is strictly a planning-doc artifact. D-11's reconciliation is a STATE.md edit, not a code change.

---

## RQ5. AuditChain zero-diff invariant verification strategy (D-13)

### Hash construction

**`[VERIFIED: grid/src/audit/chain.ts:173-183]`:**
```ts
static computeHash(
    prevHash: string,
    eventType: string,
    actorDid: string,
    payload: Record<string, unknown>,
    timestamp: number,
): string {
    const data = `${prevHash}|${eventType}|${actorDid}|${JSON.stringify(payload)}|${timestamp}`;
    return createHash('sha256').update(data).digest('hex');
}
```

**Inputs include `timestamp` = `createdAt = Date.now()`** `[VERIFIED: chain.ts:26]`. Therefore **byte-identical chain across two real-time runs is literally impossible** without controlling time.

### Existing determinism test precedent

**`[VERIFIED: grid/test/genesis/launcher.tick-audit.test.ts:1,22]`** — uses `vi.useFakeTimers` pattern. Also uses `launcher.clock.advance()` for synchronous tick advancement `[VERIFIED: same file line 33]`.

**`[VERIFIED]`** There is **no existing "100-tick simulation harness" in `grid/test/`.** Phase 5 must build it. It is not as heavy as it sounds — the pattern is essentially:

```ts
// Create two launchers with identical config and fake time
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

const launcherA = new GenesisLauncher(TEST_CONFIG);
const launcherB = new GenesisLauncher(TEST_CONFIG);
launcherA.bootstrap();
launcherB.bootstrap();

// Wire reviewer ON to A, BYPASSED to B
// (bypass mechanism = env var or feature flag — see below)

// Queue identical trade_request actions into both
// Advance clocks synchronously
for (let t = 0; t < 100; t++) {
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0, t * 10));  // tickRateMs = 10
    launcherA.clock.advance();
    launcherB.clock.advance();
    // run queued runners
}

// Compare chains
const entriesA = launcherA.audit.all();
const entriesB = launcherB.audit.all();

// Filter out trade.reviewed entries from A (since they don't exist in B)
const entriesAFiltered = entriesA.filter(e => e.eventType !== 'trade.reviewed');

// Re-assert byte-identity by recomputing hashes from filtered sequences
// (prevHash chain breaks if you just drop entries — must recompute)
```

**CRITICAL CAVEAT — the hash chain.** You cannot simply filter `trade.reviewed` entries from A and byte-compare to B. `prevHash` of the next entry in A references the `trade.reviewed` entry's hash. So the D-13 "byte-identical" comparison must either:

**Option 1** — Compare payload tuples (eventType, actorDid, payload) at the same index after filtering. Not hashes.

**Option 2** — Maintain two parallel AuditChains: chain-A emits `trade.reviewed`; chain-B's same-index positions simply skip it. Compare `chain.at(idx)` field-by-field (eventType, actorDid, payload, createdAt) for non-reviewed indices.

**Recommendation: Option 2**. The assertion "reviewer does not perturb any other event's ordering, payload, or timestamp" is stronger and more meaningful than "reviewer does not perturb hashes." Hashes are a consequence of payload+timestamp+chain-position — if those match, hashes would match too (in a hypothetical where `trade.reviewed` didn't interleave).

### Bypass mechanism

The test needs two runs: reviewer-ON (normal) and reviewer-BYPASSED (skips the `reviewer.review()` call). Options:

1. **Env var** (`NOESIS_REVIEWER_BYPASS=1`) — crude, leaks production surface area
2. **Test-only constructor flag** (`new NousRunner({ ..., _reviewerBypass: true })`) — explicit, scoped to test harness
3. **Null reviewer** (pass a `Reviewer` that always returns `{verdict: 'pass'}` and skips emit) — does not match "BYPASSED" semantics (still emits `trade.reviewed`)

**Recommendation:** Option 2 via a boolean on the config. The `NousRunnerConfig` interface gets `reviewer?: Reviewer` — when undefined, the handler skips the review block entirely. Production always injects; test can omit for the BYPASSED run. Type system catches accidental omission in production because `createGridApp` requires the field.

### Proposed D-13 test shape

```ts
// grid/test/review/determinism.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// ... imports
import { Reviewer } from '../../src/review/Reviewer.js';

describe('D-13 zero-diff: reviewer ON vs BYPASSED', () => {
    beforeEach(() => {
        Reviewer.resetForTesting();      // Needed per RQ6
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('100-tick sim produces same events except trade.reviewed', async () => {
        const { launcher: A, runners: aRunners } = buildSim({ reviewerEnabled: true });
        Reviewer.resetForTesting();       // Between A and B
        const { launcher: B, runners: bRunners } = buildSim({ reviewerEnabled: false });

        // Queue identical trades at identical ticks
        for (let t = 0; t < 100; t++) {
            if (t === 10) queueTradeOn(aRunners, bRunners);
            vi.setSystemTime(Date.now() + 10);
            A.clock.advance();
            B.clock.advance();
            await flushPromises();
        }

        const entriesA = A.audit.all().filter(e => e.eventType !== 'trade.reviewed');
        const entriesB = B.audit.all();

        expect(entriesA.length).toBe(entriesB.length);
        for (let i = 0; i < entriesA.length; i++) {
            expect({
                eventType: entriesA[i].eventType,
                actorDid: entriesA[i].actorDid,
                payload: entriesA[i].payload,
                createdAt: entriesA[i].createdAt,
            }).toEqual({
                eventType: entriesB[i].eventType,
                actorDid: entriesB[i].actorDid,
                payload: entriesB[i].payload,
                createdAt: entriesB[i].createdAt,
            });
        }
    });
});
```

Confidence: HIGH — pattern verified from `launcher.tick-audit.test.ts`.

---

## RQ6. Singleton pattern + test isolation collision (D-07)

### The collision

`static constructed = false` + `throw new Error('already constructed')` means **every test that constructs a new `Reviewer` after the first one throws**. Since Vitest runs all tests in a single Node process (by default), the second `new Reviewer()` in any test fails unless the flag resets between tests.

### How existing grid code handles this

**`[VERIFIED: grid/src/audit/chain.ts:13,17]`** — `AuditChain` has no singleton pattern. Each test constructs a fresh one (`beforeEach(() => chain = new AuditChain())` — `grid/test/audit.test.ts:7-9`).

**`[VERIFIED: grid/src/logos/engine.ts:13`]** — `LogosEngine` also no singleton.

**`[VERIFIED: grid/src/registry/registry.ts:11`]** — `NousRegistry` also no singleton.

**Reviewer is the first singleton-by-construction class in the Grid.** No existing pattern to mirror.

### Recommended pattern: test-only reset method

```ts
export class Reviewer {
    static readonly DID = 'did:noesis:reviewer';
    private static constructed = false;

    constructor(
        private readonly audit: AuditChain,
        private readonly registry: NousRegistry,
    ) {
        if (Reviewer.constructed) {
            throw new Error('ReviewerNous is a singleton — already constructed for this Grid');
        }
        Reviewer.constructed = true;
    }

    /**
     * TEST-ONLY: reset the singleton flag so a fresh Reviewer can be constructed
     * in the next test. Not exported from the module's public index.ts.
     * @internal
     */
    static resetForTesting(): void {
        Reviewer.constructed = false;
    }
}
```

- `resetForTesting` is a named static method — searchable, explicit, documented as `@internal`.
- Not exported from `grid/src/review/index.ts`. Only `Reviewer.ts` exports it, and only test files import it directly.
- In `beforeEach`, every test that constructs a `Reviewer` calls `Reviewer.resetForTesting()` first.

### Bootstrap location

**`[VERIFIED: grid/src/main.ts:65-114]`** — `createGridApp` is where infrastructure is constructed. `new GenesisLauncher(config)` is at line 66; `launcher.bootstrap()` at line 79; server and coordinator wiring follows.

**Recommended: construct `Reviewer` in `createGridApp` after `launcher.bootstrap()`**, pass it to whoever constructs `NousRunner`s. Exact construction site depends on where `NousRunner`s are eventually instantiated — currently `main.ts:113` passes `getRunner: () => undefined`, meaning the runner-construction plan is not yet wired (per v2.0 Phase 4 04-03 plan notes in the Read).

**Phase 5 extension to `NousRunner` construction:** wherever runners are built (today: nowhere; near future: some coordinator path), a `reviewer` field is added to `NousRunnerConfig` and passed through. The singleton is constructed **once** in `createGridApp` and shared across all runners.

Alternative: construct `Reviewer` inside `GenesisLauncher` like `AuditChain` and `LogosEngine` are today — this would be more consistent with existing pattern but tightens the coupling (launcher tests would need to reset the singleton more often).

**Recommended: in `createGridApp`, not `GenesisLauncher`**. This keeps `GenesisLauncher` unit tests (currently 2 files, 5 tests) free of the singleton reset dance. Only the main.ts integration tests (none exist today; Phase 5 may or may not add one) need the reset.

---

## RQ7. Subjective-keyword contract test mechanics (D-10)

### Test framework confirmed

**`[VERIFIED: grid/package.json:9,27]`** — Vitest 2.0.0. Import `{ describe, it, expect } from 'vitest'`.

### The "read source file from disk" approach

**`[VERIFIED]` — `readFileSync` is stdlib-available in all Vitest tests** (Node test environment). No dep needed.

```ts
// grid/test/review/contract.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHECKS, CHECK_ORDER } from '../../src/review/registry.js';

const FORBIDDEN = /\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b/i;
const CHECKS_DIR = resolve(__dirname, '../../src/review/checks');
const VALID_CODES = new Set([
    'insufficient_balance',
    'invalid_counterparty_did',
    'non_positive_amount',
    'malformed_memory_refs',
    'malformed_telos_hash',
] as const);

describe('REV-04: subjective-check lint gate', () => {
    it('every registered check name matches a ReviewFailureCode', () => {
        for (const name of CHECKS.keys()) {
            expect(VALID_CODES.has(name as any)).toBe(true);
        }
    });

    it('registry size equals the number of ReviewFailureCode members', () => {
        expect(CHECKS.size).toBe(VALID_CODES.size);
    });

    describe('no subjective keywords in check handler source', () => {
        for (const name of CHECK_ORDER) {
            it(`checks/${name}.ts contains no subjective keywords`, () => {
                const src = readFileSync(resolve(CHECKS_DIR, `${name}.ts`), 'utf8');
                expect(src).not.toMatch(FORBIDDEN);
            });
        }
    });

    it('CHECK_ORDER enumerates every registered check (no ghosts, no orphans)', () => {
        expect(new Set(CHECK_ORDER)).toEqual(new Set(CHECKS.keys()));
    });
});
```

### Runtime reflection alternative

TypeScript has no runtime reflection — class and function names are preserved but source bodies are erased on compile. **Reading source files is the only path for "handler body contains no X" assertions in Vitest.**

Caveat: the test reads the **compiled** source if tests run against `dist/`. But Vitest by default transforms `.ts` on the fly via esbuild and runs against source, so `resolve(__dirname, '../../src/review/checks')` points at the actual TypeScript files. `[VERIFIED]` from the launcher test which imports `'../../src/genesis/launcher.js'` — the `.js` extension but resolving against `src/`.

### Word-boundary vs substring

D-10 locks the pattern as `/fairness|wisdom|taste|quality|novelty|good|bad|should/i`. Substring match is hazardous: `shouldBail` matches; `qualify` matches; `goodbye` matches. Noēsis codebase has `shouldBail`-style names? Ripgrep the directories — none in `grid/src/review/` (doesn't exist yet), but `good` and `bad` are common English.

**Recommendation:** use word-boundary `\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b` in the contract test to avoid false positives from identifiers like `goodChecksum` or `shouldContinue`. Also strip string literals before match (easy via `src.replace(/"[^"]*"|'[^']*'/g, '')`) — comments are the concerning surface, not variable names.

---

## RQ8. Closed enum shape (D-09)

### Existing closed-set pattern in the codebase

**`[VERIFIED: grid/src/registry/registry.ts:125]`** — `transferOusia` returns a union with `error: 'not_found' | 'insufficient' | 'self_transfer' | 'invalid_amount'`. Exact shape Phase 5 should mirror.

**`[VERIFIED: grid/src/registry/types.ts]` and `grid/src/logos/types.ts`** — both use string-literal unions and `as const` readonly tuples for closed sets. No `enum` keyword anywhere in the grid source.

### Proposed types.ts

```ts
// grid/src/review/types.ts

export type ReviewFailureCode =
    | 'insufficient_balance'
    | 'invalid_counterparty_did'
    | 'non_positive_amount'
    | 'malformed_memory_refs'
    | 'malformed_telos_hash';

export type ReviewCheckName = ReviewFailureCode;   // 1:1 per D-09

export interface ReviewContext {
    proposerDid: string;
    proposerBalance: number;
    counterparty: string;
    amount: number;
    memoryRefs: string[];
    telosHash: string;
}

export type ReviewResult =
    | { verdict: 'pass' }
    | { verdict: 'fail'; failed_check: ReviewCheckName; failure_reason: ReviewFailureCode };

export type Check = (ctx: ReviewContext) => { ok: true } | { ok: false; code: ReviewFailureCode };
```

### Emit-site runtime validation

The allowlist member check already runs (`isAllowlisted('trade.reviewed')`). Additionally, the emit site should assert the failure_reason is in the valid set (defensive, catches stringly-typed JSON-boundary bugs):

```ts
// In nous-runner.ts, before audit.append('trade.reviewed', ...)
if (verdict.verdict === 'fail') {
    if (!VALID_REVIEW_FAILURE_CODES.has(verdict.failure_reason)) {
        throw new Error(`Invariant violation: unknown ReviewFailureCode "${verdict.failure_reason}"`);
    }
}
```

Where `VALID_REVIEW_FAILURE_CODES` is a `readonly Set<ReviewFailureCode>` exported from `types.ts`. This is the **runtime backstop** for the type system — if a future refactor introduces stringly-typed payloads across a JSON serialization boundary, this assertion catches it.

---

## RQ9. Payload privacy regression (D-12)

### Existing test shape

**`[VERIFIED: grid/test/broadcast-allowlist.test.ts:46-123]`** — 10 tests for `payloadPrivacyCheck()` covering numeric/currency, empty, null-valued, top-level forbidden, nested forbidden, array-nested, case-insensitive, substring match, and specific keywords.

### Proposed D-12 regression test

```ts
// grid/test/review/payload-privacy.test.ts
import { describe, it, expect } from 'vitest';
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';
import { Reviewer } from '../../src/review/Reviewer.js';

describe('D-12: trade.reviewed payload passes payloadPrivacyCheck', () => {
    it('pass payload has no forbidden keys', () => {
        const payload = {
            trade_id: 'nonce-1',
            reviewer_did: Reviewer.DID,
            verdict: 'pass' as const,
        };
        expect(payloadPrivacyCheck(payload)).toEqual({ ok: true });
    });

    it.each([
        'insufficient_balance',
        'invalid_counterparty_did',
        'non_positive_amount',
        'malformed_memory_refs',
        'malformed_telos_hash',
    ])('fail payload with code=%s has no forbidden keys', (code) => {
        const payload = {
            trade_id: 'nonce-1',
            reviewer_did: Reviewer.DID,
            verdict: 'fail' as const,
            failed_check: code,
            failure_reason: code,
        };
        expect(payloadPrivacyCheck(payload)).toEqual({ ok: true });
    });

    it('Reviewer.DID does not match FORBIDDEN_KEY_PATTERN', () => {
        // The DID itself is a value, not a key, but defensive: even if someone
        // accidentally flips it into a key position, it should be safe.
        expect(payloadPrivacyCheck({ [Reviewer.DID]: 1 })).toEqual({ ok: true });
    });
});
```

**Also extend `grid/test/broadcast-allowlist.test.ts`:** add `'trade.reviewed'` to the `it.each` "allows %s" table on line 14-27.

---

## RQ10. Test framework and test file locations

**Framework:** Vitest 2.0 `[VERIFIED: grid/package.json]`.

**Test file layout:** mirror `grid/test/audit.test.ts` + `grid/test/broadcast-allowlist.test.ts` + `grid/test/integration/trade-settlement.test.ts`.

**Recommended new files:**

| Path | Purpose | Size estimate |
|------|---------|--------------|
| `grid/test/review/reviewer.test.ts` | Unit tests per check (5 checks × ~3 cases = ~15 tests) | ~200 LOC |
| `grid/test/review/reviewer-singleton.test.ts` | D-07 double-construction throws | ~30 LOC |
| `grid/test/review/contract.test.ts` | REV-04 subjective-keyword + enum-coverage (D-10) | ~60 LOC |
| `grid/test/review/payload-privacy.test.ts` | D-12 privacy regression | ~50 LOC |
| `grid/test/review/determinism.test.ts` | D-13 zero-diff 100-tick regression | ~120 LOC |
| `grid/test/integration/trade-review.test.ts` | 3-event flow end-to-end (sister of trade-settlement.test.ts) | ~250 LOC |

**Fixture pattern for "minimal Grid for testing":** `[VERIFIED: grid/test/integration/trade-settlement.test.ts:50-69]`'s `seedEnv()` helper is the canonical pattern — construct `NousRegistry`, `AuditChain`, `SpatialMap`, `EconomyManager` directly, spawn 2 Nous, return. Phase 5 reuses this pattern in `trade-review.test.ts`, adding a fresh `Reviewer` and `Reviewer.resetForTesting()` in `beforeEach`.

---

## RQ11. Pitfalls specific to Phase 5

### Ranked by severity (1 = most likely to bite)

1. **Order of emit vs. review (HIGHEST).** Success criterion 1 requires "every trade.proposed followed by exactly one trade.reviewed." If `trade.proposed` is emitted *after* the review, the invariant collapses. Mitigation: emit `trade.proposed` **before** calling `reviewer.review()`. Test: assert on the audit chain that index N is `trade.proposed` and index N+1 is `trade.reviewed` for the same `nonce`.

2. **`Date.now()` in hash breaks D-13 literal byte-identity.** `grid/src/audit/chain.ts:26,181` means two independent runs never produce identical chains. Without `vi.useFakeTimers` + `vi.setSystemTime`, D-13 is untestable. Mitigation: use the established fake-timer pattern from `launcher.tick-audit.test.ts:22`. Compare payload+actor+timestamp tuples, not raw hashes (see RQ5 Option 2).

3. **Memory ID regex mismatch with brain (D-05 overpromise).** Brain's `Memory.id: int | None` does not match any `/^mem:...$/ string regex`. Mitigation: Option A in RQ3 — brain emits `f"mem:{id}"` strings; reviewer regex is `/^mem:\d+$/`. Requires a brain-side change in Phase 5 scope.

4. **`reviewer.review()` exception mid-tick would break determinism.** If a check throws (not returns `{ok: false}`), it propagates up through `executeActions` and kills the tick. Mitigation: each check is a pure function returning a tagged union — no throws. Contract test asserts each handler's type signature.

5. **Singleton flag leaks across test files.** If any test forgets `Reviewer.resetForTesting()`, the next file throws on construction. Mitigation: add a global `beforeEach` in a `grid/test/setup.ts` that resets the flag unconditionally.

6. **`trade.rejected` (from transferOusia path) unreachable but left in code.** The handler has defensive branches for `transferOusia` failures that are now impossible after reviewer passes. Dead code risk. Mitigation: keep the branches; add a comment `// defensive — reviewer invariants ensure this is unreachable`. Do not delete.

7. **Nonce collision within a single tick.** Two trade_requests with the same nonce from the same proposer inside one tick. Current code `[VERIFIED: nous-runner.ts]` has **no dedupe** — both would be processed. Phase 5 adds auditability via the correlation key `(proposer_did, nonce)` but doesn't enforce uniqueness. Mitigation: document as known gap; defer to a future phase. Success criteria don't require dedup.

8. **Payload key `failure_reason` value "thought" — no such code, but defensive.** The `ReviewFailureCode` union is hand-edited; a typo could introduce a code that trips `FORBIDDEN_KEY_PATTERN` (e.g., `'forbidden_thought'`). Mitigation: the privacy regression test (D-12) + the union members enumerated explicitly catches this at commit time.

9. **Brain-side test fixtures for trade actions all need updating.** `trade-settlement.test.ts` three fixtures (`nonce-1`, `nonce-2`, `nonce-3`) lack `memoryRefs` and `telosHash`. If not updated, all three tests go red. Mitigation: Phase 5 plan includes updating these to `{ counterparty, amount, nonce, memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64) }`.

10. **Reviewer call on non-trade events.** The reviewer has one job — `trade.proposed`. If someone extends the handler to call `review()` on `speak` or `move` actions, REV-04 contract is silently violated. Mitigation: keep `review()` method scoped to its ReviewContext — no ambient call sites. Contract test asserts only one call to `reviewer.review()` per trade_request in the handler.

11. **Allowlist test count hardcoded.** `expect(ALLOWLIST.size).toBe(10)` at two sites in `broadcast-allowlist.test.ts` — the Phase 5 plan must update both to `11`. Forgetting is an instant red.

12. **Phase 7 coupling: telosHash structural-only now, semantic later.** If Phase 5 accidentally introduces any registry-lookup or history-comparison in the telos hash check, Phase 7's TelosRegistry work is complicated. Mitigation: check handler is literally `/^[a-f0-9]{64}$/.test(telosHash)`. Zero external data access.

---

## Code Examples

### Reviewer class skeleton (from CONTEXT.md `<specifics>`, verified against this research)

```ts
// grid/src/review/Reviewer.ts
// Source: adapted from grid/src/audit/chain.ts class pattern
import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import { CHECKS, CHECK_ORDER } from './registry.js';
import type { ReviewContext, ReviewResult, ReviewCheckName } from './types.js';

export class Reviewer {
    static readonly DID = 'did:noesis:reviewer';
    private static constructed = false;

    constructor(
        private readonly audit: AuditChain,
        private readonly registry: NousRegistry,
    ) {
        if (Reviewer.constructed) {
            throw new Error('ReviewerNous is a singleton — already constructed for this Grid');
        }
        Reviewer.constructed = true;
    }

    /** First-fail-wins invariant review of a trade proposal. */
    review(ctx: ReviewContext): ReviewResult {
        for (const name of CHECK_ORDER) {
            const check = CHECKS.get(name);
            if (!check) throw new Error(`missing check handler: ${name}`);
            const result = check(ctx);
            if (!result.ok) {
                return {
                    verdict: 'fail',
                    failed_check: name as ReviewCheckName,
                    failure_reason: result.code,
                };
            }
        }
        return { verdict: 'pass' };
    }

    /** @internal TEST-ONLY — not exported from index.ts */
    static resetForTesting(): void {
        Reviewer.constructed = false;
    }
}
```

### Check handler — balance (one of five)

```ts
// grid/src/review/checks/balance.ts
// Source: mirror pattern from registerListener in grid/src/audit/chain.ts:76-79
import { registerCheck } from '../registry.js';

registerCheck('insufficient_balance', (ctx) => {
    return ctx.proposerBalance >= ctx.amount
        ? { ok: true }
        : { ok: false, code: 'insufficient_balance' };
});
```

### Check handler — telos_hash (structural only)

```ts
// grid/src/review/checks/telos-hash.ts
import { registerCheck } from '../registry.js';

const SHA256_HEX = /^[a-f0-9]{64}$/;

registerCheck('malformed_telos_hash', (ctx) => {
    return SHA256_HEX.test(ctx.telosHash)
        ? { ok: true }
        : { ok: false, code: 'malformed_telos_hash' };
});
```

### Handler rewrite diff insertion point

```ts
// grid/src/integration/nous-runner.ts — replaces lines 117-164
// Source: extended from existing handler pattern
case 'trade_request': {
    // ... metadata parse (as RQ2) ...

    this.audit.append('trade.proposed', this.nousDid, {
        counterparty, amount, nonce, memoryRefs, telosHash,
    });

    const proposer = this.registry.get(this.nousDid);
    const verdict = this.reviewer.review({
        proposerDid: this.nousDid,
        proposerBalance: proposer?.ousia ?? 0,
        counterparty, amount, memoryRefs, telosHash,
    });

    this.audit.append('trade.reviewed', Reviewer.DID, {
        trade_id: nonce,
        reviewer_did: Reviewer.DID,
        verdict: verdict.verdict,
        ...(verdict.verdict === 'fail' ? {
            failed_check: verdict.failed_check,
            failure_reason: verdict.failure_reason,
        } : {}),
    });

    if (verdict.verdict === 'fail') break;

    // Existing bounds + transferOusia + trade.settled emit — unchanged
    // ...
}
```

---

## State of the Art

| Old Approach (v2.0) | Current Approach (Phase 5) | When Changed | Impact |
|---------------------|---------------------------|--------------|--------|
| Trade request → (no propose) → transferOusia → trade.settled | Trade request → trade.proposed → trade.reviewed → transferOusia → trade.settled | Phase 5 | +2 audit events per successful trade; +1 for failed trade |
| Balance check only in `transferOusia` | Balance check in Reviewer **plus** defensive copy in transferOusia | Phase 5 | Balance-failure path emits trade.reviewed{fail} instead of trade.rejected{insufficient} |
| `trade.proposed` allowlisted but not emitted | First producer in nous-runner.ts | Phase 5 | v2.0 "phantom allowlist slot" now lit |
| Trade payload `{counterparty, amount, nonce}` | `{counterparty, amount, nonce, memoryRefs, telosHash}` on `trade.proposed` only; trade.settled retains the 3-key shape | Phase 5 | New schema surface on BrainAction.metadata |

**Deprecated/outdated (in docs, not code):**
- STATE.md's "11 events with trade.countered" — phantom, corrected in D-11.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.0 |
| Config file | none — defaults, per `grid/package.json:9` (`vitest run`) |
| Quick run command | `cd grid && npm test -- test/review` |
| Full suite command | `cd grid && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REV-01 | Balance ≥ amount check fires | unit | `cd grid && npx vitest run test/review/reviewer.test.ts -t "balance"` | ❌ Wave 0 |
| REV-01 | Counterparty DID regex check | unit | `cd grid && npx vitest run test/review/reviewer.test.ts -t "counterparty"` | ❌ Wave 0 |
| REV-01 | Amount positive-non-zero check | unit | `cd grid && npx vitest run test/review/reviewer.test.ts -t "amount"` | ❌ Wave 0 |
| REV-01 | memoryRefs structural check | unit | `cd grid && npx vitest run test/review/reviewer.test.ts -t "memoryRefs"` | ❌ Wave 0 |
| REV-01 | telosHash structural check | unit | `cd grid && npx vitest run test/review/reviewer.test.ts -t "telosHash"` | ❌ Wave 0 |
| REV-02 | `trade.reviewed` in allowlist | unit | `cd grid && npx vitest run test/broadcast-allowlist.test.ts -t "trade.reviewed"` | ⚠️ exists, needs extension |
| REV-02 | 3-event flow on pass; 2-event on fail | integration | `cd grid && npx vitest run test/integration/trade-review.test.ts` | ❌ Wave 0 |
| REV-02 | Closed enum — no free-form `failure_reason` | contract | `cd grid && npx vitest run test/review/contract.test.ts -t "enum"` | ❌ Wave 0 |
| REV-03 | Singleton throws on 2nd construction | unit | `cd grid && npx vitest run test/review/reviewer-singleton.test.ts` | ❌ Wave 0 |
| REV-04 | Subjective-keyword lint | contract | `cd grid && npx vitest run test/review/contract.test.ts -t "subjective"` | ❌ Wave 0 |
| D-12 | payload privacy regression | unit | `cd grid && npx vitest run test/review/payload-privacy.test.ts` | ❌ Wave 0 |
| D-13 | Zero-diff 100-tick invariant | integration | `cd grid && npx vitest run test/review/determinism.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run test/review` (5 files, <1s)
- **Per wave merge:** `cd grid && npm test` (full suite — currently 346 tests, expected ~380 after Phase 5)
- **Phase gate:** Full suite green + `brain` green (`cd brain && pytest`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/review/reviewer.test.ts` — covers REV-01 #1..#5
- [ ] `grid/test/review/reviewer-singleton.test.ts` — covers REV-03
- [ ] `grid/test/review/contract.test.ts` — covers REV-02 enum + REV-04 subjective-lint
- [ ] `grid/test/review/payload-privacy.test.ts` — covers D-12
- [ ] `grid/test/review/determinism.test.ts` — covers D-13
- [ ] `grid/test/integration/trade-review.test.ts` — covers REV-02 end-to-end 3-event flow
- [ ] `grid/test/broadcast-allowlist.test.ts` — extend existing (REV-02 allowlist membership)
- [ ] `grid/test/integration/trade-settlement.test.ts` — update 3 fixtures with `memoryRefs` + `telosHash`
- [ ] Framework install: none (Vitest already present)

*Shared fixtures — build a `grid/test/review/fixtures.ts` helper that constructs a `ReviewContext` with overrides, and a `grid/test/setup.ts` that calls `Reviewer.resetForTesting()` in `beforeEach` globally.*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | DIDs and public keys are v2.0 concerns; Phase 5 does not authenticate |
| V3 Session Management | no | No sessions |
| V4 Access Control | partial | Reviewer acts as an authorization gate on trade settlement; singleton is the sole authority (REV-03 enforces no opt-in veto-DoS) |
| V5 Input Validation | yes | All 5 reviewer checks are input validation — DID regex, integer bounds, array shape, hex format, balance sufficiency |
| V6 Cryptography | yes | `createHash('sha256')` in AuditChain reused; telosHash computed with hashlib.sha256 in brain — **never hand-roll** |

### Known Threat Patterns for Phase 5

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious proposer injects forbidden key via action.metadata | Information Disclosure | `payloadPrivacyCheck` at emit producer (existing) + explicit key allowlist in emit payload (new in RQ2 handler) |
| Tampered telosHash (attacker-controlled) | Tampering | Phase 5: format-only validation. Phase 7 TelosRegistry adds semantic match — **known gap flagged in D-05** |
| Race in tick handler causing reviewer skip | Repudiation | Reviewer is synchronous inside single-threaded JS event loop → no race possible. D-02 synchronous-gate invariant |
| Subjective-judgment check smuggled via PR | Spoofing of invariant | REV-04 contract test blocks in CI (D-10) |
| Second reviewer silently registered → veto-DoS | Denial of Service | D-07 singleton flag throws at boot (fail-fast) |
| Forbidden key in trade_request.metadata reaching payload | Information Disclosure | D-12 regression test + emit-site payload whitelisting |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 5 is the first producer of `trade.proposed` system-wide | Summary, RQ2 | None practical — ripgrep confirms zero current producers |
| A2 | Brain's Memory.id stays `int` for Phase 5 (no schema migration) | RQ3 | If brain migrates memory schema in Phase 5, Option A regex changes |
| A3 | `createGridApp` in `grid/src/main.ts` is the correct singleton construction site | RQ6 | Bootstrap might end up elsewhere if GridCoordinator wiring shifts; low risk |
| A4 | Existing `grid/test/integration/trade-settlement.test.ts` fixtures are the only trade-metadata fixtures | RQ10 (Wave 0 Gaps) | A hidden fixture somewhere else would produce a silent test break |
| A5 | Vitest `vi.useFakeTimers` supports `Date.now()` across async boundaries in the 100-tick simulation | RQ5 | If promise microtasks leak out of faked time, the determinism test becomes flaky — mitigation: `await flushPromises()` pattern with `vi.runAllTimersAsync()` |
| A6 | D-05 memoryRefs regex is discretion, not locked — planner can change to `/^mem:\d+$/` | RQ3 | CONTEXT.md called it "Claude's Discretion" — confirmed OK to adjust |
| A7 | No Phase 5 change to protocol package's type generation | RQ3 | If `@noesis/protocol` carries the action shape too, needs mirroring — ripgrep shows the Grid has a local copy in `integration/types.ts` to avoid the dep, so protocol is out-of-scope |

---

## Open Questions

1. **Where does the `NousRunner` construction actually happen?**
   - What we know: `main.ts:113` hardcodes `getRunner: () => undefined`, meaning v2.0 shipped without runners wired to the coordinator. Brain-bridge wiring is in `@noesis/protocol` but the call site that builds `NousRunner` per Nous is TBD.
   - What's unclear: which phase lights it up? Does Phase 5 need to wire the coordinator too, or is this a separate plan?
   - Recommendation: Phase 5 plan should explicitly scope "runner construction" out, and ship `Reviewer` as a dependency that's ready for whenever the coordinator lights up. Add a TODO comment at the current `getRunner: () => undefined` site pointing to `reviewer` as the new required injection.

2. **Does `@noesis/protocol` need to mirror the TradeRequestAction schema?**
   - What we know: `grid/src/integration/types.ts:2-5` says "Deliberately NOT imported from @noesis/protocol so the integration layer has no build-time dependency." So Grid has its own copy.
   - What's unclear: whether the brain-side or protocol-side Python action shape needs a separate update beyond the metadata dict convention.
   - Recommendation: ripgrep the `protocol/` folder during planning; if it has an action-shape schema, update it too. If not, dataclass + convention is enough.

3. **Should the `trade.settled` payload also gain `memoryRefs` / `telosHash`?**
   - What we know: D-05 says the fields live in `trade.proposed`. `trade.settled` payload is unchanged (3 keys: counterparty, amount, nonce).
   - What's unclear: whether a downstream consumer (future dashboard trade explorer) would want to correlate the Telos that motivated the settled trade.
   - Recommendation: NO. The proposed event carries them; settled is an outcome, not a re-statement. Privacy minimization wins.

4. **Is the memory-ID regex finalized as `/^mem:\d+$/`?**
   - What we know: D-05 proposed `/^mem:[a-z0-9\-]+$/i` which doesn't match brain reality (int IDs).
   - What's unclear: whether to keep the `\-` allowance for future UUID-style IDs.
   - Recommendation: Use `/^mem:\d+$/` now; Phase 7+ can widen if brain migrates IDs. Future-widening a regex is cheap.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 5 | Planner Action |
|-----------|-------------------|----------------|
| Documentation Sync Rule — update PROJECT.md, ROADMAP.md, STATE.md, MILESTONES.md in same turn as code | YES | Every Phase 5 plan ends with a docs-sync task; STATE.md allowlist count goes 10 → 11; PROJECT.md validated REQs gains REV-01..04 at ship; ROADMAP marks Phase 5 complete. |
| Broadcast allowlist FROZEN except via explicit per-phase additions | YES | Phase 5's single allowlist addition is `trade.reviewed`. No other events added. |
| Every new `trade.*` audit event requires explicit allowlist addition in the phase that introduces it | YES | `trade.reviewed` added in Phase 5; `trade.proposed` was already allowlisted in v2.0 (Phase 5 just lights up its producer). |
| Phase numbering continues across milestones | YES | Phase 5 is the v2.1 opener. Subsequent phases are 6, 7, 8. |
| Research citations flow into PHILOSOPHY if worldview-level | PARTIAL | REV-04 "AI is unreliable on subjective judgment" is worldview-level — already in PHILOSOPHY §5 ("Law is not configuration"). No new PHILOSOPHY edit needed. |

---

## Planner's Checklist

Flat, actionable, one line each. Planner should group into 3-4 plans.

### Plan candidate 1 — Types, allowlist, schema extensions (the "wiring surface")
1. Add `'trade.reviewed'` to `ALLOWLIST_MEMBERS` in `grid/src/audit/broadcast-allowlist.ts` between `trade.proposed` and `trade.settled`.
2. Update `grid/test/broadcast-allowlist.test.ts` size assertion `10 → 11` (2 call sites).
3. Add `'trade.reviewed'` to the `it.each` allowed-events table in the same test file.
4. Extend `TradeRequestAction.metadata` in `grid/src/integration/types.ts` with `memoryRefs: string[]` and `telosHash: string`.
5. Create `grid/src/review/types.ts` with `ReviewFailureCode`, `ReviewCheckName`, `ReviewContext`, `ReviewResult`, `Check` types + a `VALID_REVIEW_FAILURE_CODES` readonly Set for runtime validation.
6. Update `.planning/STATE.md` Accumulated Context per D-11 (10 → 11, remove `trade.countered`, add `nous.direct_message`).

### Plan candidate 2 — Reviewer module + 5 checks (the "logic")
7. Create `grid/src/review/Reviewer.ts` (class with `static DID`, `static constructed`, constructor singleton enforcement, `review(ctx)` method, `static resetForTesting()`).
8. Create `grid/src/review/registry.ts` with `CHECKS: Map<ReviewCheckName, Check>`, `CHECK_ORDER: readonly ReviewCheckName[]`, and a `registerCheck(name, handler)` helper.
9. Create 5 check files under `grid/src/review/checks/`: `balance.ts`, `counterparty-did.ts`, `amount.ts`, `memory-refs.ts` (regex `/^mem:\d+$/`), `telos-hash.ts` (regex `/^[a-f0-9]{64}$/`).
10. Create `grid/src/review/index.ts` exporting `Reviewer` and types (NOT `resetForTesting`).
11. Instantiate `Reviewer` in `grid/src/main.ts createGridApp` after `launcher.bootstrap()`; pass into the (future) `NousRunner` construction path; add `reviewer: Reviewer` to `NousRunnerConfig`.
12. Brain-side: update any `TRADE_REQUEST` action producer in `brain/src/noesis_brain/` to emit `memoryRefs` as `[f"mem:{m.id}" for m in refs]` strings and a computed `telosHash` (new `brain/src/noesis_brain/telos/hashing.py` module).

### Plan candidate 3 — Handler rewrite (the "integration")
13. Rewrite `grid/src/integration/nous-runner.ts` trade_request case (lines 117-164) per RQ2: parse new metadata fields; emit `trade.proposed`; call `reviewer.review(ctx)`; emit `trade.reviewed`; break on fail; keep existing bounds + transferOusia + trade.settled on pass.
14. Add defensive comment + `// defensive — reviewer invariants make this unreachable` on the transferOusia fail branches.
15. Update `grid/test/integration/trade-settlement.test.ts` three fixtures to include `memoryRefs` and `telosHash` so existing tests stay green.

### Plan candidate 4 — Tests (the "invariants")
16. Create `grid/test/setup.ts` with a global `beforeEach` that calls `Reviewer.resetForTesting()`; register in Vitest config or import where needed.
17. Create `grid/test/review/reviewer.test.ts` — unit tests for all 5 checks, pass/fail matrix, first-fail-wins assertion.
18. Create `grid/test/review/reviewer-singleton.test.ts` — D-07 throws on 2nd construction, resetForTesting allows re-construction.
19. Create `grid/test/review/contract.test.ts` — REV-04 subjective-keyword grep + enum-coverage + CHECK_ORDER vs CHECKS keys parity.
20. Create `grid/test/review/payload-privacy.test.ts` — D-12 pass + 5 fail payloads all pass `payloadPrivacyCheck`.
21. Create `grid/test/review/determinism.test.ts` — D-13 with `vi.useFakeTimers`, 100-tick dual-sim, field-by-field compare filtering `trade.reviewed`.
22. Create `grid/test/integration/trade-review.test.ts` — end-to-end 3-event flow (pass path + each of 5 fail paths).

### Plan candidate 5 (optional — may fold into Plan 4) — Docs sync
23. PROJECT.md — mark REV-01..REV-04 as validated on ship.
24. MILESTONES.md — append Phase 5 completion entry.
25. ROADMAP.md — mark Phase 5 complete with "Plans: X/X" count.

---

## Sources

### Primary (HIGH confidence)
- `grid/src/audit/broadcast-allowlist.ts` (lines 1-117) — frozen allowlist pattern + FORBIDDEN_KEY_PATTERN
- `grid/src/audit/chain.ts` (lines 1-184) — AuditChain.append + computeHash + zero-diff hash algorithm
- `grid/src/integration/nous-runner.ts` (lines 117-164) — current trade_request handler; Phase 5 rewrite site
- `grid/src/integration/types.ts` (lines 44-54) — TradeRequestAction schema to extend
- `grid/src/registry/registry.ts` (lines 119-143) — transferOusia signature + defensive branches
- `grid/src/logos/engine.ts` (lines 13, 14) — class + Map pattern to mirror
- `grid/src/main.ts` (lines 65-114) — createGridApp construction site for Reviewer
- `grid/src/genesis/launcher.ts` (lines 18-45) — class pattern for dependency ownership
- `grid/src/integration/grid-coordinator.ts` (lines 1-94) — coordinator pattern for runner wiring
- `grid/test/broadcast-allowlist.test.ts` (lines 1-124) — privacy + size-assertion pattern
- `grid/test/genesis/launcher.tick-audit.test.ts` (lines 1-60) — `vi.useFakeTimers` pattern for D-13
- `grid/test/integration/trade-settlement.test.ts` (lines 1-181) — seedEnv helper + fixture pattern
- `grid/package.json` (lines 1-32) — Vitest 2.0 + TS 5.5 stack confirmation
- `brain/src/noesis_brain/rpc/types.py` (lines 87-102) — Action dataclass with metadata dict
- `brain/src/noesis_brain/memory/types.py` (lines 30-53) — Memory.id is int (D-05 regex reconciliation source)
- `brain/src/noesis_brain/telos/types.py` (lines 22-48) — Goal dataclass (no intrinsic hash)
- `.planning/phases/05-reviewernous-objective-only-pre-commit-review/05-CONTEXT.md` — locked decisions D-01..D-13
- `.planning/phases/05-reviewernous-objective-only-pre-commit-review/05-DISCUSSION-LOG.md` — rationale audit trail
- `.planning/research/stanford-peer-agent-patterns.md` §1 — Agentic Reviewer rationale
- `PHILOSOPHY.md` §1, §5 — sovereignty + law/invariant separation
- `CLAUDE.md` — documentation sync rule

### Secondary (MEDIUM confidence)
- Ripgrep of entire repo for `trade.countered` returning zero source matches (only planning docs) — verified D-11 is pure doc drift
- Ripgrep of entire repo for `trade.proposed` returning only allowlist + planning docs — verified "zero current producers" claim

### Tertiary (none — no web sources required for this research)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — grid/package.json directly read
- Architecture: HIGH — all pattern sources read line-by-line from actual files
- Pitfalls: HIGH — each pitfall grounded in a specific file/line reference or verified behavior
- Singleton pattern: MEDIUM — first-of-its-kind in this codebase, so pattern is synthesized from test isolation needs rather than mirrored from existing code
- Determinism test: HIGH — `vi.useFakeTimers` precedent exists; the D-13 construction follows from known AuditChain hash semantics
- Memory ID format: HIGH — brain Memory.id verified as int; the proposed D-05 regex was verified impossible to match brain reality

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — Phase 5 codebase is stable v2.0-shipped; key files unchanged since 2026-04-18)

---

## RESEARCH COMPLETE
