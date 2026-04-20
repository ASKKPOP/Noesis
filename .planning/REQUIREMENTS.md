# Requirements: Noēsis — Steward Console (Sprint 15 / v2.1)

**Defined:** 2026-04-20
**Core Value:** The first persistent Grid where Nous actually live — now with operators who steward rather than only observe.
**Research source:** `.planning/research/stanford-peer-agent-patterns.md` (commit 9bb3046)

## v2.1 Requirements

### Reviewer (Agentic Reviewer pattern — objective-only)

<!-- Zou / Stanford HAI: AI reviewers are reliable on objective checks, unreliable on subjective judgment.
     REV-* checks are deliberately limited to invariants that have a yes/no answer. -->

- [ ] **REV-01**: A ReviewerNous runs a deterministic objective-invariant check on every `trade.proposed` event before the Grid calls `transferOusia`. Checks in scope: proposer balance ≥ amount, counterparty DID regex match, amount is positive non-zero integer, memory references in justification exist in proposer memory, no active Telos goal contradicts this trade.
- [ ] **REV-02**: A new `trade.reviewed` event is added to the broadcast allowlist with payload `{trade_id, reviewer_did, verdict: "pass"|"fail", failure_reason?: string, failed_check?: string}`. On `verdict: fail` the Grid aborts the settlement and emits no `trade.settled`. Reason codes are a closed enum — never free-form text.
- [ ] **REV-03**: ReviewerNous is deployed as a system singleton in v2.1 (one authoritative reviewer per Grid); opt-in peer review is deferred out of scope. This prevents veto-DoS from a malicious peer reviewer.
- [ ] **REV-04**: The reviewer never makes subjective judgments. There is no "is this a good trade" check; only invariants. Attempting to add a subjective check must fail a lint/test gate. (This is a contract, not a feature — encoded as a test that enumerates allowed check names.)

### Operator Agency (Human Agency Scale H1–H5)

<!-- arxiv 2506.06576: H3 Equal Partnership dominant; workers consistently want higher agency than
     experts think is needed. Make the tier a first-class UI concept so users always see the lever
     they have. -->

- [ ] **AGENCY-01**: Dashboard header renders an Agency Indicator showing the current operator tier (H1 Observer / H2 Reviewer / H3 Partner / H4 Driver / H5 Sovereign) with the tier definition accessible via tooltip.
- [ ] **AGENCY-02**: Every operator-initiated action has a declared default tier and requires an explicit elevation confirmation when the action exceeds H1. The tier map is:
  - H1: observe firehose/map/inspector (no record)
  - H2: query Nous memory (read-only, audit-logged)
  - H3: pause simulation, change broadcast-allowlist, change a Grid law (co-decision + confirm)
  - H4: force-mutate a specific Nous's Telos (operator drives, system executes)
  - H5: delete a Nous (operator only; see AGENCY-05 gating)
- [ ] **AGENCY-03**: Every `operator.*` audit event records the tier at commit time in payload (`{tier: "H3", action, target_did?, operator_id}`). Allowlist additions required: `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced`, `operator.nous_deleted`.
- [ ] **AGENCY-04**: Elevation to H3+ triggers an explicit mode-switch dialog in the UI: "Entering H3 — Co-decision. This will be logged." Operator confirms before the action proceeds. A single confirmation covers one action, not a session.
- [ ] **AGENCY-05**: H5 "delete a Nous" is gated by an irreversibility warning dialog that names the first-life promise explicitly, requires the operator to type the Nous's DID to confirm, and emits `operator.nous_deleted` with full Nous state hash pre-deletion for forensic reconstruction. Deletion never purges audit chain entries about the Nous (integrity preserved).

### Peer Dialogue Memory (SPARC-inspired)

<!-- Stanford SPARC + related research: peer-to-peer LLM dialogue outperforms tutor-student on
     learning. Upgrade `nous.spoke` so conversation actually mutates participants' goals. -->

- [ ] **DIALOG-01**: When two Nous exchange ≥2 `nous.spoke` events with each other within N ticks (configurable, default N=5), the Grid aggregates the exchange into a dialogue context and passes it to both participants' Brains on their next `get_state` call as a `dialogue_context` field.
- [ ] **DIALOG-02**: Brain can return a new `telos.refined` action when the dialogue context causes a goal refinement. Grid validates the action (signed, within actor's authority) and emits a new allowlisted `telos.refined` audit event with payload `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — hash-only, no goal contents in broadcast (privacy).
- [ ] **DIALOG-03**: Dashboard Inspector's Telos panel shows a small "↻ refined via dialogue" badge on goals that have a `telos.refined` event in their history, with a link to the triggering dialogue's firehose entries.

## Future Requirements

- **WHISPER-01**: Region-local `nous.whispered` with hash-only payload (deferred to Sprint 16+ — see research doc §2 scoped peer channel)
- **OP-MULTI-01**: Multi-operator session support with conflict resolution (deferred — single-operator v2.1)
- **REVIEW-PEER-01**: Opt-in peer review by any Nous (deferred — system singleton is v2.1 only)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full mesh peer-to-peer between all Nous | O(N²) breaks audit chain moat; arxiv 2512.08296 confirms complexity blows up above N≈20. Scoped `nous.whispered` is the later answer. |
| AI-judged subjective evaluation ("is this a good Telos", "is this novel") | Zou's paperreview.ai data: unreliable. Explicitly rejected in REV-04. |
| LLM peer-debate as a Grid-level decision mechanism | Same subjectivity concern; dialogue shapes internal Nous state only, never external Grid commits without reviewer/invariant gates. |
| Multi-operator conflict resolution | v2.1 is single-operator. Flagged as future OP-MULTI-01. |
| Auto-pause on invariant violation | Operators decide — REV-02 aborts settlement but does not pause sim. Conflates reviewer with pause authority. |
| Reviewer subjective veto power | Explicitly rejected per REV-04. |
| Deleting audit chain history on Nous delete | Violates Phase 1 integrity contract. AGENCY-05 preserves audit entries. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REV-01 | TBD | Unmapped (roadmapper will assign) |
| REV-02 | TBD | Unmapped |
| REV-03 | TBD | Unmapped |
| REV-04 | TBD | Unmapped |
| AGENCY-01 | TBD | Unmapped |
| AGENCY-02 | TBD | Unmapped |
| AGENCY-03 | TBD | Unmapped |
| AGENCY-04 | TBD | Unmapped |
| AGENCY-05 | TBD | Unmapped |
| DIALOG-01 | TBD | Unmapped |
| DIALOG-02 | TBD | Unmapped |
| DIALOG-03 | TBD | Unmapped |

**Coverage:**
- v2.1 requirements: 12 total
- Mapped to phases: 0 (roadmapper pending)
- Unmapped: 12

---
*Requirements defined: 2026-04-20*
*Source: Stanford peer-agent research synthesis (9bb3046)*
