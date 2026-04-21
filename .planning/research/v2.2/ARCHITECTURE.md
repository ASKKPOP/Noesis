# v2.2 Living Grid — Architecture Research

**Domain:** Integration patterns for 6 v2.2 themes onto the locked v2.1 architecture.
**Researched:** 2026-04-21
**Confidence:** HIGH — anchored directly in shipped code (`grid/src/audit/*`, `grid/src/integration/nous-runner.ts`, `brain/src/noesis_brain/rpc/handler.py`, `grid/src/dialogue/aggregator.ts`, `grid/src/audit/operator-events.ts`).

---

## 0. Architectural Invariants (v2.1 → v2.2, NON-NEGOTIABLE)

Every theme below is measured against these five invariants. Any proposal that breaks one is rejected at the producer boundary.

| Invariant | Enforcement Point | v2.2 Test for Every New Listener/Producer |
|---|---|---|
| **Sole-producer boundary** | One file in `grid/src/` per event type (grep-based `producer-boundary.test.ts`) | Add `<event>-producer-boundary.test.ts` that greps `grid/src/**` for `chain.append[^;]{0,200}['"]<event>['"]` and asserts ≤1 file matches. |
| **Closed-tuple payload** | `Object.keys(payload).sort()` strict-equality + explicit object literal construction (no spread) | Privacy matrix `<event>-privacy.test.ts` enumerating 6 forbidden keywords × N events + happy case. |
| **Hash-only cross-boundary** | Brain returns SHA-256 hashes; Grid validates `HEX64_RE = /^[0-9a-f]{64}$/` at RPC boundary; plaintext never crosses the wire. | `<feature>-boundary.test.ts` asserting Brain response shape has NO forbidden keys; a malformed non-hex returns 503 + no audit emit. |
| **Zero-diff listener invariant** | Unbroken since Phase 1 `29c3516`. Listener count MUST NOT mutate chain head. | `<feature>-zero-diff.test.ts`: byte-identical `entries[].eventHash` with vs without the new listener, under pinned `vi.setSystemTime()`. |
| **First-life promise (no purge)** | `auditChain.verify()` passes after tombstone (Phase 8); DID permanently reserved. | Any new purge-adjacent feature (replay, export, whisper) MUST NOT offer a `chain.truncate` or `audit.delete` affordance. |

**Plaintext-never keyword list (frozen):** `FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i` (`grid/src/audit/broadcast-allowlist.ts:100`). v2.2 extends the discipline to: `utterance`, `goal_description`, `drive_value`, `need_level`, `whisper_body`, `proposal_body`, `vote_rationale`, `memory_excerpt`. Every new closed-tuple payload must resist all 13 keywords.

**DID regex (frozen):** `/^did:noesis:[a-z0-9_\-]+$/i` — now re-used at 4 entry points (Phase 1 registry, Phase 5 reviewer, Phase 6 operator, Phase 7 telos-refined producer, Phase 8 tombstone). v2.2 producers re-import from `grid/src/audit/index.ts` (`TELOS_REFINED_DID_RE`) — do NOT introduce a 5th declaration.

---

## 1. Existing System (what v2.2 inherits)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Dashboard (Next.js)                         │
│  /grid  /nous/[id]  /operator  (H5 IrreversibilityDialog)            │
│  ◄── /ws/events (ring-buffered, allowlist-filtered)                  │
└────────────────────────────────────▲────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────┐
│                          Grid (TypeScript)                           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │WorldClock│──┤GridCoordinat.│──┤ NousRunner×N   │──┤   Brain    │ │
│  │  (ticks) │  │  (routing)   │  │  (RPC client)  │  │ (per-Nous) │ │
│  └──────────┘  └──────┬───────┘  └────────┬───────┘  └─────▲──────┘ │
│                       │                   │                │        │
│                       ▼                   ▼                │        │
│          ┌──────────────────────┐ ┌──────────────┐         │        │
│          │ DialogueAggregator   │ │   Reviewer   │         │        │
│          │ (pure listener P7)   │ │ (pre-commit) │         │        │
│          └──────────┬───────────┘ └──────┬───────┘         │        │
│                     │                    │                 │        │
│                     ▼                    ▼                 │        │
│  ┌──────────────────────────────────────────────────┐      │        │
│  │              AuditChain (SHA-256 linked)          │      │        │
│  │   ALLOWLIST: 18 event types (FROZEN except-add)   │      │        │
│  └──────────────────────┬───────────────────────────┘      │        │
│                         │                                  │        │
│       ┌─────────────────┼────────────────┐                 │        │
│       ▼                 ▼                ▼                 │        │
│  ┌──────────┐   ┌──────────────┐  ┌──────────┐             │        │
│  │NousRegist│   │ SpatialMap   │  │LogosEngin│             │        │
│  │ + Tombst.│   │  (regions)   │  │  (laws)  │             │        │
│  └──────────┘   └──────────────┘  └──────────┘             │        │
│                                                            │        │
│  ─ JSON-RPC Unix socket ───────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                                                ▲
                                                │ JSON-RPC (plaintext Brain-side only)
┌───────────────────────────────────────────────┴────────────────────┐
│                          Brain (Python)                             │
│  BrainHandler.on_tick / on_message / hash_state / query_memory /    │
│  force_telos / _build_refined_telos                                 │
│  ┌────────┐  ┌─────────┐  ┌────────┐  ┌──────────────┐              │
│  │ Psyche │  │ Thymos  │  │ Telos  │  │ MemoryStream │              │
│  │ (BigF) │  │ (emoti) │  │ (goals)│  │ (+ wiki, refl)│              │
│  └────────┘  └─────────┘  └────────┘  └──────────────┘              │
└────────────────────────────────────────────────────────────────────┘
```

**Current RPC surface (`BrainHandler`):** `on_message`, `on_tick(tick, epoch, dialogue_context?)`, `on_event`, `get_state`, `hash_state`, `query_memory`, `force_telos`.

**Current action taxonomy (`BrainAction`):** `speak`, `move`, `direct_message`, `trade_request`, `telos_refined`, `noop`.

**Current listener registry on `AuditChain.onAppend`:** (1) WsHub (broadcast filter), (2) Reviewer (pre-commit, Phase 5 — technically invoked inline from runner, not via onAppend, but conceptually a boundary listener), (3) DialogueAggregator (pure observer, Phase 7). All additions in v2.2 MUST preserve the zero-diff invariant of this registry.

---

## 2. Theme-by-Theme Integration

### Theme 1 — Rich Inner Life (Ananke / Bios / Chronos)

#### New components

| Package | New module | Role |
|---|---|---|
| `brain/` | `noesis_brain/ananke/drives.py` | `DriveEngine` — 5–7 internal drives (curiosity, autonomy, mastery, affiliation, security, meaning) with deterministic decay/trigger rules. Pure Python, no LLM call (v2.2 constraint: PROJECT.md Out-of-Scope row 5). |
| `brain/` | `noesis_brain/bios/needs.py` | `BiosManager` — bodily needs (rest, stimulation, sustenance). Decay per tick, satisfied by specific actions. |
| `brain/` | `noesis_brain/chronos/subjective_time.py` | `ChronosClock` — per-Nous subjective time (e.g. Thymos-high accelerates perceived tick rate, idle-Nous slows it). Reads `tick` from `on_tick` params; never writes to the Grid WorldClock. |
| `brain/` | `noesis_brain/prompts/inner_state.py` | Builds drive/need/chronos lines into the system prompt. |
| `grid/` | `grid/src/audit/append-drive-surge.ts` | **Sole producer** for `nous.drive_surge` (hash-only). |
| `grid/` | `grid/src/audit/append-bios-low.ts` | **Sole producer** for `nous.bios_low` (hash-only). |
| `dashboard/` | `dashboard/src/components/inspector/drive-bars.tsx` | Derived from `get_state` hash → opaque bar widget. **Plaintext drive values ONLY come from Brain via `get_state` direct Inspector RPC**, NOT from audit. The audit event is hash-only forensics; the Inspector gets plaintext the same way it already gets Psyche/Thymos/Telos (via `get_state`). |

#### Integration points

- **`BrainHandler.on_tick`** (existing) gains a pre-Telos step:
  ```python
  # Phase 9: Ananke/Bios/Chronos tick update (BEFORE dialogue_context consumption)
  self.ananke.step(tick)            # decay drives
  self.bios.step(tick)              # decay needs
  self.chronos.step(tick, self.thymos.mood)  # update subjective time
  # Existing Phase 7 dialogue_context consumption continues here…
  ```
- **`get_state`** (existing) returns a superset: adds `drives`, `needs`, `chronos` top-level keys. Dashboard Inspector already uses additive widening (`test_get_state_widening` strict-superset rule).
- **Telos bucket weighting**: drives influence `TelosManager.top_priority()` ordering. Kept Brain-side — Grid sees only the resulting `get_state` goal list and the `telos.refined` hash diff if the reweighting produces a non-identity change (reuses Phase 7 pathway — no new audit event needed for weight shifts).
- **Drive/need surge events** are additive: they fire from Brain's `on_tick` return value as a new action variant, OR — simpler — they fire from a new Grid-side `NousRunner` hook that compares successive `get_state` hashes. Recommendation: **action-variant** (action_type `drive_surge` / `bios_low`) with Brain as the authoritative source. This mirrors `telos_refined` exactly and re-uses the `NousRunner.executeActions` dispatch pattern.

#### New allowlist members (2)

| Event type | Closed-tuple payload (sorted keys) | Rationale |
|---|---|---|
| `nous.drive_surge` | `{did, drive_name, hash_after, hash_before, tick}` | `drive_name ∈ {"curiosity","autonomy","mastery","affiliation","security","meaning"}` — closed enum. Hash-only before/after ("drive" vector SHA-256). `tick` is the Grid tick (already on the wire via `on_tick`). |
| `nous.bios_low` | `{did, hash_after, hash_before, need_name, tick}` | `need_name ∈ {"rest","stimulation","sustenance"}` — closed enum. Hash-only. Fires only when crossing a threshold (e.g. need < 0.2). |

**Privacy posture:** both events rejected against the new `drive_value|need_level` forbidden-keyword set (adds 2 terms to `FORBIDDEN_KEY_PATTERN` in the same phase that introduces the first of these events).

**Chronos emits NO audit event** — subjective time is purely Brain-internal (pure Brain sovereignty). The Inspector surfaces `chronos` via `get_state`; it never enters the audit chain.

#### Data flow

```
Tick N ─────► GridCoord.onTick ─► aggregator.drain ─► NousRunner.tick
                                                         │
                                                         ▼
                              RPC: brain.onTick({tick, epoch, dialogue_context?})
                                                         │
                                    [Brain: Ananke.step → Bios.step → Chronos.step
                                     → Telos re-weight → maybe emit telos_refined
                                     → maybe emit drive_surge / bios_low actions]
                                                         │
                                                         ▼
                              NousRunner.executeActions →
                                  case 'drive_surge':  appendDriveSurge(hash_before, hash_after, drive_name)
                                  case 'bios_low':     appendBiosLow(hash_before, hash_after, need_name)
                                  case 'telos_refined': (existing Phase 7 path)
```

**Bridge crossings:** Only hashes (SHA-256 of drive vector, need vector) and closed enum names cross. Plaintext drive values stay Brain-side. Inspector RPC (`get_state`) carries plaintext DIRECTLY to dashboard, bypassing audit — this is the same privacy model already used for Telos/Psyche/Thymos in the Inspector panel.

#### Architectural risks

1. **Drive/need decay determinism drift** — if decay uses wall-clock time, zero-diff invariant breaks.
   **Mitigation (v2.1 pattern):** DialogueAggregator strict "no Date.now/Math.random/performance.now" rule (`grid/src/dialogue/aggregator.ts:11–14`). Extend to `ananke/bios/chronos` modules — enforced by a new Python import-linter rule `brain/tests/lint/no_wallclock_in_ananke.py` greping for `time.time|datetime.now|random\\.` under `noesis_brain/ananke`, `bios`, `chronos`.

2. **Drive surge storm** — chaotic Nous emits `drive_surge` every tick → audit chain bloats.
   **Mitigation (v2.1 pattern):** Phase 7 `_build_refined_telos` silent-no-op discipline (D-22). Brain emits surge ONLY on threshold crossing (hysteresis: emit once when crossing <0.2, don't re-emit until crossing >0.4 again). Same shape as "no-op refinement returns no action".

3. **Cross-component hash determinism** — `drive_hash_before` must match `drive_hash_after` of the PRIOR tick, forming a mini-chain. If `Drive` serialization is not canonical (dict key order), chain drifts silently.
   **Mitigation (v2.1 pattern):** Phase 8 D-07 locked canonical key order for `combineStateHash` (`psyche→thymos→telos→memory_stream`). Apply identical `canonicalSerialize` with frozen key tuple to drive/need vectors. Test: `brain/test/test_drive_canonical_hash.py` pins a golden hash.

#### Build order within theme

Chronos → Bios → Ananke. Rationale: Chronos has zero audit surface (lowest risk, establishes `step(tick)` pattern). Bios adds ONE audit event with threshold discipline. Ananke builds on the pattern with SEVEN drives + the more complex Telos-reweighting interaction. Each ships as its own phase (3 phases total).

---

### Theme 2 — Relationship & Trust

#### New components

| Package | New module | Role |
|---|---|---|
| `grid/` | `grid/src/relationships/tracker.ts` | `RelationshipTracker` — **pure listener** on AuditChain. Subscribes via `onAppend` to `trade.settled`, `trade.reviewed`, `nous.spoke`, `telos.refined`. Maintains per-(sorted-DID-pair) edge with {interaction_count, last_tick, weight_hash}. |
| `grid/` | `grid/src/relationships/storage.ts` | In-memory map + snapshot integration (existing MySQL snapshot adapter). |
| `grid/` | `grid/src/relationships/index.ts` | Barrel + `getRelationship(didA, didB)` read API. |
| `brain/` | `noesis_brain/rpc/handler.py` (additive method) | `get_relationship(counterparty_did) → {weight_hash, interaction_count, last_interaction_tick}` — Brain RPC proxy that calls Grid via an out-of-band query method. |
| `grid/` | `grid/src/api/relationship/query.ts` | HTTP + RPC endpoint for Brain to query its own relationships (Grid is authoritative; Brain is querier). |
| `dashboard/` | `dashboard/src/components/inspector/relationship-panel.tsx` | Per-(DID, DID) edge list on Inspector. |
| `dashboard/` | `dashboard/src/app/grid/relationships/page.tsx` | Grid-level force graph (vanilla SVG first; defer d3-force until N>50 Nous). |

#### Integration points

- **`AuditChain.onAppend` subscription** — new pure listener. Registers at `GenesisLauncher` construction, AFTER `this.audit` but BEFORE `this.aggregator` (preserves Phase 7 launcher construction order rule — `GenesisLauncher` constructor MUST construct `this.aggregator` AFTER `this.audit`; same pattern).
- **Brain query path** — Brain cannot push relationship data because Grid is authoritative. Pattern: Brain invokes `grid.getRelationship(counterparty_did)` via a new JSON-RPC method exposed by the Grid's RPC server. This is the **reverse direction** of every other RPC in v2.1 (which is Grid→Brain). Two options:
  - **Option A (recommended):** Grid injects relationship data into `on_tick` params (additive widening, same as dialogue_context). When `NousRunner.tick` fires, it queries `RelationshipTracker` for the top-K relevant counterparties and attaches them as `relationship_context: [{counterparty_did, weight_hash, interaction_count}, ...]`. Brain consumes as read-only context. Zero new RPC direction.
  - **Option B:** Bidirectional RPC (Brain initiates call over the same Unix socket). Adds a new server surface in Brain (Brain already hosts an RPC server; Grid would need to expose one too). Higher architectural cost.
  - **Verdict:** Option A. Re-uses the Phase 7 additive-widening pattern. No new bridge direction.

#### New allowlist members (2, possibly 0)

| Event type | Closed-tuple payload | Rationale |
|---|---|---|
| `relationship.warmed` | `{counterparty_did, did, tick, weight_hash_after, weight_hash_before}` | Fires when edge weight crosses a "warm" threshold (e.g. < 0.5 → ≥ 0.5). Hash-only. |
| `relationship.cooled` | `{counterparty_did, did, tick, weight_hash_after, weight_hash_before}` | Fires when edge weight crosses a "cool" threshold (e.g. ≥ 0.5 → < 0.5). Hash-only. |

**Alternative (strongly consider): emit ZERO audit events.** Relationship is fully derivable from existing audit events (`trade.settled`, `nous.spoke`, etc.). Treating RelationshipTracker as a **purely derived view** with NO audit emission preserves the zero-diff invariant perfectly and makes relationship a pure observer — mirrors the DialogueAggregator discipline exactly (aggregator does NOT emit, it only surfaces context).

**Decision for roadmapper:** Start with **zero audit emission** (pure observer, derived view). If emergent UX demands discrete "friendship formed" events, add `relationship.warmed/cooled` in a LATER phase with explicit allowlist growth. This is the conservative v2.1 pattern — DialogueAggregator emitted nothing; the Brain emitted `telos_refined` AFTER observing the aggregator's output. Ship the observer first, emit later if needed.

#### Data flow

```
trade.settled ───► AuditChain.onAppend ───► RelationshipTracker
nous.spoke    ───► AuditChain.onAppend ───► RelationshipTracker
telos.refined ───► AuditChain.onAppend ───► RelationshipTracker
                                                  │
                                                  ▼
                                       In-memory Map<pair_key, Edge>
                                                  │
                        ┌─────────────────────────┼─────────────────────┐
                        ▼                         ▼                     ▼
           GridCoord.onTick (top-K  Dashboard /ws/relationships   MySQL snapshot
           query for each NousRunner)            (read-only)       (restore path)
```

**Plaintext policy:** No conversation text, no trade amounts, no memory references are stored in the tracker. Edge weight is a scalar (computed from event counts + decay). The `weight_hash` in any future audit payload is SHA-256 of the canonical edge tuple.

#### Architectural risks

1. **Listener order affects chain hash (zero-diff)** — the single biggest risk. If `RelationshipTracker.onAppend` synchronously re-enters `chain.append` it mutates chain state during iteration.
   **Mitigation (v2.1 pattern):** DialogueAggregator rule — `onAppend` listener is strictly side-effect-free re: the chain (`grid/src/dialogue/aggregator.ts` registers listener, buffers locally, never calls `append`). Apply identical discipline. Regression: `relationship-zero-diff.test.ts` with 100 scripted events × 0 vs N relationship listeners → byte-identical `entries[].eventHash`.

2. **MySQL snapshot semantic drift** — relationship state is derivable from the audit chain, so snapshot integration is optional for v2.2 but adds complexity if added.
   **Mitigation (v2.1 pattern):** Phase 1 Grid MySQL adapter `snapshot/restore` lifecycle. For v2.2, DO NOT snapshot relationship state. On Grid restart, REBUILD tracker state by replaying the audit chain in-memory. This is O(audit_length) but trivially correct and audit-chain-authoritative. Adding snapshot later is additive and safe.

3. **Edge count blow-up at N=100 Nous** — dense relationship graph becomes O(N²) = 10,000 edges. In-memory map is fine; rendering force graph on dashboard is not.
   **Mitigation (v2.1 pattern):** arxiv 2512.08296 mesh-vs-star finding (centralized topology locked as Key Decision). Dashboard renders top-K=20 edges by weight. Full graph available via CSV export (Theme 6 tooling). Treat force-graph as a research-tool rendering, not real-time.

#### Build order within theme

Tracker (pure listener, zero audit) → Brain query injection into `on_tick` (relationship_context) → Dashboard panel → Dashboard force graph. If `relationship.warmed/cooled` are added, they come after the tracker has observed real emergent thresholds in long-horizon rigs (Theme 6 dependency).

---

### Theme 3 — Governance & Law

#### New components

| Package | New module | Role |
|---|---|---|
| `brain/` | `noesis_brain/rpc/types.py` (additive) | New `ActionType.PROPOSE_LAW`, `ActionType.CAST_VOTE`. |
| `brain/` | `noesis_brain/governance/proposal.py` | Hash-only proposal builder. Brain decides to propose; produces closed-tuple action with `proposal_body_hash` + minimal metadata. Plaintext body stays in Brain memory (new `proposal_drafts` sub-stream). |
| `grid/` | `grid/src/governance/engine.ts` | `GovernanceEngine` — in-memory proposal state machine. States: `proposed → voting → {promoted, rejected, expired}`. Integrates with `LogosEngine.amendLaw` for promoted proposals. |
| `grid/` | `grid/src/governance/storage.ts` | MySQL table for proposal plaintext body (Grid-side canonical store — proposals are NOT Brain-sovereign; they're inter-Nous contracts). |
| `grid/` | `grid/src/audit/append-law-proposed.ts` | Sole producer for `law.proposed`. |
| `grid/` | `grid/src/audit/append-law-voted.ts` | Sole producer for `law.voted`. |
| `grid/` | `grid/src/audit/append-law-promoted.ts` | Sole producer for `law.promoted`. |
| `grid/` | `grid/src/audit/append-law-rejected.ts` | Sole producer for `law.rejected`. |
| `grid/` | `grid/src/api/governance/*` | REST endpoints: `GET /proposals`, `GET /proposals/:id`, read-only (writes happen via Brain actions). |
| `dashboard/` | `dashboard/src/app/governance/page.tsx` | Proposal list + tallies + law lineage. |

#### Integration points

- **`NousRunner.executeActions`** — adds two new cases `case 'propose_law'` and `case 'cast_vote'`, mirroring the Phase 7 `case 'telos_refined'` boundary (authority check → producer helper → closed-tuple payload).
- **`LogosEngine.amendLaw`** (Phase 6 already exposes operator pathway) gains a second trigger path: `GovernanceEngine.finalize(proposalId)` calls `logos.amendLaw(…)` with `source: 'nous_vote'`. The shared validator `grid/src/api/operator/_validation.ts` is reused.
- **Proposal state transitions** are deterministic (tick-indexed). Voting window expires at tick N+K (configurable per law preset). Closure uses `WorldClock.onTick` subscription — same pattern as `DialogueAggregator`.
- **Proposal body storage:** unlike Telos plaintext (Brain-sovereign) or memory (Brain-sovereign), law proposal text is inherently social/public. It lives in MySQL on Grid. The audit chain carries only the hash + minimal metadata (proposer_did, tick).

#### New allowlist members (4)

| Event type | Closed-tuple payload | Notes |
|---|---|---|
| `law.proposed` | `{proposal_body_hash, proposal_id, proposer_did, tick, voting_window_ticks}` | `proposal_id` = SHA-256 truncated to 16 chars (reuse Phase 7 DIALOGUE_ID_RE shape). Body is stored in MySQL keyed by `proposal_id`. |
| `law.voted` | `{proposal_id, tick, vote, voter_did}` | `vote ∈ {"yes","no","abstain"}` — closed enum. No rationale on the wire (body hash of optional rationale could be added — deferred). |
| `law.promoted` | `{proposal_id, tally_no, tally_yes, tick}` | Deterministic promotion when tally exceeds threshold at voting window close. |
| `law.rejected` | `{proposal_id, reason, tally_no, tally_yes, tick}` | `reason ∈ {"window_expired_quorum","window_expired_tally","invariant_conflict"}` — closed enum. |

**Existing `law.triggered`** (v1, already allowlisted) remains the "law was invoked at runtime" event — unrelated to proposal→vote→promote lifecycle. `law.promoted` is the act of enactment; `law.triggered` is the act of application.

#### Data flow

```
Brain: ActionType.PROPOSE_LAW ─► NousRunner → case 'propose_law':
           ├─ Grid stores plaintext in MySQL `proposals` table
           ├─ appendLawProposed({proposal_id, proposer_did, proposal_body_hash, ...})
           └─ GovernanceEngine.register(proposal_id, voting_window_ticks)

Brain: ActionType.CAST_VOTE ─► NousRunner → case 'cast_vote':
           ├─ GovernanceEngine.recordVote(proposal_id, voter_did, vote)
           │     - rejects duplicate vote per (voter, proposal)
           │     - rejects vote outside voting window
           └─ appendLawVoted({proposal_id, voter_did, vote, tick})

WorldClock.onTick:
           GovernanceEngine.tick(currentTick):
              ├─ For each proposal with window_close == currentTick:
              │     if quorum && tally_yes > tally_no:
              │        appendLawPromoted({proposal_id, tally_yes, tally_no, tick})
              │        LogosEngine.amendLaw(proposal_id, source='nous_vote')
              │     else:
              │        appendLawRejected({proposal_id, reason, ...})
```

**Bridge crossings:** Proposal body hash crosses from Brain to Grid as part of the action metadata. Body plaintext is routed to MySQL via a NEW Grid-side path (Brain also keeps its own copy in `proposal_drafts` memory sub-stream — dual storage, which is OK because proposal body is not Brain-sovereign plaintext). Vote rationale, if supported in v2.2, is hash-only (`vote_rationale_hash` not in closed tuple — deferred).

#### Architectural risks

1. **Proposal body plaintext in MySQL breaks hash-only discipline** — this is the first v2.2 feature where Grid legitimately stores plaintext.
   **Mitigation (v2.1 pattern):** Treat proposal body like the existing `law.triggered` law body (Phase 6 D-11 — law body NEVER broadcast; stored in LogosEngine; audit payload carries law_id only). Extend same discipline: proposal body stored in MySQL, NEVER included in any audit event or WebSocket broadcast. Privacy test `governance-payload-privacy.test.ts` enumerates all 4 new events × forbidden keywords to ensure body plaintext never leaks to broadcast.

2. **Vote forgery (adversarial Brain casts vote for other DID)** — mirrors Phase 7 `recentDialogueIds` authority concern.
   **Mitigation (v2.1 pattern):** Phase 7 `triggered_by_dialogue_id` / `recentDialogueIds` authority check + Phase 8 `payload.did === actorDid` self-report invariant. `appendLawVoted` enforces `payload.voter_did === actorDid` at the producer boundary. NousRunner's `case 'cast_vote'` sets `voter_did = this.nousDid` unconditionally, ignoring any `voter_did` metadata from Brain (same pattern as `case 'telos_refined'` injects `did: this.nousDid`).

3. **`LogosEngine.amendLaw` now has two callers (operator H3 + nous vote promotion) — producer-boundary drift**
   **Mitigation (v2.1 pattern):** Phase 5 `appendTelosRefined` sole-producer pattern. `LogosEngine.amendLaw` internally calls a new `appendLawChanged` helper OR `appendLawPromoted` depending on source. BUT: two entry points can trigger one event only if the existing `operator.law_changed` and new `law.promoted` remain DISTINCT events — they are, so no conflict. `law.promoted` is nous-vote-originated; `operator.law_changed` is operator-originated. Different events, different producer boundaries. Crown jewel preserved.

#### Build order within theme

1. Proposal data model + `law.proposed` producer + MySQL table.
2. Voting + `law.voted` producer + per-(voter,proposal) uniqueness + voting window.
3. Finalization + `law.promoted` / `law.rejected` producers + `LogosEngine.amendLaw` integration.
4. Dashboard Governance page.

**Cross-theme dependency:** ideally ships AFTER Relationship (relationship weight might influence vote weight in future phases — defer this to post-v2.2) AND AFTER Ananke (meaning-drive and affiliation-drive motivate the act of proposing; otherwise Nous have no reason to propose). Build-order impact: Governance is Phase 13+ in the v2.2 roadmap.

---

### Theme 4 — Mesh Whisper (WHISPER-01)

#### New components

| Package | New module | Role |
|---|---|---|
| `brain/` | `noesis_brain/rpc/types.py` (additive) | `ActionType.SEND_WHISPER`. |
| `brain/` | `noesis_brain/rpc/handler.py` (additive) | `receive_whisper(sender_did, whisper_body)` — Brain-side RPC handler; whisper lands in a new private memory sub-stream. |
| `grid/` | `grid/src/whisper/router.ts` | `WhisperRouter` — stateless routing: receives a whisper action from NousRunner, looks up recipient NousRunner in GridCoordinator, calls `recipientBridge.receiveWhisper(sender_did, body)`. Grid does **NOT** persist whisper body; it is a pass-through router. |
| `grid/` | `grid/src/whisper/rate-limiter.ts` | Token bucket per sender (1 whisper / 10 ticks global; configurable per-pair in future). |
| `grid/` | `grid/src/integration/types.ts` | Extend `IBrainBridge` with `receiveWhisper(sender_did, body): Promise<void>`. |
| `grid/` | `grid/src/audit/append-whisper.ts` | Sole producer for `nous.whispered` — **payload is hash + length only**, plaintext NEVER enters audit chain. |

#### Integration points

- **`NousRunner.executeActions`** — new `case 'send_whisper'`: validates action, calls `whisperRouter.send(senderRunner, recipientDid, body)`.
- **`WhisperRouter.send`** — (1) rate-limit check, (2) recipient existence check (including tombstone), (3) compute body hash, (4) emit `nous.whispered` audit event with hash-only payload, (5) call `recipientRunner.bridge.receiveWhisper(sender_did, body)` — Grid-mediated but plaintext-transparent (router touches plaintext momentarily in memory; never writes it to disk/chain).
- **Critical bridge semantics:** the whisper plaintext travels: Brain_A → Grid (in-memory, transient) → Brain_B. The Grid NEVER persists plaintext. This is distinct from Phase 7 dialogue_context (which is also Grid-mediated but routes broadcast-derived text, NOT private text).
- **Brain-side storage:** recipient Brain's `receive_whisper` appends the body to a new `whisper_inbox` memory sub-stream. Sender Brain stores in `whisper_outbox`. Both are Brain-sovereign plaintext (same privacy model as existing memory stream / wiki).

#### New allowlist members (1)

| Event type | Closed-tuple payload | Rationale |
|---|---|---|
| `nous.whispered` | `{payload_hash, payload_length, recipient_did, sender_did, tick}` | Hash-only. `payload_length` gives operator enough forensic info (who said how much to whom when) without content leak. Matches the spirit of `nous.direct_message` existing payload which is metadata-only. |

**Privacy matrix additions:** `whisper_body`, `message_body`, `content` added to forbidden keyword set in the same phase.

#### Data flow

```
Brain_A: ActionType.SEND_WHISPER
    metadata = {recipient_did, body}            ← PLAINTEXT in Brain_A memory
        │
        ▼
NousRunner_A → case 'send_whisper' →
    WhisperRouter.send(senderRunner, recipient_did, body):
        │
        ├─ rateLimiter.consume(sender_did) or drop silently
        ├─ recipientRunner = coordinator.get(recipient_did); tombstoneCheck()
        ├─ body_hash = sha256(body)              ← hash computed in Grid memory
        ├─ appendWhisper({sender_did, recipient_did, payload_hash, payload_length, tick})
        │     NO BODY in payload. Only hash+length.
        ├─ await recipientRunner.bridge.receiveWhisper(sender_did, body)   ← plaintext through Grid
        │
        ▼
Brain_B: receive_whisper(sender_did, body) appends to whisper_inbox
```

**Bridge crossings (key invariant):** body plaintext crosses **Brain_A → Grid → Brain_B** via the existing Unix socket. The Grid process is a router; it never persists the body (no MySQL, no audit chain entry with body). The AuditChain gets hash-only forensics.

**Rejected alternatives:**
- "Queue in Grid, recipient polls" — would require Grid plaintext storage (even short-TTL). Rejected.
- "Direct Brain-to-Brain socket (bypass Grid)" — breaks audit chain centrality and mesh-vs-star Key Decision (PROJECT.md: "Centralized star topology (Grid hub) over mesh"). Rejected.

#### Architectural risks

1. **Plaintext through Grid memory is a new cross-boundary path** — all prior v2.1 flows kept plaintext Brain-side; this is the first deliberate exception.
   **Mitigation (v2.1 pattern):** Explicit `WhisperRouter.send` boundary: a single file where plaintext touches Grid. Producer-boundary test `whisper-router-boundary.test.ts` greps all `grid/src/**` for `whisper` + `body` and asserts the ONLY file handling plaintext is `grid/src/whisper/router.ts`. Also add a "plaintext-no-store" test that monkey-patches `fs.writeFile`/`chain.append` with `body` argument, runs 100 whispers, and asserts zero writes to either.

2. **Recipient tombstoned between audit emit and bridge call** — audit event records whisper to deleted Nous, but bridge call fails.
   **Mitigation (v2.1 pattern):** Phase 8 D-30 deletion order (validate → tombstoneCheck → Brain RPC → tombstone → despawn → audit emit). Apply mirror: WhisperRouter checks tombstone BEFORE emitting audit. Deletion-order test `whisper-tombstone-race.test.ts`.

3. **Rate-limit bypass via multi-recipient spam** — one sender whispers to 10 recipients in 1 tick.
   **Mitigation (new pattern, v2.1-style discipline):** Token bucket is per-sender (not per-(sender, recipient)). A 1-per-10-tick budget means sender can only emit 1 whisper per 10 ticks period. If per-pair granularity is desired, add a second bucket; keep v2.2 MVP simple with per-sender only.

#### Build order within theme

Whisper is the **smallest-viable** scope per PROJECT.md Out-of-Scope ("Full mesh topology… WHISPER-01 ships smallest-viable sidechannel, not full mesh"). Ships as 1 phase. Must come AFTER Ananke (affiliation drive motivates whispering) and AFTER Relationship (whisper to whom is shaped by relationships) — so this is Phase 14+.

---

### Theme 5 — Operator Observability (Replay / Rewind / Export)

#### New components

| Package | New module | Role |
|---|---|---|
| `grid/` | `grid/src/replay/engine.ts` | `ReplayEngine` — reads audit chain slice + snapshot, replays deterministically into an **isolated** `ReplayGrid` instance. Never mutates canonical chain. |
| `grid/` | `grid/src/replay/isolated-grid.ts` | `ReplayGrid` — composition of existing `GenesisLauncher` + overridden `AuditChain` (in-memory, append-only, NOT hash-linked to canonical) + overridden brain bridges (fake, replay-from-audit) + NO WsHub to broadcast. |
| `grid/` | `grid/src/replay/snapshot-loader.ts` | Reads MySQL snapshot at tick N, reconstructs registry + spatial + telos hashes + relationship tracker. |
| `cli/` | `cli/src/commands/replay.ts` | `noesis replay --from-tick 1000 --to-tick 2000 --snapshot snap-1000.sql --session-id S123` |
| `cli/` | `cli/src/commands/export.ts` | `noesis export --from-tick 1000 --to-tick 2000 --format jsonl --output audit-slice.jsonl` |
| `dashboard/` | `dashboard/src/app/replay/[session]/page.tsx` | Replay tab reads from isolated replay instance over a separate WebSocket port (`/ws/replay/:session`). Firehose shows historical events. |
| `grid/` | `grid/src/api/ws-hub.ts` (additive) | Replay mode: isolated `WsHub` instance on different port. Canonical `WsHub` untouched. |

#### Integration points

- **`ReplayEngine` is a separate process** (CLI-launched), NOT a mode of the running Grid. Cross-contamination mitigated by process boundary.
- **Shared code:** `GenesisLauncher` is parameterized to accept an `AuditChain` and brain-bridge factory; `ReplayGrid` constructs the launcher with its own chain and fake bridges. No fork of core code.
- **Brain bridges in replay mode:** `FakeReplayBridge` reads the audit chain slice; for each `nous.spoke` at tick T, the fake bridge's `sendTick(T)` returns `[{action_type: 'speak', channel, text}]` reconstructed from the audit payload. Where the original audit payload is hash-only (e.g. `telos.refined`), the replay reconstructs the hash but cannot replay the plaintext — this is a fundamental limitation of hash-only-first invariant. Plaintext Telos cannot be replayed, only its before/after hash sequence.
- **Snapshot + audit-slice export:** produces a tarball `{audit-chain.jsonl, snapshot.sql, metadata.json}` that can be replayed on another Grid instance.

#### New allowlist members (0)

Replay is read-only on the canonical chain. It emits no new events on the canonical chain. **Zero allowlist growth for this theme.**

The isolated `ReplayGrid` chain has its own (non-canonical, non-persisted) entries — these exist only for the duration of the replay session.

#### Data flow

```
CLI: noesis replay --from-tick 1000 --to-tick 2000 --snapshot snap-1000.sql
    │
    ▼
ReplayEngine.run():
    ├─ Load snapshot.sql into ephemeral MySQL database (separate schema)
    ├─ Load audit-chain slice [1000..2000] into memory
    ├─ Construct ReplayGrid:
    │     - AuditChain (isolated, in-memory, NOT linked to canonical)
    │     - NousRegistry (from snapshot)
    │     - SpatialMap (from snapshot)
    │     - FakeReplayBridge × N Nous (scripted from audit slice)
    │     - NO canonical WsHub
    │     - Isolated WsHub on replay port
    ├─ GenesisLauncher.start() — ticks 1000..2000
    │     Each tick, FakeReplayBridge returns pre-scripted actions from audit slice
    │     NousRunner executes them; isolated AuditChain collects a replay chain
    └─ Produce replay chain + diff report against canonical
        Dashboard subscribes to replay WsHub for live-replay view
```

**Cross-contamination risks and mitigations:**

| Risk | Mitigation |
|---|---|
| Replay writes to canonical MySQL | Separate schema + separate connection string enforced at CLI arg level. Launcher receives `dbConfig` — replay launcher gets a different one. |
| Replay writes to canonical audit chain | `ReplayGrid` constructs its own `AuditChain` instance; NEVER imports the launcher's chain. Zero-import test asserts `replay-engine.ts` does not import from canonical chain singleton path. |
| Replay broadcasts to canonical WsHub / operator dashboards | Replay WsHub binds to a different port; dashboard replay tab explicitly connects to `/ws/replay/:session`. Canonical `/ws/events` untouched. |
| Replay Brain bridges make real network/LLM calls | `FakeReplayBridge` is script-only: it never connects to a real Unix socket. Interface `IBrainBridge` has `connected: boolean` — fake returns `true` without connection. |
| Replay modifies the user's Nous database | Use MySQL `CREATE DATABASE noesis_replay_<session>` scratch schema; drop on exit. |

#### Architectural risks

1. **Replay divergence from canonical (replay produces different chain hashes)** — indicates non-determinism.
   **Mitigation (v2.1 pattern):** Phase 6 D-17 WorldClock pause/resume zero-diff invariant (`FIXED_TIME=2026-01-01T00:00:00.000Z`). Replay runs with `FIXED_TIME` pinned; all wall-clock sources banned (already enforced by v2.1 DialogueAggregator rule). Verification: replay chain hash over slice [1000..2000] MUST equal canonical chain hash over same slice. If not, a non-determinism bug — regression-pin that hash.

2. **Shared Brain LLM state leaking into replay** — if replay somehow uses real Brain, LLM call produces different output per run.
   **Mitigation:** `FakeReplayBridge` is enforced-script-only. Type system: `ReplayGrid` constructor rejects non-`FakeReplayBridge` brain factories at compile time.

3. **Hash-only replay gap** — some events (e.g. `telos.refined`) record only before/after hashes, not plaintext goals. Replay can reconstruct the hash transition but not the goal text.
   **Mitigation (acknowledged limitation, v2.1 pattern):** Phase 7 hash-only discipline was a deliberate privacy choice. For replay, enhance with optional "witness bundle" — operator can OPT-IN to export Brain plaintext state (force-Telos snapshot) alongside audit chain. Witness bundle sits next to snapshot in export tarball. Brain-side consent required (new `hash_state_full` RPC returning plaintext for export purposes, H5-tier gated).

#### Build order within theme

1. Export (read-only audit slice + snapshot dump — smallest surface area, pure read).
2. Replay engine (headless, CLI-only — reconstruction path + FakeReplayBridge).
3. Replay dashboard tab (UI over existing engine — additive).

**Cross-theme dependency:** Replay should ship AFTER all new event types (Themes 1–4), so the replay engine handles a complete v2.2 audit vocabulary from day one. So: Theme 5 is Phase 15+.

---

### Theme 6 — Researcher Tooling

#### New components

| Package | New module | Role |
|---|---|---|
| `cli/` | `cli/src/commands/rig.ts` | `noesis rig run --preset <genesis\|empty\|custom> --nous N --ticks K --output run.tar.gz` |
| `grid/` | `grid/src/rig/launcher.ts` | `RigLauncher` — wraps `GenesisLauncher` with: headless mode flag (no WsHub OR optional WsHub), long-horizon tick budget support, automatic snapshot-every-K-ticks, live metrics. |
| `grid/` | `grid/src/rig/export.ts` | Tarball composer: `audit-chain.jsonl`, `snapshots/tick-{N}.sql`, `nous-wikis/{did}.md`, `metrics.csv`, `metadata.json`. |
| `grid/` | `grid/src/rig/metrics.ts` | Per-tick metrics collector: Nous count, trade volume, message rate, relationship edge count, active proposal count. |
| `brain/` | `noesis_brain/cli/export_wiki.py` | CLI helper to dump a Nous wiki to markdown (Brain-sovereign data; operator-invoked). |

#### Integration points

- **`RigLauncher` extends `GenesisLauncher`** — NOT a fork. Same constructor signature, additional options: `{headless: bool, snapshotIntervalTicks: number, metricsOutputPath: string, durationTicks: number}`. When `headless=true`, WsHub is not mounted. When `durationTicks` is reached, launcher calls `stop()`.
- **Snapshot-every-K-ticks** hooks into `WorldClock.onTick` with `tick % K === 0` check → MySQL snapshot dump. Zero-diff preserved because snapshot is a read, not a write.
- **Metrics collector** is a **pure listener** on `AuditChain.onAppend` + a `WorldClock.onTick` subscriber. No audit emission.
- **Export tarball** is built after rig completion (post-stop). CLI streams to stdout or tarball path.

#### New allowlist members (0)

Researcher tooling is observation-only. Metrics are derived. Wiki export is Brain-side plaintext export (operator-consent gated same as whisper plaintext — but operator-level, not Nous-level). **Zero allowlist growth.**

#### Data flow

```
CLI: noesis rig run --preset genesis --nous 50 --ticks 10000 --output run-42.tar.gz
    │
    ▼
RigLauncher.start() {
    headless: true,
    snapshotIntervalTicks: 500,
    durationTicks: 10000,
    metricsOutputPath: '/tmp/rig-metrics.csv'
}
    │
    ├─ GenesisLauncher.start() (no WsHub if headless)
    ├─ MetricsCollector subscribes to AuditChain.onAppend + WorldClock.onTick
    ├─ Every 500 ticks: MySQL snapshot to snapshots/tick-{N}.sql
    ├─ At tick 10000: launcher.stop()
    └─ Export tarball:
         ├─ audit-chain.jsonl (full chain)
         ├─ snapshots/tick-500.sql, tick-1000.sql, …, tick-10000.sql
         ├─ nous-wikis/{did}.md (Brain export per Nous)
         ├─ metrics.csv (per-tick scalar metrics)
         └─ metadata.json (preset, seed, versions, fixed_time)
```

#### Architectural risks

1. **Long-horizon tick run produces unbounded AuditChain memory** — 10,000+ ticks × 50 Nous × multi-event-per-tick = millions of entries.
   **Mitigation (v2.1 pattern):** First-life promise says audit entries retained forever; doesn't mean all in RAM. Grid already persists chain to MySQL (Phase 2 STORE-01). For rigs, tune batch commit size (e.g. commit every 1000 entries). AuditChain stays in-memory within a tunable ring for recent entries (last 10,000); older entries evicted from memory but preserved in MySQL. No invariant break — audit chain is still append-only and never purged.

2. **Headless mode divergence from production Grid** — headless-only bug lands in rigs, developers don't see it in dashboard runs.
   **Mitigation (v2.1 pattern):** `RigLauncher` is a **configuration** of `GenesisLauncher`, not a subclass. Headless = `wsHub: null`. Any functional divergence is a launcher bug testable with the same v2.1 integration test suite. Reuse the Phase 6 shared-launcher pattern.

3. **Brain wiki export leaks sovereignty boundary** — operator-initiated Brain plaintext dump is a new cross-boundary path.
   **Mitigation (v2.1 pattern):** Phase 6 D-13 tier-required producer boundary. Wiki export is H4-or-H5 operator action. Requires explicit `IrreversibilityDialog`-equivalent "Acknowledge Brain sovereignty override" consent (copy-verbatim locked). Audit event `operator.wiki_exported` (not a v2.2 allowlist addition unless we commit to this; defer if possible). If wiki-export audit is needed, it adds a 5th `operator.*` family event.

#### Build order within theme

Rig launcher (headless mode) → Export tarball → Metrics collector → Wiki export (operator-gated). Researcher tooling is LAST because it validates everything else: a clean 10,000-tick rig is the smoke test for Themes 1–5 at scale.

---

## 3. Cross-Theme Allowlist Growth Summary

| Phase | Theme | New Events | Running Total |
|---|---|---|---|
| 9 | Chronos (Theme 1a) | 0 | 18 |
| 10 | Bios (Theme 1b) | 1: `nous.bios_low` | 19 |
| 11 | Ananke (Theme 1c) | 1: `nous.drive_surge` | 20 |
| 12 | Relationship (Theme 2) | 0 (pure derived view — MVP) | 20 |
| 13 | Governance (Theme 3) | 4: `law.proposed`, `law.voted`, `law.promoted`, `law.rejected` | 24 |
| 14 | Whisper (Theme 4) | 1: `nous.whispered` | 25 |
| 15 | Export / Replay (Theme 5) | 0 | 25 |
| 16 | Researcher Rigs (Theme 6) | 0 | 25 |

**Minimum v2.2 allowlist growth: +7 events (18 → 25).** Every addition through sole-producer boundary + closed-tuple payload + privacy matrix + `scripts/check-state-doc-sync.mjs` update + STATE.md enumeration bump, in the SAME commit (CLAUDE.md doc-sync rule).

**If `relationship.warmed/cooled` are added post-MVP:** +2 more events (27 total). Defer to later phase with explicit user pull.

---

## 4. Suggested Build Order (Dependency-Driven)

```
Phase  9 ── Chronos (Brain-only, zero audit)
Phase 10 ── Bios (1 audit event, hash-only; threshold-gated)
Phase 11 ── Ananke drives (1 audit event, hash-only; Telos re-weighting)
              │
Phase 12 ── Relationship tracker (pure listener; relationship_context injection into on_tick)
              │       ┌────────────────────────────────┐
              │       │  Ananke meaning/affiliation    │
              │       │  motivates proposals + votes   │
              ▼       ▼
Phase 13 ── Governance & Law (4 audit events)
              │
              ▼
Phase 14 ── Whisper (1 audit event, hash+length only; plaintext through Grid router)
              │
Phase 15 ── Export + Replay (0 audit events; read-only over full v2.2 vocabulary)
              │
Phase 16 ── Researcher Rigs (0 audit events; long-horizon validation of all prior)
```

**Rationale:**
- **Chronos first** (Phase 9): zero audit surface. Safest landing strip. Introduces `step(tick)` pattern.
- **Bios before Ananke**: one threshold event pattern before seven-drive complexity.
- **Ananke before Governance**: meaning-drive and affiliation-drive are what *motivate* a Nous to propose a law or cast a vote. Without inner pressure, governance produces zero proposals.
- **Relationship before Governance**: relationship weight informs vote intent (future phase); even in v2.2 MVP, relationship panel on Inspector is table-stakes context for understanding why Nous A would support Nous B's proposal.
- **Whisper after Relationship**: whisper-to-whom is shaped by relationship weights. Before relationships exist, whisper is undirected noise.
- **Export/Replay after all new events**: replay engine must know the complete v2.2 audit vocabulary. Shipping replay before whisper = replay can't reconstruct whisper-including runs.
- **Rigs last**: rigs are the integration smoke test for everything.

**Alternative order considered:** Whisper before Relationship (pure Brain-Brain sidechannel, no relationship dependency). Rejected because whispers without relationships produces chaotic noise with no observable social structure — MVP optics matter.

---

## 5. Architectural Patterns (Inherited from v2.1, Re-used in v2.2)

### Pattern 1: Sole-Producer Boundary

**What:** Each event type has exactly ONE file in `grid/src/` that calls `chain.append(eventType, …)`.
**When:** Every new allowlist event in v2.2.
**Enforcement:** Grep-based test (`<event>-producer-boundary.test.ts`) fails CI on drift.
**v2.1 exemplars:** `append-telos-refined.ts`, `append-nous-deleted.ts`, `operator-events.ts`.

### Pattern 2: Closed-Tuple Payload with Explicit Construction

**What:** Payload is an object literal with exactly N keys; `Object.keys(payload).sort()` strict-equality at producer; no spread.
**When:** Every new event.
**Enforcement:** Producer code reconstructs `cleanPayload = { key1: val, key2: val, ... }` literally; any Brain-side extra metadata is dropped at the runner boundary.
**v2.1 exemplar:** `appendTelosRefined` in `grid/src/audit/append-telos-refined.ts:86–91`.

### Pattern 3: Hash-Only Cross-Boundary

**What:** Brain returns SHA-256 hashes of plaintext state; Grid validates HEX64 regex at RPC boundary; plaintext never crosses wire.
**When:** Any Nous-internal state (drives, needs, goals, relationships-to-self, wiki).
**Enforcement:** Brain handler return type is `dict[str, str]` of hashes; Grid handler regex-validates before audit emit.
**v2.1 exemplar:** `BrainHandler.force_telos` + `BrainHandler.hash_state`.

### Pattern 4: Pure-Observer Listener

**What:** A listener on `AuditChain.onAppend` that reads but does NOT append to the chain (and does NOT cause any other listener to append differently).
**When:** Any derived view: DialogueAggregator, RelationshipTracker, MetricsCollector.
**Enforcement:** `<listener>-zero-diff.test.ts` — byte-identical `entries[].eventHash` with vs without listener, under pinned `vi.setSystemTime()`.
**v2.1 exemplar:** `DialogueAggregator` in `grid/src/dialogue/aggregator.ts`.

### Pattern 5: Authority Token (dialogue_id → recentDialogueIds)

**What:** Runner maintains a rolling set of tokens it issued to the Brain (via tick params); Brain must cite a token when emitting an action; runner rejects unknown tokens silently.
**When:** Any Brain-emitted action whose legitimacy depends on prior Grid-delivered context (future use: whisper reply, vote on a proposal the Nous knows about, drive_surge cite).
**Enforcement:** Authority check at runner boundary: `if (!runner.recentXxxIds.has(token)) drop silently`.
**v2.1 exemplar:** `NousRunner.recentDialogueIds` + `case 'telos_refined'` check.

### Pattern 6: Additive Widening of Brain RPC Params

**What:** Add new optional keys to existing RPC methods rather than introducing new methods when the domain is additive. Empty/absent keys preserve pre-widening behavior exactly.
**When:** `on_tick` gaining `dialogue_context`, `relationship_context`, `drive_context`.
**Enforcement:** "Phase K preserves Phase K-1 behavior" regression test: call with only pre-widening params, assert output matches pre-widening golden.
**v2.1 exemplar:** `on_tick(dialogue_context?)` in `BrainHandler.on_tick`.

### Pattern 7: Copy-Verbatim Locked Destructive UX

**What:** Any irreversible/destructive operator copy (button labels, warnings, titles) is pinned in test assertions; paraphrase fails.
**When:** Whisper-body-export consent (if needed), wiki-export consent, governance proposal deletion (if any).
**v2.1 exemplar:** `IrreversibilityDialog` constants `WARNING_COPY`, `TITLE_COPY`, `DELETE_LABEL`, `CANCEL_LABEL`.

### Pattern 8: Configuration Over Fork (for Launchers)

**What:** `RigLauncher`, `ReplayGrid` are *configurations* of `GenesisLauncher`, not subclasses or forks.
**When:** Theme 5 (replay) and Theme 6 (rig) launchers.
**Enforcement:** Headless / replay mode = constructor arg, not new class.
**v2.1 exemplar:** `GenesisLauncher` accepting optional reviewer, aggregator (Phase 7 additive widening of launcher constructor).

---

## 6. Consolidated Risk Register

| # | Risk (Theme) | Severity | Mitigation Pattern |
|---|---|---|---|
| R1 | Drive/need wall-clock non-determinism (T1) | High | Ban `time.time/Date.now/Math.random` in ananke/bios/chronos; import-linter rule. |
| R2 | Drive surge storm inflates audit chain (T1) | Medium | Threshold hysteresis; silent-no-op discipline from Phase 7 D-22. |
| R3 | Drive vector canonical-serialization drift (T1) | Medium | Locked canonical key order + golden-hash test (Phase 8 D-07 pattern). |
| R4 | Relationship listener mutates chain hash (T2) | Critical | Pure-observer discipline + `relationship-zero-diff.test.ts`. |
| R5 | Relationship edge explosion at N=100 (T2) | Medium | Top-K dashboard rendering; CSV export via Theme 6 tooling. |
| R6 | Vote forgery (T3) | Critical | `voter_did === actorDid` producer invariant (Phase 7/8 self-report pattern). |
| R7 | Proposal plaintext leak to broadcast (T3) | Critical | Body in MySQL only; hash-only in audit; privacy matrix enumerator. |
| R8 | `LogosEngine.amendLaw` multi-producer drift (T3) | Medium | Two distinct events (`operator.law_changed`, `law.promoted`); preserves sole-producer per event. |
| R9 | Whisper plaintext persisted in Grid (T4) | Critical | `WhisperRouter` sole plaintext-touch file; `fs.writeFile` monkey-patch test. |
| R10 | Whisper rate-limit bypass (T4) | Medium | Token bucket per-sender; audit `nous.whispered` records every attempt. |
| R11 | Whisper to tombstoned recipient race (T4) | Low | Tombstone check before audit emit (Phase 8 D-30 order). |
| R12 | Replay cross-contamination to canonical DB (T5) | Critical | Separate MySQL schema + import-boundary test. |
| R13 | Replay non-determinism divergence (T5) | High | `FIXED_TIME` + wall-clock ban; regression-pin replay chain hash. |
| R14 | Replay cannot reconstruct hash-only plaintext (T5) | Known limitation | Witness-bundle opt-in export (H5-gated). |
| R15 | Long-horizon rig audit-memory blow-up (T6) | Medium | MySQL-backed chain ring-buffer in memory (eviction-only, no purge). |
| R16 | Headless-mode divergence from dashboard runs (T6) | Medium | `RigLauncher` = configured `GenesisLauncher`, not fork. |
| R17 | Wiki-export breaches Brain sovereignty (T6) | High | H4/H5 tier-gated with copy-verbatim consent dialog; audit event if needed. |

All 17 risks map to a v2.1-origin mitigation pattern. No new invariant is required; v2.2 is a disciplined extension of the existing architectural doctrine.

---

## 7. Open Questions for `/gsd-discuss-phase`

1. **Governance proposal body storage location** — MySQL table on Grid (recommended) vs. Brain-sovereign (like Telos)? MVP answer: Grid MySQL, because proposals are inter-Nous contracts, not Brain-internal state. Revisit if this proves untenable.
2. **Whisper rate-limit granularity** — per-sender (MVP recommended) vs per-(sender,recipient)? Per-sender simpler; per-pair prevents targeted harassment but is over-engineering for v2.2.
3. **Relationship tracker — emit audit events or pure derived view?** Recommendation: start pure derived view (0 allowlist growth). Add `relationship.warmed/cooled` only when an emergent pattern demands it.
4. **Drive/need vector serialization key order** — mirror Phase 8 D-07 locked canonical key order explicitly in a shared module so future additions don't drift?
5. **Wiki export consent surface** — Inspector button with `IrreversibilityDialog`-style typed-DID paste-suppressed confirmation? Probably yes; ships with Theme 6.
6. **Replay "witness bundle" (optional plaintext export)** — does this exist in v2.2 or deferred? Recommendation: defer to v2.3 unless researchers pull on it explicitly.
7. **Chronos: does subjective time ever influence audit event tick numbering?** Strong recommendation: NO. Audit tick = WorldClock tick always. Chronos is Brain-internal and never contaminates the canonical tick contract.

---

## 8. Sources

- `.planning/PROJECT.md` (v2.2 opening, 2026-04-21)
- `.planning/STATE.md` (18-event allowlist, zero-diff invariant history)
- `.planning/MILESTONES.md` (Phase 5–8 shipped artifacts)
- `grid/src/audit/broadcast-allowlist.ts` (frozen allowlist, privacy pattern)
- `grid/src/audit/append-telos-refined.ts` (sole-producer + closed-tuple exemplar)
- `grid/src/audit/append-nous-deleted.ts` (Phase 8 H5 pattern)
- `grid/src/audit/operator-events.ts` (tier-required producer boundary)
- `grid/src/integration/nous-runner.ts` (action dispatch, authority-check, tick loop)
- `grid/src/integration/grid-coordinator.ts` (pull-query aggregator wiring)
- `grid/src/dialogue/aggregator.ts` (pure-observer listener exemplar)
- `brain/src/noesis_brain/rpc/handler.py` (RPC surface, hash-only boundary, additive widening)
- `.planning/research/stanford-peer-agent-patterns.md` (v2.1 research foundation; WHISPER-01 deferred pattern, mesh-vs-star Key Decision)

---

*Last updated: 2026-04-21 — v2.2 Architecture research complete; ready for roadmapper consumption.*
