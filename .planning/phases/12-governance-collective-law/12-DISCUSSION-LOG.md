# Phase 12: Governance & Collective Law — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 12-governance-collective-law
**Mode:** `--auto` (all areas auto-selected, recommended defaults chosen without user interaction)
**Areas discussed:** Allowlist growth, Commit-reveal mechanics, Tally trigger, Proposal body storage & privacy, Tombstone edge cases, One-Nous-one-vote, Brain governance integration, MySQL schema, Dashboard governance page, Law promotion path, CI gates

---

## Allowlist growth

| Option | Description | Selected |
|--------|-------------|----------|
| +4 events as scoped | `proposal.opened`, `ballot.committed`, `ballot.revealed`, `proposal.tallied` | ✓ |

**Auto-selected:** +4 events exactly as ROADMAP.md specifies. No alternatives considered — scope is locked by VOTE-01..04.

---

## Commit-reveal mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| sha256(choice\|nonce\|voter_did) with pipe delimiters | Prevents chosen-plaintext ambiguity | ✓ |
| sha256(choice+nonce+voter_did) concatenated | Simpler but ambiguous | |

**Auto-selected:** Pipe delimiter formula. Nonce from Brain `secrets.token_hex(16)`. Overlapping commit+reveal window (no separate reveal-only window at MVP).

---

## Tally trigger

| Option | Description | Selected |
|--------|-------------|----------|
| tick_closed hook at deadline_tick | Pure deterministic, zero wall-clock, T-09-13 defense | ✓ |
| Manual H5 trigger | Operator-controlled — violates VOTE-05 | |
| Auto on all-reveals | Non-deterministic if some never reveal | |

**Auto-selected:** `tick_closed` hook. Pessimistic quorum counts unrevealed committed ballots.

---

## Proposal body storage

| Option | Description | Selected |
|--------|-------------|----------|
| MySQL governance_proposals table, H2+ RPC to fetch | T-09-12 defense, body never in audit | ✓ |
| Store in audit payload | Violates T-09-12 — forbidden | |

**Auto-selected:** MySQL storage with H2+ tier-gated RPC. title_hash = sha256(body)[:32].

---

## Tombstone edge cases

| Option | Description | Selected |
|--------|-------------|----------|
| Dead proposer: existing votes complete, new votes rejected | ROADMAP explicit decision | ✓ |
| Dead proposer: void entire proposal | Punitive, not specified | |

**Auto-selected:** Existing votes complete; new votes/reveals for tombstoned-proposer proposals return 410 Gone. Dead voter: committed ballot stays in tally as unrevealed; reveal attempt post-death rejected 410.

---

## Brain governance integration

| Option | Description | Selected |
|--------|-------------|----------|
| Three new ActionTypes (PROPOSE, VOTE_COMMIT, VOTE_REVEAL) | Follows existing Brain action dispatch pattern | ✓ |
| Operator-only governance API | Violates VOTE-05 | |

**Auto-selected:** Brain action types. Brain fetches proposal body at H2. Brain generates nonce with `secrets.token_hex(16)`.

---

## Law promotion path

| Option | Description | Selected |
|--------|-------------|----------|
| Additive widening of law.triggered with enacted_by: 'collective' | T-09-15 defense, no new event | ✓ |
| New promotion event | Adds 5th allowlist entry — exceeds VOTE-04 scope | |

**Auto-selected:** Additive widening. `appendProposalTallied.ts` triggers `law.triggered` on pass.

---

## Claude's Discretion

- UUID v4 via `crypto.randomUUID()` for proposal_id
- Law DSL: proposal body parses to existing `Law` type from `grid/src/logos/types.ts`
- Wave structure: 5-wave pattern matching Phase 11

## Deferred Ideas

- Quadratic voting, multi-proposal chains, vote delegation — v2.3
- Penalty policy for hash-mismatch reveals — v2.3
