---
phase: 12-governance-collective-law
verified: 2026-04-27T01:00:00Z
status: passed
score: 25/25 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 24/25
  gaps_closed:
    - "scripts/check-state-doc-sync.mjs exits 0 — STATE.md now lists 26 events including all four governance events at positions 23-26"
  gaps_remaining: []
  regressions: []
---

# Phase 12: Governance Collective Law — Verification Report

**Phase Goal:** Ship commit-reveal governance lifecycle (VOTE-01..07) — Nous-to-Nous collective governance with operator exclusion, cryptographic ballot privacy, tally, and law promotion.
**Verified:** 2026-04-27
**Status:** PASSED
**Re-verification:** Yes — after gap closure (STATE.md doc-sync fix)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Broadcast allowlist has exactly 26 entries — four governance events added (VOTE-01..04) | ✓ VERIFIED | `grid/src/audit/broadcast-allowlist.ts` ALLOWLIST_MEMBERS array has 26 entries (lines 60-121); indices 22-25 = proposal.opened, ballot.committed, ballot.revealed, proposal.tallied |
| 2 | scripts/check-state-doc-sync.mjs exits 0 — recognizes the 26-event allowlist with all four governance events | ✓ VERIFIED | Script exits 0: "OK — STATE.md is in sync with the 26-event allowlist."; STATE.md lines 61-94 now headed "Phase 12 — post-ship, Plan 12-04" / "**26 events.**" with all four governance entries at positions 23-26 |
| 3 | Closed-tuple payload interfaces are defined in grid/src/governance/types.ts with alphabetical KEYS tuples | ✓ VERIFIED | types.ts exports PROPOSAL_OPENED_KEYS (6 keys), BALLOT_COMMITTED_KEYS (3 keys), BALLOT_REVEALED_KEYS (4 keys), PROPOSAL_TALLIED_KEYS (6 keys); GOVERNANCE_FORBIDDEN_KEYS (12 literals) re-exported from broadcast-allowlist.ts |
| 4 | Cross-language sha256 commit-reveal contract: Grid (TypeScript) and Brain (Python) produce identical hex for identical inputs | ✓ VERIFIED | Fixture hex `0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2` appears in both grid/test/governance/governance-commit-hash.test.ts and brain/test/governance/test_commit_hash.py |
| 5 | Each governance audit event has exactly one sole-producer file in grid/src/governance/ | ✓ VERIFIED | Single file per event literal: appendProposalOpened.ts (proposal.opened), appendBallotCommitted.ts (ballot.committed), appendBallotRevealed.ts (ballot.revealed), appendProposalTallied.ts (proposal.tallied), appendLawTriggered.ts (law.triggered) |
| 6 | computeTally is a pure function with no I/O — no audit/store/registry imports | ✓ VERIFIED | grid/src/governance/tally.ts contains no imports referencing audit, store, registry, or logos |
| 7 | GovernanceEngine.onTickClosed wires tally to clock ticks in GenesisLauncher | ✓ VERIFIED | launcher.ts line 137: `this.governance = new GovernanceEngine(...)`, line 272: `void this.governance.onTickClosed(event.tick)` |
| 8 | API routes enforce tier gating: H1 gets 403 on body access, H5 required for ballot history | ✓ VERIFIED | routes.ts: GET /proposals/:id/body calls `validateTierAtLeast(2)`, GET /proposals/:id/ballots/history calls `validateTierAtLeast(5)` |
| 9 | Duplicate-DID ballot guard returns 409 and hash-mismatch returns 422 | ✓ VERIFIED | routes.ts catches GovernanceError codes DUPLICATE_BALLOT→409, HASH_MISMATCH→422 |
| 10 | Brain ActionType enum has PROPOSE, VOTE_COMMIT, VOTE_REVEAL entries | ✓ VERIFIED | brain/src/noesis_brain/rpc/types.py lines 23-25: PROPOSE="propose", VOTE_COMMIT="vote_commit", VOTE_REVEAL="vote_reveal" |
| 11 | NousRunner dispatches propose/vote_commit/vote_reveal BrainActions to sole-producer emitters | ✓ VERIFIED | grid/src/integration/nous-runner.ts switch cases: propose→appendProposalOpened (line 457), vote_commit→appendBallotCommitted (line 511), vote_reveal→appendBallotRevealed (line 568) |
| 12 | Operators cannot propose, commit, or reveal — all governance write routes are Nous-only (VOTE-05 / D-12-11) | ✓ VERIFIED | routes.ts uses `validateNousDid` guard on all write routes; governance-dashboard.tsx has VOTE-05 comment; no propose/commit/reveal button at any tier |
| 13 | LawTriggeredPayload widened with `enacted_by: 'collective' \| 'operator'` (T-09-15) | ✓ VERIFIED | grid/src/logos/types.ts: LawTriggeredPayload includes `enacted_by: 'collective' \| 'operator'`; LAW_TRIGGERED_KEYS includes 'enacted_by' alphabetically |
| 14 | scripts/check-governance-isolation.mjs exits 0 | ✓ VERIFIED | Exit 0: "clean (0 violations — operator isolation preserved)" |
| 15 | scripts/check-governance-plaintext.mjs exits 0 | ✓ VERIFIED | Exit 0: "clean (0 body/text/content violations outside allowlist)" |
| 16 | scripts/check-governance-weight.mjs exits 0 | ✓ VERIFIED | Exit 0: "clean (0 vote-weighting violations — VOTE-06 OK)" |
| 17 | Dashboard governance page renders tier-aware proposals list with H5-only ballot history | ✓ VERIFIED | dashboard/src/app/grid/governance/governance-dashboard.tsx: SWR hook useGovernanceProposals, refreshInterval 2000; "View votes" button gated by `{tier >= 5 && ...}`; page.tsx server component passes tier prop |
| 18 | Cross-tier type drift detector (T-09-17) passes — dashboard/src/lib/protocol/governance-types.ts mirrors grid/src/governance/types.ts | ✓ VERIFIED | dashboard/test/lib/governance-types.drift.test.ts: 18 tests covering KEYS array parity (grid↔dashboard, grid↔brain), interface key parity, BallotChoice union, SYNC headers, forbidden-field guards |
| 19 | Brain governance modules exist: proposer.py, voter.py, state.py | ✓ VERIFIED | All three files exist at brain/src/noesis_brain/governance/; proposer.py has build_propose_action, voter.py has build_commit_action/build_reveal_action/evaluate_choice, state.py has GovernanceState |
| 20 | Zero-diff regression: chain-tail hashes are deterministic for fixture-A | ✓ VERIFIED | governance-zero-diff.test.ts uses _proposalIdOverride + vi.spyOn(Date, 'now'); frozen hashes: 0-reveals=a3fb2a63…, 1-reveal=37a3c8b3…, 5-reveals=642d5e10…, 10-reveals=c2636503… |
| 21 | DB migration v6 exists for governance schema (proposals + governance_ballots tables) | ✓ VERIFIED | grid/src/db/migrations/ contains v6 migration with CREATE TABLE governance_proposals and CREATE TABLE governance_ballots |
| 22 | ROADMAP.md marks Phase 12 complete with shipped date | ✓ VERIFIED | .planning/ROADMAP.md: Phase 12 bullet marked [x] with shipped date 2026-04-27 and allowlist delta 22→26 |
| 23 | MILESTONES.md has Phase 12 SHIPPED entry | ✓ VERIFIED | .planning/MILESTONES.md contains Phase 12 SHIPPED entry with key primitives, invariants, allowlist delta, lessons |
| 24 | README.md updated with Phase 12 status, test coverage, milestone table entries 23-26 | ✓ VERIFIED | README.md contains Phase 12 status paragraph, updated test coverage (1147+ grid, 513+ brain), milestone table entries #23-26 |
| 25 | verifyReveal never throws — returns boolean for all inputs | ✓ VERIFIED | grid/src/governance/commit-reveal.ts: verifyReveal wraps all operations in try/catch returning false; brain/src/noesis_brain/governance/commit_reveal.py: verify_reveal uses try/except returning False |

**Score:** 25/25 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/governance/types.ts` | Closed-tuple KEYS exports + GOVERNANCE_FORBIDDEN_KEYS | ✓ VERIFIED | WIRED — imported by all 5 sole-producer emitters |
| `grid/src/governance/commit-reveal.ts` | computeCommitHash + verifyReveal (node:crypto) | ✓ VERIFIED | WIRED — imported by appendBallotCommitted.ts, appendBallotRevealed.ts, nous-runner.ts |
| `brain/src/noesis_brain/governance/commit_reveal.py` | compute_commit_hash + verify_reveal + generate_nonce | ✓ VERIFIED | WIRED — re-exported via governance/__init__.py |
| `grid/src/governance/appendProposalOpened.ts` | Sole producer for proposal.opened | ✓ VERIFIED | WIRED — called from routes.ts and nous-runner.ts |
| `grid/src/governance/appendBallotCommitted.ts` | Sole producer for ballot.committed | ✓ VERIFIED | WIRED — called from routes.ts and nous-runner.ts |
| `grid/src/governance/appendBallotRevealed.ts` | Sole producer for ballot.revealed | ✓ VERIFIED | WIRED — called from routes.ts and nous-runner.ts |
| `grid/src/governance/appendProposalTallied.ts` | Sole producer for proposal.tallied | ✓ VERIFIED | WIRED — called from engine.ts |
| `grid/src/governance/appendLawTriggered.ts` | Sole producer for law.triggered (widened) | ✓ VERIFIED | WIRED — called from engine.ts on passed outcome |
| `grid/src/governance/tally.ts` | Pure computeTally function | ✓ VERIFIED | WIRED — imported by engine.ts |
| `grid/src/governance/engine.ts` | GovernanceEngine with onTickClosed | ✓ VERIFIED | WIRED — instantiated in launcher.ts; tick hook called |
| `grid/src/governance/store.ts` | GovernanceStore (in-memory Map + MySQL interface) | ✓ VERIFIED | WIRED — injected into engine.ts; createInMemoryStore in launcher.ts |
| `grid/src/governance/replay.ts` | Deterministic replay harness | ✓ VERIFIED | WIRED — used by governance-zero-diff.test.ts |
| `grid/src/governance/errors.ts` | GovernanceError structured error codes | ✓ VERIFIED | WIRED — caught in routes.ts |
| `grid/src/api/governance/routes.ts` | 5 tier-gated Fastify routes | ✓ VERIFIED | WIRED — registered in server.ts via registerGovernanceRoutes |
| `grid/src/genesis/launcher.ts` (modified) | GovernanceEngine field + tick hook | ✓ VERIFIED | WIRED — engine constructed at line 137, onTickClosed at line 272 |
| `grid/src/integration/nous-runner.ts` (modified) | 3 governance BrainAction switch cases | ✓ VERIFIED | WIRED — cases at lines 457, 511, 568 |
| `brain/src/noesis_brain/governance/proposer.py` | build_propose_action | ✓ VERIFIED | WIRED — exported via __init__.py |
| `brain/src/noesis_brain/governance/voter.py` | build_commit_action, build_reveal_action, evaluate_choice | ✓ VERIFIED | WIRED — exported via __init__.py |
| `brain/src/noesis_brain/governance/state.py` | GovernanceState in-memory store | ✓ VERIFIED | WIRED — exported via __init__.py |
| `scripts/check-governance-isolation.mjs` | CI gate — VOTE-05 operator exclusion | ✓ VERIFIED | Exits 0 (0 violations) |
| `scripts/check-governance-plaintext.mjs` | CI gate — T-09-12 body privacy | ✓ VERIFIED | Exits 0 (0 violations outside allowlist of 7 files) |
| `scripts/check-governance-weight.mjs` | CI gate — VOTE-06 no vote-weighting | ✓ VERIFIED | Exits 0 (0 violations) |
| `scripts/check-state-doc-sync.mjs` | CI gate — STATE.md 26-event invariant | ✓ VERIFIED | Exits 0 — STATE.md synced to 26 events with all four governance entries |
| `dashboard/src/app/grid/governance/page.tsx` | Server component passes tier prop | ✓ VERIFIED | WIRED — imports governance-dashboard.tsx, passes tier from session |
| `dashboard/src/app/grid/governance/governance-dashboard.tsx` | Tier-aware proposals table | ✓ VERIFIED | WIRED — SWR useGovernanceProposals, VOTE-05 DOM exclusion |
| `dashboard/src/app/grid/governance/voting-history-modal.tsx` | Native `<dialog>` H5 ballot history | ✓ VERIFIED | WIRED — showModal(), Esc via close event, backdrop click |
| `dashboard/src/app/grid/governance/use-governance-proposals.ts` | SWR hook for proposals | ✓ VERIFIED | WIRED — consumed by governance-dashboard.tsx |
| `dashboard/test/lib/governance-types.drift.test.ts` | 18-test drift detector | ✓ VERIFIED | 18 tests: KEYS parity, interface parity, BallotChoice union, forbidden fields, SYNC headers |
| `.planning/STATE.md` | Broadcast allowlist updated to 26 events with governance entries | ✓ VERIFIED | Lines 61-94: heading "Phase 12 — post-ship, Plan 12-04", "**26 events.**", entries 23-26 present; regression gate comment references "26-event invariant" |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `launcher.ts` | `GovernanceEngine` | `this.governance = new GovernanceEngine(...)` line 137 | ✓ WIRED | Engine gets audit, createInMemoryStore(), registry, logos injected |
| `launcher.ts` | `engine.onTickClosed` | `void this.governance.onTickClosed(event.tick)` line 272 | ✓ WIRED | Every clock tick triggers tally evaluation |
| `nous-runner.ts` | `appendProposalOpened` | switch case `propose` line 457 | ✓ WIRED | BrainActionPropose → sole-producer emitter |
| `nous-runner.ts` | `appendBallotCommitted` | switch case `vote_commit` line 511 | ✓ WIRED | BrainActionVoteCommit → sole-producer emitter |
| `nous-runner.ts` | `appendBallotRevealed` | switch case `vote_reveal` line 568 | ✓ WIRED | BrainActionVoteReveal → sole-producer emitter |
| `routes.ts` | `validateTierAtLeast(2)` | body access route | ✓ WIRED | H1 returns 403; H2+ returns 200 |
| `routes.ts` | `validateTierAtLeast(5)` | history route | ✓ WIRED | H1-H4 returns 403; H5 returns 200 |
| `routes.ts` | `GovernanceError` → 409/422 | catch block | ✓ WIRED | DUPLICATE_BALLOT → 409; HASH_MISMATCH → 422 |
| `engine.ts` | `appendProposalTallied` | onTickClosed → computeTally | ✓ WIRED | Tally fired at deadline tick |
| `engine.ts` | `appendLawTriggered` | passed outcome path | ✓ WIRED | enacted_by: 'collective' on governance-passed law |
| `governance-dashboard.tsx` | `/api/governance/proposals` | SWR useGovernanceProposals | ✓ WIRED | refreshInterval 2000, revalidateOnFocus false |
| `check-state-doc-sync.mjs` | STATE.md allowlist section | reads file, asserts "26 events" + 4 event names | ✓ WIRED | STATE.md updated; script exits 0 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `governance-dashboard.tsx` | `proposals` (from `data ?? []`) | `useGovernanceProposals` → SWR → `/api/governance/proposals` | Yes — route queries GovernanceStore.getOpenProposals() → DB | ✓ FLOWING |
| `voting-history-modal.tsx` | `history` (from SWR fetch inside modal) | `/api/governance/proposals/:id/ballots/history` | Yes — route queries GovernanceStore.getRevealsForProposal() → DB | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| check-governance-isolation.mjs exits 0 | `node scripts/check-governance-isolation.mjs` | Exit 0: "clean (0 violations — operator isolation preserved)" | ✓ PASS |
| check-governance-plaintext.mjs exits 0 | `node scripts/check-governance-plaintext.mjs` | Exit 0: "clean (0 body/text/content violations outside allowlist)" | ✓ PASS |
| check-governance-weight.mjs exits 0 | `node scripts/check-governance-weight.mjs` | Exit 0: "clean (0 vote-weighting violations — VOTE-06 OK)" | ✓ PASS |
| check-state-doc-sync.mjs exits 0 | `node scripts/check-state-doc-sync.mjs` | Exit 0: "OK — STATE.md is in sync with the 26-event allowlist." | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOTE-01 | 12-00/12-02 | Proposal opened event with 6-key closed-tuple payload | ✓ SATISFIED | appendProposalOpened.ts sole producer; PROPOSAL_OPENED_KEYS (6 keys); route POST /proposals |
| VOTE-02 | 12-00/12-02 | Commit-reveal ballot with cryptographic privacy | ✓ SATISFIED | appendBallotCommitted.ts + appendBallotRevealed.ts; computeCommitHash/verifyReveal cross-language; nonce via secrets.token_hex(16) |
| VOTE-03 | 12-00/12-02 | Tally engine with pessimistic quorum | ✓ SATISFIED | computeTally pure function; GovernanceEngine.onTickClosed; appendProposalTallied.ts; passed→appendLawTriggered |
| VOTE-04 | 12-02 | Law promotion via enacted_by: 'collective' | ✓ SATISFIED | appendLawTriggered.ts with enacted_by widening; LawTriggeredPayload in logos/types.ts |
| VOTE-05 | 12-03/12-04 | Operator exclusion from all governance write paths | ✓ SATISFIED | validateNousDid on all write routes; check-governance-isolation.mjs exits 0; VOTE-05 DOM exclusion in governance-dashboard.tsx |
| VOTE-06 | 12-00/12-04 | No vote-weighting — GOVERNANCE_FORBIDDEN_KEYS enforced | ✓ SATISFIED | 12 forbidden keys declared in broadcast-allowlist.ts; check-governance-weight.mjs exits 0; payload closed-tuple validation in all emitters |
| VOTE-07 | 12-00/12-04 | Body plaintext excluded from audit events | ✓ SATISFIED | check-governance-plaintext.mjs exits 0; body stored in DB only; audit events carry body_hash not body text |

All 7 requirements satisfied at the code level. VOTE-01 through VOTE-07 are all marked [x] in .planning/REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `brain/src/noesis_brain/governance/voter.py` | `evaluate_choice` is a deterministic placeholder: `hash(body) % 3 → ['yes','no','abstain']` | ⚠️ Warning | Known stub per D-12-07; v2.3 telos-LLM eval deferred. Governance flow is functional — Brain votes deterministically until replaced. Does NOT block VOTE-01..07. |

---

### Human Verification Required

None. All goal-level behaviors verified programmatically.

---

### Gaps Summary

No gaps. All 25 must-haves verified.

The single gap from the initial run (STATE.md not updated to reflect the 26-event allowlist) has been resolved. STATE.md lines 61-94 now carry the correct heading ("Phase 12 — post-ship, Plan 12-04"), count ("**26 events.**"), all four governance entries at positions 23-26, and the regression gate comment updated to reference the 26-event invariant. `scripts/check-state-doc-sync.mjs` exits 0.

All implementation goals are achieved: commit-reveal cryptography (cross-language parity), sole-producer emitters, 5 tier-gated Fastify routes, Brain RPC governance actions, 4 CI gates passing, Dashboard governance page with tier-aware rendering, and the doc-sync invariant satisfied.

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
