# Phase 5 Discussion Log — ReviewerNous (Objective-Only Pre-Commit Review)

**Session date:** 2026-04-20
**Workflow:** `/gsd-discuss-phase 5 --auto`
**Outcome:** 13 decisions locked (D-01…D-13) in `05-CONTEXT.md`

This log is the audit trail for how each decision was reached. Discussion began interactively; after partial progress the user sent `--auto` / "do auto confirm" — remaining gray areas were resolved using the recommended option and logged inline.

---

## Gray areas presented

The discuss-phase scout identified four gray areas that prior docs (REQUIREMENTS.md, ROADMAP.md, STATE.md) did not fully lock:

| # | Area | Why it was gray |
|---|------|-----------------|
| 1 | Review flow & `trade.proposed` emission — who emits it, when, and how `trade.reviewed` is correlated | Allowlist has `trade.proposed` but no producer in v2.0 code; REQ says reviewer runs "on" it |
| 2 | Cross-boundary checks — REV-01 checks #4 (memory refs) and #5 (Telos contradiction) need brain-side data | No schema exists for passing these into the Grid; sync RPC back to brain would break determinism |
| 3 | ReviewerNous code placement — new module vs pseudo-Nous in registry | Called out explicitly in STATE.md open questions |
| 4 | Enum reason codes shape & subjective-check lint-gate mechanism (REV-04) | REQ says "closed enum" and "lint/test gate" but does not specify enforcement |
| + | (uncovered during discussion) STATE.md allowlist doc drift vs actual `broadcast-allowlist.ts` | 10 vs 11 vs 12 event count mismatch |

---

## Interactive round — selection

**Q1.** Which gray areas to discuss?
- Options: (a) Review flow, (b) Cross-boundary checks, (c) Placement, (d) Enum + lint gate, (e) all, (f) skip all
- **User chose:** (a) only — "Review flow & trade.proposed emission"
- (b)/(c)/(d) deferred to later in same session or auto-mode

---

## Deep-dive: Review flow (Gray Area 1) → D-01…D-04

**Q2.** Event sequence shape
- Options:
  - [recommended] 3-event flow: `trade.proposed` → `trade.reviewed` → `trade.settled|rejected`
  - 2-event flow: fold `trade.proposed` into `trade.reviewed`, drop from allowlist
  - 4-event flow: add `trade.abort` on reviewer fail
- **User chose:** recommended → **D-01**
- Rationale logged: keeps v2.0 allowlist intact; `trade.proposed` finally gets a real producer; reviewer verdict is a distinct auditable step from settlement.

**Q3.** Reviewer invocation timing
- Options:
  - [recommended] Synchronous gate inside `nous-runner.ts trade_request` handler, between `trade.proposed` emit and `transferOusia` call
  - Post-hoc async (emit settled, reviewer rolls back on fail)
  - Pre-append AuditChain hook (every event passes through reviewer)
- **User chose:** recommended → **D-02**
- Rationale: post-hoc rollback would violate AuditChain append-only invariant (29c3516); pre-append hook expands scope beyond REQ.

**Q4.** Failure reporting shape when multiple checks fail
- Options:
  - [recommended] First-fail-wins — singular `failed_check` + `failure_reason` from closed enum
  - All-fail — array of failed checks
  - First-fail with reason string
- **User chose:** recommended → **D-03**
- Rationale: matches REQ REV-02 payload shape `{failed_check?, failure_reason?}` (both singular optional); closed enum satisfies "never free-form text"; keeps payload size small and private.

**(Implicit from D-01/D-02/D-03):**
**D-04** — nonce doubles as `trade_id`; correlation key on the event chain is `(proposer_did, nonce)` across all 3 events. No new ID generator. Confirmed by v2.0 trade-flow code where nonce is already the replay-prevention primitive.

---

## Deep-dive: Cross-boundary checks (Gray Area 2) → D-05

**Q5.** Where do memory-ref existence (REV-01 #4) and Telos-contradiction (REV-01 #5) get checked?
- Options:
  - [recommended] Brain pre-resolves `memoryRefs: list[str]` and `telosHash: str` into the `trade_request` action payload; reviewer verifies structurally only (shape + presence + hash match against last-known snapshot)
  - Sync RPC from Reviewer → Brain to validate live
  - Defer cross-boundary checks out of Phase 5 (only do structural checks #1–#3)
- **User chose:** recommended → **D-05**
- Rationale: preserves determinism (no sync RPC from Grid to Brain); sovereign-intelligence (PHILOSOPHY §1) — brain self-attests; real semantic validity is brain's job.
- **Watchpoint flagged:** `telosHash` requires Grid-side TelosRegistry. Phase 5 ships structural-only (hash presence + format). Full semantic match against a Grid-held snapshot lands in **Phase 7** (`telos.refined` introduces the registry).

---

## Interactive round — next gray area

**Q6.** Which area next?
- Options: (a) Placement, (b) Enum + lint gate, (c) Allowlist doc drift, (d) stop here
- **User chose:** (a) "Discuss Reviewer code placement next"

---

## Deep-dive: Reviewer code placement (Gray Area 3) → D-06, D-07, D-08

**Q7.** Module layout
- Options:
  - [recommended] `grid/src/review/Reviewer.ts` (new module, parallel to `audit/`, `registry/`, `integration/`)
  - `grid/src/registry/ReviewerNous.ts` as a pseudo-Nous with reserved DID inside NousRegistry
  - Inline inside `grid/src/integration/nous-runner.ts`
- **User chose:** recommended → **D-06**
- Rationale: matches existing separation-of-concerns (AuditChain, LogosEngine each live in their own module); pseudo-Nous approach would force the registry to carry a non-lifecycle actor; inline would couple the reviewer to one caller and defeat the singleton enforcement.

**Q8.** Singleton enforcement mechanism (REV-03 "system singleton per Grid")
- Options:
  - [recommended] `static constructed = false` flag on `Reviewer` class — second construction throws at Grid bootstrap
  - Runtime registry lookup (registry rejects second reviewer registration)
  - Module-level singleton export (`export const reviewer = new Reviewer(...)`)
- **User chose:** recommended → **D-07**
- Rationale: fail-fast at Grid bootstrap rather than silent coexistence; compatible with per-Grid instantiation in test harness (flag reset between tests is explicit and auditable); module-level export would break per-Grid isolation in multi-Grid test setups.

**Q9.** Reviewer DID format
- Options:
  - [recommended] `did:noesis:reviewer` (grid-agnostic, reserved)
  - `did:noesis:reviewer.<grid>` (grid-scoped)
  - `did:noesis:system.reviewer` (namespaced system actor)
- **User chose:** recommended → **D-08**
- Rationale: options 2 and 3 fail the v2.0-locked DID regex `/^did:noesis:[a-z0-9_\-]+$/i` (dot is excluded). Option 1 is compatible with all 3 DID entry points; grid-agnosticism is acceptable because the reviewer is per-Grid via D-07 singleton enforcement, not per-DID uniqueness.

---

## Auto-mode pivot

User sent `--auto` / "do auto confirm" → stop asking, accept recommended options for all remaining gray areas, log choices inline. No further AskUserQuestion calls.

---

## Auto-resolved: Enum shape & REV-04 lint gate → D-09, D-10

**Auto-choice for enum shape:**
- Recommended: TypeScript string-literal union (`ReviewFailureCode = 'balance_insufficient' | 'counterparty_did_invalid' | ...`) exported from `grid/src/review/codes.ts`. 5 initial codes covering REV-01 #1–#5.
- Alternative rejected: `enum` (loses structural typing, breaks closed-set guarantee in payload emission).
- Alternative rejected: string constants with no compile-time constraint (violates "closed enum").
- **Locked as D-09**

**Auto-choice for REV-04 subjective-check lint gate:**
- Recommended: self-registering check registry (`CHECKS: readonly Check[]`) combined with contract test that regex-greps each check handler's source for subjective keywords (`fairness|wisdom|taste|quality|novelty|good|bad|should`). Test fails CI if match found.
- Alternative rejected: runtime-only check name allowlist (fails REQ REV-04 "must fail a lint/test gate" — needs to block before runtime).
- Alternative rejected: static-analysis rule in ESLint (overhead too high for 1 guarded file).
- **Locked as D-10**

---

## Auto-resolved: Allowlist doc drift → D-11

**Discovered during codebase scout:**
- Actual `grid/src/audit/broadcast-allowlist.ts` defines **10 events**: `nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message`, `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`.
- `.planning/STATE.md` Accumulated Context says **11 events** and lists a phantom `trade.countered`, omits `nous.direct_message`.
- This is stale documentation from v1.0→v2.0 transition.

**Auto-choice:**
- The Phase 5 commit that adds `trade.reviewed` also reconciles STATE.md:
  - Remove phantom `trade.countered`
  - Add missing `nous.direct_message`
  - Correct the frozen count from 10 → 11 (after `trade.reviewed` is added)
- **Locked as D-11**

---

## Auto-resolved: Privacy & zero-diff regressions → D-12, D-13

These flow naturally from v2.0 invariants and REQ REV-02; no real gray area, but recorded so the planner sees them.

**D-12 — `trade.reviewed` payload passes `payloadPrivacyCheck`:**
- Payload is `{trade_id, reviewer_did, verdict, failure_reason?, failed_check?}`. None of these fields match `FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i`. Regression test added to `grid/test/audit/broadcast-allowlist.test.ts` to assert this.

**D-13 — Zero-diff invariant (AuditChain commit 29c3516):**
- Regression test: 100-tick simulation with reviewer ON vs BYPASSED produces byte-identical chains except for `trade.reviewed` entries. Proves reviewer does not perturb any other event ordering, payload, or hash.

---

## Decisions summary (locked in 05-CONTEXT.md)

| ID | Decision | Source |
|----|----------|--------|
| D-01 | 3-event flow: proposed → reviewed → settled/rejected | Q2 recommended |
| D-02 | Synchronous reviewer gate inside nous-runner trade_request | Q3 recommended |
| D-03 | First-fail-wins, singular failed_check + failure_reason | Q4 recommended |
| D-04 | nonce doubles as trade_id; correlation key (proposer_did, nonce) | Implicit from D-01/02/03 |
| D-05 | Brain pre-resolves memoryRefs + telosHash into action payload; reviewer verifies structurally | Q5 recommended |
| D-06 | Module placement at grid/src/review/Reviewer.ts | Q7 recommended |
| D-07 | Singleton enforcement via static constructed flag (throws on 2nd construction) | Q8 recommended |
| D-08 | Reviewer DID = `did:noesis:reviewer` (grid-agnostic) | Q9 recommended |
| D-09 | ReviewFailureCode as TypeScript string-literal union with 5 initial codes | Auto (recommended) |
| D-10 | Self-registering check registry + regex-grep contract test | Auto (recommended) |
| D-11 | Phase 5 commit reconciles STATE.md allowlist doc drift | Auto (recommended) |
| D-12 | trade.reviewed payload passes payloadPrivacyCheck regression | Auto (invariant) |
| D-13 | Zero-diff 100-tick reviewer-ON vs BYPASSED regression | Auto (invariant) |

---

## Downstream-agent contract

A researcher / planner reading `05-CONTEXT.md` should be able to proceed without re-asking the user on any of:
- event shape, invocation timing, correlation key
- cross-boundary data flow from brain to reviewer
- module location, class shape, singleton mechanism
- reviewer DID format
- enum mechanism, lint-gate mechanism
- allowlist doc reconciliation
- mandatory regression tests (payload privacy + zero-diff)

**Remaining open per REQ (planner to resolve):**
- Concrete check implementations for REV-01 #1, #2, #3 (structural; no gray area, just code)
- Fixtures for failing-trade test matrix (one per ReviewFailureCode)
- Docs touches (PROJECT.md validated REQs, MILESTONES on ship)

---

*End of discussion log. Next workflow step: commit CONTEXT.md + this log, update STATE.md, auto-advance to `/gsd-plan-phase 5 --auto`.*
