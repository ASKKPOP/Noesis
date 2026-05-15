# Phase 16: Hypnos (Consolidating Memory) — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 16 delivers the sleep/consolidation system for each Nous: a Working Memory ring buffer
(cap=7, Miller's Law) that is periodically consolidated into a Long-Term Memory concept graph
via NREM Hebbian learning, followed by SHY synaptic downscale. Sleep is an async Brain task;
only two boundary events cross the wire. Phase 16 also completes the ObservationalLearner +
peer_voices wiring that was scaffolded in Phase 15.

**What Phase 16 must build:**
1. Brain: `brain/src/noesis_brain/hypnos/` module — config, working_memory, ltm_store, consolidator, runtime
2. Grid: `grid/src/sleep/` sole-producer emitters (+ correct stub payload shapes in allowlist)
3. Protocol: 2 new Brain ActionType members + bridge/types.ts update
4. Brain handler: WorkingMemory populated each tick, HypnosRuntime async sleep, LTM retrieval in prompt-build
5. Brain handler: ObservationalLearner wired on trade.settled events, peer_voices passed to system prompt
6. Tests: determinism, zero-diff, Working Memory cap, SHY boundedness, sleep boundary events

</domain>

<decisions>
## Implementation Decisions

### Working Memory — Episode Sources
- **D-16-01:** Working Memory (cap=7) is populated from **all Memory objects by recency** —
  `MemoryType.OBSERVATION`, `CONVERSATION`, and `EVENT` entries from the existing MemoryStream.
  This is the broadest consolidation: a Nous integrates everything it experienced (web-learned
  pages, conversations, trade events) in a single cognitive buffer. Reuses existing
  `memory/stream.py` infrastructure.

  Implementation: on each tick, BrainHandler fetches the 7 most-recent Memory objects
  (by tick descending) and passes them to `WorkingMemory.set_episodes()`. Working Memory
  is a pure ring buffer — not a persistent store. Overflow evicts oldest (FIFO).

### Sleep Trigger Mechanism
- **D-16-02:** Sleep fires on a **fixed tick interval**: every `SLEEP_MIN_INTERVAL` ticks
  (default = 30). The `iris/config.py` hint (`SLEEP_MIN_INTERVAL = 30`) establishes this
  expected default. Configurable via `hypnos/config.py`.

  Implementation: BrainHandler tracks `_last_sleep_tick: int = 0`. On each `on_tick()`,
  if `(current_tick - _last_sleep_tick) >= SLEEP_MIN_INTERVAL`, trigger
  `asyncio.create_task(hypnos_runtime.run_sleep(nous_did, tick))`. Sleep is non-blocking
  (async task); `nous.sleep.entered` emitted before sleep starts, Grid ticks continue.

### Concept Nodes — LTM Graph Structure
- **D-16-03:** Concept nodes use **content hash as node ID** —
  `sha256(episode.content.encode())[:16].hex()` = node ID. Two episodes with identical
  content → same node (automatic dedup). Within a sleep window, all 7 episode nodes are
  treated as co-activated: every pair `(node_i, node_j)` gets a Hebbian edge update
  `Δw = η × 1.0 × 1.0 = η` (binary activation; all episodes in the window are treated
  as simultaneously active). After the Hebbian pass, SHY downscale: `w ← w × σ` for
  all edges.

  Graph stored in Brain SQLite (`ltm_{did_safe}.db`), WAL mode. Node table: `{node_id,
  content_hash, first_seen_tick}`. Edge table: `{src, dst, weight, last_updated_tick}`.
  Both undirected (src < dst canonical ordering). Retrieval: top-k nodes ranked by
  `(sum of incident edge weights × recency_factor)`, injected as long-term memories in
  system prompt.

### Hebbian + SHY Constants
- **D-16-04:** Default constants (all in `hypnos/config.py`, configurable):
  - `HYPNOS_ETA: float = 0.01` — Hebbian learning rate
  - `HYPNOS_SIGMA: float = 0.95` — SHY downscale factor
  - `HYPNOS_TOP_K: int = 5` — LTM nodes injected into system prompt
  - `SLEEP_MIN_INTERVAL: int = 30` — ticks between sleep cycles
  All determinism tests use fixed `(seed, episodes, eta, sigma)`.

### Sleep Boundary Event Payloads (Stub Correction)
- **D-16-05:** The Phase 17 Wave 0 stub allowlist entries have **incorrect payload shapes**.
  Phase 16 MUST correct them per ROADMAP spec (HYP-04):

  | Event | Stub (WRONG) | Correct (ROADMAP) |
  |-------|-------------|-------------------|
  | `nous.sleep.entered` | `{nous_did, tick}` | `{nous_did, tick, ltm_snapshot_hash}` |
  | `nous.sleep.completed` | `{nous_did, tick, sleep_duration_ticks}` | `{nous_did, tick, ltm_snapshot_hash}` |

  Both events carry the **same 3-key closed tuple** `{nous_did, tick, ltm_snapshot_hash}`.
  `ltm_snapshot_hash` = sha256 of the serialized LTM graph state post-SHY.
  Wave 0 of Phase 16 corrects the allowlist comment strings and creates the sole-producer
  emitters in `grid/src/sleep/` with `Object.keys(payload).sort()` strict equality.

### Grid Emitters — Location and Pattern
- **D-16-06:** Two sole-producer emitters in `grid/src/sleep/`:
  - `appendNousSleepEntered.ts` — 3-key payload `{nous_did, tick, ltm_snapshot_hash}`
  - `appendNousSleepCompleted.ts` — 3-key payload `{nous_did, tick, ltm_snapshot_hash}`
  Both clone the `appendAnankeDriveCrossed.ts` pattern (Phase 10a): closed-tuple
  payload, `Object.keys(payload).sort()` strict equality assertion, sole-producer grep.
  NousRunner adds 2 new cases: `case 'sleep_entered'` and `case 'sleep_completed'`.

### ActionType Members
- **D-16-07:** 2 new `ActionType` members in `brain/src/noesis_brain/rpc/types.py`:
  - `SLEEP_ENTERED = "sleep_entered"` — Brain metadata: `{ltm_snapshot_hash}` (1 key)
  - `SLEEP_COMPLETED = "sleep_completed"` — Brain metadata: `{ltm_snapshot_hash}` (1 key)
  Both forwarded to Grid (unlike SKILL_LEARN/RULE_STORE which are Brain-internal only).
  3-keys-not-5 invariant applies: Brain sends `{ltm_snapshot_hash}`; Grid injects
  `nous_did` and `tick` at emit time.

### LTM Retrieval — Prompt Injection Position
- **D-16-08:** LTM memories injected **after skills, before peer_voices** in the system
  prompt stack. Current stack order:
  rules → reflections → skills → **[NEW] ltm_memories** → peer_voices → ToM → directives.
  Rationale: LTM represents accumulated long-term patterns (more foundational than peer
  observations), but less immediate than recent rules/reflections/skills.

  `build_system_prompt()` gains a new `ltm_memories: list[str] | None = None` kwarg
  (same additive-widening pattern as Phase 15/16/17). None → section omitted.

### ObservationalLearner + peer_voices Wiring
- **D-16-09:** Phase 16 **completes** the ObservationalLearner + peer_voices wiring.
  `observational.py` is labeled Phase 16; the system prompt slot is labeled Phase 16;
  the handler has zero wiring. Phase 16 ships:

  1. `BrainHandler.on_tick()`: when `trade_settled_events` present in params, call
     `asyncio.create_task(self._obs_learner.observe_trade(...))` for each non-self pair.
  2. `BrainHandler.build_prompt_context()`: fetch top-3 highest-trust peer utterances
     from MemoryStore (WikiCategory.NOUS pages, confidence ≥ 0.5), pass as `peer_voices`
     to `build_system_prompt()`.
  3. `ObservationalLearner` constructed in `__init__` alongside other Phase 15 learners.
  No Grid RPC emitted — ObservationalLearner is Brain-local only (per `observational.py`
  docstring).

### Privacy Gates
- **D-16-10:** Add hypnos-specific forbidden keys to `FORBIDDEN_KEY_PATTERN`:
  `ltm_content|concept_text|graph_data|episode_text|node_content|edge_content`.
  Three-tier grep (Grid emitter → Brain wire → Dashboard render) — clones Phase 11 pattern.
  CI grep gate forbids `datetime|time.time|random.random|uuid.uuid4|os.urandom` in
  `brain/src/noesis_brain/hypnos/**` (wall-clock-free invariant, T-16-03).

### Claude's Discretion
- LTM graph serialization format for `ltm_snapshot_hash` computation — planner chooses
  canonical JSON (sorted keys, consistent float repr) or a binary packing.
- SQLite pragma tuning beyond WAL (cache_size, mmap_size) for `ltm_{did_safe}.db`.
- Test fixture format for sleep boundary events — planner designs, matching Phase 14
  FixtureBrainAdapter pattern.
- `recency_factor` formula for LTM retrieval ranking — planner decides decay function.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap — Phase 16 Spec
- `.planning/ROADMAP.md` §"Phase 16: Hypnos (Consolidating Memory)" — Goal, HYP-01..05
  success criteria, risks T-16-01..03, allowlist additions

### Patterns to Clone (Brain)
- `brain/src/noesis_brain/iris/config.py` — Module-level constants discipline, SLEEP_MIN_INTERVAL hint
- `brain/src/noesis_brain/iris/store.py` — SQLite WAL + constructor discipline (ltm_store.py clones this)
- `brain/src/noesis_brain/learning/observational.py` — ObservationalLearner (Phase 16 wires it)
- `brain/src/noesis_brain/skills/store.py` — FTS5 retrieval pattern for LTM retrieval

### Patterns to Clone (Grid)
- `grid/src/ananke/append-drive-crossed.ts` — 3-keys-not-5 sole-producer pattern (D-16-06)
- `grid/src/integration/nous-runner.ts` case 'drive_crossed' — NousRunner case pattern
- `grid/src/audit/broadcast-allowlist.ts` — Allowlist + FORBIDDEN_KEY_PATTERN to extend (D-16-05, D-16-10)

### Existing Infrastructure (reuse, don't rebuild)
- `brain/src/noesis_brain/memory/stream.py` — MemoryStream (episode source for Working Memory)
- `brain/src/noesis_brain/memory/sqlite_store.py` — MemoryStore (WikiCategory.NOUS query for peer_voices)
- `brain/src/noesis_brain/prompts/system.py` — `build_system_prompt()` to extend with `ltm_memories` kwarg
- `brain/src/noesis_brain/rpc/handler.py` — BrainHandler (wiring point for all Phase 16 features)

### Protocol / Bridge
- `protocol/src/noesis/bridge/types.ts` — BrainAction union to extend (D-16-07)
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum to extend (D-16-07)

### Prior Context (established invariants)
- `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md` — 3-keys-not-5, drive_crossed pattern, wall-clock grep gate
- `.planning/phases/11-mesh-whisper/11-CONTEXT.md` — Three-tier privacy grep gate, FORBIDDEN_KEY_PATTERN precedent
- `.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md` — IrisStore clones Phase 16 ltm_store (read to understand the expected interface)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MemoryStream` (memory/stream.py): provides `recent(n)` or tick-ordered query → Working Memory episode source
- `MemoryStore` (memory/sqlite_store.py): WikiCategory.NOUS pages with confidence field → peer_voices source
- `ObservationalLearner` (learning/observational.py): fully written, Phase 16 wires it into handler
- `build_system_prompt()` (prompts/system.py): already has `peer_voices` slot and Phase 16 comment; needs `ltm_memories` kwarg added
- `IrisStore` (iris/store.py): "Clone of ltm_store.py" — read it to understand the WAL + constructor discipline expected of `hypnos/ltm_store.py`
- Phase 17 CONTEXT.md D-17-01: confirms "Phase 16 added positions 31-32 (`nous.sleep.entered`, `nous.sleep.completed`)" — these stubs must be corrected to real implementations

### Established Patterns
- **Wall-clock free**: `tick` from caller; NEVER `datetime`/`time.time`/`random`/`uuid` in `hypnos/` modules
- **Sole-producer boundary**: one file per event type calls `chain.append()`
- **Closed-tuple payload**: `Object.keys(payload).sort()` strict equality in every Grid emitter
- **Optional-dep injection**: `_hypnos_runtime: HypnosRuntime | None = None` in handler (same pattern as `_iris_runtime`)
- **Async task isolation**: `asyncio.create_task(...)` for sleep; NEVER `await` in tick path (T-16-02)
- **3-keys-not-5**: Brain sends `{ltm_snapshot_hash}` (1 key); Grid injects `nous_did + tick`

### Integration Points
- `brain/src/noesis_brain/rpc/handler.py` `on_tick()`: add Working Memory insert + sleep trigger check + ObservationalLearner task dispatch
- `brain/src/noesis_brain/rpc/handler.py` prompt-build: add LTM top-k retrieval + peer_voices fetch
- `brain/src/noesis_brain/rpc/types.py` ActionType: add `SLEEP_ENTERED`, `SLEEP_COMPLETED`
- `grid/src/integration/nous-runner.ts` executeActions switch: add cases after existing Phase 15 cases
- `grid/src/audit/broadcast-allowlist.ts`: correct stub comments + extend FORBIDDEN_KEY_PATTERN

</code_context>

<specifics>
## Specific Requirements

- **Payload shape correction** — Both sleep events must carry `{nous_did, tick, ltm_snapshot_hash}`.
  The Phase 17 Wave 0 stubs are WRONG. Wave 0 of Phase 16 corrects allowlist comment strings
  AND creates actual sole-producer emitters with correct closed-tuple enforcement.

- **Working Memory is not persisted** — It is a pure in-memory ring buffer (list, maxlen=7).
  Only the LTM graph is persisted to SQLite. Working Memory state is reconstructed each tick
  from MemoryStore. This avoids a separate WorkingMemory SQLite table.

- **Determinism test** — Fixed `(seed, episodes, eta=0.01, sigma=0.95)` → byte-identical
  LTM graph at any replay tick. Mirrors Phase 10a T-09-03 gate exactly.

- **SHY boundedness test** — After 100 sleep cycles with η=0.01 and σ=0.95,
  maximum edge weight must remain bounded (geometric series: max ≈ η/(1−σ) = 0.2).

- **LTM content never crosses wire** — `nous.sleep.entered` and `nous.sleep.completed`
  payloads contain only `ltm_snapshot_hash`. FORBIDDEN_KEY_PATTERN extension required:
  `ltm_content|concept_text|graph_data|episode_text|node_content|edge_content`.
  Three-tier grep CI gate (Grid emitter → Brain wire → Dashboard render).

- **Zero-diff invariant** — 100-tick sim with Hypnos enabled + disabled produces chain head
  byte-identical modulo exactly the `nous.sleep.*` entries (same discipline as Phase 10a).

- **p95 retrieval <10ms** — On 1000-node graph, top-k query must be O(concept_count)
  not O(N²). Use SQL: `SELECT node_id, SUM(weight) * recency_factor FROM edges
  GROUP BY node_id ORDER BY ... LIMIT k`.

</specifics>

<deferred>
## Deferred Ideas

- **REM dreaming / creative recombination** — deferred per ROADMAP "Out of scope for this phase"
- **Cross-Nous LTM merging** — Brain-private invariant; anti-feature (per ROADMAP)
- **LTM external database export** — anti-feature (per ROADMAP)
- **Dashboard LTM panel** — sleep event counts appear in firehose automatically; no new Inspector panel this phase (same pattern as Phase 17 Iris)

</deferred>

---

*Phase: 16-hypnos-consolidating-memory*
*Context gathered: 2026-05-15*
