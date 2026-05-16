# Phase 16: Hypnos (Consolidating Memory) - Research

**Researched:** 2026-05-15
**Domain:** Brain-side cognitive memory consolidation (Hebbian LTM graph + SHY downscale), Grid allowlist correction, ObservationalLearner + peer_voices wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-16-01:** Working Memory (cap=7) populated from all Memory objects by recency — `MemoryType.OBSERVATION`, `CONVERSATION`, and `EVENT` entries from `memory/stream.py`. Pure in-memory ring buffer (list, maxlen=7). Reconstructed each tick from MemoryStore; not persisted.
- **D-16-02:** Sleep fires on fixed tick interval every `SLEEP_MIN_INTERVAL` ticks (default=30). `BrainHandler` tracks `_last_sleep_tick: int = 0`. Non-blocking: `asyncio.create_task(hypnos_runtime.run_sleep(...))`.
- **D-16-03:** Concept nodes use content hash as node ID: `sha256(episode.content.encode())[:16].hex()`. All 7 episodes co-activated → every pair gets Hebbian edge update `Δw = η × 1.0 × 1.0 = η`. After Hebbian pass, SHY downscale: `w ← w × σ` for all edges. SQLite WAL (`ltm_{did_safe}.db`). Retrieval: top-k nodes ranked by `(sum of incident edge weights × recency_factor)`.
- **D-16-04:** `HYPNOS_ETA: float = 0.01`, `HYPNOS_SIGMA: float = 0.95`, `HYPNOS_TOP_K: int = 5`, `SLEEP_MIN_INTERVAL: int = 30` — all in `hypnos/config.py`.
- **D-16-05:** Payload shape correction required. Correct shape for BOTH events: `{nous_did, tick, ltm_snapshot_hash}`. Stub entries in allowlist (positions 31-32) are WRONG and must be corrected.
- **D-16-06:** Two sole-producer emitters in `grid/src/sleep/`: `appendNousSleepEntered.ts` and `appendNousSleepCompleted.ts`. Clone `appendAnankeDriveCrossed.ts` pattern. NousRunner gains `case 'sleep_entered'` and `case 'sleep_completed'`.
- **D-16-07:** 2 new `ActionType` members: `SLEEP_ENTERED = "sleep_entered"`, `SLEEP_COMPLETED = "sleep_completed"`. Brain metadata: `{ltm_snapshot_hash}` (1 key only). Grid injects `nous_did` and `tick` at emit time (3-keys-not-5).
- **D-16-08:** LTM memories injected after skills, before peer_voices in system prompt. `build_system_prompt()` gains `ltm_memories: list[str] | None = None` kwarg.
- **D-16-09:** ObservationalLearner + peer_voices wiring completed. `on_tick()`: dispatch `asyncio.create_task(self._obs_learner.observe_trade(...))` for each non-self `trade_settled_events`. `build_prompt_context()`: fetch top-3 highest-trust peer utterances (WikiCategory.NOUS, confidence ≥ 0.5), pass as `peer_voices`.
- **D-16-10:** FORBIDDEN_KEY_PATTERN extended: `ltm_content|concept_text|graph_data|episode_text|node_content|edge_content`. Three-tier grep CI gate. CI grep forbids `datetime|time.time|random.random|uuid.uuid4|os.urandom` in `brain/src/noesis_brain/hypnos/**`.

### Claude's Discretion

- LTM graph serialization format for `ltm_snapshot_hash` computation — canonical JSON (sorted keys, consistent float repr) or binary packing.
- SQLite pragma tuning beyond WAL (cache_size, mmap_size) for `ltm_{did_safe}.db`.
- Test fixture format for sleep boundary events (matching Phase 14 FixtureBrainAdapter pattern).
- `recency_factor` formula for LTM retrieval ranking — decay function choice.

### Deferred Ideas (OUT OF SCOPE)

- REM dreaming / creative recombination
- Cross-Nous LTM merging (Brain-private invariant; anti-feature)
- LTM external database export (anti-feature)
- Dashboard LTM panel (sleep event counts appear in firehose automatically; no new Inspector panel)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HYP-01 | Working Memory holds ≤7 episode slots (Miller's Law); overflow evicts oldest. Deterministic given `(seed, tick)`. | `MemoryStore.recent_memories()` is the episode source; pure in-memory list with `maxlen=7` (collections.deque or manual slice). |
| HYP-02 | NREM Hebbian pass: co-activated concept pairs strengthen LTM graph edges via `Δw = η × pre × post` with configurable η. Graph stored in Brain SQLite, never broadcast. Determinism test. | LtmStore clones IrisStore/SkillStore FTS5+WAL pattern. All-pairs Hebbian in `O(episodes²)` — acceptable for n=7. |
| HYP-03 | SHY downscale: after Hebbian pass all edge weights scaled by σ ∈ (0,1). After 100 sleep cycles max edge weight remains bounded (max ≈ η/(1−σ)). | Pure multiplicative decay; bounded geometric series proof. SQL UPDATE on all edges per sleep cycle. |
| HYP-04 | `nous.sleep.entered` and `nous.sleep.completed` fire with correct 3-key closed-tuple `{nous_did, tick, ltm_snapshot_hash}`. Stub correction required. Grid ticks continue during sleep. | Corrects wrong stubs. Clones appendAnankeDriveCrossed pattern. 3-keys-not-5: Brain sends `{ltm_snapshot_hash}` only. |
| HYP-05 | LTM retrieval: top-k concept nodes by `(edge_weight × recency_factor)`. O(concept_count) not O(N²). p95 <10ms on 1000-node graph. | SQL aggregation pattern: `SELECT node_id, SUM(weight) * recency_factor ... GROUP BY node_id LIMIT k`. |
</phase_requirements>

---

## Summary

Phase 16 delivers three interconnected systems: (1) the Hypnos brain module (`brain/src/noesis_brain/hypnos/`) with a Working Memory ring buffer, an LTM concept graph backed by SQLite WAL, Hebbian consolidation, and SHY downscale; (2) Grid-side sole-producer emitters that fix wrong stub payload shapes from Phase 17's Wave 0; and (3) completion of the ObservationalLearner + peer_voices wiring scaffolded in Phase 15.

The most critical Wave 0 task is fixing the allowlist stub: positions 31-32 currently carry payloads `{nous_did, tick}` and `{nous_did, tick, sleep_duration_ticks}` respectively — both WRONG. Both events must carry `{nous_did, tick, ltm_snapshot_hash}` per D-16-05. Phase 17 already shipped against the stub stubs (positions 33-36 are correctly wired Iris events), so Phase 16 Wave 0 must correct the comment strings AND create the real sole-producer emitters with the correct closed-tuple enforcement.

The Hypnos Brain module is pure Python without external dependencies — SQLite is stdlib. The LTM graph determinism invariant mirrors Phase 10a T-09-03: fixed `(seed, episodes, η, σ)` → byte-identical graph at any replay tick. Wall-clock is forbidden from all `hypnos/` modules.

**Primary recommendation:** Structure as 5 waves — Wave 0 (allowlist correction + types + stubs), Wave 1 (Brain LtmStore + WorkingMemory), Wave 2 (HypnosRuntime + sleep cycle wiring), Wave 3 (ObservationalLearner + peer_voices + prompt injection), Wave 4 (tests + CI grep gates + doc-sync).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Working Memory buffer (cap=7) | Brain | — | Pure in-memory cognitive state; Brain reconstructs from MemoryStore each tick. Never broadcast. |
| LTM concept graph (Hebbian + SHY) | Brain (SQLite) | — | Brain-private; all consolidation is Brain-local. Only `ltm_snapshot_hash` crosses the wire. |
| Sleep cycle trigger | Brain (BrainHandler) | — | `_last_sleep_tick` tracked in handler; `asyncio.create_task` called on fixed interval. |
| Sleep boundary events | Grid (sole-producer emitters) | Brain (ActionType) | Brain emits `SLEEP_ENTERED`/`SLEEP_COMPLETED` actions; Grid dispatches to audit chain. |
| Allowlist stub correction | Grid (allowlist + emitters) | — | Phase 17 already added stub entries at wrong shapes; Phase 16 must fix comment strings AND implement real emitters. |
| ObservationalLearner dispatch | Brain (BrainHandler.on_tick) | — | Brain-local only — no Grid RPC emitted. |
| peer_voices injection | Brain (BrainHandler + build_system_prompt) | — | Reads WikiCategory.NOUS pages from MemoryStore; passed as kwarg to system prompt builder. |
| LTM retrieval → prompt injection | Brain (HypnosRuntime + BrainHandler) | — | SQL GROUP BY query; injected into system prompt before peer_voices. |
| Privacy CI gates | Grid (scripts/) + Brain (scripts/) | Dashboard (scripts/) | Three-tier grep for hypnos-specific FORBIDDEN keys + wall-clock grep gate. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python sqlite3 | stdlib | LTM graph persistence (WAL mode) | Already used by IrisStore, SkillStore, MemoryStore — no new deps |
| hashlib | stdlib | `sha256(content)[:16].hex()` for node ID; `ltm_snapshot_hash` computation | Already used throughout Brain |
| asyncio | stdlib | `asyncio.create_task()` for non-blocking sleep | Established pattern in handler for AAU, Iris |
| collections.deque | stdlib | Working Memory ring buffer (maxlen=7) | O(1) append+evict; deque enforces cap natively |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-asyncio | ≥0.23 | Testing async sleep path | All async Brain tests |
| vitest | ^2.0.0 | Grid TypeScript emitter tests | All Grid sole-producer tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sqlite3 WAL | networkx in-memory graph | SQLite persists across restarts; networkx needs a separate serialization layer and adds a runtime dep — out of scope for this phase |
| collections.deque | list with manual slice | deque enforces maxlen natively; list requires explicit overflow handling — deque is cleaner |
| Canonical JSON for snapshot hash | msgpack binary | JSON is more debuggable and already used for audit chain canonical serialization; msgpack adds a runtime dep |

**Installation:** No new runtime dependencies. All stdlib.

---

## Architecture Patterns

### System Architecture Diagram

```
Brain on_tick()
    │
    ├─ 1. Fetch 7 most-recent Memory objects (MemoryStore.recent_memories(7))
    │       └─→ WorkingMemory.set_episodes(memories)    [pure in-memory ring buffer]
    │
    ├─ 2. Sleep trigger check:
    │       if (tick - _last_sleep_tick) >= SLEEP_MIN_INTERVAL:
    │           asyncio.create_task(hypnos_runtime.run_sleep(nous_did, tick))
    │           emit SLEEP_ENTERED action {ltm_snapshot_hash_pre}
    │
    ├─ 3. HypnosRuntime.run_sleep(nous_did, tick) [async, non-blocking]
    │       ├─ Hebbian pass:  for each pair (i,j): edge_ij.weight += η
    │       ├─ SHY downscale: for all edges:        weight *= σ
    │       ├─ Compute ltm_snapshot_hash (canonical JSON of graph state)
    │       └─ emit SLEEP_COMPLETED action {ltm_snapshot_hash}
    │
    ├─ 4. LTM retrieval (at prompt-build time):
    │       SQL: SELECT node_id, SUM(weight)*recency_factor FROM edges
    │            GROUP BY node_id ORDER BY ... LIMIT HYPNOS_TOP_K
    │       → top-k strings injected into build_system_prompt(ltm_memories=...)
    │
    └─ 5. ObservationalLearner dispatch:
            for each trade_settled_event (non-self pair):
                asyncio.create_task(obs_learner.observe_trade(...))

Brain → Grid wire (3-keys-not-5):
    SLEEP_ENTERED  metadata: {ltm_snapshot_hash}   → Grid injects nous_did, tick → emits nous.sleep.entered
    SLEEP_COMPLETED metadata: {ltm_snapshot_hash}  → Grid injects nous_did, tick → emits nous.sleep.completed

LTM SQLite (ltm_{did_safe}.db):
    nodes: {node_id TEXT PK, content_hash TEXT, first_seen_tick INTEGER}
    edges: {src TEXT, dst TEXT, weight REAL, last_updated_tick INTEGER, PRIMARY KEY(src,dst)}
           canonical: src < dst (undirected)
```

### Recommended Project Structure
```
brain/src/noesis_brain/hypnos/
├── __init__.py         # public API exports
├── config.py           # HYPNOS_ETA, HYPNOS_SIGMA, HYPNOS_TOP_K, SLEEP_MIN_INTERVAL
├── types.py            # Episode dataclass, ConceptNode, ConceptEdge
├── working_memory.py   # WorkingMemory ring buffer (maxlen=7)
├── ltm_store.py        # LtmStore — SQLite WAL, nodes + edges tables, retrieval query
├── consolidator.py     # Hebbian pass + SHY downscale logic (pure functions)
└── runtime.py          # HypnosRuntime — run_sleep(), snapshot_hash()

grid/src/sleep/
├── appendNousSleepEntered.ts    # sole-producer for nous.sleep.entered
├── appendNousSleepCompleted.ts  # sole-producer for nous.sleep.completed
├── types.ts                     # NousSleepPayload interface
└── index.ts                     # barrel export
```

### Pattern 1: LtmStore — Clone of IrisStore WAL Constructor Discipline
**What:** SQLite WAL-mode database with two tables (nodes, edges), opened via the same `db_path: str | Path = ":memory:"` + `nous_did` constructor pattern as IrisStore.
**When to use:** Any time a new per-Nous Brain SQLite store is needed.

```python
# Source: brain/src/noesis_brain/iris/store.py (verified, CITED)
class LtmStore:
    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None:
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            safe = _did_safe(nous_did) if nous_did else "unknown"
            p = p / f"ltm_{safe}.db"
        self._db_path = str(p) if p is not None else ":memory:"
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS ltm_nodes (
                node_id        TEXT PRIMARY KEY,
                content_hash   TEXT NOT NULL,
                first_seen_tick INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ltm_edges (
                src              TEXT NOT NULL,
                dst              TEXT NOT NULL,
                weight           REAL NOT NULL DEFAULT 0.0,
                last_updated_tick INTEGER NOT NULL,
                PRIMARY KEY (src, dst)
            );
            CREATE INDEX IF NOT EXISTS idx_ltm_edges_src ON ltm_edges(src);
            CREATE INDEX IF NOT EXISTS idx_ltm_edges_dst ON ltm_edges(dst);
        """)
        self._conn.commit()
```

### Pattern 2: Hebbian Update + SHY Downscale (Consolidator)
**What:** All-pairs update for n≤7 episodes (max 21 pairs), then a single UPDATE on all edges.
**When to use:** Inside `HypnosRuntime.run_sleep()` after Working Memory is loaded.

```python
# Source: D-16-03 (CITED from CONTEXT.md), Hebb 1949, Tononi SHY hypothesis 2003
def hebbian_pass(store: LtmStore, episodes: list[Episode], eta: float, tick: int) -> None:
    """Co-activate all episode pairs. Δw = η × 1.0 × 1.0 = η (binary activation)."""
    for i in range(len(episodes)):
        for j in range(i + 1, len(episodes)):
            ep_i, ep_j = episodes[i], episodes[j]
            node_i = sha256(ep_i.content.encode())[:16].hex()  # 16-hex node ID
            node_j = sha256(ep_j.content.encode())[:16].hex()
            src, dst = (node_i, node_j) if node_i < node_j else (node_j, node_i)
            store.upsert_node(node_i, ep_i.content_hash, tick)
            store.upsert_node(node_j, ep_j.content_hash, tick)
            store.strengthen_edge(src, dst, delta=eta, tick=tick)

def shy_downscale(store: LtmStore, sigma: float) -> None:
    """Scale all edge weights by σ — prevents runaway saturation."""
    store.conn.execute("UPDATE ltm_edges SET weight = weight * ?", (sigma,))
    store.conn.commit()
```

### Pattern 3: LTM Retrieval — O(concept_count) SQL
**What:** Group-by aggregation over edges, never O(N²) Python iteration.
**When to use:** At prompt-build time in BrainHandler.

```python
# Source: D-16-05 specifics section (CITED from CONTEXT.md)
# recency_factor = exp(-Δtick / TAU) for each node, computed in Python
# but the SUM aggregation happens in SQL.
def retrieve_top_k(store: LtmStore, current_tick: int, k: int, tau: int = 500) -> list[str]:
    """Return top-k concept content strings ranked by (sum_weight × recency_factor)."""
    rows = store.conn.execute("""
        SELECT n.node_id, n.content_hash, n.first_seen_tick,
               COALESCE(SUM(e.weight), 0.0) AS total_weight
        FROM ltm_nodes n
        LEFT JOIN ltm_edges e ON (e.src = n.node_id OR e.dst = n.node_id)
        GROUP BY n.node_id
        ORDER BY total_weight DESC
        LIMIT ?
    """, (k * 4,)).fetchall()  # fetch 4× budget; re-rank with recency in Python

    import math
    scored = []
    for row in rows:
        delta = current_tick - row["first_seen_tick"]
        recency = math.exp(-delta / tau) if delta >= 0 else 1.0
        scored.append((row["total_weight"] * recency, row["content_hash"]))

    scored.sort(reverse=True)
    return [content for _, content in scored[:k]]
```

### Pattern 4: Sole-Producer Emitter (Grid TypeScript) — Clone of appendAnankeDriveCrossed
**What:** Closed-tuple 3-key payload with `Object.keys(payload).sort()` strict equality.
**When to use:** For each of the 2 new sleep events.

```typescript
// Source: grid/src/ananke/append-drive-crossed.ts (VERIFIED, read in session)
// Clone pattern — 3-key payload: {nous_did, tick, ltm_snapshot_hash}
const EXPECTED_KEYS = ['ltm_snapshot_hash', 'nous_did', 'tick'] as const;  // alphabetical

export function appendNousSleepEntered(
    audit: AuditChain,
    actorDid: string,
    payload: NousSleepPayload,
): AuditEntry {
    // 1. DID regex guard
    if (!DID_RE.test(actorDid)) throw new TypeError('...');
    if (!DID_RE.test(payload.nous_did)) throw new TypeError('...');
    // 2. Self-report invariant
    if (payload.nous_did !== actorDid) throw new TypeError('...');
    // 3. Tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) throw new TypeError('...');
    // 4. ltm_snapshot_hash: 64-char hex
    if (!/^[0-9a-f]{64}$/.test(payload.ltm_snapshot_hash)) throw new TypeError('...');
    // 5. Closed-tuple check
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== 3 || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i]))
        throw new TypeError('...');
    // 6. Explicit reconstruction
    const cleanPayload = {
        nous_did: payload.nous_did,
        tick: payload.tick,
        ltm_snapshot_hash: payload.ltm_snapshot_hash,
    };
    // 7. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) throw new TypeError('...');
    // 8. Commit
    return audit.append('nous.sleep.entered', actorDid, cleanPayload);
}
```

### Pattern 5: Optional-Dep Injection in BrainHandler
**What:** `_hypnos_runtime: HypnosRuntime | None = None` constructed when `hypnos_db_dir` is provided. Mirrors `_iris_runtime` introduced in Phase 17.
**When to use:** Same pattern as `iris_db_dir` constructor param.

```python
# Source: brain/src/noesis_brain/rpc/handler.py (VERIFIED, read in session)
# Phase 16: add hypnos_db_dir: str | Path | None = None to __init__ signature
if hypnos_db_dir is not None:
    _ltm_store = LtmStore(
        db_path=Path(hypnos_db_dir) / f"ltm_{self.did.replace(':', '_')}.db",
        nous_did=self.did,
    )
    self._hypnos_runtime: HypnosRuntime | None = HypnosRuntime(_ltm_store)
    self._obs_learner: ObservationalLearner | None = ObservationalLearner(
        store=self.memory,  # MemoryStore
        skill_store=...,    # SkillStore (already present)
        llm=self.llm,
        my_name=self.psyche.name,
    )
else:
    self._hypnos_runtime = None
    self._obs_learner = None
self._last_sleep_tick: int = 0
```

### Anti-Patterns to Avoid

- **`await` in tick path for sleep:** Sleep MUST use `asyncio.create_task(...)` — never `await hypnos_runtime.run_sleep(...)` directly inside `on_tick()`. T-16-02 critical risk.
- **Wall-clock in hypnos/ modules:** `datetime`, `time.time()`, `random.random()`, `uuid.uuid4()`, `os.urandom()` are FORBIDDEN in `brain/src/noesis_brain/hypnos/**`. Only `tick` from caller is the time axis.
- **Storing Working Memory to SQLite:** Working Memory is reconstructed from MemoryStore on every tick. No separate WorkingMemory SQLite table.
- **O(N²) retrieval loop:** LTM retrieval MUST use SQL GROUP BY aggregation. Never iterate all edge pairs in Python.
- **Spreading LTM content across wire:** `nous.sleep.entered` and `nous.sleep.completed` carry ONLY `{nous_did, tick, ltm_snapshot_hash}`. No episode text, no graph data, no content strings.
- **Amending stub entries without creating real emitters:** Wave 0 must BOTH fix the allowlist comment strings AND create the actual sole-producer emitter files in `grid/src/sleep/`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAL SQLite connection management | Custom file locking | Clone IrisStore pattern (conn + PRAGMA journal_mode=WAL + executescript) | Already solved, tested, and battle-hardened in Phase 17 |
| Ring buffer with bounded capacity | Manual list slicing with overflow check | `collections.deque(maxlen=7)` | Enforces cap natively; no off-by-one risk |
| Sole-producer TypeScript emitter structure | Freeform append calls | Clone `appendAnankeDriveCrossed.ts` verbatim structure | Closed-tuple + privacy-check + DID-regex + self-report discipline is load-bearing |
| Graph snapshot hash | Ad-hoc JSON dumps | `json.dumps(sorted(graph_dict.items()), separators=(',',':'), sort_keys=True)` → `sha256(...).hexdigest()` | Canonical JSON with sorted keys gives stable, deterministic byte representation |
| Geometric series bound proof | Complex math | `max_weight ≈ η / (1 − σ)` | With η=0.01, σ=0.95: max ≈ 0.2. Write the SHY boundedness test against this formula |

**Key insight:** All storage and retrieval patterns exist in the codebase (`IrisStore`, `SkillStore`, `MemoryStore`). LtmStore is a structural clone of IrisStore with a different schema (undirected edges instead of belief rows).

---

## Common Pitfalls

### Pitfall 1: Wrong Payload Shape in Stub Entries
**What goes wrong:** Allowlist positions 31-32 carry `{nous_did, tick}` and `{nous_did, tick, sleep_duration_ticks}`. Any test that validates the emitter closed-tuple will fail until the stubs are replaced with real emitters using `{nous_did, tick, ltm_snapshot_hash}`.
**Why it happens:** Phase 17 Wave 0 added the stubs proactively with placeholder payloads; Phase 16 owns the correction.
**How to avoid:** Wave 0 of Phase 16 must: (a) update the comment strings in `ALLOWLIST_MEMBERS` positions 31-32, (b) create `grid/src/sleep/appendNousSleepEntered.ts` and `appendNousSleepCompleted.ts` with the correct 3-key payload.
**Warning signs:** TypeScript emitter tests fail with "unexpected key set" on the closed-tuple check.

### Pitfall 2: `await` in Tick Path (T-16-02)
**What goes wrong:** If `run_sleep()` is awaited directly in `on_tick()`, the Grid tick RPC blocks for the entire Hebbian pass duration. With 7 episodes and 21 pairs, this may take milliseconds — but it still violates the non-blocking contract.
**Why it happens:** Natural async/await reflex when calling an async method.
**How to avoid:** Always use `asyncio.create_task(hypnos_runtime.run_sleep(...))`. The sleep task runs in the background; `on_tick()` returns immediately. CI grep gate forbids bare `await` calls to `run_sleep` in `handler.py`.
**Warning signs:** Grid tick latency spikes; test asserting `asyncio.create_task` is called fails.

### Pitfall 3: Wall-Clock Coupling in Hypnos Modules (T-16-03)
**What goes wrong:** Any `datetime`, `time.time()`, `random.random()`, `uuid.uuid4()`, or `os.urandom()` in `hypnos/` modules breaks determinism — fixed `(seed, episodes, η, σ)` will no longer reproduce byte-identical LTM graphs.
**Why it happens:** Default Python patterns for generating unique IDs or timestamps.
**How to avoid:** Use `tick` from the caller as the sole time axis. Use content-hash (`sha256`) for node IDs. The CI grep gate (`scripts/check-wallclock-forbidden.mjs` or equivalent Python test) catches violations in `brain/src/noesis_brain/hypnos/**`.
**Warning signs:** Determinism test (`test_ltm_determinism`) fails with different graph states on replay.

### Pitfall 4: Missing ObservationalLearner Wiring
**What goes wrong:** `learning/observational.py` is fully implemented but `BrainHandler` has zero wiring (per CONTEXT.md D-16-09). If not wired, ObservationalLearner never fires.
**Why it happens:** Phase 15 scaffolded it; Phase 16 was intended to complete it.
**How to avoid:** BrainHandler must: (1) construct `ObservationalLearner` in `__init__` alongside other learners, (2) in `on_tick()` call `asyncio.create_task(self._obs_learner.observe_trade(...))` for each `trade_settled_event` where neither participant is `self.did`.
**Warning signs:** `_obs_learner` is `None` at runtime; no skills are ever stored from peer observations.

### Pitfall 5: peer_voices Already Slotted but Not Yet Populated
**What goes wrong:** `build_system_prompt()` already has the `peer_voices` kwarg (Phase 16 comment in system.py) and `_peer_voices_section()` renders it, but the handler never fetches and passes peer utterances.
**Why it happens:** Prompt architecture was designed ahead of implementation.
**How to avoid:** In `BrainHandler.build_prompt_context()` (or the prompt-build path), fetch top-3 `WikiCategory.NOUS` pages with `confidence ≥ 0.5` from `MemoryStore`, extract `(name, content)` pairs, pass as `peer_voices` to `build_system_prompt()`.
**Warning signs:** `peer_voices` is always `None` in the system prompt; `_peer_voices_section()` never renders.

### Pitfall 6: LTM Position in Prompt Stack
**What goes wrong:** Inserting `ltm_memories` AFTER peer_voices instead of BEFORE — reversed from D-16-08 spec (stack order: rules → reflections → skills → ltm_memories → peer_voices → ToM → directives).
**Why it happens:** Current `build_system_prompt()` appends sections in order; it's easy to add `ltm_memories` after the `peer_voices` block.
**How to avoid:** D-16-08 is explicit: `ltm_memories` section must be injected BEFORE the `peer_voices` block. The system.py section-append ordering is the source of truth.
**Warning signs:** System prompt ordering test fails; prompt shows ltm after peer_voices.

---

## Code Examples

### Working Memory — Fetching 7 Most-Recent Episodes
```python
# Source: D-16-01 (CITED from CONTEXT.md), MemoryStream.recent() verified in session
# In BrainHandler.on_tick():
if self._hypnos_runtime is not None:
    recent_memories = self.memory.recent_memories(limit=7)  # MemoryStore method
    self._hypnos_runtime.working_memory.set_episodes(recent_memories)
```

### Sleep Trigger Check (Non-Blocking)
```python
# Source: D-16-02 (CITED from CONTEXT.md)
# In BrainHandler.on_tick(), after Working Memory update:
if (self._hypnos_runtime is not None and
        (tick - self._last_sleep_tick) >= SLEEP_MIN_INTERVAL):
    self._last_sleep_tick = tick
    asyncio.create_task(self._run_sleep_cycle(tick))
    # SLEEP_ENTERED action emitted inside _run_sleep_cycle before Hebbian pass
```

### ltm_snapshot_hash Computation
```python
# Source: Claude's Discretion — canonical JSON approach recommended
import json, hashlib

def compute_ltm_snapshot_hash(store: LtmStore) -> str:
    """Deterministic hash of the LTM graph state post-SHY."""
    nodes = store.conn.execute(
        "SELECT node_id, content_hash, first_seen_tick FROM ltm_nodes ORDER BY node_id"
    ).fetchall()
    edges = store.conn.execute(
        "SELECT src, dst, weight, last_updated_tick FROM ltm_edges ORDER BY src, dst"
    ).fetchall()

    graph_dict = {
        "nodes": [{"id": r["node_id"], "ch": r["content_hash"], "tick": r["first_seen_tick"]}
                  for r in nodes],
        "edges": [{"s": r["src"], "d": r["dst"], "w": round(r["weight"], 8),
                   "tick": r["last_updated_tick"]}
                  for r in edges],
    }
    canonical = json.dumps(graph_dict, separators=(',', ':'), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
```

### SHY Boundedness Proof (for test)
```python
# Source: D-16-04 (CITED from CONTEXT.md) + geometric series math
# max_weight = η / (1 - σ) = 0.01 / (1 - 0.95) = 0.2
# Test: after 100 sleep cycles, all edge weights must be ≤ 0.2 + epsilon
def test_shy_boundedness():
    store = LtmStore(":memory:")
    episodes = [Episode(content=f"ep{i}", content_hash=f"h{i}") for i in range(7)]
    runtime = HypnosRuntime(store, eta=0.01, sigma=0.95)
    for tick in range(100):
        runtime.working_memory.set_episodes(episodes)
        runtime._run_hebbian_shy(tick)
    max_weight = store.conn.execute("SELECT MAX(weight) FROM ltm_edges").fetchone()[0]
    assert max_weight <= 0.21  # theoretical max 0.2 + small floating-point margin
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stubs at positions 31-32: wrong payloads | Real emitters with `{nous_did, tick, ltm_snapshot_hash}` | Phase 16 Wave 0 | CI tests for sleep emitters will finally pass |
| ObservationalLearner present but unwired | ObservationalLearner dispatched on trade_settled events | Phase 16 Wave 3 | Peer skill extraction starts working |
| peer_voices kwarg present but always None | peer_voices populated from WikiCategory.NOUS pages | Phase 16 Wave 3 | System prompt gains cultural observational learning section |
| No LTM retrieval | top-k concept nodes injected at prompt-build | Phase 16 Wave 2 | Long-term pattern accumulation feeds into every decision |

**Deprecated/outdated:**
- Stub comment `{nous_did, tick}` for `nous.sleep.entered` — replaced by `{nous_did, tick, ltm_snapshot_hash}`.
- Stub comment `{nous_did, tick, sleep_duration_ticks}` for `nous.sleep.completed` — replaced by `{nous_did, tick, ltm_snapshot_hash}`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MemoryStore.recent_memories(limit=7)` returns memories in descending tick order, suitable for Working Memory population | Standard Stack, Code Examples | If ordering is ascending, Working Memory gets oldest-first; test would catch this |
| A2 | Canonical JSON with `round(weight, 8)` provides stable float repr across Python versions | Code Examples (snapshot hash) | Hash would differ across Python minor versions; use `f"{weight:.8f}"` string format instead if needed |
| A3 | `_run_sleep_cycle` async method is the right abstraction for emitting SLEEP_ENTERED before Hebbian then SLEEP_COMPLETED after SHY | Architecture Patterns | If sleep actions need to be emitted synchronously from the task, the action dispatch mechanism needs to support async task → action queue |

---

## Open Questions

1. **How does the async sleep task emit actions back to the RPC response?**
   - What we know: `on_tick()` returns a list of actions synchronously. The sleep task runs asynchronously after `on_tick()` returns.
   - What's unclear: `SLEEP_ENTERED` and `SLEEP_COMPLETED` actions must reach the Grid. If they're produced inside an `asyncio.create_task`, they cannot be returned in the same `on_tick()` response list.
   - Recommendation: The most likely pattern (consistent with Iris elicit() architecture) is that `SLEEP_ENTERED` is added to `actions` synchronously BEFORE creating the task (to signal sleep started), and `SLEEP_COMPLETED` is queued for the NEXT tick response via an internal action buffer or the pattern where the task stores the result for the next `on_tick()` call to drain. The planner must decide this queue mechanism. Alternatively, both events may be emitted on the SAME tick in a two-phase synchronous approach where sleep is synchronous but non-CPU-blocking (all the math is O(49) operations for 7 episodes).
   - Note: Given the simplicity of the Hebbian pass (at most 21 edge updates), treating it as synchronous within the tick may be simpler than a true async task. The planner should confirm whether `asyncio.create_task` is truly needed for correctness vs. blocking concern.

2. **Does `MemoryStore` have a `recent_memories` method returning tick-ordered objects?**
   - What we know: `MemoryStream.recent(limit)` calls `self._store.recent_memories(limit=limit)`.
   - What's unclear: The exact column name for tick-ordering in the SQL query (may be `tick`, `created_at`, or similar).
   - Recommendation: Read `brain/src/noesis_brain/memory/sqlite_store.py` before implementing `WorkingMemory.set_episodes()` to confirm the ordering parameter.

3. **Where does `SkillStore` come from in `BrainHandler.__init__` for `ObservationalLearner`?**
   - What we know: `ObservationalLearner.__init__` takes `skill_store: SkillStore`. Phase 15 shipped SkillStore.
   - What's unclear: Whether `BrainHandler` already has a reference to SkillStore or whether it needs to be passed as a constructor argument.
   - Recommendation: Read `handler.py` constructor for existing Phase 15 SkillStore wiring before implementing ObservationalLearner construction.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all new code is stdlib Python sqlite3 + TypeScript stdlib; no new npm or pip packages required).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Brain framework | pytest + pytest-asyncio, `testpaths = ["test"]` (flat, no subdirs unless subdirectoried per module) |
| Grid framework | vitest ^2.0.0 |
| Brain config | `brain/pyproject.toml` |
| Grid config | `grid/vitest.config.ts` (inferred from existing Phase 17 tests) |
| Quick Brain run | `cd brain && pytest test/ -x -q` |
| Quick Grid run | `cd grid && npm test` |
| Full suite | Brain: `pytest test/ -v --cov` / Grid: `vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HYP-01 | WorkingMemory cap=7, 8 insertions → 7 retained | unit | `pytest brain/test/hypnos/test_working_memory.py -x` | ❌ Wave 0 |
| HYP-01 | WorkingMemory deterministic given (seed, tick) | unit | `pytest brain/test/hypnos/test_working_memory.py::test_determinism -x` | ❌ Wave 0 |
| HYP-02 | Hebbian pass: fixed (seed, episodes, η) → byte-identical LTM graph | unit | `pytest brain/test/hypnos/test_ltm_determinism.py -x` | ❌ Wave 0 |
| HYP-03 | SHY boundedness: after 100 cycles max_weight ≤ η/(1−σ) + ε | unit | `pytest brain/test/hypnos/test_shy_boundedness.py -x` | ❌ Wave 0 |
| HYP-04 | sleep boundary events carry correct 3-key payload | unit | `vitest run grid/test/sleep/` | ❌ Wave 0 |
| HYP-04 | Zero-diff: 100-tick sim with Hypnos enabled/disabled → byte-identical chain except sleep.* entries | integration | `pytest brain/test/hypnos/test_zero_diff.py -x` | ❌ Wave 0 |
| HYP-05 | LTM retrieval SQL GROUP BY returns results in < 10ms on 1000-node graph | perf | `pytest brain/test/hypnos/test_ltm_retrieval_perf.py -x` | ❌ Wave 0 |
| D-16-10 | CI grep: no wall-clock in hypnos/ | grep gate | `pytest brain/test/test_hypnos_no_walltime.py -x` | ❌ Wave 0 |
| D-16-10 | CI grep: no ltm_content|concept_text|... in Grid emitters | grep gate | `vitest run grid/test/sleep/sleep-privacy.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd brain && pytest test/hypnos/ -x -q` / `cd grid && vitest run grid/test/sleep/`
- **Per wave merge:** `cd brain && pytest test/ -q` / `cd grid && npm test`
- **Phase gate:** Full Brain + Grid suites green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `brain/test/hypnos/` directory with `__init__.py`
- [ ] `brain/test/hypnos/test_working_memory.py` — HYP-01
- [ ] `brain/test/hypnos/test_ltm_determinism.py` — HYP-02
- [ ] `brain/test/hypnos/test_shy_boundedness.py` — HYP-03
- [ ] `brain/test/hypnos/test_zero_diff.py` — HYP-04
- [ ] `brain/test/hypnos/test_ltm_retrieval_perf.py` — HYP-05
- [ ] `brain/test/test_hypnos_no_walltime.py` — D-16-10 grep gate
- [ ] `grid/test/sleep/` directory with sleep-specific tests
- [ ] `grid/test/sleep/sleep-producer-boundary.test.ts`
- [ ] `grid/test/sleep/sleep-privacy.test.ts`
- [ ] `grid/src/sleep/` directory with emitter files

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Closed-tuple check in TypeScript emitters; DID regex; 64-hex regex for snapshot hash |
| V6 Cryptography | yes | SHA-256 for node IDs and snapshot hash — stdlib hashlib only; no custom crypto |

### Known Threat Patterns for Hypnos Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LTM content leaking across Brain↔Grid wire | Information Disclosure | FORBIDDEN_KEY_PATTERN extension + three-tier grep CI gate (D-16-10) |
| Hebbian pass blocks Grid tick (T-16-02) | DoS | `asyncio.create_task()` — never `await` in tick path |
| Wall-clock coupling breaks determinism (T-16-03) | Tampering (replay integrity) | CI grep forbids datetime/time.time/random/uuid/os.urandom in hypnos/ |
| Wrong payload shape crossing audit chain | Tampering | Closed-tuple `Object.keys(payload).sort()` strict equality in emitters |
| Snapshot hash collision (content dedup) | Spoofing | SHA-256 truncated to 16 hex chars for node IDs — collision negligible at n=7 episodes; full 64-char hash for ltm_snapshot_hash |

---

## Sources

### Primary (HIGH confidence)
- `brain/src/noesis_brain/iris/store.py` — IrisStore WAL constructor discipline (VERIFIED, read in session)
- `brain/src/noesis_brain/iris/config.py` — Module-level constants pattern; `SLEEP_MIN_INTERVAL` comment (VERIFIED)
- `brain/src/noesis_brain/rpc/handler.py` — Existing on_tick() structure, _iris_runtime optional-dep pattern, async task discipline (VERIFIED, read lines 1-500)
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum with Phase 16 stubs (VERIFIED)
- `brain/src/noesis_brain/prompts/system.py` — `build_system_prompt()` with peer_voices and Phase 16/17 comments (VERIFIED)
- `brain/src/noesis_brain/learning/observational.py` — Full ObservationalLearner implementation (VERIFIED)
- `brain/src/noesis_brain/memory/stream.py` — MemoryStream.recent() (VERIFIED)
- `grid/src/ananke/append-drive-crossed.ts` — 3-keys-not-5 sole-producer clone pattern (VERIFIED)
- `grid/src/audit/broadcast-allowlist.ts` — Current allowlist with wrong stub payloads at positions 31-32 (VERIFIED)
- `.planning/phases/16-hypnos-consolidating-memory/16-CONTEXT.md` — All locked decisions D-16-01..D-16-10 (CITED)
- `.planning/ROADMAP.md` §Phase 16 — HYP-01..05 success criteria and T-16-01..03 risks (CITED)
- `.planning/STATE.md` — Accumulated context: allowlist at 36 events, 3-keys-not-5 invariant, async task discipline (CITED)

### Secondary (MEDIUM confidence)
- Miller's Law (1956): Working Memory cap = 7 ± 2 — cited in ROADMAP research artifacts
- Tononi SHY hypothesis (2003): Synaptic Homeostasis after Hebbian consolidation — cited in ROADMAP
- Hebb (1949): Hebbian learning `Δw = η × pre × post` — cited in ROADMAP

### Tertiary (LOW confidence)
- None — all architectural decisions are locked in CONTEXT.md or verified in the codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all patterns verified from existing IrisStore, handler, emitters in the codebase
- Architecture: HIGH — all locked decisions read from CONTEXT.md; existing code patterns confirmed
- Pitfalls: HIGH — stub payload mismatch confirmed by reading broadcast-allowlist.ts; async/wall-clock patterns verified from T-09-03 precedent

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable domain — all locked decisions, no fast-moving ecosystem)
