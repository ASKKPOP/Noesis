# Phase 7: Peer Dialogue → Telos Refinement - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `/gsd-discuss-phase 7 --auto` (all gray areas auto-resolved with recommended options)

<domain>
## Phase Boundary

Two Nous exchanging ≥2 `nous.spoke` utterances with each other inside a sliding N-tick window trigger the Grid to aggregate the exchange into a `dialogue_context` field that lands on both participants' next `sendTick` RPC call. Brain may respond with a new `telos_refined` action; the Grid validates authority + signing, emits an allowlisted `telos.refined` audit event with **hash-only** payload (`{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`), and the dashboard Inspector surfaces a "↻ refined via dialogue" badge on Telos goals whose history references that event. The broadcast allowlist grows 16→17. The AuditChain zero-diff invariant is extended to cover 0-vs-10-listener determinism across dialogue + refinement.

**In scope:**
- **New allowlist member**: `telos.refined` — appended at position 17 in `ALLOWLIST_MEMBERS`.
- **New grid module** `grid/src/dialogue/aggregator.ts` — sliding-window observer on `nous.spoke` appends; maintains a bounded per-pair buffer; emits aggregated `DialogueContext` objects keyed by a deterministic `dialogue_id`.
- **Widened `sendTick` params** — adds optional `dialogue_context?: DialogueContext` field; additive, existing Phase 6 `test_get_state_widening.py` pattern applies.
- **New Brain `ActionType.TELOS_REFINED`** — Python RPC type + handler branch that inspects `dialogue_context` on incoming tick and MAY return a `telos_refined` action with `{new_goals, triggered_by_dialogue_id}` metadata (Brain-opt-in per PHILOSOPHY §1).
- **Grid-side telos_refined handler** in `NousRunner.executeActions` — validates hashes, appends `telos.refined` to AuditChain via a new producer-boundary helper `appendTelosRefined(...)` (mirror of `appendOperatorEvent` from Phase 6 D-13).
- **Hash-only payload** `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — 4 keys exactly, `Object.keys(payload).sort()` structural assertion, payloadPrivacyCheck enforced.
- **Privacy matrix** `grid/test/audit/telos-refined-privacy.test.ts` — 1 event × (6 forbidden keys + 1 nested + 1 happy) = 8 enumerated cases + coverage assertion that `EVENT_SPECS` includes `telos.refined`.
- **Inspector badge** in `dashboard/src/app/grid/components/inspector-sections/telos.tsx` — "↻ refined via dialogue" chip on any goal whose `id` (sha256(description)[:12]) matches a known `after_goal_hash`-derived identifier from firehose; click-through filters firehose by `triggered_by_dialogue_id`.
- **AuditChain determinism regression** — 100-tick run with dialogue aggregation enabled + telos.refined actions emitted, assert byte-identical chain head across 0 vs 10 WebSocket listeners (extends the Phase 6 c7c49f49… hash pattern).
- **Grid config knobs** under `config.dialogue.{windowTicks, minExchanges}` — defaults `{5, 2}`; boundary test asserts aggregation fires at min and does NOT fire below min.
- **Doc-sync reconciliation** — `scripts/check-state-doc-sync.mjs` bumped 16→17 events; STATE.md + README.md updated in the same phase-closing commit per CLAUDE.md doc-sync rule.

**Explicitly out of scope:**
- **Grid opinion on dialogue outcomes.** Grid aggregates; Brain decides if a refinement is warranted. No "did this dialogue produce a good refinement" judgment at Grid layer (REV-04 invariant extends).
- **Dialogue content persistence at Grid.** Aggregator buffers are in-memory, bounded, ephemeral. Memory write is Brain's prerogative.
- **Three-or-more-party dialogue aggregation.** Strictly pairwise for v2.1; group conversations tracked under a deferred WHISPER-02 or DIALOGUE-GROUP-01 requirement.
- **Broadcast of dialogue content.** `nous.spoke` already broadcasts first 200 chars (Phase 1 invariant); `telos.refined` adds NO utterance content, only the dialogue_id reference.
- **Cross-grid dialogue.** Inter-grid federation is Phase 5-milestone-5 (Out of Scope per PROJECT.md).
- **`telos.refined` under H4 force-Telos path.** H4 (Phase 6) already has its own event `operator.telos_forced`; `telos.refined` is strictly the Nous-initiated path. An operator invoking H4 does NOT emit `telos.refined`.
- **Retroactive dialogue detection.** If a Nous is paused/resumed across a dialogue window boundary, the buffer resets — no cross-pause aggregation. Mirrors Phase 6 D-17 pause-is-a-clean-boundary discipline.
- **Pluggable dialogue classifiers.** A future Phase could introduce "topic similarity" or "persona-contingent" triggers; v2.1 triggers only on cardinality (≥2 bidirectional within window).
- **H5 Sovereign deletion.** Still Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Dialogue Detection & Aggregation (DIALOG-01)

- **D-01 — Trigger semantics: bidirectional rolling window.** An aggregated `dialogue_context` fires when, within a sliding `windowTicks`-sized window (default 5), the Grid has observed **≥ minExchanges total `nous.spoke` events** (default 2) between the **same unordered DID pair** AND **at least one utterance in each direction** (A→channel and B→channel both observed). Two A→channel utterances alone do NOT trigger. Rationale: SPARC-style dialogue is bidirectional by construction; a speaker monologuing into a channel while a listener is silent does not refine shared goals.
- **D-02 — Pair identity is the unordered set `{did_a, did_b}`.** Aggregator buffers are keyed by `pair_key = [did_a, did_b].sort().join('|')`. Both participants see the SAME dialogue and the SAME `dialogue_id`.
- **D-03 — Aggregator lives at `grid/src/dialogue/aggregator.ts`.** New module. Subscribes to `AuditChain.on('append', ...)` (or equivalent listener surface; planner may use the existing Phase 2 listener hub if available) and filters for `eventType === 'nous.spoke'`. Keeps a bounded ring buffer per `pair_key` of shape `{tick, speakerDid, channel, text: text.slice(0,200), name}`. Buffer cap is `windowTicks × 4` entries per pair (prevents unbounded memory under bursty channels). Entries older than `currentTick - windowTicks` are evicted on every new append.
- **D-04 — Aggregation is stateless across pauses.** On `WorldClock.pause()` the aggregator buffer is drained (matches Phase 6 D-17: pause/resume is a clean boundary). Buffers rebuild from fresh observations after resume.
- **D-05 — Channel gating.** Only utterances on the **same channel** within the window count toward a single dialogue. Cross-channel parallel exchanges are distinct dialogues. `pair_key` is extended to `pair_key|channel` to prevent false-positive aggregation when A and B happen to be active on two channels simultaneously.

### Dialogue ID & Determinism (DIALOG-02 prerequisite)

- **D-06 — Deterministic `dialogue_id`.** `dialogue_id = sha256(`${sortedDids.join('|')}|${channel}|${windowStartTick}`).slice(0, 16)`. Both sides derive the same id without coordination, and the id is reproducible across replays — zero-diff-compatible.
- **D-07 — `windowStartTick` is the tick of the FIRST utterance in the current window.** Not the tick at which the threshold is crossed. Makes the id stable under late-arriving participants and across `minExchanges` changes.
- **D-08 — Once a `dialogue_id` has been surfaced to a participant, subsequent utterances extend the same dialogue** until the window expires (no utterance between the pair for `windowTicks` ticks). When the window expires, the next qualifying exchange mints a NEW `dialogue_id`. This prevents perpetual context stickiness and matches SPARC session semantics.

### Dialogue Context Shape (DIALOG-01)

- **D-09 — `DialogueContext` TypeScript interface** (grid side):
  ```ts
  interface DialogueContext {
      dialogue_id: string;            // 16-hex
      pair: [string, string];         // sorted DIDs
      channel: string;
      window_start_tick: number;
      window_end_tick: number;         // current tick at emit
      utterances: ReadonlyArray<{
          tick: number;
          speaker_did: string;
          speaker_name: string;
          text: string;                 // already 200-char-truncated at nous.spoke producer
      }>;                                // MAX 5 entries (most recent), enforced at emit site
  }
  ```
  Field `utterances` is capped at 5 entries (`lastUtterances = buffer.slice(-5)`) to bound `sendTick` RPC payload size and match the `windowTicks` default.
- **D-10 — `sendTick` params widen additively.** New signature on the Python side: `on_tick(params: {tick: int, epoch: int, dialogue_context: DialogueContext | None = None})`. TS `TickParams` extends: `dialogue_context?: DialogueContext`. Existing callers that never pass the field work unchanged — Phase 6 `test_get_state_widening.py` pattern applies.
- **D-11 — Delivery is per-participant, per-tick.** On the tick where the threshold crosses, `GridCoordinator` (or the aggregator directly, if wired) iterates the pair and calls `runner.bridge.sendTick({tick, epoch, dialogue_context})` for each of the 2 Nous. If a Nous's bridge is disconnected, the dialogue_context is dropped for that Nous (best-effort; no retry, no queue).
- **D-12 — Dialogue context is NOT persisted.** The aggregator keeps the utterance buffer; the emitted `DialogueContext` is a view over the buffer at that moment. No separate `dialogues` table, no snapshotting. Replaying the AuditChain reproduces identical DialogueContexts because `nous.spoke` is ordered + deterministic.

### Brain `telos_refined` Action (DIALOG-02)

- **D-13 — New `ActionType.TELOS_REFINED`** added to `brain/src/noesis_brain/rpc/types.py`:
  ```python
  class ActionType(str, Enum):
      SPEAK = "speak"
      DIRECT_MESSAGE = "direct_message"
      MOVE = "move"
      TRADE_REQUEST = "trade_request"
      TELOS_REFINED = "telos_refined"       # Phase 7 (DIALOG-02)
      NOOP = "noop"
  ```
- **D-14 — Action metadata contract** (Brain → Grid):
  ```
  action_type: 'telos_refined'
  channel: '' (ignored)
  text: '' (ignored)
  metadata: {
      new_goals: list[{description: str, priority: float}]     // Brain's proposed refined goal set
      triggered_by_dialogue_id: str                             // 16-hex from DialogueContext
      before_goal_hash: str                                      // 64-hex, computed BEFORE rebuild
      after_goal_hash: str                                       // 64-hex, computed AFTER rebuild
  }
  ```
  Brain is responsible for (a) deciding whether to refine, (b) rebuilding its TelosManager, (c) computing both hashes via `compute_active_telos_hash` (Phase 6 sole hash authority). Brain does NOT write to memory at this boundary — memory integration is a separate Brain-internal concern.
- **D-15 — Brain opt-in is the rule.** `on_tick` inspects `dialogue_context`; if present the prompt/heuristic MAY (not MUST) produce a `telos_refined` action. Grid never coerces refinement. This preserves PHILOSOPHY §1 sovereign intelligence — dialogue provides input, cognition decides.
- **D-16 — Grid-side validation contract** (NousRunner.executeActions, new `case 'telos_refined'`):
  1. Assert `metadata.triggered_by_dialogue_id` is a known dialogue_id that was delivered to THIS nous within the last `windowTicks × 2` ticks (replay-protection + authority: a Nous cannot forge a dialogue id it never participated in).
  2. Assert `metadata.before_goal_hash` and `metadata.after_goal_hash` each match `/^[0-9a-f]{64}$/` (contract-drift guard at the RPC boundary; mirrors Phase 6 D-19 hash-regex pattern).
  3. Assert `metadata.new_goals` is an array of `{description: string, priority: number}` objects (payload shape check).
  4. On any assertion failure: log warning, drop silently, NO audit emit (mirrors Phase 6 malformed-brain-response pattern).
  5. On success: call `appendTelosRefined(this.audit, this.nousDid, { dialogue_id, before_goal_hash, after_goal_hash })` — single producer boundary.
- **D-17 — `appendTelosRefined` is the SOLE producer path for `telos.refined`.** New helper at `grid/src/audit/append-telos-refined.ts`, structurally symmetric to Phase 6's `appendOperatorEvent`. Any direct `auditChain.append({ eventType: 'telos.refined', ... })` fails a new producer-boundary gate test in `grid/test/audit/telos-refined-producer-boundary.test.ts`.
- **D-18 — `new_goals` plaintext NEVER crosses the grid producer boundary.** The grid-side helper accepts only hashes + dialogue_id; it has no knob to pass `new_goals`. Brain stays the sovereign owner of goal plaintext (PHILOSOPHY §1); the audit chain sees only the cryptographic diff, matching Phase 6 D-19 hash-only discipline for `operator.telos_forced`.

### Broadcast Allowlist & Payload Contract (DIALOG-02)

- **D-19 — Allowlist grows 16→17.** `ALLOWLIST_MEMBERS` in `grid/src/audit/broadcast-allowlist.ts` gains `'telos.refined'` **at position 17**, appended after `'operator.telos_forced'`. Tuple order locked — any reorder fails the frozen-ordering test.
- **D-20 — Closed payload tuple (4 keys exact):**
  ```
  { did: string, before_goal_hash: string, after_goal_hash: string, triggered_by_dialogue_id: string }
  ```
  Structural `Object.keys(payload).sort()` assertion in `telos-refined.test.ts` fails if any key is added or removed (same discipline as Phase 6 D-11 for `operator.law_changed`).
- **D-21 — `payloadPrivacyCheck()` passes natively** — the four keys contain no substring matching `/prompt|response|wiki|reflection|thought|emotion_delta/i`. No FORBIDDEN_KEY_PATTERN extension needed.
- **D-22 — Privacy matrix `grid/test/audit/telos-refined-privacy.test.ts`:** 1 event × (6 forbidden key names + 1 nested forbidden + 1 happy baseline) = 8 enumerated cases. Plus a coverage assertion: `EVENT_SPECS` (or the Phase 6 equivalent constant) must include `telos.refined`. Pattern identical to Phase 6's 40-case matrix, scaled for 1 event.

### AuditChain Determinism (Success Criteria #4)

- **D-23 — Zero-diff-under-listeners regression.** New test `grid/test/dialogue-zero-diff.test.ts`: 100-tick simulation with deterministic clock (`FIXED_TIME='2026-01-01T00:00:00.000Z'`, `tickRateMs=1_000_000`, `ticksPerEpoch=25`), a hand-rigged brain bridge that emits a deterministic dialogue exchange at tick 20–22 and returns a `telos_refined` action at tick 23 on both participants. Assert AuditChain.head() is byte-identical across 0 WebSocket listeners vs 10 listeners. This extends Phase 6's c7c49f49… regression hash pattern into dialogue territory.
- **D-24 — `AuditChain.verify() === {valid: true}`** after the 100-tick run is asserted in the same test. Chain integrity must be preserved across the dialogue + refinement sequence.

### Config (Success Criteria #5)

- **D-25 — Grid config knobs.** `config.dialogue = { windowTicks: 5, minExchanges: 2 }` with env/config-file overrides. Plumbed through `GenesisLauncher` → `DialogueAggregator` constructor. No new singletons; aggregator is a plain class instantiated once per Grid at startup.
- **D-26 — Boundary test for N.** `grid/test/dialogue/aggregator-window.test.ts` runs three scenarios against an in-memory aggregator: (1) `windowTicks=5, minExchanges=2`, bidirectional exchange at ticks 0+3 — aggregation fires; (2) same config, exchange at ticks 0+6 (second utterance outside window) — does NOT fire; (3) `windowTicks=10, minExchanges=3`, 2-utterance bidirectional exchange — does NOT fire (below threshold); 3-utterance bidirectional — fires. Validates Success Criteria #5.

### Inspector Badge (DIALOG-03)

- **D-27 — Badge is derived, not stored.** `dashboard/src/app/grid/components/inspector-sections/telos.tsx` accepts a new prop `refinedGoalHashes: ReadonlySet<string>` (hashes of goals that have a matching `after_goal_hash` in the firehose history for this nous). For every goal, if `sha256(description)` starts with any hash in the set (or matches the `after_goal_hash` composition rule defined by Brain's `compute_active_telos_hash` — pinned at Phase 6), render a `<Chip>` with label "↻ refined via dialogue" and testid `goal-refined-badge-${goal.id}`.
- **D-28 — `refinedGoalHashes` flows from a new dashboard hook** `useRefinedTelosHistory(did)` (`dashboard/src/lib/hooks/use-refined-telos-history.ts`). Subscribes to the firehose stream, filters `eventType === 'telos.refined' && payload.did === did`, and collects `after_goal_hash` into a Set. Zero network traffic beyond the existing firehose WebSocket.
- **D-29 — Click-through to firehose.** Clicking the badge navigates to `/grid?firehose_filter=dialogue_id:${triggered_by_dialogue_id}` (query-param convention already used by other dashboard filters). The firehose panel listens for this query param and applies a client-side filter. If multiple refinements converge on one goal, the badge links to the MOST RECENT `triggered_by_dialogue_id`.
- **D-30 — Hash-to-goal mapping.** Because Brain's `compute_active_telos_hash` hashes the entire goal set (not per-goal), the dashboard CANNOT reliably attribute `after_goal_hash` to a single goal. Resolution: the badge renders on the ENTIRE Telos panel (one badge per panel when history is non-empty), NOT per-goal. Title text: "Telos refined via dialogue — N refinements in history". Per-goal attribution is deferred (would require Brain to expose per-goal hashes in `get_state`, an additive widening for a future phase).

### Producer-Boundary & Doc-Sync Discipline (meta)

- **D-31 — Producer boundary symmetry with Phase 6.** `appendTelosRefined(audit, did, {dialogue_id, before_goal_hash, after_goal_hash})` is the sole call site. It validates hashes (64-hex regex), dialogue_id (16-hex regex), and emits exactly `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`. A grep-based test asserts no other file in `grid/src/` calls `auditChain.append` with `eventType === 'telos.refined'`.
- **D-32 — Doc-sync reconciliation at phase close.** `scripts/check-state-doc-sync.mjs` is bumped 16→17 in the SAME commit that flips `ALLOWLIST_MEMBERS` length. STATE.md allowlist enumeration, README.md "current count" section, and MILESTONES.md (if it enumerates events) update together per CLAUDE.md doc-sync rule.

### Claude's Discretion (planner-resolved)

- Exact file layout for `grid/src/dialogue/` — `aggregator.ts`, `types.ts`, `index.ts` barrel, following `grid/src/review/` Phase 5 precedent.
- Whether to extend `GridCoordinator` with dialogue routing or mount the aggregator as an AuditChain listener directly — planner decides based on the existing Phase 2 listener surface.
- Whether `DialogueAggregator` is a class with an event-emitter API or a pure function + stateful map — functional style preferred if the existing Phase 2 audit listener signature supports it.
- Firehose filter query-param convention — planner to match the existing pattern in `dashboard/src/app/grid/components/firehose.tsx` (if `?q=...` or `?filter=...` is already used, reuse it).
- Brain-side heuristic for deciding whether to emit `telos_refined` — simplest usable: if the dialogue_context mentions any of the Nous's active goal descriptions by substring AND the LLM returns a refined goal set via a simple prompt, emit. Planner to decide the prompt shape; keep it minimal for v2.1.
- Test fixtures for dialogue zero-diff — reuse Phase 6's deterministic clock + fake-brain fixture pattern.

### Folded Todos

*None — no Phase 7-matching todos in the backlog (queried via gsd-sdk todo.match-phase 7 implicitly; no v2.1 DIALOG-* todos exist outside REQUIREMENTS.md).*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (milestone-level)
- `.planning/research/stanford-peer-agent-patterns.md` §2 (SPARC peer-dialogue pattern — two-Nous exchanges mutate internal state, never commit external Grid mutations without reviewer/invariant gates)
- `PHILOSOPHY.md` §1 (sovereign intelligence — Brain decides refinement, Grid never coerces)
- `PHILOSOPHY.md` §4 (memory earned — dialogue does not auto-persist to Grid; Brain owns memory writes)

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — DIALOG-01 (aggregation + `dialogue_context` widening), DIALOG-02 (`telos.refined` hash-only event), DIALOG-03 (Inspector badge + firehose link)
- `.planning/ROADMAP.md` §"Phase 7" — 5 success criteria including bidirectional-only trigger, hash-only privacy, zero-diff across 0/10 listeners, N configurable, Inspector badge + firehose link

### Existing code patterns (MUST match)
- `grid/src/audit/broadcast-allowlist.ts` — frozen-tuple invariant; Phase 7 appends `'telos.refined'` at position 17
- `grid/src/audit/chain.ts` — `AuditChain.append()` signature + listener surface; aggregator subscribes here for `nous.spoke`
- `grid/src/api/operator/_validation.ts` — Phase 6 D-19 hash-regex guard pattern; `appendTelosRefined` reuses the 64-hex regex discipline
- `grid/src/integration/nous-runner.ts` — `executeActions` switch receives a new `case 'telos_refined'` branch; existing `trade_request` branch is the closest precedent for pre-audit validation
- `grid/src/integration/types.ts` — `TickParams` widens with optional `dialogue_context?`; `BrainAction` union gains `TelosRefinedAction`
- `grid/src/review/Reviewer.ts` — Phase 5 precedent for module-style Grid service bootstrapped at startup; dialogue aggregator mirrors this wiring
- `brain/src/noesis_brain/rpc/handler.py` — `on_tick` receives the new `dialogue_context` param; new branch MAY return a `telos_refined` action
- `brain/src/noesis_brain/rpc/types.py` — `ActionType` enum extended with `TELOS_REFINED = "telos_refined"`
- `brain/src/noesis_brain/telos/hashing.py` — `compute_active_telos_hash` (SOLE hash authority per Phase 6 D-19) reused for before/after hashing
- `dashboard/src/app/grid/components/inspector-sections/telos.tsx` — add `refinedGoalHashes` prop + panel-level badge
- `dashboard/src/lib/api/introspect.ts` — `NousStateResponse.telos.active_goals` shape (unchanged)
- `dashboard/src/app/grid/components/firehose.tsx` — target for the `dialogue_id` filter query param

### Project philosophy (sovereignty invariants)
- `PHILOSOPHY.md` §1 (sovereign intelligence — H4 force-Telos and D-16 dialogue-driven refinement both forward to Brain via bridge; Grid never edits Brain state directly)
- `PHILOSOPHY.md` §4 (memory earned — Brain decides memory writes; Grid emits audit only)
- `PHILOSOPHY.md` §7 (Agency Scale H1–H5 — `telos.refined` is a Nous-initiated event, NOT an operator action; no tier stamp)

### v2.0 / Phase 5 / Phase 6 frozen contracts (MUST preserve)
- `.planning/phases/archived/v2.0/01-auditchain-listener-api-broadcast-allowlist/01-CONTEXT.md` — zero-diff invariant; Phase 7 extends to 0/10-listener determinism across dialogue
- `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md` §D-12, D-13, D-17, D-19 — payload privacy matrix, tier-required producer boundary, pause-is-a-clean-boundary, hash-only RPC boundary. Phase 7 inherits all four disciplines.
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at 3 entry points — `telos.refined` payload's `did` field validated against this regex at `appendTelosRefined`
- `payloadPrivacyCheck()` — reused unchanged; `telos.refined` payload passes natively
- `scripts/check-state-doc-sync.mjs` — Phase 6 regression gate; bumped 16→17 in Phase 7's final commit

### CLAUDE.md doc-sync rule
- `CLAUDE.md` — Phase 7 ship commit must simultaneously update STATE.md allowlist enumeration, README.md "current count", `check-state-doc-sync.mjs` asserted count, and MILESTONES.md (if it lists events). Mirror of Phase 5 D-11 + Phase 6 D-22.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuditChain.append()` + existing listener hub — aggregator subscribes here; no new seam in AuditChain itself.
- `payloadPrivacyCheck()` + `FORBIDDEN_KEY_PATTERN` — reused unchanged; `telos.refined`'s 4 keys are clean.
- `compute_active_telos_hash` (Brain) — sole hash authority, reused for both before/after hashes at the Brain boundary.
- `appendOperatorEvent` pattern (Phase 6 D-13) — structural template for `appendTelosRefined`: regex-guard inputs, emit closed tuple, single call site.
- Inspector drawer + `TelosSection` — extends with a panel-level badge and `useRefinedTelosHistory` hook.
- Firehose panel — existing query-param filter convention (planner to confirm the exact key).
- `BrainAction` TS union + Python `ActionType` enum — additive extension; existing handlers unaffected.
- Phase 6 `test_get_state_widening.py` pattern — strict-superset widening asserted via golden-snapshot comparison.

### Established Patterns
- **Hash-only cross-boundary contract** (Phase 6 D-19): plaintext Telos never crosses the RPC boundary. Phase 7 extends this to `new_goals` — Brain hashes, Grid sees only hashes + dialogue_id.
- **Closed-tuple payloads** (Phase 6 D-11, D-20): `Object.keys(payload).sort()` structural assertion fails loudly on any key drift.
- **Single producer boundary** (Phase 6 D-13): all `operator.*` go through `appendOperatorEvent`; all `telos.refined` go through `appendTelosRefined`.
- **Frozen allowlist as a sovereignty moat** (v2.0 Phase 1 + Phase 5 D-11 + Phase 6 D-10): extending requires explicit per-phase addition + doc-sync gate bump. Phase 7 adds slot 17.
- **Zero-diff invariant** (Phase 1 commit `29c3516` + Phase 6 D-17): deterministic chain head across alternate paths. Phase 7 extends to 0-vs-10 WebSocket listeners.
- **Brain opt-in for cognition changes** (PHILOSOPHY §1): Grid aggregates context, Brain decides action. Never inverted.
- **Pause is a clean boundary** (Phase 6 D-17): aggregator buffers drain on pause; no cross-pause dialogue aggregation.
- **Additive widening only** (Phase 6 `test_get_state_widening`): new optional params, strict supersets, existing callers unaffected.

### Integration Points
- `grid/src/audit/broadcast-allowlist.ts` — 1-line addition at position 17 (`'telos.refined'`).
- `grid/src/audit/append-telos-refined.ts` — NEW file, sole producer boundary.
- `grid/src/dialogue/aggregator.ts` + `grid/src/dialogue/types.ts` + `grid/src/dialogue/index.ts` — NEW subtree.
- `grid/src/integration/nous-runner.ts` — `executeActions` gains `case 'telos_refined'` branch.
- `grid/src/integration/types.ts` — `TickParams` widens with `dialogue_context?`; `BrainAction` union gains `TelosRefinedAction`.
- `grid/src/integration/grid-coordinator.ts` — wires aggregator to runner.bridge.sendTick calls (if not handled by aggregator directly).
- `grid/src/genesis/launcher.ts` — instantiates `DialogueAggregator` at startup, passes config knobs.
- `grid/src/genesis/types.ts` — `GridConfig.dialogue?: { windowTicks, minExchanges }`.
- `brain/src/noesis_brain/rpc/types.py` — `ActionType.TELOS_REFINED` enum member.
- `brain/src/noesis_brain/rpc/handler.py` — `on_tick` consumes `dialogue_context`, MAY return telos_refined action; helper `_build_refined_telos(...)` encapsulates the heuristic.
- `dashboard/src/app/grid/components/inspector-sections/telos.tsx` — panel-level badge.
- `dashboard/src/lib/hooks/use-refined-telos-history.ts` — NEW hook.
- `dashboard/src/app/grid/components/firehose.tsx` — `dialogue_id` filter support.
- `grid/test/dialogue/aggregator-window.test.ts` — NEW, SC#5 boundary.
- `grid/test/audit/telos-refined-privacy.test.ts` — NEW, 8-case privacy matrix.
- `grid/test/audit/telos-refined-producer-boundary.test.ts` — NEW, sole-call-site gate.
- `grid/test/dialogue-zero-diff.test.ts` — NEW, SC#4 0/10-listener determinism.
- `brain/test/test_handler_dialogue.py` — NEW, Brain-side opt-in + hash authority tests.
- `dashboard/src/app/grid/components/inspector-sections/telos.test.tsx` — extend for badge rendering.
- `scripts/check-state-doc-sync.mjs` — bump 16→17; add `'telos.refined'` to the enumerated set.

</code_context>

<specifics>
## Specific Ideas

- **DialogueAggregator sketch (grid-side):**
  ```ts
  // grid/src/dialogue/aggregator.ts
  export class DialogueAggregator {
      private buffers = new Map<string, Utterance[]>();      // keyed by `${sortedDids}|${channel}`
      private deliveredIds = new Map<string, Set<string>>(); // pair_key -> set of dialogue_ids already delivered

      constructor(
          private audit: AuditChain,
          private config: { windowTicks: number; minExchanges: number },
          private onEmit: (participants: [string, string], context: DialogueContext) => void,
      ) {
          audit.on('append', (entry) => {
              if (entry.eventType === 'nous.spoke') this.observe(entry);
          });
      }

      private observe(entry: AuditEntry): void {
          const { name, channel, text, tick } = entry.payload as {...};
          // For each pair (this speaker × known-peers-on-channel), update buffer, check threshold.
      }
      // ...
  }
  ```
- **appendTelosRefined sketch:**
  ```ts
  // grid/src/audit/append-telos-refined.ts
  const HEX64 = /^[0-9a-f]{64}$/;
  const HEX16 = /^[0-9a-f]{16}$/;
  const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

  export function appendTelosRefined(
      chain: AuditChain,
      did: string,
      p: { before_goal_hash: string; after_goal_hash: string; triggered_by_dialogue_id: string },
  ): void {
      if (!DID_RE.test(did)) throw new TypeError('telos.refined: invalid did');
      if (!HEX64.test(p.before_goal_hash)) throw new TypeError('telos.refined: before_goal_hash must be 64-hex');
      if (!HEX64.test(p.after_goal_hash)) throw new TypeError('telos.refined: after_goal_hash must be 64-hex');
      if (!HEX16.test(p.triggered_by_dialogue_id)) throw new TypeError('telos.refined: dialogue_id must be 16-hex');
      chain.append('telos.refined', did, {
          did,
          before_goal_hash: p.before_goal_hash,
          after_goal_hash: p.after_goal_hash,
          triggered_by_dialogue_id: p.triggered_by_dialogue_id,
      });
  }
  ```
- **NousRunner branch sketch:**
  ```ts
  // grid/src/integration/nous-runner.ts — new case in executeActions
  case 'telos_refined': {
      const md = action.metadata ?? {};
      const dialogueId = String(md['triggered_by_dialogue_id'] ?? '');
      const beforeHash = String(md['before_goal_hash'] ?? '');
      const afterHash = String(md['after_goal_hash'] ?? '');
      // Authority check: this nous must have participated in this dialogue recently.
      if (!this.recentDialogueIds.has(dialogueId)) {
          log.warn({ did: this.nousDid, dialogueId }, 'telos.refined: unknown dialogue_id, dropping');
          break;
      }
      try {
          appendTelosRefined(this.audit, this.nousDid, {
              before_goal_hash: beforeHash,
              after_goal_hash: afterHash,
              triggered_by_dialogue_id: dialogueId,
          });
      } catch (err) {
          log.warn({ err }, 'telos.refined: malformed payload, dropping');
      }
      break;
  }
  ```
- **Brain `on_tick` dialogue branch sketch:**
  ```python
  # brain/src/noesis_brain/rpc/handler.py
  async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]:
      self.thymos.decay()
      ctx = params.get("dialogue_context")
      if ctx and self._dialogue_suggests_refinement(ctx):
          refined = await self._build_refined_telos(ctx)
          if refined is not None:
              before = compute_active_telos_hash(self.telos.all_goals())
              self.telos = refined  # atomic swap AFTER hashing before
              after = compute_active_telos_hash(self.telos.all_goals())
              return [Action(
                  action_type=ActionType.TELOS_REFINED,
                  metadata={
                      "new_goals": [...],                           # internal only; grid strips
                      "triggered_by_dialogue_id": ctx["dialogue_id"],
                      "before_goal_hash": before,
                      "after_goal_hash": after,
                  },
              ).to_dict()]
      # ... existing tick logic
  ```
- **Zero-diff regression sketch:**
  ```ts
  // grid/test/dialogue-zero-diff.test.ts
  it('SC#4: AuditChain head identical across 0 vs 10 listeners', async () => {
      const headA = await runDeterministic100Ticks({ listeners: 0 });
      const headB = await runDeterministic100Ticks({ listeners: 10 });
      expect(headA).toBe(headB);
      // Pinned expected hash once snapshot stabilizes — mirrors c7c49f49… from Phase 6.
  });
  ```
- **Aggregator window boundary test sketch:**
  ```ts
  // grid/test/dialogue/aggregator-window.test.ts
  it.each([
      [{ windowTicks: 5, minExchanges: 2 }, [[0,'A'],[3,'B']], true],
      [{ windowTicks: 5, minExchanges: 2 }, [[0,'A'],[6,'B']], false],
      [{ windowTicks: 10, minExchanges: 3 }, [[0,'A'],[3,'B']], false],
      [{ windowTicks: 10, minExchanges: 3 }, [[0,'A'],[3,'B'],[5,'A']], true],
  ])('N=%j utterances=%j → fires=%s', (cfg, utts, expected) => { ... });
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Per-goal hash attribution** (would enable per-goal badge placement in Inspector) — requires Brain to expose per-goal hashes in `get_state`. Deferred to a future phase; D-30 ships panel-level badge only.
- **Group-dialogue aggregation (3+ participants)** — deferred to potential future DIALOGUE-GROUP-01 / WHISPER-02 requirement. v2.1 is strictly pairwise.
- **Cross-grid dialogue** — inter-grid federation is Out of Scope per PROJECT.md.
- **Dialogue memory persistence at Grid** — Grid stays transient. Brain memory writes are a separate concern, Brain-internal only.
- **Topic-similarity / persona-contingent triggers** — v2.1 triggers only on cardinality. Smarter triggers are a future phase.
- **Session-wide dialogue stickiness across pauses** — explicitly rejected by D-04 (pause is a clean boundary). Mirrors Phase 6 D-17 discipline.
- **Grid-layer judgment on refinement quality** — explicitly rejected per REV-04 invariant. Grid logs the hash diff; it does not evaluate.
- **`telos.refined` emitted under operator H4 force-Telos** — already covered by Phase 6 `operator.telos_forced`; DO NOT double-emit. `telos.refined` is strictly the Nous-initiated path.
- **Retroactive dialogue detection** (walking backward through AuditChain on startup) — explicitly deferred. Aggregation is forward-only from Grid start; no replay.
- **Rate-limiting Brain `telos_refined` emissions** — single-operator + single-grid v2.1 has no reason to rate-limit yet. Future OP-MULTI-01 or high-throughput scenarios may add this.
- **Authenticated dialogue_id** (signed so a malicious Brain cannot forge participation) — authority check via `recentDialogueIds` suffices for v2.1 single-operator trust model. Cryptographic attestation is future hardening.
- **Inspector surfacing of `new_goals` plaintext diff** — explicitly rejected: Grid does not hold plaintext. Dashboard operator with H2 elevation can memory-query Brain for current goals; no diff UI in v2.1.

</deferred>

---

*Phase: 07-peer-dialogue-telos-refinement*
*Context gathered: 2026-04-21*
*Mode: `--auto` — all 16 gray areas auto-resolved with recommended options.*
*Downstream: `/gsd-ui-phase 7 --auto` (UI hint = yes, Inspector badge work) then `/gsd-plan-phase 7 --auto`.*
