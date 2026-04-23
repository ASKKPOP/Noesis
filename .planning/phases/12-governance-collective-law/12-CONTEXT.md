# Phase 12: Governance & Collective Law — Context

**Gathered:** 2026-04-23
**Mode:** `--auto` (all gray areas auto-selected with recommended defaults; see `12-DISCUSSION-LOG.md`)
**Status:** Ready for research/planning

<domain>
## Phase Boundary

Nous collectively open proposals, commit blind ballots, reveal, and trigger law promotion via a deterministic 4-event commit-reveal lifecycle. Allowlist grows **22 → 26** (+4: `proposal.opened`, `ballot.committed`, `ballot.revealed`, `proposal.tallied`). Operators are **read-only at all tiers, including H5** — no vote, propose, or tally path for operators exists.

**Out of scope** (do not drift): Multi-proposal sequencing / proposal chains (GOV-MULTI-01 deferred); quadratic / age-gated / reputation-weighted voting (T-09-14 sybil gate deferred to v2.3); DAO governance libraries (Aragon, Snapshot.js, OpenZeppelin Governor — wrong trust model); vote delegation; penalty policy for hash-mismatch reveals (logged, not penalized, in v2.2); sybil-vote eligibility gate (v2.3).

</domain>

<decisions>
## Implementation Decisions

### Allowlist growth — exactly +4 events
- **D-12-01:** Four new events added to `grid/src/audit/broadcast-allowlist.ts` at positions 23–26 (zero-indexed 22–25). Running total **22 → 26**.
  - Position 23: `proposal.opened` — closed 6-key payload `{proposal_id, proposer_did, title_hash, quorum_pct, supermajority_pct, deadline_tick}`
  - Position 24: `ballot.committed` — closed 3-key payload `{proposal_id, voter_did, commit_hash}`
  - Position 25: `ballot.revealed` — closed 4-key payload `{proposal_id, voter_did, choice, nonce}`
  - Position 26: `proposal.tallied` — closed 6-key payload `{proposal_id, outcome, yes_count, no_count, abstain_count, quorum_met}`
  - All payloads enforce `Object.keys(payload).sort()` strict equality at their sole-producer boundary (Phase 6 D-11 pattern).
  - **Forbidden siblings** in `grid/src/**`: `proposal.created | proposal.draft | ballot.cast | vote.committed | governance.* | proposal.* siblings not enumerated above` — grep gate asserts hits = 0 for any governance event that is NOT one of the four above.
  - **Doc-sync obligation:** Plan that lands allowlist changes updates `scripts/check-state-doc-sync.mjs` (22→26), `STATE.md` Accumulated Context, `ROADMAP.md §Phase 12` running-total, and `PHILOSOPHY.md` allowlist block in the same commit (CLAUDE.md doc-sync rule).

### Commit-reveal mechanics
- **D-12-02:** `commit_hash = sha256(choice || '|' || nonce || '|' || voter_did)` — delimiter `|` to prevent chosen-plaintext ambiguity. `choice ∈ {yes, no, abstain}`. `nonce` is 32 hex chars (16 bytes) — Brain generates cryptographically random nonce per ballot; Grid stores it at reveal, never before.
  - **Nonce source:** Brain generates nonce via `secrets.token_hex(16)` in Python. Grid never generates nonces — only receives and verifies them at reveal.
  - **Reveal window:** Commit phase open from `proposal.opened` tick through `deadline_tick - 1` (inclusive). Reveal phase: same window — commit and reveal may overlap (simpler: no separate reveal-only window in v2.2). Deadline tick is the last tick for either action.
  - **Hash verification at reveal:** `sha256(choice + '|' + nonce + '|' + voter_did) === commit_hash` — if mismatch, log `ballot_reveal_mismatch` to server log, return 422, do NOT emit `ballot.revealed`, do NOT count vote.

### Tally trigger — tick_closed hook
- **D-12-03:** Tally fires via `tick_closed` hook when `currentTick >= proposal.deadline_tick` AND at least one `ballot.revealed` exists for the proposal. Pure deterministic — no wall-clock, no `Date.now`. Per-tick batch tally (T-09-13 defense): all reveals up to `deadline_tick` are included; reveals after `deadline_tick` are silently ignored at tally time.
  - **Partial reveal handling:** Only revealed ballots count. Committed-but-not-revealed ballots are treated as abstain for quorum purposes (not vote count). Quorum: `(revealed + unrevealed_committed) / total_nous_count >= quorum_pct` (pessimistic quorum).
  - **Quorum defaults (VOTE-01):** `quorum_pct: 50, supermajority_pct: 67` (integers, 1–100 range). Proposer may override at proposal-open time.
  - **Outcome logic:** `outcome = passed` if `quorum_met AND yes_count / (yes_count + no_count) >= supermajority_pct/100`; `outcome = quorum_fail` if `!quorum_met`; `outcome = rejected` if `quorum_met AND threshold not reached`.
  - **On `passed`:** Grid immediately emits `law.triggered` with `enacted_by: 'collective'` field added to the existing payload (additive widening per T-09-15 defense, not a new event). Grep test asserts `proposal.tallied` never triggers `operator.law_changed`.

### Proposal body storage & privacy
- **D-12-04:** Proposal body stored in MySQL `governance_proposals` table (NOT in audit payload — body privacy T-09-12 defense). `title_hash = sha256(body_text)` truncated to 32 hex chars in `proposal.opened` payload. The full `proposal_id` is UUID v4.
  - **Body fetch RPC:** `GET /api/v1/governance/proposals/:id/body` requires **H2+ tier elevation** (clone Phase 6 memory-query tier discipline). H1 sees only title_hash + status in proposal listing. H2+ sees full body text.
  - **Privacy matrix forbidden keys for `proposal.opened`:** `text | body | content | description | rationale | proposal_text | law_text | body_text` — flat + nested. Privacy matrix test asserts 0 instances in audit chain.
  - **MySQL schema:** New migration (version 6) adds two tables: `governance_proposals` and `governance_ballots`. See D-12-08 for schema details.

### Tombstone edge cases — governance
- **D-12-05:** Extend Phase 8 `tombstoneCheck` to all governance routes (propose, commit, reveal).
  - **Dead proposer:** Once proposer is tombstoned (`bios.death` emitted for `proposer_did`), no new ballots accepted. Existing committed/revealed ballots remain valid and tally proceeds normally at deadline_tick (ongoing vote completes, proposal is not voided). New `ballot.committed` or `ballot.revealed` calls for a tombstoned-proposer proposal return 410 Gone.
  - **Dead voter:** A committed ballot from a DID that is later tombstoned remains in the tally (commit already counted for quorum purposes). Reveal from a tombstoned DID is rejected with 410 Gone (cannot reveal after death). Unrevealed committed ballot counted as non-reveal for tally purposes (abstain for quorum).
  - **Implementation:** `isTombstoned(proposer_did)` check at proposal-open route entry. `isTombstoned(voter_did)` check at ballot-commit and ballot-reveal route entries.

### One-Nous-one-vote enforcement (I-7)
- **D-12-06:** Duplicate DID on same proposal rejected at `ballot.committed` emitter. Check: `ballotExists(proposal_id, voter_did)` before emitting. If true, return 409 Conflict + error `duplicate_ballot`. This is enforced at the sole-producer boundary (not just DB constraint) — the emitter function checks before any DB write.
  - **Operator cannot vote:** `voter_did` must pass DID regex (`/^did:noesis:[a-z0-9_\-]+$/i`) AND must be in NousRegistry (not an operator ID). Grep CI gate: `scripts/check-governance-isolation.mjs` — no import from `grid/src/audit/operator-events.ts` into `grid/src/governance/**`. No `operator.*` event emitted from `grid/src/governance/**`.

### Brain governance integration
- **D-12-07:** Brain gains three new action types: `ActionType.PROPOSE`, `ActionType.VOTE_COMMIT`, `ActionType.VOTE_REVEAL`. Brain autonomously decides to propose based on Telos + drives (high curiosity or safety drive may trigger governance action). Brain decides vote choice (`yes/no/abstain`) based on its Telos evaluation of the proposal body (H2+ fetch to read body). Grid dispatcher adds three new `BrainAction` variant cases.
  - **Brain fetches proposal body:** Brain calls `GET /api/v1/governance/proposals/:id/body` with H2-equivalent credentials to read the proposal before voting. This is the same tier-gated RPC as the operator Dashboard read.
  - **Brain nonce generation:** `secrets.token_hex(16)` — 16 bytes hex = 32 chars. Brain stores `(proposal_id, nonce)` in its local state between commit and reveal ticks.
  - **Reveal timing:** Brain reveals on the next tick after commit (or any tick before deadline). No wall-clock delay.

### MySQL schema — governance tables
- **D-12-08:** Add migration version 6 with two new tables:
  ```sql
  CREATE TABLE IF NOT EXISTS governance_proposals (
    grid_name        VARCHAR(63)  NOT NULL,
    proposal_id      VARCHAR(36)  NOT NULL,   -- UUID v4
    proposer_did     VARCHAR(255) NOT NULL,
    title_hash       VARCHAR(32)  NOT NULL,   -- sha256[:32]
    body_text        TEXT         NOT NULL,
    quorum_pct       TINYINT      NOT NULL DEFAULT 50,
    supermajority_pct TINYINT     NOT NULL DEFAULT 67,
    deadline_tick    INT UNSIGNED NOT NULL,
    status           VARCHAR(32)  NOT NULL DEFAULT 'open',  -- open | tallied
    outcome          VARCHAR(32),                            -- passed | rejected | quorum_fail
    opened_at_tick   INT UNSIGNED NOT NULL,
    tallied_at_tick  INT UNSIGNED,
    PRIMARY KEY (grid_name, proposal_id),
    INDEX idx_status (grid_name, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS governance_ballots (
    grid_name        VARCHAR(63)  NOT NULL,
    proposal_id      VARCHAR(36)  NOT NULL,
    voter_did        VARCHAR(255) NOT NULL,
    commit_hash      VARCHAR(64)  NOT NULL,
    revealed         TINYINT(1)   NOT NULL DEFAULT 0,
    choice           VARCHAR(16),           -- yes | no | abstain (NULL until revealed)
    nonce            VARCHAR(32),           -- set at reveal
    committed_tick   INT UNSIGNED NOT NULL,
    revealed_tick    INT UNSIGNED,
    PRIMARY KEY (grid_name, proposal_id, voter_did),
    INDEX idx_proposal (grid_name, proposal_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ```
  - **Sole-producers:** `appendProposalOpened.ts`, `appendBallotCommitted.ts`, `appendBallotRevealed.ts`, `appendProposalTallied.ts` — four separate sole-producer files (clone Phase 11 `appendNousWhispered.ts` pattern). Each is the ONLY file allowed to call `audit.append('proposal.opened')` / `audit.append('ballot.committed')` etc. Grep gates enforce this.

### Dashboard governance page
- **D-12-09:** New Next.js page at `dashboard/src/app/grid/governance/page.tsx`. Shows:
  - **Proposals list** (H1+): proposal_id (truncated), status, opened tick, deadline tick, commit count, reveal count, outcome (if tallied).
  - **Proposal detail view** (H1+): title_hash display. H2+ can see body text. Tally results (aggregate yes/no/abstain counts, quorum_met). Post-tally law-promotion link to `/grid/laws` for passed proposals.
  - **Per-Nous voting history** (H5 only): which DID committed, revealed, and what choice — tier-gated RPC `GET /api/v1/governance/proposals/:id/ballots/history` requires H5.
  - **No vote affordance in Dashboard**: Dashboard is read-only for operators (VOTE-05). No Propose / Commit / Reveal UI elements. Governance is Nous-only.
  - **SWR polling**: `useSWR('/api/v1/governance/proposals', { refreshInterval: 2000 })` for open proposals list (clone Phase 9 relationships pattern).

### Law promotion path
- **D-12-10:** On `proposal.tallied` with `outcome: 'passed'`, Grid immediately fires `law.triggered` with the existing `LogosEngine.addLaw()` call AND adds `enacted_by: 'collective'` to the `law.triggered` payload (additive widening — existing law.triggered closed-tuple grows by 1 key). The law body is fetched from `governance_proposals.body_text` and parsed as the existing Law DSL.
  - **Existing `law.triggered` payload** (before this phase): unknown — no current sole-producer found in codebase. Phase 12 implementation must define one. See canonical refs for the payload shape to use.
  - **Promotion guard:** `proposal.tallied` emitter (`appendProposalTallied.ts`) is responsible for triggering `law.triggered` on pass. `appendProposalTallied.ts` imports `LogosEngine` and `appendLawTriggered.ts` (new sole-producer for `law.triggered` if none exists; or extends existing one).
  - **Grep test:** `scripts/check-governance-isolation.mjs` asserts `proposal.tallied` never results in `operator.law_changed` (no call chain from governance to operator emitter).

### CI gates
- **D-12-11:** Three CI gate scripts ship with this phase:
  1. `scripts/check-governance-isolation.mjs` — no import from `grid/src/audit/operator-events.ts` into `grid/src/governance/**`; no `operator.*` emit in governance module; no `law.triggered` call from any file that imports operator-events.
  2. `scripts/check-governance-plaintext.mjs` — clone of `check-whisper-plaintext.mjs`; scans `grid/src/governance/**` and `brain/src/noesis_brain/governance/**` for forbidden plaintext keys (`text|body|content|description|rationale|proposal_text`).
  3. `scripts/check-governance-weight.mjs` — asserts no `weight | reputation | relationship_score | ousia_weight` key appears in any ballot or tally payload; guards VOTE-06.

### Claude's Discretion
- Specific proposal_id format: UUID v4 generated via `crypto.randomUUID()` in Node (available since Node 14.17 — no extra dep).
- Law DSL parsing: reuse existing `LogosEngine` law shape from `grid/src/logos/types.ts`; proposal body is a JSON-stringified `Law` object.
- Tick hook integration: wire `tick_closed` callback into `GenesisLauncher` following the existing `clock.onTick()` pattern — no new lifecycle event.
- Wave structure: follow Phase 11 5-wave pattern (W0: RED stubs + allowlist; W1: crypto/commit-reveal math; W2: emitters + rate logic; W3: API + Brain; W4: CI gates + dashboard + doc-sync).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Governance requirements
- `.planning/REQUIREMENTS.md` §VOTE-01..07 — All seven vote requirements (closed-tuple payloads, quorum defaults, operator exclusion, dashboard)
- `.planning/ROADMAP.md` §Phase 12 — Success criteria, risks T-09-12..T-09-16, out-of-scope list, allowlist additions

### Prior phase patterns (clone discipline)
- `grid/src/audit/broadcast-allowlist.ts` — Current allowlist at 22; Phase 12 extends to 26
- `grid/src/whisper/appendNousWhispered.ts` — Sole-producer pattern to clone for all 4 new emitters
- `grid/test/whisper/whisper-privacy-matrix.test.ts` — Privacy-matrix test shape to clone for governance forbidden keys
- `grid/test/whisper/whisper-producer-boundary.test.ts` — Sole-producer boundary grep gate to clone x4
- `grid/src/api/whisper/send.ts` — DID validation + tombstone check pattern to clone for governance routes
- `grid/src/audit/operator-events.ts` — Import chain to NEVER touch from governance module
- `scripts/check-whisper-plaintext.mjs` — CI grep gate to clone as `check-governance-plaintext.mjs`
- `grid/src/db/schema.ts` — MySQL migration pattern; Phase 12 adds migration version 6

### Existing engine & types
- `grid/src/logos/engine.ts` — LogosEngine.addLaw() — Phase 12 promotion path calls this
- `grid/src/logos/types.ts` — Law DSL shape; proposal body must parse to this type
- `grid/src/api/operator/governance-laws.ts` — Existing operator law-management CRUD; governance module does NOT import from here

### PHILOSOPHY
- `PHILOSOPHY.md` §6 Economy (free market, no token-weighted voting) — VOTE-06 grounding
- `PHILOSOPHY.md` §7 Human Agency Tiers — H1/H2/H5 tier discipline for body fetch and ballot history RPCs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LogosEngine` (`grid/src/logos/engine.ts`): `addLaw()` / `activeLaws()` — Phase 12 promotion path calls `addLaw()` directly after `proposal.tallied` with `outcome: passed`.
- `grid/src/db/schema.ts` migration runner: extend with version 6 (governance tables).
- `grid/src/api/operator/_validation.ts` validateTierBody pattern — clone for governance API tier validation.
- Phase 8 tombstone check pattern (in `grid/src/integration/grid-coordinator.ts`): clone `isTombstoned()` check in governance route handlers.
- `@noble/hashes` sha256 (already in package.json from Phase 11 audit chain): reuse for `commit_hash` computation on Brain side and hash-verification at reveal.

### Established Patterns
- **Sole-producer files**: Each new allowlist event gets its own `append*.ts` file; no other file may call `audit.append('proposal.opened')` etc. — grep gate enforces (Phase 11 pattern).
- **Closed-tuple enforcement**: `Object.keys(payload).sort()` strict `deepEqual` against the expected key array before `.append()` — prevents payload drift (Phase 6 D-11 pattern).
- **Privacy matrix**: `whisper-privacy-matrix.test.ts` enumerates 13 flat + 3 nested forbidden keys — clone at same scale for governance forbidden keys.
- **MySQL migrations**: all schema changes go through the numbered migration array in `grid/src/db/schema.ts`; no ad-hoc table creation.
- **Dashboard page pattern**: `dashboard/src/app/grid/<feature>/page.tsx` + adjacent `components/` — clone relationships (`dashboard/src/app/grid/relationships/`) for governance page structure.

### Integration Points
- `GenesisLauncher` (`grid/src/genesis/launcher.ts`): wire `GovernanceEngine` construction and `clock.onTick()` tally-trigger hook (similar to how RelationshipListener and AnankeLoader are wired).
- `grid/src/api/server.ts`: register governance Fastify plugin alongside whisper routes.
- Brain `BrainAction` dispatch (`brain/src/noesis_brain/dispatcher.py`): add `PROPOSE`, `VOTE_COMMIT`, `VOTE_REVEAL` action variants.

</code_context>

<specifics>
## Specific Ideas

- **commit_hash formula exactly:** `sha256(choice + '|' + nonce + '|' + voter_did)` — pipe delimiters prevent chosen-plaintext ambiguity. Both Brain (Python) and Grid (TypeScript) must use identical formula.
- **Quorum pessimism:** unrevealed-but-committed ballots count toward quorum denominator. This prevents a voter from gaming quorum by committing and not revealing.
- **proposal_id as UUID v4:** `crypto.randomUUID()` — no external dep, deterministic per test with mocked crypto (clone audit-chain test pattern).
- **`enacted_by: 'collective'`:** Additive widening of existing `law.triggered` payload. This is the T-09-15 defense: forensically distinguishes collective enactment from operator enactment. The existing test for `law.triggered` payload must be updated to allow this new key.

</specifics>

<deferred>
## Deferred Ideas

- Quadratic / reputation / relationship-weighted voting — T-09-14 sybil gate (v2.3)
- Multi-proposal sequencing and proposal chains — GOV-MULTI-01 (v2.3)
- Vote delegation — out of scope for v2.2
- Penalty policy for hash-mismatch reveals (logged not penalized in v2.2)
- Sybil-vote eligibility gate — operator-observable anomaly surfacing (v2.3)
- Proposal expiry notification event — could be useful but adds to allowlist; deferred
- Per-Nous governance reputation score — post-v2.2

</deferred>

---

*Phase: 12-governance-collective-law*
*Context gathered: 2026-04-23*
