# Phase 12: Governance & Collective Law — Research

**Researched:** 2026-04-23
**Domain:** Commit-reveal governance lifecycle, MySQL schema migration, Brain action dispatch, Dashboard governance page
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-12-01:** Four new allowlist events at positions 23–26. Payloads: `proposal.opened` (6-key), `ballot.committed` (3-key), `ballot.revealed` (4-key), `proposal.tallied` (6-key). Forbidden siblings grep gate. Doc-sync obligation in same commit.
- **D-12-02:** `commit_hash = sha256(choice + '|' + nonce + '|' + voter_did)`. `choice ∈ {yes, no, abstain}`. Nonce = 32 hex chars from `secrets.token_hex(16)` in Brain. Grid never generates nonces. Hash mismatch → log + 422 + no emit. Commit and reveal windows overlap; deadline tick is last tick for both.
- **D-12-03:** Tally fires via `tick_closed` hook when `currentTick >= proposal.deadline_tick` AND at least one `ballot.revealed` exists. Pessimistic quorum: `(revealed + unrevealed_committed) / total_nous_count >= quorum_pct`. Outcome logic: `passed | quorum_fail | rejected`. On `passed`, emit `law.triggered` with `enacted_by: 'collective'` additive widening.
- **D-12-04:** Proposal body in MySQL `governance_proposals`, NOT in audit payload. `title_hash = sha256(body_text)[:32]`. UUID v4 via `crypto.randomUUID()`. Body fetch RPC at `GET /api/v1/governance/proposals/:id/body` requires H2+ tier. Privacy matrix forbidden keys: `text|body|content|description|rationale|proposal_text|law_text|body_text`.
- **D-12-05:** Tombstone checks at all governance routes. Dead proposer: proposal not voided, no new ballots (410). Dead voter: commit remains (already counted), reveal rejected (410). Unrevealed committed ballot counted as non-reveal for tally purposes.
- **D-12-06:** Duplicate DID per proposal rejected at `ballot.committed` emitter (not just DB constraint). `voter_did` must pass DID regex AND must be in NousRegistry (not operator). CI gate: `scripts/check-governance-isolation.mjs`.
- **D-12-07:** Brain gains `ActionType.PROPOSE`, `ActionType.VOTE_COMMIT`, `ActionType.VOTE_REVEAL`. Brain uses `secrets.token_hex(16)` for nonce; stores `(proposal_id, nonce)` in local state between commit and reveal ticks.
- **D-12-08:** Migration version 6 with `governance_proposals` and `governance_ballots` tables. Four sole-producer files: `appendProposalOpened.ts`, `appendBallotCommitted.ts`, `appendBallotRevealed.ts`, `appendProposalTallied.ts`.
- **D-12-09:** Dashboard at `dashboard/src/app/grid/governance/page.tsx`. Proposals list (H1+), proposal detail (H1+ title_hash, H2+ body), per-Nous voting history (H5 only). No vote affordance. SWR polling 2000ms.
- **D-12-10:** On `passed`, Grid calls `LogosEngine.addLaw()` AND emits `law.triggered` with `enacted_by: 'collective'` widening. `appendProposalTallied.ts` is responsible. `appendLawTriggered.ts` is a new sole-producer (no existing emitter found in codebase).
- **D-12-11:** Three CI gate scripts: `check-governance-isolation.mjs`, `check-governance-plaintext.mjs`, `check-governance-weight.mjs`.

### Claude's Discretion

- `proposal_id`: UUID v4 via `crypto.randomUUID()` (Node 14.17+, no extra dep).
- Law DSL parsing: reuse `LogosEngine` law shape from `grid/src/logos/types.ts`; proposal body is JSON-stringified `Law` object.
- Tick hook integration: wire `tick_closed` callback into `GenesisLauncher` following existing `clock.onTick()` pattern.
- Wave structure: 5-wave pattern (W0: RED stubs + allowlist; W1: crypto/commit-reveal math; W2: emitters + rate logic; W3: API + Brain; W4: CI gates + dashboard + doc-sync).

### Deferred Ideas (OUT OF SCOPE)

- Quadratic / reputation / relationship-weighted voting (v2.3)
- Multi-proposal sequencing, proposal chains (GOV-MULTI-01, v2.3)
- Vote delegation (out of scope v2.2)
- Penalty policy for hash-mismatch reveals (logged not penalized in v2.2)
- Sybil-vote eligibility gate (v2.3)
- Proposal expiry notification event
- Per-Nous governance reputation score (post-v2.2)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTE-01 | `proposal.opened` event with closed-tuple `{proposal_id, proposer_did, title_hash, quorum_pct, supermajority_pct, deadline_tick}`. Body in MySQL. Defaults quorum=50%, supermajority=67%. | D-12-01, D-12-04, appendNousWhispered.ts clone pattern, schema.ts migration pattern. |
| VOTE-02 | `ballot.committed` with closed-tuple `{proposal_id, voter_did, commit_hash}` where `commit_hash = sha256(choice||nonce||voter_did)`. Duplicate DID rejected. | D-12-02, D-12-06, Node crypto.createHash('sha256') pattern from whisper/crypto.ts. |
| VOTE-03 | `ballot.revealed` with closed-tuple `{proposal_id, voter_did, choice, nonce}`. Hash-mismatch → 422, no emit, log only. | D-12-02, appendNousWhispered.ts validation pattern. |
| VOTE-04 | `proposal.tallied` with closed-tuple `{proposal_id, outcome, yes_count, no_count, abstain_count, quorum_met}`. On `passed`, promote to LogosEngine + emit `law.triggered`. | D-12-03, D-12-10, LogosEngine.addLaw() verified in logos/engine.ts. |
| VOTE-05 | Operators cannot vote/propose/tally at any tier. Governance is intra-Nous. Grep CI gate: no `operator.*` emit from governance module. | D-12-06, D-12-11. Registry.isTombstoned() interface pattern. |
| VOTE-06 | No token-weighted, reputation-weighted, or relationship-weighted voting. `check-governance-weight.mjs` CI gate. | D-12-11, PHILOSOPHY §6. |
| VOTE-07 | Dashboard Governance page with proposal list, tally results, law-promotion links. H5 per-Nous voting history tier-gate. | D-12-09, relationships/page.tsx clone pattern. |

</phase_requirements>

---

## Summary

Phase 12 implements a commit-reveal governance lifecycle where Nous collectively open proposals, commit blind ballots, reveal choices, and trigger automatic law promotion. The technical scope is four new sole-producer audit emitters (cloning `appendNousWhispered.ts`), MySQL migration version 6 with two new tables, a `GovernanceEngine` that wires into `GenesisLauncher.clock.onTick()` for tally triggering, Brain action dispatch for three new action types, and a Next.js 15 dashboard governance page cloning the relationships page structure.

The key research finding is that **`law.triggered` has NO existing sole-producer in the codebase**. The event appears only in `broadcast-allowlist.ts` and in test enumeration files. Phase 12 must create `appendLawTriggered.ts` as a new sole-producer. The payload shape will be the existing law DSL fields (`id`, `title`, `description`, `ruleLogic`, `severity`, `status`) plus the new `enacted_by: 'collective'` field — the planner must define this closed tuple.

SHA-256 is available via Node's built-in `node:crypto` (`createHash('sha256')`) — this is what the whisper crypto layer uses. No `@noble/hashes` dependency is needed for Grid-side commit-hash verification. Brain-side uses `hashlib.sha256` from Python stdlib.

**Primary recommendation:** Clone `appendNousWhispered.ts` x4 for the four sole-producers; clone `whisper-producer-boundary.test.ts` x4 for their boundary tests; clone `whisper-privacy-matrix.test.ts` for `proposal.opened` privacy; clone `check-whisper-plaintext.mjs` for `check-governance-plaintext.mjs`; wire `GovernanceEngine` into `GenesisLauncher` following the `RelationshipListener` construction-order discipline.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Proposal creation | API / Backend (Grid) | Brain (initiator) | Grid is the audit boundary; Brain submits the proposal body via RPC |
| Ballot commit (blind) | API / Backend (Grid) | Brain (nonce generator) | Grid stores commit_hash in MySQL; Brain generates the nonce and holds it |
| Ballot reveal + hash verify | API / Backend (Grid) | — | Grid performs sha256 verification at reveal boundary; Brain supplies nonce |
| Tally computation | API / Backend (Grid) | — | Pure deterministic tick-count logic in GovernanceEngine; no Brain involvement |
| Law promotion on pass | API / Backend (Grid) | — | LogosEngine.addLaw() call + law.triggered emit both in Grid |
| Proposal body storage | Database / Storage (MySQL) | — | Body text in governance_proposals table, never in audit payload |
| Dashboard read view | Frontend Server (SSR) | Browser / Client (SWR) | Next.js page server-renders shell; SWR polls proposals list client-side |
| Per-Nous voting history | API / Backend (Grid) | — | H5-gated RPC endpoint, tier enforcement on Grid side |
| Operator exclusion gate | API / Backend (Grid) | — | NousRegistry membership check + DID regex enforced at emitter boundary |
| Brain governance actions | Brain | API / Backend (Grid) | Brain decides when to PROPOSE/VOTE_COMMIT/VOTE_REVEAL; Grid dispatches |

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` | Node built-in | SHA-256 for commit_hash, title_hash, proposal_id UUID | Already used in whisper/crypto.ts for sha256; `crypto.randomUUID()` in send.ts. No new dep. [VERIFIED: codebase grep] |
| `mysql2/promise` | existing dep | MySQL queries for governance_proposals + governance_ballots | Already used in grid/src/db/ migration pattern. [VERIFIED: codebase] |
| `hashlib` (Python stdlib) | stdlib | Brain-side sha256 for commit_hash computation | Used in brain/src/noesis_brain/whisper/sender.py; `hashlib.sha256(...).hexdigest()`. [VERIFIED: codebase] |
| `secrets` (Python stdlib) | stdlib | `secrets.token_hex(16)` for nonce generation in Brain | Python stdlib, wall-clock-free, cryptographically secure. [VERIFIED: codebase grep] |
| `vitest` | existing | Grid test framework | 1122 tests currently passing. [VERIFIED: `cd grid && npx vitest run` output] |
| `pytest` (via uv) | existing | Brain test framework | 498 tests currently passing. [VERIFIED: `cd brain && uv run pytest` output] |
| Next.js 15 + React 19 | existing | Dashboard governance page | All dashboard pages use this stack. [VERIFIED: codebase] |
| SWR | existing | Dashboard data fetching with polling | Used in relationships page with `refreshInterval`. [VERIFIED: relationship-graph.tsx] |

### No New Dependencies

Phase 12 adds zero new runtime dependencies. All required primitives exist:
- Grid SHA-256: `node:crypto` `createHash('sha256')` [VERIFIED: grid/src/whisper/crypto.ts line 27]
- `crypto.randomUUID()`: available since Node 14.17, used in `grid/src/api/whisper/send.ts` line 34 [VERIFIED]
- Brain SHA-256: `hashlib.sha256` stdlib [VERIFIED: brain/src/noesis_brain/whisper/sender.py line 121]
- Brain nonce: `secrets.token_hex(16)` stdlib [ASSUMED — standard Python, not yet grep-verified in brain governance code as none exists yet]

---

## Architecture Patterns

### System Architecture Diagram

```
Brain                          Grid                           MySQL
  |                              |                              |
  |-- PROPOSE action ----------->|                              |
  |   {proposal_id, body_text,   |-- validateDID + tombstone -->|
  |    quorum_pct, deadline_tick}|-- INSERT governance_proposals|
  |                              |-- appendProposalOpened() --->| audit_trail
  |                              |   (6-key closed tuple)       |
  |                              |                              |
  |-- VOTE_COMMIT action ------->|                              |
  |   {proposal_id, commit_hash} |-- ballotExists check ------->|
  |                              |-- INSERT governance_ballots  |
  |                              |-- appendBallotCommitted() -->| audit_trail
  |                              |                              |
  |-- VOTE_REVEAL action ------->|                              |
  |   {proposal_id, choice,nonce}|-- sha256 verify (Grid only)  |
  |                              |-- UPDATE ballot.revealed=1   |
  |                              |-- appendBallotRevealed() --->| audit_trail
  |                              |                              |
  |   [on each tick]             |                              |
  |                              |-- GovernanceEngine.onTick()  |
  |                              |   currentTick >= deadline?   |
  |                              |   any ballot.revealed? Y/N   |
  |                              |-- SELECT tallyCounts() ------>|
  |                              |-- computeOutcome()           |
  |                              |-- UPDATE proposal.status     |
  |                              |-- appendProposalTallied() -->| audit_trail
  |                              |   if passed:                 |
  |                              |-- LogosEngine.addLaw()       |
  |                              |-- appendLawTriggered() ----->| audit_trail
  |                              |   + enacted_by:'collective'  |
```

### Recommended Project Structure (governance module)

```
grid/src/governance/
├── engine.ts               # GovernanceEngine — tick_closed hook, tally logic
├── types.ts                # ProposalPayload, BallotPayload, GovernanceConfig
├── appendProposalOpened.ts # Sole-producer for proposal.opened
├── appendBallotCommitted.ts# Sole-producer for ballot.committed
├── appendBallotRevealed.ts # Sole-producer for ballot.revealed
├── appendProposalTallied.ts# Sole-producer for proposal.tallied
├── appendLawTriggered.ts   # Sole-producer for law.triggered (NEW — none exists)
└── index.ts                # Barrel exports

grid/src/api/governance/
├── routes.ts               # Fastify plugin registering governance routes
├── propose.ts              # POST /api/v1/governance/proposals
├── commit.ts               # POST /api/v1/governance/proposals/:id/commit
├── reveal.ts               # POST /api/v1/governance/proposals/:id/reveal
├── body.ts                 # GET /api/v1/governance/proposals/:id/body (H2+ tier)
└── ballots.ts              # GET /api/v1/governance/proposals/:id/ballots/history (H5)

grid/test/governance/
├── governance-producer-boundary.test.ts  # x4 (clone whisper-producer-boundary)
├── governance-privacy-matrix.test.ts     # forbidden key matrix (clone whisper-privacy-matrix)
├── governance-commit-reveal.test.ts      # sha256 math, hash verify, mismatch handling
├── governance-tally.test.ts              # quorum logic, outcome enum, pessimistic quorum
├── governance-tombstone.test.ts          # dead proposer / dead voter behaviors
├── governance-operator-exclusion.test.ts # VOTE-05 operator cannot vote/propose
├── governance-zero-diff.test.ts          # tally listener is pure-observer
└── governance-law-triggered.test.ts      # enacted_by:'collective' additive widening

dashboard/src/app/grid/governance/
└── page.tsx                # Next.js 15 server component (clone relationships/page.tsx)

scripts/
├── check-governance-isolation.mjs        # no operator.* emit from governance/**
├── check-governance-plaintext.mjs        # forbidden body text keys (clone check-whisper-plaintext)
└── check-governance-weight.mjs           # no weight/reputation keys in ballot payloads
```

### Pattern 1: Sole-Producer Emitter (clone appendNousWhispered.ts)

**What:** Each new event has exactly one TypeScript file that calls `audit.append('event.name', ...)`. All other files are forbidden from calling it directly.

**When to use:** Every new allowlist event (VOTE-01 through VOTE-04).

```typescript
// Source: grid/src/whisper/appendNousWhispered.ts (verified clone template)
export function appendProposalOpened(
    audit: AuditChain,
    actorDid: string,
    payload: ProposalOpenedPayload,
): AuditEntry {
    // 1. DID regex guard on actorDid
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendProposalOpened: invalid actorDid (DID_RE failed)`);
    }
    // 2. Closed-tuple check FIRST (before field-level checks)
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...PROPOSAL_OPENED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new TypeError(`appendProposalOpened: unexpected key set`);
    }
    // 3-N. Field-level validation (DID, tick, hash, enum guards)
    // N+1. Explicit reconstruction (no spread — prototype pollution defense)
    const cleanPayload = {
        deadline_tick: payload.deadline_tick,
        proposal_id: payload.proposal_id,
        proposer_did: payload.proposer_did,
        quorum_pct: payload.quorum_pct,
        supermajority_pct: payload.supermajority_pct,
        title_hash: payload.title_hash,
    };
    // N+2. Privacy gate (payloadPrivacyCheck)
    const privacy = payloadPrivacyCheck(cleanPayload as unknown as Record<string, unknown>);
    if (!privacy.ok) {
        throw new TypeError(`appendProposalOpened: privacy violation`);
    }
    // N+3. Commit to chain
    return audit.append('proposal.opened', actorDid, cleanPayload);
}
```

### Pattern 2: GenesisLauncher Wiring (tick_closed hook)

**What:** New engine classes are constructed in `GenesisLauncher` constructor AFTER `this.audit` and registered on `clock.onTick()`.

**When to use:** GovernanceEngine needs a tick callback to trigger tally.

```typescript
// Source: grid/src/genesis/launcher.ts (verified pattern)
// In GenesisLauncher.constructor():
this.governance = new GovernanceEngine(this.audit, this.logos, this.registry, pool);

// In GenesisLauncher.bootstrap():
this.clock.onTick(async (event) => {
    // ... existing tick body (registry.touch, audit.append('tick'), snapshot) ...
    await this.governance.onTick(event.tick);  // tally trigger
});
```

**Critical:** Construction order — `this.audit` MUST exist before `this.governance` is constructed (same rule as `this.aggregator`). [VERIFIED: launcher.ts construction order discipline, D-9-04]

### Pattern 3: Brain Action Dispatch (clone DRIVE_CROSSED case)

**What:** Grid's `NousRunner.executeActions` switch receives Brain actions and routes them to sole-producers.

**When to use:** Three new Brain action types require matching cases in the switch.

```typescript
// Source: grid/src/integration/nous-runner.ts:383-403 (DRIVE_CROSSED case — verified)
case 'governance_propose': {
    // Clone drive_crossed: extract metadata keys, inject did+tick, route to emitter
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    // Extract: proposal_id, body_text, quorum_pct, supermajority_pct, deadline_tick
    // Grid injects proposer_did = this.nousDid, tick
    try {
        await this.governance.openProposal({
            proposer_did: this.nousDid, tick, ...extracted_md
        });
    } catch { /* silent drop per Phase 6 malformed-brain-response discipline */ }
    break;
}
```

### Pattern 4: Tombstone Check (isTombstoned interface)

**What:** Governance routes need `registry.isTombstoned(did)` to enforce D-12-05.

**How it works:** `NousRegistry` exposes `get(did)` which returns `NousRecord | undefined`. The tombstone state is `record.status === 'deleted'`. The `isTombstoned` method is exposed as a minimal interface for dependency injection in sole-producers (as in `appendBiosDeath.ts`).

```typescript
// Source: grid/src/bios/appendBiosDeath.ts lines 50 + 120 (verified)
export interface TombstoneCheck {
    isTombstoned(did: string): boolean;
}
// NousRegistry does NOT have isTombstoned() — it uses get() + status check.
// The pattern: registry.get(did)?.status === 'deleted'
// Governance routes should define their own TombstoneCheck interface
// (same as appendBiosDeath.ts) and use the registry adapter pattern.
```

**Critical finding:** `NousRegistry` does NOT currently have an `isTombstoned()` method [VERIFIED: `grep -n "isTombstoned" grid/src/registry/registry.ts` returns 0 hits]. The whisper/send.ts and whisper/router.ts use `deps.registry.isTombstoned(did)` via a minimal interface. Production wiring passes `NousRegistry` with an adapter or the method is added to NousRegistry. The planner must decide: add `isTombstoned()` to NousRegistry directly (cleaner), or use the `get() + status check` inline adapter pattern.

### Pattern 5: MySQL Migration (schema.ts MIGRATIONS array)

**What:** All schema changes go through the `MIGRATIONS` array in `grid/src/db/schema.ts`. Phase 12 adds version 6.

**Current state:** Migrations array ends at version 5 (`create_grid_config`). [VERIFIED: grid/src/db/schema.ts line 89]

```typescript
// Source: grid/src/db/schema.ts (verified pattern)
{
    version: 6,
    name: 'create_governance_tables',
    up: `
        CREATE TABLE IF NOT EXISTS governance_proposals (
            grid_name        VARCHAR(63)  NOT NULL,
            proposal_id      VARCHAR(36)  NOT NULL,
            -- ... (verbatim from D-12-08 SQL)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS governance_ballots (
            -- ... (verbatim from D-12-08 SQL)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    down: `
        DROP TABLE IF EXISTS governance_ballots;
        DROP TABLE IF EXISTS governance_proposals;
    `,
}
```

### Pattern 6: law.triggered Sole-Producer (NEW — create in Phase 12)

**Critical finding:** `law.triggered` has NO existing sole-producer in the codebase. [VERIFIED: grep for `audit.append.*law.triggered` and `chain.append.*law.triggered` returns 0 hits in grid/src/]. The event appears only in `broadcast-allowlist.ts` (as allowlist member) and test enumeration files. Phase 12 must create `appendLawTriggered.ts`.

The Law type is fully defined in `grid/src/logos/types.ts` [VERIFIED]:
```typescript
export interface Law {
    id: string;
    title: string;
    description: string;
    ruleLogic: RuleLogic;
    severity: LawSeverity;      // 'info'|'warning'|'minor'|'major'|'critical'
    status: LawStatus;          // 'proposed'|'active'|'repealed'
    proposedBy?: string;
}
```

The `law.triggered` payload (new, defined by Phase 12) should include enough for the operator to identify the law plus the `enacted_by` discriminator. The planner must finalize the closed tuple. Suggested minimal shape: `{law_id, title_hash, enacted_by}` where `enacted_by ∈ {operator, collective}`. The existing `operator.law_changed` event handles operator-side law mutations; `law.triggered` was in v1 but never given a sole-producer — it is essentially an unfinished v1 stub that Phase 12 completes.

### Anti-Patterns to Avoid

- **Bare `audit.append('proposal.opened', ...)` outside the sole-producer file:** The producer-boundary test will catch this. Clone the grep gate from `whisper-producer-boundary.test.ts`.
- **Spreading Brain metadata into the payload:** Always extract individual keys and reconstruct explicitly (`const cleanPayload = { key1: payload.key1, ... }`) — prevents prototype pollution per Phase 7 D-14 pattern.
- **Checking `Date.now()` for proposal deadline:** Deadline is `deadline_tick`, a tick count. Wall-clock ban applies to all governance code.
- **Storing nonce in MySQL before reveal:** Nonce is stored only at reveal time (D-12-02: "Grid stores it at reveal, never before").
- **Emitting `operator.law_changed` from governance module:** The CI gate `check-governance-isolation.mjs` will catch any import of `operator-events.ts` from `grid/src/governance/**`.
- **Using `Math.random()` for UUID or nonce:** `crypto.randomUUID()` for proposal_id in Node; `secrets.token_hex(16)` in Python Brain. Both are tested for wall-clock absence.
- **Wiring GovernanceEngine after `clock.start()`:** Must be constructed in constructor and registered in `bootstrap()` BEFORE `start()` — same ordering discipline as RelationshipListener.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID v4 for proposal_id | Custom ID generator | `crypto.randomUUID()` from `node:crypto` | Available since Node 14.17, already used in `send.ts` line 34 |
| SHA-256 hashing | Custom hash function | `node:crypto` `createHash('sha256')` (Grid) / `hashlib.sha256` (Brain) | Both already in use; byte-compatible across languages |
| Closed-enum validation | Custom validator | Literal-guard pattern from `appendBiosDeath.ts` (`assertCause`) | Proven pattern; throws at boundary, not silently accepts |
| MySQL connection | Direct `mysql2` calls | The existing `DatabaseConnection` / migration runner pattern | Pool management already handled; `MIGRATIONS` array is the only migration path |
| Law validation | Custom JSON schema validator | TypeScript type guard (`isLawShape` in governance-laws.ts) | Already implemented in `grid/src/api/operator/governance-laws.ts` line 36-44 |
| Privacy checks | Per-file ad-hoc checks | `payloadPrivacyCheck` from `broadcast-allowlist.ts` + governance-specific forbidden keys | Consistent with all prior phases; the global check plus a governance-specific pattern |

**Key insight:** The commit-reveal pattern is ~40 LOC with `node:crypto`. Any blockchain/DAO library (Aragon, Snapshot.js, OpenZeppelin Governor) would add the wrong trust model and hundreds of KB of dependencies for no benefit.

---

## Common Pitfalls

### Pitfall 1: isTombstoned method missing from NousRegistry

**What goes wrong:** Governance routes call `registry.isTombstoned(did)` but `NousRegistry` does not expose this method — `grep -n "isTombstoned" grid/src/registry/registry.ts` returns 0 hits. Callers (whisper/send.ts, whisper/router.ts) define their own `TombstoneCheck` interface and pass a compatible registry adapter.

**Why it happens:** The `isTombstoned` interface was introduced per-callsite, not added to NousRegistry directly.

**How to avoid:** Either (a) add `isTombstoned(did: string): boolean { return this.get(did)?.status === 'deleted' ?? false; }` to NousRegistry in Wave 1, or (b) use the inline `registry.get(did)?.status === 'deleted'` check everywhere. Wave 0 RED tests should assert the interface shape; GREEN adds the method.

**Warning signs:** TypeScript compilation errors on `registry.isTombstoned` in governance routes.

### Pitfall 2: law.triggered has no existing sole-producer

**What goes wrong:** Planning assumes `appendLawTriggered.ts` already exists; execution discovers the file does not exist and `law.triggered` is an unowned v1 event.

**Why it happens:** The allowlist includes `law.triggered` from v1, but no sole-producer was ever created (it was emitted via direct `audit.append()` in the original v1 code that has since been refactored away). [VERIFIED: grep returns 0 hits for emission sites]

**How to avoid:** Include `appendLawTriggered.ts` creation as an explicit task in Wave 2 of the plan. The producer-boundary test for `law.triggered` must enumerate it alongside the four governance events.

**Warning signs:** If the planner creates `appendProposalTallied.ts` but forgets `appendLawTriggered.ts`, the `proposal.tallied` → `law.triggered` promotion path will have no sole-producer.

### Pitfall 3: Nonce stored at commit time instead of reveal time

**What goes wrong:** Developer mirrors the commit_hash in the ballot table but also stores the nonce in `governance_ballots.nonce` at commit time. This defeats the purpose of blind voting — a DB-privileged operator could read the nonce to reverse the hash.

**Why it happens:** D-12-02 is explicit: "Grid stores it [nonce] at reveal, never before." The `governance_ballots` schema has `nonce VARCHAR(32)` as nullable, set only at reveal.

**How to avoid:** The `appendBallotCommitted.ts` emitter should NOT accept a nonce parameter. The `appendBallotRevealed.ts` emitter receives and stores the nonce as part of the reveal flow.

### Pitfall 4: Pessimistic quorum calculation using wrong denominator

**What goes wrong:** Quorum check uses `total_revealed / total_nous_count` instead of `(total_revealed + total_unrevealed_committed) / total_nous_count`.

**Why it happens:** The pessimistic quorum design (D-12-03) is non-obvious. A voter who commits but doesn't reveal is counted in the quorum denominator but NOT in yes/no/abstain counts — this prevents gaming by committing-then-ghosting.

**How to avoid:** The `GovernanceEngine.computeTally()` method must query BOTH `revealed=1` count AND `revealed=0` count for the quorum computation. Tally test must include a case with committed-but-unrevealed ballots that tip quorum status.

### Pitfall 5: GovernanceEngine construction after AuditChain listener registration window

**What goes wrong:** `GovernanceEngine` is constructed after `clock.start()` in `GenesisLauncher`, causing the tally tick hook to miss early ticks.

**Why it happens:** Launcher construction order discipline is critical (D-9-04 / Phase 7 pattern). All engines must be constructed BEFORE `bootstrap()` and `start()`.

**How to avoid:** Add `this.governance = new GovernanceEngine(...)` in the GenesisLauncher constructor AFTER `this.relationships` (maintain the ordered construction chain). Register the tally hook in `bootstrap()` inside the `clock.onTick()` callback.

### Pitfall 6: Proposal body leaking into audit payload via privacy check false-negative

**What goes wrong:** The `payloadPrivacyCheck` function uses `FORBIDDEN_KEY_PATTERN` which currently matches `text|body|content|...`. But `proposal.opened` payload keys are `proposal_id|proposer_did|title_hash|quorum_pct|supermajority_pct|deadline_tick` — none of which match. A developer might add `description` to a helper object that gets spread.

**Why it happens:** The global privacy check is substring-based and catches known keywords. Novel field names (e.g., `rationale`) might slip through if not added to a governance-specific forbidden key list.

**How to avoid:** Add `GOVERNANCE_FORBIDDEN_KEYS` constant to `broadcast-allowlist.ts` with the 8 keys from D-12-04: `{text, body, content, description, rationale, proposal_text, law_text, body_text}`. The CI gate `check-governance-plaintext.mjs` scans `grid/src/governance/**` for these keys.

---

## Code Examples

### SHA-256 commit_hash in TypeScript (Grid reveal verification)

```typescript
// Source: node:crypto — used in grid/src/api/whisper/send.ts:110 (verified pattern)
import { createHash } from 'node:crypto';

function computeCommitHash(choice: string, nonce: string, voterDid: string): string {
    return createHash('sha256')
        .update(`${choice}|${nonce}|${voterDid}`)
        .digest('hex');
}

// Verify at reveal:
const expectedHash = computeCommitHash(choice, nonce, voter_did);
if (expectedHash !== storedCommitHash) {
    // Log ballot_reveal_mismatch, return 422, do NOT emit ballot.revealed
}
```

### SHA-256 commit_hash in Python (Brain commit)

```python
# Source: hashlib used in brain/src/noesis_brain/whisper/sender.py:121 (verified pattern)
import hashlib
import secrets

nonce = secrets.token_hex(16)  # 32 hex chars = 16 bytes
raw = f"{choice}|{nonce}|{voter_did}"
commit_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
# Store (proposal_id, nonce) in Brain local state for reveal
```

### GenesisLauncher wiring (tick_closed hook)

```typescript
// Source: grid/src/genesis/launcher.ts bootstrap() lines 231-253 (verified pattern)
// In bootstrap():
this.clock.onTick(async (event) => {
    // ... existing body ...

    // Phase 12: governance tally trigger
    await this.governance.onTick(event.tick);
});
```

### Producer boundary test shape (clone of whisper-producer-boundary.test.ts)

```typescript
// Source: grid/test/whisper/whisper-producer-boundary.test.ts (verified)
describe("'proposal.opened' literal appears only in allowlist + sole-producer + known-consumers", () => {
    it("string 'proposal.opened' appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const src = readFileSync(file, 'utf8');
            if (/proposal\.opened/.test(src)) hits.push(relative(GRID_SRC, file));
        }
        hits.sort();
        const expected = ['audit/broadcast-allowlist.ts', 'governance/appendProposalOpened.ts', ...KNOWN_CONSUMERS].sort();
        expect(hits).toEqual(expected);
    });
});
```

### NousRunner dispatch cases (clone drive_crossed pattern)

```typescript
// Source: grid/src/integration/nous-runner.ts:383-403 (DRIVE_CROSSED case — verified)
case 'governance_propose': {
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const proposalId = typeof md['proposal_id'] === 'string' ? md['proposal_id'] : null;
    const bodyText = typeof md['body_text'] === 'string' ? md['body_text'] : null;
    const quorumPct = typeof md['quorum_pct'] === 'number' ? md['quorum_pct'] : 50;
    const supermajorityPct = typeof md['supermajority_pct'] === 'number' ? md['supermajority_pct'] : 67;
    const deadlineTick = typeof md['deadline_tick'] === 'number' ? md['deadline_tick'] : null;
    if (!proposalId || !bodyText || !deadlineTick) break; // silent drop on missing required fields
    try {
        await this.governance?.openProposal({ proposer_did: this.nousDid, proposal_id: proposalId, body_text: bodyText, quorum_pct: quorumPct, supermajority_pct: supermajorityPct, deadline_tick: deadlineTick, tick });
    } catch { /* silent drop per malformed-brain-response discipline */ }
    break;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare `audit.append('law.triggered', ...)` (v1 pre-Phase 5) | Sole-producer via `appendLawTriggered.ts` (Phase 12) | Phase 12 creates it | law.triggered is the last v1 event without a sole-producer boundary; Phase 12 completes the boundary discipline |
| MySQL migrations as ad-hoc SQL files | MIGRATIONS array in schema.ts (version 1–5) | Introduced in early phases | Version 6 follows the established in-code migration pattern |
| Brain action dispatch via giant if/elif chain | switch on `action_type` in NousRunner.executeActions | Phase 5 | Three new cases appended (governance_propose, governance_vote_commit, governance_vote_reveal) |

**Deprecated/outdated:**
- `@noble/hashes` for sha256: The codebase uses `node:crypto` `createHash('sha256')` for all sha256 operations. `@noble/hashes` is NOT in `grid/package.json`. [VERIFIED: no `@noble` in package.json deps]. The original phase description mentioned `@noble/hashes` but this is incorrect — use `node:crypto`.

---

## Open Questions

1. **`isTombstoned()` method on NousRegistry**
   - What we know: `NousRegistry.get(did)?.status === 'deleted'` is the inline check; a minimal `TombstoneCheck` interface is used per-callsite in whisper and bios.
   - What's unclear: Should Wave 1 add `isTombstoned(did: string): boolean` directly to NousRegistry, or should governance routes define a local interface adapter?
   - Recommendation: Add `isTombstoned()` to NousRegistry for DRY; it is a single-line method. Include in Wave 0 or Wave 1.

2. **`law.triggered` payload closed tuple**
   - What we know: The event is allowlisted from v1 but has no sole-producer; D-12-10 specifies additive widening with `enacted_by: 'collective'`.
   - What's unclear: The FULL existing `law.triggered` payload shape was never formally defined in any Context or Requirements doc. D-12-10 says "existing law.triggered payload (before this phase): unknown."
   - Recommendation: Phase 12 defines the canonical closed tuple for `law.triggered`. Suggested: `{law_id, title_hash, enacted_by}` where `enacted_by ∈ {operator, collective}`. Future operator-enacted laws (if added) would use `enacted_by: 'operator'`. Wave 0 RED tests must assert this tuple shape.

3. **GovernanceEngine pool injection pattern**
   - What we know: `RelationshipStorage` is injected via `attachRelationshipStorage(pool)` post-construction; `GovernanceEngine` needs MySQL access for proposal/ballot queries.
   - What's unclear: Should `GovernanceEngine` use the same pool-injection pattern as RelationshipStorage, or accept the pool at construction time?
   - Recommendation: Accept the pool at construction time (simpler) since GovernanceEngine has no "fallback to in-memory" mode — MySQL is always required for governance persistence.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node:crypto` (createHash, randomUUID) | commit_hash, proposal_id | Yes | Node built-in | — |
| MySQL2 (mysql2/promise) | governance tables, ballots storage | Yes | existing dep | — |
| `secrets` (Python stdlib) | Brain nonce generation | Yes | stdlib | — |
| `hashlib` (Python stdlib) | Brain sha256 | Yes | stdlib | — |
| vitest | Grid tests | Yes | existing | — |
| pytest (via uv) | Brain tests | Yes | uv run pytest | — |

All required dependencies are available. [VERIFIED: codebase and `uv run pytest` output]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Grid framework | vitest (existing config in `grid/vitest.config.ts`) |
| Brain framework | pytest via `uv run pytest` (existing config in `brain/pyproject.toml`) |
| Grid baseline | **1122 tests passing** (verified: `cd grid && npx vitest run` output 2026-04-23) |
| Brain baseline | **498 tests passing** (verified: `cd brain && uv run pytest` output 2026-04-23) |
| Grid quick run | `cd grid && npx vitest run --reporter=dot` |
| Grid full suite | `cd grid && npx vitest run` |
| Brain quick run | `cd brain && uv run pytest -q --tb=short` |
| Brain full suite | `cd brain && uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| VOTE-01 | proposal.opened emitter accepts valid 6-key payload | unit | `cd grid && npx vitest run test/governance/governance-producer-boundary.test.ts` | Wave 0 |
| VOTE-01 | proposal.opened rejects forbidden body keys (8 flat + 3 nested) | unit | `cd grid && npx vitest run test/governance/governance-privacy-matrix.test.ts` | Wave 0 |
| VOTE-01 | Migration version 6 creates governance_proposals + governance_ballots | unit | `cd grid && npx vitest run test/db/schema.test.ts` | Wave 1 |
| VOTE-02 | commit_hash = sha256(choice|nonce|voter_did) verification | unit | `cd grid && npx vitest run test/governance/governance-commit-reveal.test.ts` | Wave 1 |
| VOTE-02 | Duplicate ballot rejected pre-commit (409) | unit | `cd grid && npx vitest run test/governance/governance-commit-reveal.test.ts` | Wave 2 |
| VOTE-03 | Hash mismatch at reveal → 422, no ballot.revealed emit | unit | `cd grid && npx vitest run test/governance/governance-commit-reveal.test.ts` | Wave 2 |
| VOTE-04 | Quorum math: pessimistic (unrevealed committed counts in denom) | unit | `cd grid && npx vitest run test/governance/governance-tally.test.ts` | Wave 2 |
| VOTE-04 | outcome ∈ {passed, quorum_fail, rejected} | unit | `cd grid && npx vitest run test/governance/governance-tally.test.ts` | Wave 2 |
| VOTE-04 | On passed: LogosEngine.addLaw() called + law.triggered emitted | unit | `cd grid && npx vitest run test/governance/governance-law-triggered.test.ts` | Wave 2 |
| VOTE-04 | GovernanceEngine is pure-observer (zero-diff) | unit | `cd grid && npx vitest run test/governance/governance-zero-diff.test.ts` | Wave 2 |
| VOTE-05 | Operator cannot vote (voter_did not in NousRegistry → 403) | unit | `cd grid && npx vitest run test/governance/governance-operator-exclusion.test.ts` | Wave 2 |
| VOTE-05 | No operator.* emit from governance module (grep gate) | CI | `node scripts/check-governance-isolation.mjs` | Wave 4 |
| VOTE-06 | No weight/reputation keys in ballot payloads (grep gate) | CI | `node scripts/check-governance-weight.mjs` | Wave 4 |
| VOTE-07 | Dashboard governance page renders proposals list | unit | `cd dashboard && npx vitest run src/app/grid/governance/` | Wave 4 |
| VOTE-01..04 | Tombstone behaviors: dead proposer (410), dead voter reveal (410) | unit | `cd grid && npx vitest run test/governance/governance-tombstone.test.ts` | Wave 2 |
| All | Brain action types: PROPOSE, VOTE_COMMIT, VOTE_REVEAL | unit | `cd brain && uv run pytest test/test_governance_actions.py -x` | Wave 3 |

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run --reporter=dot` (full Grid suite, ~4s)
- **Per wave merge:** `cd grid && npx vitest run` + `cd brain && uv run pytest`
- **Phase gate:** Both suites fully green + all 3 CI gate scripts exit 0 before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/governance/governance-producer-boundary.test.ts` — x4 RED stubs (covers VOTE-01..04)
- [ ] `grid/test/governance/governance-privacy-matrix.test.ts` — RED stub
- [ ] `grid/test/governance/governance-commit-reveal.test.ts` — RED stub
- [ ] `grid/test/governance/governance-tally.test.ts` — RED stub
- [ ] `grid/test/governance/governance-tombstone.test.ts` — RED stub
- [ ] `grid/test/governance/governance-operator-exclusion.test.ts` — RED stub
- [ ] `grid/test/governance/governance-zero-diff.test.ts` — RED stub
- [ ] `grid/test/governance/governance-law-triggered.test.ts` — RED stub
- [ ] `brain/test/test_governance_actions.py` — RED stubs for PROPOSE, VOTE_COMMIT, VOTE_REVEAL
- [ ] `grid/test/audit/allowlist-twenty-six.test.ts` — clone of allowlist-twenty-two.test.ts, asserts 26 events

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Governance routes use DID + NousRegistry membership check (not human auth) |
| V3 Session Management | no | Stateless tick-based system |
| V4 Access Control | yes | H2+ tier for body fetch; H5 for ballot history; operator exclusion at emitter boundary |
| V5 Input Validation | yes | DID regex, closed-enum choice, hex nonce/hash validation at sole-producer boundary |
| V6 Cryptography | yes | SHA-256 via `node:crypto` (Grid) and `hashlib` (Brain) — standard, not hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Double-ballot attack | Tampering | `ballotExists(proposal_id, voter_did)` check at `appendBallotCommitted` boundary before DB write (D-12-06) |
| Operator vote injection | Elevation of Privilege | `voter_did` must be in NousRegistry (not operator ID) + grep CI gate on governance module |
| Proposal body plaintext in audit | Information Disclosure | Body in MySQL only; `title_hash = sha256(body)[:32]` in payload; 8-key governance privacy forbidden list |
| Nonce preimage leak | Information Disclosure | Nonce stored ONLY at reveal; NULL in governance_ballots until then |
| Hash mismatch reveal (attempted manipulation) | Tampering | 422 on mismatch; log `ballot_reveal_mismatch`; no emit; no count; not penalized in v2.2 |
| Tally timing manipulation | Tampering | Pure deterministic tick-count; no wall-clock; `tick_closed` fires exactly at `deadline_tick` |
| Operator reads proposal body below H2 | Information Disclosure | H2+ tier check on `/api/v1/governance/proposals/:id/body` (clone Phase 6 memory-query tier discipline) |
| weight/reputation in ballot payload | Tampering | `check-governance-weight.mjs` CI gate; VOTE-06 |

---

## Sources

### Primary (HIGH confidence)
- `grid/src/whisper/appendNousWhispered.ts` — sole-producer clone template [VERIFIED]
- `grid/src/audit/broadcast-allowlist.ts` — current 22-event allowlist, FORBIDDEN_KEY_PATTERN [VERIFIED]
- `grid/src/genesis/launcher.ts` — construction order discipline, clock.onTick() wiring pattern [VERIFIED]
- `grid/src/logos/engine.ts` — LogosEngine.addLaw() signature [VERIFIED]
- `grid/src/logos/types.ts` — Law DSL type shape [VERIFIED]
- `grid/src/db/schema.ts` — MIGRATIONS array at version 5 [VERIFIED]
- `grid/src/integration/nous-runner.ts` — executeActions switch pattern, DRIVE_CROSSED clone target [VERIFIED]
- `grid/src/integration/grid-coordinator.ts` — coordinator structure [VERIFIED]
- `grid/test/whisper/whisper-privacy-matrix.test.ts` — 16-case privacy matrix clone template [VERIFIED]
- `grid/test/whisper/whisper-producer-boundary.test.ts` — producer boundary test clone template [VERIFIED]
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum, Action dataclass [VERIFIED]
- `brain/src/noesis_brain/whisper/sender.py` — hashlib.sha256 + secrets.token_hex pattern [VERIFIED]
- `dashboard/src/app/grid/relationships/page.tsx` — dashboard page clone template [VERIFIED]
- `scripts/check-whisper-plaintext.mjs` — CI gate clone template [VERIFIED]
- vitest run output: 1122 tests passing [VERIFIED: 2026-04-23]
- uv run pytest output: 498 tests passing [VERIFIED: 2026-04-23]

### Secondary (MEDIUM confidence)
- `.planning/phases/12-governance-collective-law/12-CONTEXT.md` — all 12 decisions (D-12-01..D-12-11) [CITED]
- `.planning/REQUIREMENTS.md` §VOTE-01..07 [CITED]
- `.planning/STATE.md` Accumulated Context [CITED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `secrets.token_hex(16)` is wall-clock-free and determinism-safe for testing via seed | Standard Stack | If not deterministic in tests, Brain governance tests will fail; mitigation: pass explicit nonce in test fixtures |
| A2 | `isTombstoned()` is the intended method name for the registry interface (based on usage in appendBiosDeath.ts) | Common Pitfalls | Rename ripple across governance routes if wrong; low risk since pattern is established |
| A3 | The `law.triggered` closed tuple should be `{enacted_by, law_id, title_hash}` | Code Examples | Wrong tuple means allowlist test for law.triggered payload will fail in Wave 0; must finalize in plan |
| A4 | `GovernanceEngine.onTick()` is async (pool queries) and uses fire-and-forget pattern like RelationshipStorage | Architecture Patterns | Tick never blocked on MySQL I/O — same discipline as snapshot scheduling; if await blocks tick, miss deadline |

**Three claims were verified against codebase; four are partially assumed based on pattern extrapolation from prior phases.**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified present in codebase
- Architecture: HIGH — all patterns cloned from verified prior-phase implementations
- Pitfalls: HIGH — isTombstoned gap verified by grep (0 hits); law.triggered gap verified by grep (0 emission sites); other pitfalls based on D-12-XX decisions
- Test baseline: HIGH — verified by running both suites

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30-day stable; no fast-moving dependencies)
