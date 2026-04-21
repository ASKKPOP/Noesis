# Roadmap: Noēsis — v2.1 Steward Console (Sprint 15)

## Overview

Sprint 15 transforms the observational dashboard into a stewarded environment. Three research-derived capabilities ship in sequence: a singleton **ReviewerNous** that runs objective-only invariant checks before trades settle (Agentic Reviewer pattern, Zou/Stanford HAI); a first-class **Human Agency Scale** operator surface (H1–H5) that forces explicit elevation for every non-observational action and stamps the tier into every `operator.*` audit event; and **peer dialogue memory** that lets two-Nous exchanges mutate Telos via a new `telos.refined` action without ever leaking goal contents to the broadcast allowlist.

Phase ordering respects the zero-diff invariant of Phase 1 (commit `29c3516`), preserves the frozen broadcast allowlist except via explicit additions per phase, and isolates the highest-risk operator capability (H5 Nous deletion) into its own terminal phase so the riskier integration work doesn't block earlier wins.

## Milestones

- ✅ **v1.0 Genesis** (shipped 2026-04-17) — Phases 1-10, 944+ TS tests, 226 Py tests
- ✅ **v2.0 First Life Sprints 11-14** (shipped 2026-04-18) — E2E, persistence, Docker, Dashboard v1
- 🚧 **v2.1 Steward Console — Phases 5-8** (in progress, opened 2026-04-20)

## Phases

- [ ] **Phase 5: ReviewerNous — Objective-Only Pre-Commit Review** — Singleton reviewer, `trade.reviewed` allowlist addition, closed-enum reason codes, Grid abort flow, subjective-check lint gate.
- [ ] **Phase 6: Operator Agency Foundation (H1–H4)** — `operator.*` allowlist additions, tier-stamped audit events, Agency Indicator header, elevation confirmation dialog, tier map for inspect / pause / law-change / force-Telos.
- [ ] **Phase 7: Peer Dialogue → Telos Refinement** — Grid dialogue aggregation, Brain `telos.refined` action, hash-only `telos.refined` audit event, Inspector Telos-panel badge.
- [ ] **Phase 8: H5 Sovereign Operations (Nous Deletion)** — Irreversibility warning, DID-typed confirmation, pre-deletion forensic state hash, `operator.nous_deleted` audit event, audit-chain preservation invariant.

## Phase Details

### Phase 5: ReviewerNous — Objective-Only Pre-Commit Review
**Goal**: Every proposed trade passes a deterministic, objective-invariant review before the Grid settles it, and review outcomes are observable in the audit chain.
**Depends on**: v2.0 Phase 4 (frozen broadcast allowlist, `trade.proposed` / `trade.settled` emission, DID regex at 3 entry points)
**Requirements**: REV-01, REV-02, REV-03, REV-04
**Success Criteria** (what must be TRUE):
  1. Every `trade.proposed` event is followed by exactly one `trade.reviewed` event on the same trade_id before any `trade.settled` can be emitted; on `verdict: "fail"` no `trade.settled` is ever emitted for that trade.
  2. The five objective checks from REV-01 (balance ≥ amount, counterparty DID regex, positive-non-zero integer amount, memory-ref existence, no contradicting active Telos) each map to a distinct enum reason code, and `failure_reason` / `failed_check` in the payload is always drawn from that closed enum — never free-form text.
  3. `ReviewerNous` is deployed as exactly one system singleton per Grid at startup; a second reviewer registration attempt fails fast with a clear error. Opt-in peer review is unreachable from the public API surface.
  4. A contract test enumerates the allowed check names; adding a new check requires updating the enum, and the test fails (red) if any check handler references subjective concepts (fairness, wisdom, taste, quality, novelty) by keyword.
  5. AuditChain zero-diff invariant still holds — a 100-tick simulation with review enabled produces byte-identical chain hashes to the same simulation with the reviewer path bypassed *except* for the added `trade.reviewed` entries (i.e., determinism is preserved, the allowlist addition is the only diff).
**Plans**: 5 plans
  - [x] 05-01-PLAN.md — Closed-enum types + 5 objective check handlers + REV-04 subjective-keyword lint gate
  - [x] 05-02-PLAN.md — Reviewer singleton + first-fail-wins loop + public barrel
  - [x] 05-03-PLAN.md — Brain schema extension (memoryRefs + telosHash) + nous-runner 3-event rewrite + main.ts bootstrap wiring
  - [ ] 05-04-PLAN.md — Allowlist addition (`trade.reviewed`) + D-12 privacy regression + D-13 zero-diff invariant regression
  - [ ] 05-05-PLAN.md — STATE.md D-11 reconciliation + `scripts/check-state-doc-sync.mjs` regression gate + ship-time doc sync

### Phase 6: Operator Agency Foundation (H1–H4)
**Goal**: Every operator-initiated action declares a tier, elevates explicitly above H1, and records the tier at commit time; the dashboard makes the current tier unmissable.
**Depends on**: Phase 5 (allowlist-addition mechanism proven; no hard dependency on reviewer logic, but phase order keeps allowlist surgery contained to one phase at a time)
**Requirements**: AGENCY-01, AGENCY-02, AGENCY-03, AGENCY-04
**Success Criteria** (what must be TRUE):
  1. Every page of the dashboard renders a persistent Agency Indicator in the header displaying the current tier (H1 Observer default) with a tooltip containing the H1–H5 definitions; no dashboard route can be entered without the indicator mounted.
  2. Five new `operator.*` events (`operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced`) are in the broadcast allowlist, each carrying `{tier, action, target_did?, operator_id}` in payload; a test fails if any `operator.*` event is emitted without a `tier` field.
  3. Any UI action mapped to H3 or H4 surfaces a mode-switch confirmation dialog before proceeding, the dialog names the destination tier explicitly ("Entering H3 — Co-decision. This will be logged."), and a single confirmation covers one action only (no session-wide persistence).
  4. The tier recorded in each `operator.*` audit event matches the tier the operator was in at confirmation time, not the tier at the moment the HTTP request arrives at the Grid — this is verifiable by forcing a UI elevation-then-downgrade race and asserting the committed tier reflects the user's explicit choice.
  5. All four non-H5 tiers (H1 observe, H2 read memory, H3 pause / allowlist / law-change, H4 force-Telos) have at least one exercised action in the dashboard; H5 surfaces appear disabled with "requires Phase 8" affordance.
**Plans**: TBD (estimate 4-5 plans: allowlist additions + tier field contract, Agency Indicator + tooltip, elevation dialog + tier map, H2/H3 wiring, H4 force-Telos)
**UI hint**: yes

### Phase 7: Peer Dialogue → Telos Refinement
**Goal**: Two-Nous exchanges can meaningfully mutate each participant's Telos without leaking goal contents, and the dashboard shows which goals arose from dialogue.
**Depends on**: Phase 6 (tier-stamping infrastructure in place; peer dialogue is an internal-Nous state change but the Inspector UI work shares dashboard scaffolding touched in Phase 6)
**Requirements**: DIALOG-01, DIALOG-02, DIALOG-03
**Success Criteria** (what must be TRUE):
  1. When two Nous exchange ≥2 `nous.spoke` events with each other inside N ticks (configurable, default N=5), both participants' next `get_state` call receives a `dialogue_context` field containing the aggregated exchange; a single utterance or a one-way broadcast does not trigger aggregation.
  2. Brain can return a new `telos.refined` action in response to `dialogue_context`; the Grid validates signing + authority and emits an allowlisted `telos.refined` event with payload `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — a privacy test asserts no goal string, no dialogue content, and no memory ref ever appears in the broadcast payload.
  3. Dashboard Inspector Telos panel renders a "↻ refined via dialogue" badge on any Telos goal whose history contains a `telos.refined` event, and the badge links to the firehose entries of the triggering dialogue (queryable by `triggered_by_dialogue_id`).
  4. AuditChain integrity: a 100-tick simulation with dialogue aggregation enabled and `telos.refined` actions emitted produces a deterministic, verifiable chain — `AuditChain.verify()` returns `{valid: true}` and determinism holds across 0 vs 10 listeners.
  5. The dialogue aggregation threshold (N) is configurable via Grid config and is covered by at least one test that varies N and asserts aggregation fires / does not fire at the boundary.
**Plans**: TBD (estimate 3-4 plans: Grid dialogue aggregator + tick window, Brain `telos.refined` action + handler, allowlist + hash-only event, Inspector badge + firehose link)
**UI hint**: yes

### Phase 8: H5 Sovereign Operations (Nous Deletion)
**Goal**: An operator can delete a Nous under H5 Sovereign tier with maximum friction, full forensic preservation, and audit-chain integrity intact.
**Depends on**: Phase 6 (tier-stamping, elevation dialog, `operator.*` allowlist shape), Phase 7 (Inspector Telos panel — delete affordance lives in the same drawer)
**Requirements**: AGENCY-05
**Success Criteria** (what must be TRUE):
  1. Triggering H5 deletion surfaces a distinct irreversibility dialog (visually differentiated from the H3/H4 confirmation dialog) that names the first-life promise explicitly and requires the operator to type the target Nous's full `did:noesis:...` DID to enable the confirm button; partial-match or copy-paste of anything other than the exact DID keeps the button disabled.
  2. On confirmation, a full pre-deletion state hash (Psyche + Thymos + Telos + memory stream + Ousia balance) is computed and included in the `operator.nous_deleted` audit payload alongside `{tier: "H5", operator_id, target_did, pre_deletion_state_hash}`; a test reconstructs the hash from a known Nous fixture and asserts bit-for-bit match.
  3. Post-deletion, the Nous is removed from the active runtime (NousRegistry, SpatialMap, economy ledger reconciled) but every prior audit entry referencing the deleted DID remains in the chain unmodified — `AuditChain.verify()` returns `{valid: true}` and a query for historical events by DID still returns the pre-deletion history.
  4. Attempting any operation on a deleted DID (trade, inspect, force-Telos) fails with a clear "Nous deleted at tick N" error; the DID is not reusable — a future Nous cannot be spawned with the same DID.
  5. The H5 affordance is gated behind the Phase 6 Agency Indicator — an operator in H1–H4 cannot surface the deletion dialog without an explicit elevation to H5 and the irreversibility dialog confirming the tier transition.
**Plans**: TBD (estimate 2-3 plans: irreversibility dialog + DID-typed confirm, forensic state hash + `operator.nous_deleted` emission, runtime deletion + chain-preservation invariant)
**UI hint**: yes

## Progress

**Execution Order:** 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. ReviewerNous — Objective-Only Pre-Commit Review | 2/5 | In progress | — |
| 6. Operator Agency Foundation (H1–H4) | 0/TBD | Not started | — |
| 7. Peer Dialogue → Telos Refinement | 0/TBD | Not started | — |
| 8. H5 Sovereign Operations (Nous Deletion) | 0/TBD | Not started | — |

## Research Artifacts

Primary source: `.planning/research/stanford-peer-agent-patterns.md` (committed 9bb3046, 2026-04-20)

- **Agentic Reviewer** (Zou, Stanford HAI) — objective-only invariant checks; reject subjective judgment → Phase 5
- **Human Agency Scale H1–H5** (arxiv 2506.06576) — workers want higher agency than experts deem needed on 47.5% of tasks → Phases 6, 8
- **SPARC peer-dialogue pattern** — two-Nous exchanges mutate internal state, never commit external Grid mutations without reviewer/invariant gates → Phase 7
- **Multi-agent topology taxonomy** (arxiv 2512.08296) — stay centralized; scoped peer channels deferred to Sprint 16+ (WHISPER-01)

Secondary invariant sources (carry-forward from v2.0):
- AuditChain zero-diff invariant — Phase 1 commit `29c3516`
- Broadcast allowlist freeze — v2.0 Phase 1 plan `01-03`
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at 3 entry points
- TradeRecord.timestamp Unix-seconds contract

## Open Questions (Planner Must Resolve)

1. **ReviewerNous deployment model** — confirmed system singleton for v2.1 (REV-03 locks this), but where does the singleton live? New `grid/ReviewerNous.ts` actor registered at Grid startup, or a pseudo-Nous in NousRegistry with a reserved DID? Security: singleton vs opt-in already decided (singleton) — this question is about code placement.
2. **Agency Indicator persistence** — per-operator session state (stored in dashboard client) vs global sim mode (stored on Grid). Global risks multi-operator conflicts (deferred to OP-MULTI-01); per-session risks audit confusion if two operators view the same Grid at different tiers. Plan-phase must choose and document.
3. **H5 permission surface** — AGENCY-05 permits deletion with maximum gating. Plan-phase must decide whether the H5 affordance is feature-flagged OFF by default in v2.1 (requires explicit Grid config to enable) or shipped ON behind the irreversibility dialog. First-life promise suggests default-OFF with opt-in.
4. **Dialog detection threshold** — N=5 ticks is the default in DIALOG-01, but the aggregation window semantics need pinning: is it ≥2 exchanges *ever* in a rolling N-tick window, or a strict turn-taking pattern (A→B→A→B)? Affects both Grid aggregator logic and the `triggered_by_dialogue_id` generation.

---
*Roadmap created: 2026-04-20 — v2.1 Steward Console milestone opened*
*Supersedes: v2.0 Sprint 14 roadmap (archived to MILESTONES.md)*
