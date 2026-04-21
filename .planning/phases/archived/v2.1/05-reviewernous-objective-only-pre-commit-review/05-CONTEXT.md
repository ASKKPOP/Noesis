# Phase 5: ReviewerNous — Objective-Only Pre-Commit Review - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Every `trade.proposed` event passes through a deterministic, objective-invariant review before the Grid calls `transferOusia`, and review outcomes are observable in the audit chain via a new allowlisted `trade.reviewed` event. v2.1 ships a system singleton ReviewerNous per Grid — no opt-in peer review, no subjective judgment, no veto DoS.

**In scope:**
- New module `grid/src/review/Reviewer.ts` + types
- New allowlist member `trade.reviewed` (adds to frozen set)
- Rewrite `nous-runner.ts` `trade_request` handler to emit 3 audit events (propose → review → settle) with synchronous reviewer gating
- New check registry with 5 objective handlers (REV-01)
- Contract test enumerating allowed check names + subjective-keyword lint (REV-04)
- Brain-side schema extension: `BrainAction.trade_request` gains `memoryRefs: string[]` and `telosHash: string` (pre-resolved on brain before action crosses the Unix socket)
- STATE.md allowlist doc-drift reconciliation (11 events after this phase; phantom `trade.countered` removed)

**Explicitly out of scope:**
- Opt-in peer review (deferred — `REVIEW-PEER-01`)
- Subjective checks of any kind (permanently rejected — REV-04)
- Grid-side `TelosRegistry` tracking latest-seen Telos hash per DID (Phase 7 concern — see D-05 Phase 7 watchpoint)
- Sync RPC from reviewer to brain during review (violates tick-determinism)
- Dashboard UI surfacing of `trade.reviewed` (dashboard work is Phase 6+)
- Auto-pause on invariant violation (operators decide per REQUIREMENTS.md Out of Scope)

</domain>

<decisions>
## Implementation Decisions

### Event Flow & Audit Chain Shape

- **D-01:** 3-event flow — `trade.proposed` (actor: proposer DID) → `trade.reviewed` (actor: reviewer DID) → `trade.settled` (actor: proposer DID, on pass only). On `verdict: fail`, no `trade.settled` is emitted for that trade.
- **D-02:** Synchronous reviewer call inside `nous-runner.ts` `trade_request` handler. Reviewer is injected at `NousRunner` construction as a dependency. No new `AuditChain` seam (zero-diff invariant preserved). No listener-based review (would break settle-in-same-handler atomicity).
- **D-03:** First-fail-wins on check results. `trade.reviewed` fail payload: `{trade_id, reviewer_did, verdict: 'fail', failure_reason: ReviewFailureCode, failed_check: ReviewCheckName}`. Pass payload: `{trade_id, reviewer_did, verdict: 'pass'}`.
- **D-04:** `nonce` doubles as `trade_id`. No new field. Correlation key across all three events is `(proposer_did, nonce)`. Matches the v2.0-locked TradeRecord contract — nonce is already globally unique per proposer.

### Cross-Boundary Data (Grid ↔ Brain)

- **D-05:** Brain pre-resolves cross-boundary data and carries it in the `trade_request` action payload before the action reaches Grid. Schema extension:
  ```python
  # brain/.../actions.py (conceptual)
  class TradeRequestAction:
      counterparty: str       # DID
      amount: int             # positive integer Ousia
      nonce: str              # globally unique per proposer
      memoryRefs: list[str]   # NEW — pre-resolved memory IDs that justify this trade
      telosHash: str          # NEW — 64-hex sha256 of the proposer's currently active Telos
  ```
  Reviewer verifies **structurally** (deterministic, tick-aligned, no RPC):
  - `memoryRefs`: non-empty, each is a well-formed memory-ID string matching `/^mem:[a-z0-9\-]+$/i` (brain-side format — planner to confirm regex)
  - `telosHash`: 64-hex string, non-empty, brain self-attests
  - The actual "memory exists" and "Telos doesn't contradict" semantic checks live in brain (sovereign per PHILOSOPHY §1); the reviewer's job is "brain did attest."
- **D-05 Phase 7 watchpoint:** When `telos.refined` ships in Phase 7 with hash-only payload, Grid can build a `TelosRegistry` from the emitted hashes and tighten the reviewer's `telosHash` check to "matches latest-seen hash for proposerDid." **Phase 5 does NOT introduce TelosRegistry** — it ships the structural-only check and the Phase 7 plan must wire the upgrade explicitly.

### Reviewer Code Placement & Deployment

- **D-06:** Module-style placement at `grid/src/review/Reviewer.ts`. NOT in `NousRegistry`. Reviewer is a class registered at Grid bootstrap (from `grid/src/main.ts` or genesis launcher) and injected into `NousRunner` construction. Mirrors current `LogosEngine` placement pattern.
- **D-07:** Singleton enforcement at Grid bootstrap — `Reviewer` constructor (or a `Reviewer.create()` factory) throws if a prior instance exists on the Grid handle. Second construction fails fast at startup with a clear error, not at runtime. No runtime "first trade.proposed" enforcement.
- **D-08:** Reviewer DID = `did:noesis:reviewer` (grid-agnostic, stable across Grids). Passes the v2.0-locked DID regex `/^did:noesis:[a-z0-9_\-]+$/i` cleanly. Used as `actorDid` on every emitted `trade.reviewed` event. Rejected: grid-scoped `did:noesis:reviewer.<grid>` (dot fails regex — widening Phase 1 invariant is a non-starter).

### Reason-Code Enum & Subjective-Check Lint Gate

- **D-09:** REV-02 closed enum encoded as TypeScript string-literal union in `grid/src/review/types.ts`:
  ```ts
  export type ReviewFailureCode =
    | 'insufficient_balance'
    | 'invalid_counterparty_did'
    | 'non_positive_amount'
    | 'malformed_memory_refs'
    | 'malformed_telos_hash';

  export type ReviewCheckName = keyof typeof CHECKS;
  ```
  The union is the contract — free-form text cannot satisfy the type. Initial set is 5 codes (1:1 with the 5 structural checks). Adding a new code requires a typescript compile-time edit + contract-test update.
- **D-10:** REV-04 lint gate as **self-registering check registry**. Each check declares its name and handler at module load:
  ```ts
  // grid/src/review/checks/insufficient-balance.ts
  registerCheck('insufficient_balance', (ctx) => {
    return ctx.proposerBalance >= ctx.amount
      ? { ok: true }
      : { ok: false, code: 'insufficient_balance' };
  });
  ```
  Contract test (`grid/test/review/contract.test.ts`) does:
  1. Import the registry; assert every registered name is a member of `ReviewFailureCode` (type-level + runtime).
  2. For each registered check, read its source file (via `fs.readFileSync`); assert NO match for `/fairness|wisdom|taste|quality|novelty/i` (case-insensitive).
  3. Assert the registry size matches the union's member count (no ghost checks, no missing codes).
  Anonymous handlers cannot register (no file path → test fails). Subjective keywords in a handler → test fails red.

### Singleton + Privacy Invariants

- **D-11:** Phase 5 commit that adds `trade.reviewed` to `grid/src/audit/broadcast-allowlist.ts` also reconciles `.planning/STATE.md`:
  - Correct allowlist count: v2.0 code shipped with **10 events** (`nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message`, `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`). Phase 5 adds `trade.reviewed` → **11 events**.
  - Remove the phantom `trade.countered` reference (never emitted, never in code file). If the full handshake ships later, it earns its allowlist slot in its own phase.
  - Add `nous.direct_message` to the STATE.md enumeration (currently missing).
- **D-12:** `trade.reviewed` payload passes `payloadPrivacyCheck()` — the `ReviewFailureCode` enum values contain no forbidden keywords (`prompt|response|wiki|reflection|thought|emotion_delta`). Add a regression test.
- **D-13:** Zero-diff invariant regression test (SC #5): a 100-tick deterministic simulation with reviewer enabled produces byte-identical chain hashes to the same simulation with reviewer **bypassed** *except* for the injected `trade.reviewed` entries. Test compares hashes entry-by-entry with the reviewer path filtered out.

### Claude's Discretion

- Exact directory layout under `grid/src/review/` (flat vs `checks/` subdir for per-handler files) — planner can decide.
- Whether `registerCheck()` is exported from `Reviewer.ts` or a separate `registry.ts` (style decision).
- Fixture layout for the contract test (inline vs external JSON).
- Whether the memory-ID regex in D-05 lands as `/^mem:[a-z0-9\-]+$/i` or another brain-compatible format — planner to reconcile with brain's existing memory store naming.
- Bootstrap location for Reviewer instantiation — `grid/src/main.ts`, `grid/src/genesis/launcher.ts`, or a new `grid/src/review/bootstrap.ts`. Pick whichever matches LogosEngine's current wiring.

### Folded Todos

*None — no matching todos in the backlog.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (milestone-level)
- `.planning/research/stanford-peer-agent-patterns.md` §1 (Agentic Reviewer, Zou/Stanford HAI — objective-only recommendation)
- `.planning/research/stanford-peer-agent-patterns.md` §4 (REV-04 rationale — AI subjective judgment unreliable)

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — REV-01 (objective checks), REV-02 (trade.reviewed allowlist + closed enum), REV-03 (singleton + no veto-DoS), REV-04 (subjective-check lint gate)
- `.planning/ROADMAP.md` §"Phase 5" — 5 success criteria including zero-diff invariant regression

### Existing code patterns (MUST match)
- `grid/src/audit/broadcast-allowlist.ts` — frozen set pattern; Phase 5 adds `trade.reviewed`
- `grid/src/audit/chain.ts` — `AuditChain.append()` signature; no new seam introduced
- `grid/src/integration/nous-runner.ts` lines 117–164 — current `trade_request` handler; Phase 5 rewrites this site to emit 3 events
- `grid/src/logos/engine.ts` — LogosEngine placement pattern that Reviewer mirrors (module-style, bootstrap-injected)
- `grid/src/registry/registry.ts` line 119 — `transferOusia()` signature that the post-review branch calls
- `brain/noesis_brain/actions.py` (or equivalent) — `trade_request` action schema to extend with `memoryRefs` + `telosHash`

### Project philosophy (sovereignty invariants)
- `PHILOSOPHY.md` §1 (sovereign intelligence — brain self-attests, reviewer does not reach into brain)
- `PHILOSOPHY.md` §4 (sovereign memory — memory refs carried as IDs only, never content)
- `PHILOSOPHY.md` §5 (law is not configuration — Logos handles subjective judgment via voting; reviewer handles objective invariants; clean separation)

### v2.0 frozen contracts (MUST preserve)
- `.planning/phases/archived/v2.0/01-auditchain-listener-api-broadcast-allowlist/01-CONTEXT.md` — zero-diff invariant + allowlist policy
- `.planning/phases/archived/v2.0/04-nous-inspector-economy-docker-polish/04-CONTEXT.md` §D8/D9 — privacy-first trade payload shape `{counterparty, amount, nonce}`
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at 3 entry points — Phase 1 invariant; NOT to be widened in Phase 5

### CLAUDE.md doc-sync rule
- `CLAUDE.md` — when STATE.md drift is reconciled in D-11, README/MILESTONES/PROJECT also get a cursory check for staleness

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuditChain.append()` — no modification needed; Phase 5 just adds 2 new call sites for `trade.proposed` and `trade.reviewed`
- `broadcast-allowlist.ts` `buildFrozenAllowlist()` — extend `ALLOWLIST_MEMBERS` tuple with `'trade.reviewed'`; frozen-set invariant protects against runtime mutation
- `payloadPrivacyCheck()` — reuse directly on `trade.reviewed` payload in a regression test
- `EconomyManager.validateTransfer()` — already used by current handler; stays in post-review branch
- `NousRegistry.transferOusia()` (line 119) — called after review pass, unchanged
- LogosEngine wiring pattern — mirror for Reviewer bootstrap

### Established Patterns
- **Privacy at producer boundary** — `nous-runner.ts` sanitizes payloads before `audit.append`. Reviewer follows the same discipline: no subjective strings leak into `trade.reviewed` by the type system alone (D-09).
- **Closed-enum error reasons** — existing `trade.rejected` emits `{reason: 'malformed_metadata' | 'bounds' | ...}` from a fixed set. ReviewFailureCode extends this pattern for the new event.
- **Injection via constructor** — `NousRunner` already takes `audit`, `registry`, `economy`, `bridge` as deps. Add `reviewer` to the list.

### Integration Points
- `nous-runner.ts` `trade_request` case (lines 117–164) is the single modification site for the handler rewrite
- `grid/src/main.ts` or `grid/src/genesis/launcher.ts` — one-line `new Reviewer()` at bootstrap, passed into NousRunner construction
- `grid/src/audit/broadcast-allowlist.ts` — one-line allowlist addition
- Brain-side `actions.py` (or TypeScript stub on Grid side that mirrors the schema) — two new fields on trade_request action
- `grid/test/` — new `grid/test/review/` subtree for reviewer unit + contract tests

</code_context>

<specifics>
## Specific Ideas

- **Reviewer class sketch:**
  ```ts
  // grid/src/review/Reviewer.ts
  export class Reviewer {
    static readonly DID = 'did:noesis:reviewer';
    private static constructed = false;

    constructor(private readonly audit: AuditChain, private readonly registry: NousRegistry) {
      if (Reviewer.constructed) {
        throw new Error('ReviewerNous is a singleton — already constructed for this Grid');
      }
      Reviewer.constructed = true;
    }

    review(ctx: ReviewContext): ReviewResult {
      for (const [name, check] of CHECKS.entries()) {
        const result = check(ctx);
        if (!result.ok) return { verdict: 'fail', failed_check: name, failure_reason: result.code };
      }
      return { verdict: 'pass' };
    }
  }
  ```
- **Handler rewrite shape (nous-runner.ts trade_request case):**
  ```ts
  // Emit propose
  this.audit.append('trade.proposed', this.nousDid, { counterparty, amount, nonce, memoryRefs, telosHash });
  // Review synchronously
  const verdict = this.reviewer.review({ proposerDid: this.nousDid, proposerBalance, counterparty, amount, memoryRefs, telosHash });
  this.audit.append('trade.reviewed', Reviewer.DID, { trade_id: nonce, reviewer_did: Reviewer.DID, verdict: verdict.verdict, ...(verdict.verdict === 'fail' ? { failed_check: verdict.failed_check, failure_reason: verdict.failure_reason } : {}) });
  if (verdict.verdict === 'fail') break;  // no transferOusia, no trade.settled
  // Pass path — existing code
  const result = this.registry.transferOusia(...);
  this.audit.append('trade.settled', this.nousDid, { counterparty, amount, nonce });
  ```
- **Contract test skeleton:**
  ```ts
  describe('REV-04 subjective-check lint gate', () => {
    for (const [name, handler] of CHECKS.entries()) {
      it(`${name} has no subjective keywords`, () => {
        const src = readFileSync(handler.sourcePath, 'utf8');
        expect(src).not.toMatch(/fairness|wisdom|taste|quality|novelty/i);
      });
    }
    it('every registered check name is a ReviewFailureCode', () => {
      const validCodes = ['insufficient_balance', 'invalid_counterparty_did', 'non_positive_amount', 'malformed_memory_refs', 'malformed_telos_hash'];
      for (const name of CHECKS.keys()) expect(validCodes).toContain(name);
    });
  });
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Grid-side `TelosRegistry` tracking latest-seen Telos hash per DID** — Phase 7 (when `telos.refined` event ships). Phase 5's reviewer ships structural-only `telosHash` check; Phase 7 plan upgrades to registry-backed contradiction detection.
- **Opt-in peer review by any Nous (REVIEW-PEER-01)** — Already deferred in REQUIREMENTS.md. Would require Reviewer to support multiple instances, veto-DoS mitigation, and a different DID model. v2.1 singleton-only.
- **Full three-phase handshake (`trade.proposed → trade.countered → trade.settled`)** — Deferred since v2.0 Phase 4. Would allowlist `trade.countered` in its own phase.
- **Rich dashboard surfacing of `trade.reviewed` fails** — Dashboard changes belong in Phase 6+ (Operator Agency Foundation wave).
- **Auto-pause on invariant violation** — Explicitly out of scope per REQUIREMENTS.md; operators retain pause authority, reviewer does not.
- **Sync RPC from reviewer to brain** — Rejected during discussion; violates tick-determinism. Not a future candidate.

</deferred>

---

*Phase: 05-reviewernous-objective-only-pre-commit-review*
*Context gathered: 2026-04-20*
*Decisions locked interactively (6 questions across 2 gray areas); remaining 2 gray areas auto-resolved with recommended options.*
