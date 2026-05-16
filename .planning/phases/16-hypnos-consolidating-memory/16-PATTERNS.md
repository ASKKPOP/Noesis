# Phase 16: Hypnos (Consolidating Memory) — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 16 new/modified files
**Analogs found:** 16 / 16

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `brain/src/noesis_brain/hypnos/__init__.py` | module-init | — | `brain/src/noesis_brain/iris/__init__.py` | role-match |
| `brain/src/noesis_brain/hypnos/config.py` | config | — | `brain/src/noesis_brain/iris/config.py` | exact |
| `brain/src/noesis_brain/hypnos/types.py` | model | — | `brain/src/noesis_brain/iris/types.py` (inferred) | role-match |
| `brain/src/noesis_brain/hypnos/working_memory.py` | utility | CRUD | `collections.deque` pattern; no direct code analog | partial |
| `brain/src/noesis_brain/hypnos/ltm_store.py` | service | CRUD | `brain/src/noesis_brain/iris/store.py` | exact |
| `brain/src/noesis_brain/hypnos/consolidator.py` | utility | transform | `brain/src/noesis_brain/iris/store.py` (SQL patterns) | partial |
| `brain/src/noesis_brain/hypnos/runtime.py` | service | event-driven | `brain/src/noesis_brain/iris/elicit.py` (inferred) + handler async pattern | role-match |
| `brain/src/noesis_brain/rpc/handler.py` (modify) | controller | request-response | itself — additive widening pattern | exact |
| `brain/src/noesis_brain/rpc/types.py` (modify) | model | — | itself — ActionType enum extension | exact |
| `brain/src/noesis_brain/prompts/system.py` (modify) | utility | transform | itself — additive-widening kwarg pattern | exact |
| `grid/src/sleep/types.ts` | model | — | `grid/src/ananke/types.ts` | exact |
| `grid/src/sleep/appendNousSleepEntered.ts` | utility | request-response | `grid/src/ananke/append-drive-crossed.ts` | exact |
| `grid/src/sleep/appendNousSleepCompleted.ts` | utility | request-response | `grid/src/ananke/append-drive-crossed.ts` | exact |
| `grid/src/sleep/index.ts` | module-init | — | `grid/src/ananke/index.ts` (inferred barrel) | role-match |
| `grid/src/integration/nous-runner.ts` (modify) | controller | event-driven | itself — `case 'iris_belief_revised'` switch block | exact |
| `grid/src/audit/broadcast-allowlist.ts` (modify) | config | — | itself — positions 31-32 comment correction + FORBIDDEN_KEY_PATTERN extension | exact |
| `protocol/src/noesis/bridge/types.ts` (modify) | model | — | itself — BrainAction union extension | exact |
| `brain/test/hypnos/test_working_memory.py` | test | — | `brain/test/` pytest conventions | role-match |
| `brain/test/hypnos/test_ltm_determinism.py` | test | — | Phase 10a T-09-03 determinism discipline | role-match |
| `brain/test/hypnos/test_shy_boundedness.py` | test | — | same pattern | role-match |
| `brain/test/hypnos/test_zero_diff.py` | test | — | Phase 10a zero-diff gate | role-match |
| `brain/test/hypnos/test_ltm_retrieval_perf.py` | test | — | same | role-match |
| `grid/test/sleep/sleep-producer-boundary.test.ts` | test | — | `grid/test/ananke/append-drive-crossed.test.ts` | exact |
| `grid/test/sleep/sleep-privacy.test.ts` | test | — | `grid/test/ananke/append-drive-crossed.test.ts` | role-match |

---

## Pattern Assignments

### `brain/src/noesis_brain/hypnos/config.py` (config)

**Analog:** `brain/src/noesis_brain/iris/config.py` (lines 1-22)

**Imports + constants pattern** (lines 1-22 of iris/config.py):
```python
"""Iris module configuration constants — Phase 17.

All constants are module-level (locked) — not injectable, not overridable at runtime.
Mirrors brain/src/noesis_brain/hypnos/config.py discipline.
"""
from __future__ import annotations

# Minimum subjective ticks between elicit() calls per (nous_did, target_did) pair.
# Mirrors SLEEP_MIN_INTERVAL = 30 from hypnos/config.py — same pattern.
IRIS_ELICIT_COOLDOWN: int = 20

# Maximum active beliefs per (target_did, dimension) pair.
IRIS_BELIEFS_CAP: int = 10

# Top-K beliefs returned by context_for() per peer.
IRIS_CONTEXT_TOP_K: int = 5
```

**Apply for hypnos/config.py** — replace iris constants with:
```python
"""Hypnos module configuration constants — Phase 16.

All constants are module-level (locked) — not injectable, not overridable at runtime.
Wall-clock FORBIDDEN: datetime, time.time, random, uuid, os.urandom are banned here.
"""
from __future__ import annotations

HYPNOS_ETA: float = 0.01        # Hebbian learning rate (η)
HYPNOS_SIGMA: float = 0.95      # SHY downscale factor (σ)
HYPNOS_TOP_K: int = 5           # LTM nodes injected into system prompt
SLEEP_MIN_INTERVAL: int = 30    # Ticks between sleep cycles
```

---

### `brain/src/noesis_brain/hypnos/ltm_store.py` (service, CRUD)

**Analog:** `brain/src/noesis_brain/iris/store.py` (lines 1-90)

**Imports + constructor pattern** (iris/store.py lines 1-53):
```python
from __future__ import annotations

import hashlib
import re
import sqlite3
from pathlib import Path

from noesis_brain.iris.config import IRIS_BELIEFS_CAP, IRIS_CONTEXT_TOP_K
from noesis_brain.iris.types import Belief, DIMENSION_VALUES


def _did_safe(nous_did: str) -> str:
    """Convert DID to filesystem-safe name. Mirrors Phase 16 ltm_{did_safe}.db convention."""
    return re.sub(r"[^a-z0-9_\-]", "_", nous_did.lower())


class IrisStore:
    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None:
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            safe = _did_safe(nous_did) if nous_did else "unknown"
            p = p / f"iris_{safe}.db"
        self._db_path = str(p) if p is not None else ":memory:"
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()
```

**Schema pattern** (iris/store.py lines 55-90):
```python
    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS iris_beliefs (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                ...
            );
            CREATE INDEX IF NOT EXISTS idx_iris_target
                ON iris_beliefs(target_did, dimension);
            ...
        """)
        self._conn.commit()
```

**Apply for ltm_store.py** — clone constructor exactly but change:
- `iris_{safe}.db` → `ltm_{safe}.db`
- Replace schema with:
```python
    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS ltm_nodes (
                node_id          TEXT PRIMARY KEY,
                content_hash     TEXT NOT NULL,
                first_seen_tick  INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ltm_edges (
                src               TEXT NOT NULL,
                dst               TEXT NOT NULL,
                weight            REAL NOT NULL DEFAULT 0.0,
                last_updated_tick INTEGER NOT NULL,
                PRIMARY KEY (src, dst)
            );
            CREATE INDEX IF NOT EXISTS idx_ltm_edges_src ON ltm_edges(src);
            CREATE INDEX IF NOT EXISTS idx_ltm_edges_dst ON ltm_edges(dst);
        """)
        self._conn.commit()
```

**Write methods pattern** (iris/store.py lines 92-132 for insert discipline):
```python
    def add_belief(self, belief: Belief, tick: int) -> int:
        content_hash = hashlib.sha256(belief.content.encode("utf-8")).hexdigest()
        cursor = self._conn.execute(
            "INSERT INTO iris_beliefs (...) VALUES (?, ...)",
            (...),
        )
        new_id = cursor.lastrowid
        self._conn.commit()
        return new_id
```

**Apply for ltm_store.py** — equivalent write methods:
```python
    def upsert_node(self, node_id: str, content_hash: str, tick: int) -> None:
        self._conn.execute(
            """INSERT INTO ltm_nodes (node_id, content_hash, first_seen_tick)
               VALUES (?, ?, ?)
               ON CONFLICT(node_id) DO NOTHING""",
            (node_id, content_hash, tick),
        )
        self._conn.commit()

    def strengthen_edge(self, src: str, dst: str, delta: float, tick: int) -> None:
        """src MUST be < dst (canonical undirected ordering enforced by caller)."""
        self._conn.execute(
            """INSERT INTO ltm_edges (src, dst, weight, last_updated_tick)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(src, dst) DO UPDATE SET
                   weight = weight + excluded.weight,
                   last_updated_tick = excluded.last_updated_tick""",
            (src, dst, delta, tick),
        )
        self._conn.commit()

    def scale_all_edges(self, sigma: float) -> None:
        """SHY downscale: w ← w × σ for all edges."""
        self._conn.execute("UPDATE ltm_edges SET weight = weight * ?", (sigma,))
        self._conn.commit()
```

**Read pattern** (iris/store.py lines 178-223):
```python
    def get_beliefs(self, target_did: str, k: int = IRIS_CONTEXT_TOP_K) -> list[Belief]:
        rows = self._conn.execute(
            "SELECT ... FROM iris_beliefs WHERE ... ORDER BY confidence DESC LIMIT ?",
            (..., k),
        ).fetchall()
        return [Belief(...) for r in rows]
```

**Apply for ltm_store.py** — LTM retrieval (O(concept_count) SQL GROUP BY):
```python
    def retrieve_candidates(self, budget: int) -> list[sqlite3.Row]:
        """Return top-(budget) nodes by total incident edge weight.
        O(concept_count) via SQL GROUP BY — never O(N²) Python iteration.
        """
        return self._conn.execute(
            """SELECT n.node_id, n.content_hash, n.first_seen_tick,
                      COALESCE(SUM(e.weight), 0.0) AS total_weight
               FROM ltm_nodes n
               LEFT JOIN ltm_edges e ON (e.src = n.node_id OR e.dst = n.node_id)
               GROUP BY n.node_id
               ORDER BY total_weight DESC
               LIMIT ?""",
            (budget,),
        ).fetchall()
```

**Close pattern** (iris/store.py line 252):
```python
    def close(self) -> None:
        self._conn.close()
```

---

### `brain/src/noesis_brain/hypnos/consolidator.py` (utility, transform)

**Analog:** RESEARCH.md Pattern 2 + hashlib pattern from iris/store.py line 109

**Core pattern:**
```python
"""Consolidator — Hebbian pass + SHY downscale (Phase 16).

Wall-clock FORBIDDEN: datetime, time.time, random, uuid, os.urandom.
Only `tick` from caller is the time axis.
"""
from __future__ import annotations

import hashlib

from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.types import Episode


def _node_id(content: str) -> str:
    """sha256(content.encode())[:16].hex() — 16-hex node ID. D-16-03."""
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def hebbian_pass(store: LtmStore, episodes: list[Episode], eta: float, tick: int) -> None:
    """Co-activate all episode pairs. Δw = η × 1.0 × 1.0 = η (binary activation).

    All-pairs O(n²) for n=7 episodes → 21 edge updates max. Acceptable.
    Canonical undirected ordering: src < dst enforced here.
    """
    for i in range(len(episodes)):
        for j in range(i + 1, len(episodes)):
            ep_i, ep_j = episodes[i], episodes[j]
            node_i = _node_id(ep_i.content)
            node_j = _node_id(ep_j.content)
            src, dst = (node_i, node_j) if node_i < node_j else (node_j, node_i)
            store.upsert_node(node_i, hashlib.sha256(ep_i.content.encode()).hexdigest(), tick)
            store.upsert_node(node_j, hashlib.sha256(ep_j.content.encode()).hexdigest(), tick)
            store.strengthen_edge(src, dst, delta=eta, tick=tick)


def shy_downscale(store: LtmStore, sigma: float) -> None:
    """Scale all edge weights by σ — prevents runaway saturation. D-16-03."""
    store.scale_all_edges(sigma)
```

---

### `brain/src/noesis_brain/hypnos/runtime.py` (service, event-driven)

**Analog:** handler.py `_iris_runtime` pattern (lines 80-88) + async create_task discipline in on_tick (lines 204-228)

**Core pattern:**
```python
"""HypnosRuntime — orchestrates sleep cycle (Hebbian + SHY + snapshot hash). Phase 16.

Wall-clock FORBIDDEN: datetime, time.time, random, uuid, os.urandom.
"""
from __future__ import annotations

import hashlib
import json
import math

from noesis_brain.hypnos.config import HYPNOS_ETA, HYPNOS_SIGMA, HYPNOS_TOP_K
from noesis_brain.hypnos.consolidator import hebbian_pass, shy_downscale
from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.working_memory import WorkingMemory


class HypnosRuntime:
    def __init__(
        self,
        store: LtmStore,
        eta: float = HYPNOS_ETA,
        sigma: float = HYPNOS_SIGMA,
        top_k: int = HYPNOS_TOP_K,
    ) -> None:
        self._store = store
        self._eta = eta
        self._sigma = sigma
        self._top_k = top_k
        self.working_memory = WorkingMemory()

    async def run_sleep(self, nous_did: str, tick: int) -> str:
        """Execute one sleep cycle. Returns ltm_snapshot_hash. Non-blocking caller MUST
        asyncio.create_task() this — never await in tick path (T-16-02)."""
        episodes = self.working_memory.episodes()
        if episodes:
            hebbian_pass(self._store, episodes, self._eta, tick)
        shy_downscale(self._store, self._sigma)
        return self.compute_snapshot_hash()

    def compute_snapshot_hash(self) -> str:
        """Canonical JSON hash of the LTM graph state post-SHY. D-16-03."""
        nodes = self._store._conn.execute(
            "SELECT node_id, content_hash, first_seen_tick FROM ltm_nodes ORDER BY node_id"
        ).fetchall()
        edges = self._store._conn.execute(
            "SELECT src, dst, weight, last_updated_tick FROM ltm_edges ORDER BY src, dst"
        ).fetchall()
        graph_dict = {
            "nodes": [{"ch": r["content_hash"], "id": r["node_id"], "tick": r["first_seen_tick"]}
                      for r in nodes],
            "edges": [{"d": r["dst"], "s": r["src"], "tick": r["last_updated_tick"],
                       "w": round(r["weight"], 8)}
                      for r in edges],
        }
        canonical = json.dumps(graph_dict, separators=(',', ':'), sort_keys=True)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def retrieve_top_k(self, current_tick: int, tau: int = 500) -> list[str]:
        """O(concept_count) retrieval via SQL GROUP BY. p95 < 10ms on 1000-node graph."""
        candidates = self._store.retrieve_candidates(self._top_k * 4)
        scored = []
        for row in candidates:
            delta = current_tick - row["first_seen_tick"]
            recency = math.exp(-delta / tau) if delta >= 0 else 1.0
            scored.append((row["total_weight"] * recency, row["content_hash"]))
        scored.sort(reverse=True)
        return [content for _, content in scored[:self._top_k]]
```

---

### `brain/src/noesis_brain/hypnos/working_memory.py` (utility, CRUD)

**No direct code analog** — pure Python `collections.deque(maxlen=7)` pattern.

**Core pattern:**
```python
"""WorkingMemory — pure in-memory ring buffer (cap=7, Miller's Law). Phase 16.

NOT persisted. Reconstructed each tick from MemoryStore. D-16-01.
Wall-clock FORBIDDEN in this module.
"""
from __future__ import annotations

from collections import deque

from noesis_brain.hypnos.types import Episode


class WorkingMemory:
    """Ring buffer capped at 7 episodes. Overflow evicts oldest (FIFO via deque)."""

    CAP = 7

    def __init__(self) -> None:
        self._buf: deque[Episode] = deque(maxlen=self.CAP)

    def set_episodes(self, memories: list) -> None:
        """Replace buffer contents from tick-ordered MemoryStore results (D-16-01)."""
        self._buf.clear()
        for m in memories[:self.CAP]:
            self._buf.append(Episode(content=m.content, memory_type=str(m.memory_type)))

    def episodes(self) -> list[Episode]:
        return list(self._buf)

    def __len__(self) -> int:
        return len(self._buf)
```

---

### `brain/src/noesis_brain/rpc/handler.py` (modify — additive widening)

**Analog:** itself — `_iris_runtime` optional-dep injection pattern (lines 77-88) + `on_tick` action-append discipline (lines 204-319)

**Optional-dep injection pattern** (handler.py lines 77-88):
```python
        # Phase 17 D-17-14: IrisRuntime optional-dep injection.
        # iris_db_dir=None → Iris disabled (all iris guards are no-ops).
        if iris_db_dir is not None:
            _iris_store = IrisStore(
                db_path=Path(iris_db_dir) / f"iris_{self.did.replace(':', '_')}.db",
                nous_did=self.did,
            )
            self._iris_runtime: IrisRuntime | None = IrisRuntime(_iris_store, self.llm)
            self._iris_runtime.set_dispatcher(None)
        else:
            self._iris_runtime = None
```

**Apply for Phase 16** — add to `__init__` signature and body:
```python
        # Phase 16 D-16-02/D-16-09: Hypnos optional-dep injection.
        # hypnos_db_dir=None → Hypnos disabled; sleep never fires.
        if hypnos_db_dir is not None:
            from noesis_brain.hypnos.ltm_store import LtmStore
            from noesis_brain.hypnos.runtime import HypnosRuntime
            from noesis_brain.learning.observational import ObservationalLearner
            _ltm_store = LtmStore(db_path=Path(hypnos_db_dir), nous_did=self.did)
            self._hypnos_runtime: HypnosRuntime | None = HypnosRuntime(_ltm_store)
            self._obs_learner: ObservationalLearner | None = ObservationalLearner(
                store=self.memory,
                skill_store=...,   # existing SkillStore ref
                llm=self.llm,
                my_name=self.psyche.name,
            )
        else:
            self._hypnos_runtime = None
            self._obs_learner = None
        self._last_sleep_tick: int = 0
```

**on_tick action-append pattern** (handler.py lines 204-228, drive_crossed):
```python
        runtime.on_tick(tick)
        for xing in runtime.drain_crossings():
            actions.append(
                Action(
                    action_type=ActionType.DRIVE_CROSSED,
                    metadata={
                        "drive": xing.drive.value,
                        "level": xing.level.value,
                        "direction": xing.direction.value,
                    },
                ).to_dict()
            )
```

**Apply for Phase 16 Working Memory + sleep trigger** (insert after BIOS block):
```python
        # Phase 16 D-16-01/D-16-02: Working Memory update + sleep trigger.
        if self._hypnos_runtime is not None:
            recent = self.memory.recent_memories(limit=7)
            self._hypnos_runtime.working_memory.set_episodes(recent)

            if (tick - self._last_sleep_tick) >= SLEEP_MIN_INTERVAL:
                self._last_sleep_tick = tick
                snapshot_hash = self._hypnos_runtime.compute_snapshot_hash()
                # SLEEP_ENTERED emitted synchronously before async sleep task.
                actions.append(Action(
                    action_type=ActionType.SLEEP_ENTERED,
                    metadata={"ltm_snapshot_hash": snapshot_hash},
                ).to_dict())
                asyncio.create_task(self._run_sleep_cycle(tick))
```

**Iris elicit pattern for ObservationalLearner dispatch** (handler.py lines 268-319):
```python
        if self._iris_runtime is not None and isinstance(dialogue_ctxs, list):
            for ctx in dialogue_ctxs:
                ...
                try:
                    result = self._iris_runtime.elicit(...)
                except Exception as exc:
                    log.warning("iris: elicit failed for %s: %s", target_did, exc)
                    continue
```

**Apply for ObservationalLearner** (insert trade_settled dispatch):
```python
        # Phase 16 D-16-09: ObservationalLearner dispatch on trade_settled events.
        if self._obs_learner is not None:
            trade_events = params.get("trade_settled_events", [])
            if isinstance(trade_events, list):
                for evt in trade_events:
                    buyer = evt.get("buyer_did", "")
                    seller = evt.get("seller_did", "")
                    if buyer == self.did or seller == self.did:
                        continue  # skip own trades
                    asyncio.create_task(
                        self._obs_learner.observe_trade(buyer, seller, evt.get("item", ""), tick)
                    )
```

---

### `brain/src/noesis_brain/rpc/types.py` (modify — ActionType extension)

**Analog:** itself (lines 36-41, Phase 17 iris actions)

**Iris extension pattern** (types.py lines 36-41):
```python
    # Phase 17 — D-17-06: Iris Theory of Mind lifecycle events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # All 4 are forwarded to the Grid (unlike SKILL_LEARN/RULE_STORE/SKILL_SHARE which are Brain-internal).
    # 3-keys-not-5: Brain metadata carries 1–3 keys; Grid injects nous_did and tick at emit time.
    IRIS_BELIEF_REVISED = "iris_belief_revised"
    IRIS_CONTEXT_INVOKED = "iris_context_invoked"
    IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"
    IRIS_PRIOR_SEEDED = "iris_prior_seeded"
```

**Apply for Phase 16** (add after SKILL_SHARE):
```python
    # Phase 16 — D-16-07: Hypnos sleep boundary events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # Both forwarded to Grid (unlike SKILL_LEARN/RULE_STORE/SKILL_SHARE which are Brain-internal).
    # 3-keys-not-5: Brain metadata carries 1 key {ltm_snapshot_hash};
    # Grid injects nous_did and tick at emit time.
    SLEEP_ENTERED = "sleep_entered"
    SLEEP_COMPLETED = "sleep_completed"
```

---

### `brain/src/noesis_brain/prompts/system.py` (modify — ltm_memories kwarg)

**Analog:** itself — peer_voices additive-widening pattern (lines 31-107)

**peer_voices kwarg pattern** (system.py lines 31-107):
```python
    # Phase 16 additive-widening: peer cultural learning.
    peer_voices: "list[tuple[str, str]] | None" = None,
    # Phase 17 additive-widening: Theory of Mind context for up to 3 peers.
    tom_context: "list | None" = None,
) -> str:
    ...
    # Phase 16: inject recent peer utterances for cultural observation.
    if peer_voices:
        section = _peer_voices_section(peer_voices)
        if section:
            sections.append(section)

    # Phase 17: inject Theory of Mind context if available.
    if tom_context:
        section = _theory_of_mind_section(tom_context)
        if section:
            sections.append(section)
```

**Apply for Phase 16 ltm_memories** — insert kwarg BETWEEN skills and peer_voices:
```python
    # Phase 16 additive-widening: long-term memory concept retrieval.
    # ltm_memories: top-k content hashes / descriptors from LtmStore.
    # Injected AFTER skills, BEFORE peer_voices (D-16-08 stack order).
    ltm_memories: "list[str] | None" = None,
```

And in the sections assembly block (after skills, before peer_voices):
```python
    # Phase 16: inject LTM concept nodes BEFORE peer_voices (D-16-08 order).
    if ltm_memories:
        section = _ltm_memories_section(ltm_memories)
        if section:
            sections.append(section)

    # Phase 16: inject recent peer utterances for cultural observation.
    if peer_voices:
```

And the section builder:
```python
def _ltm_memories_section(ltm_memories: "list[str]") -> str:
    """Inject top-k LTM concept nodes. Content is content_hash strings — not raw text.
    Brain-private: LTM content never crosses the Brain↔Grid wire. D-16-03, D-16-10.
    """
    if not ltm_memories:
        return ""
    lines = ["## Long-Term Patterns"]
    for entry in ltm_memories[:5]:  # HYPNOS_TOP_K = 5
        lines.append(f"- {entry}")
    return "\n".join(lines)
```

---

### `grid/src/sleep/types.ts` (model)

**Analog:** `grid/src/ananke/types.ts` (lines 1-59)

**Interface pattern** (ananke/types.ts lines 42-59):
```typescript
export interface AnankeDriveCrossedPayload {
    /** Actor DID — matches DID_RE (see append-drive-crossed.ts). */
    readonly did: string;
    /** Non-negative integer tick. */
    readonly tick: number;
    ...
}
```

**Apply for sleep/types.ts** — 3-key closed tuple (D-16-05):
```typescript
/**
 * Closed 3-key payload for nous.sleep.entered and nous.sleep.completed audit events.
 * Phase 16 (SLEEP-01). D-16-05.
 *
 * Key-set strict equality enforced at runtime by appendNousSleepEntered /
 * appendNousSleepCompleted via Object.keys(payload).sort().
 */
export interface NousSleepPayload {
    /** Nous DID — matches DID_RE. Self-report: must equal actorDid. */
    readonly nous_did: string;
    /** Non-negative integer world-clock tick. */
    readonly tick: number;
    /** SHA-256 hexdigest (64 chars) of the LTM graph state post-SHY. */
    readonly ltm_snapshot_hash: string;
}
```

---

### `grid/src/sleep/appendNousSleepEntered.ts` (utility, request-response)

**Analog:** `grid/src/ananke/append-drive-crossed.ts` (lines 1-134)

**Full structure pattern** (append-drive-crossed.ts lines 1-134):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { ... } from './types.js';

export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

const EXPECTED_KEYS = ['did', 'direction', 'drive', 'level', 'tick'] as const;  // alphabetical

export function appendAnankeDriveCrossed(
    audit: AuditChain,
    actorDid: string,
    payload: AnankeDriveCrossedPayload,
): AuditEntry {
    // 1. DID regex guards
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendAnankeDriveCrossed: invalid actorDid ...`);
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(`appendAnankeDriveCrossed: invalid payload.did ...`);
    }
    // 2. Self-report invariant
    if (payload.did !== actorDid) {
        throw new TypeError(`appendAnankeDriveCrossed: payload.did must equal actorDid ...`);
    }
    // 3. Tick — non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendAnankeDriveCrossed: tick must be non-negative integer ...`);
    }
    // 4-5. [enum checks then] Closed-tuple
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendAnankeDriveCrossed: unexpected key set ...`);
    }
    // 6. Explicit reconstruction
    const cleanPayload = { did: payload.did, tick: payload.tick, ... };
    // 7. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) throw new TypeError(`... privacy violation ...`);
    // 8. Commit
    return audit.append('ananke.drive_crossed', actorDid, cleanPayload);
}
```

**Apply for appendNousSleepEntered.ts** — 8 validation steps with:
- `EXPECTED_KEYS = ['ltm_snapshot_hash', 'nous_did', 'tick'] as const` (alphabetical, 3 keys)
- Step 1: DID regex on `actorDid` AND `payload.nous_did`
- Step 2: Self-report — `payload.nous_did !== actorDid`
- Step 3: Tick non-negative integer
- Step 4 (no enums): jump directly to closed-tuple step 5
- Step 5: `Object.keys(payload).sort()` strict equality against EXPECTED_KEYS (3)
- Step 6: `const cleanPayload = { nous_did: payload.nous_did, tick: payload.tick, ltm_snapshot_hash: payload.ltm_snapshot_hash }`
- Step 7: `payloadPrivacyCheck(cleanPayload)` — privacy gate
- Step 8: `audit.append('nous.sleep.entered', actorDid, cleanPayload)`
- Add: 64-char hex validation for `ltm_snapshot_hash`: `if (!/^[0-9a-f]{64}$/.test(payload.ltm_snapshot_hash)) throw new TypeError(...)`

**`appendNousSleepCompleted.ts`** is identical except step 8 uses `'nous.sleep.completed'` and function name changes. Clone line-for-line.

---

### `grid/src/integration/nous-runner.ts` (modify — switch cases)

**Analog:** itself — `case 'iris_belief_revised'` pattern (lines 634-653)

**Iris case pattern** (nous-runner.ts lines 634-653):
```typescript
                case 'iris_belief_revised': {
                    // Phase 17 D-17-09: Grid injects nous_did+tick (3-keys-not-5).
                    // Brain sends target_did, belief_hash, dimension (3 keys).
                    // Sole producer: appendIrisBeliefRevised. Rejections drop silently.
                    try {
                        appendIrisBeliefRevised(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            target_did: action.metadata['target_did'] as string,
                            belief_hash: action.metadata['belief_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'iris.dispatch.rejected',
                            action_type: 'iris_belief_revised',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }
```

**Apply for Phase 16 sleep cases** (add after last iris case):
```typescript
                case 'sleep_entered': {
                    // Phase 16 D-16-07: Grid injects nous_did+tick (3-keys-not-5).
                    // Brain sends {ltm_snapshot_hash} (1 key only).
                    // Sole producer: appendNousSleepEntered. Rejections drop silently.
                    try {
                        appendNousSleepEntered(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            ltm_snapshot_hash: action.metadata['ltm_snapshot_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'hypnos.dispatch.rejected',
                            action_type: 'sleep_entered',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'sleep_completed': {
                    try {
                        appendNousSleepCompleted(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            ltm_snapshot_hash: action.metadata['ltm_snapshot_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'hypnos.dispatch.rejected',
                            action_type: 'sleep_completed',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }
```

---

### `grid/src/audit/broadcast-allowlist.ts` (modify — positions 31-32 + FORBIDDEN_KEY_PATTERN)

**Analog:** itself — existing comment pattern for positions 31-32 (lines 140-143) + DRIVE_FORBIDDEN_KEYS pattern (lines 185-193)

**Wrong stub pattern** (allowlist.ts lines 140-143 — MUST FIX):
```typescript
    // Phase 16 (SLEEP-01) — stub allowlist entries. Sole-producer emitters in grid/src/sleep/.
    'nous.sleep.entered',        // (31) {nous_did, tick}              ← WRONG
    'nous.sleep.completed',      // (32) {nous_did, tick, sleep_duration_ticks}  ← WRONG
```

**Correct comment pattern** (clone bios.death comment style at lines 108-110):
```typescript
    // Phase 16 (SLEEP-01) — Nous sleep cycle boundaries. Closed 3-key payload:
    // {ltm_snapshot_hash, nous_did, tick}. Sole producers in grid/src/sleep/.
    // appendNousSleepEntered (grid/src/sleep/appendNousSleepEntered.ts)
    // appendNousSleepCompleted (grid/src/sleep/appendNousSleepCompleted.ts).
    'nous.sleep.entered',        // (31) {ltm_snapshot_hash, nous_did, tick}
    'nous.sleep.completed',      // (32) {ltm_snapshot_hash, nous_did, tick}
```

**DRIVE_FORBIDDEN_KEYS pattern** (lines 185-193) to clone for hypnos keys:
```typescript
export const DRIVE_FORBIDDEN_KEYS = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
    'drive_value',
] as const;
```

**Apply for D-16-10** (add HYPNOS_FORBIDDEN_KEYS and extend FORBIDDEN_KEY_PATTERN):
```typescript
export const HYPNOS_FORBIDDEN_KEYS = [
    'ltm_content',
    'concept_text',
    'graph_data',
    'episode_text',
    'node_content',
    'edge_content',
] as const;
```
Then extend `FORBIDDEN_KEY_PATTERN` regex to include `|ltm_content|concept_text|graph_data|episode_text|node_content|edge_content`.

---

### `protocol/src/noesis/bridge/types.ts` (modify — BrainAction union)

**Analog:** itself — iris_* union members (lines 42-47)

**Iris union extension pattern** (types.ts lines 42-47):
```typescript
        // Phase 17 — D-17-10: Iris Theory of Mind lifecycle events (forwarded to Grid).
        | 'iris_belief_revised'
        | 'iris_context_invoked'
        | 'iris_contradiction_detected'
        | 'iris_prior_seeded';
```

**Apply for Phase 16**:
```typescript
        // Phase 16 — D-16-07: Hypnos sleep boundary events (forwarded to Grid).
        | 'sleep_entered'
        | 'sleep_completed'
```

---

### `grid/test/sleep/sleep-producer-boundary.test.ts` (test)

**Analog:** `grid/test/ananke/append-drive-crossed.test.ts` (lines 1-182)

**Test structure pattern** (append-drive-crossed.test.ts lines 1-30):
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendAnankeDriveCrossed, DID_RE } from '../../src/ananke/append-drive-crossed.js';
import type { AnankeDriveCrossedPayload } from '../../src/ananke/types.js';

const DID = 'did:noesis:alpha';

const happyRising: AnankeDriveCrossedPayload = {
    did: DID, tick: 100, drive: 'hunger', level: 'med', direction: 'rising',
};

describe('appendAnankeDriveCrossed — DRIVE-03 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    describe('happy path', () => {
        it('appends a well-formed rising crossing', () => {
            const entry = appendAnankeDriveCrossed(chain, DID, happyRising);
            expect(entry.eventType).toBe('ananke.drive_crossed');
            expect(Object.keys(entry.payload as Record<string, unknown>).sort()).toEqual(
                ['did', 'direction', 'drive', 'level', 'tick'],
            );
        });
    });

    describe('closed-tuple rejection', () => { ... });
    describe('DID regex + self-report invariant', () => { ... });
    describe('tick validation', () => { ... });
});
```

**Apply for sleep-producer-boundary.test.ts**:
- Import `appendNousSleepEntered`, `appendNousSleepCompleted`, `DID_RE` from sleep emitters
- Import `NousSleepPayload` from `../../src/sleep/types.js`
- Happy payload: `{ nous_did: DID, tick: 100, ltm_snapshot_hash: 'a'.repeat(64) }`
- Verify `Object.keys(payload).sort()` equals `['ltm_snapshot_hash', 'nous_did', 'tick']`
- Closed-tuple tests: missing key (2-key), extra key (4-key), forbidden hypnos key
- DID regex + self-report: `payload.nous_did !== actorDid` → TypeError
- Tick: negative, float → TypeError
- `ltm_snapshot_hash`: not 64 chars, contains non-hex → TypeError

---

### `brain/test/hypnos/test_ltm_determinism.py` (test)

**Analog:** Phase 10a T-09-03 discipline (described in RESEARCH.md) + MemoryStore test conventions

**Test pattern** (from RESEARCH.md + test_shy_boundedness template):
```python
"""T-16-02: Fixed (seed, episodes, η, σ) → byte-identical LTM graph at any replay tick."""
import pytest
from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.runtime import HypnosRuntime
from noesis_brain.hypnos.types import Episode


def _make_episodes(n: int = 7) -> list[Episode]:
    return [Episode(content=f"episode_{i}", memory_type="observation") for i in range(n)]


def test_ltm_determinism():
    """Same (episodes, eta, sigma) → byte-identical snapshot hash at any replay."""
    episodes = _make_episodes()

    store1 = LtmStore(":memory:")
    rt1 = HypnosRuntime(store1, eta=0.01, sigma=0.95)
    rt1.working_memory.set_episodes(episodes)
    hash1 = rt1.compute_snapshot_hash()

    store2 = LtmStore(":memory:")
    rt2 = HypnosRuntime(store2, eta=0.01, sigma=0.95)
    rt2.working_memory.set_episodes(episodes)
    hash2 = rt2.compute_snapshot_hash()

    assert hash1 == hash2, "LTM snapshot hash must be byte-identical for same inputs"
```

---

### `brain/test/hypnos/test_shy_boundedness.py` (test)

**Core pattern** (from RESEARCH.md SHY boundedness proof):
```python
"""T-16-03: After 100 sleep cycles max_weight ≤ η/(1−σ) + ε."""

def test_shy_boundedness():
    """max_weight = η / (1 - σ) = 0.01 / 0.05 = 0.2. After 100 cycles stays bounded."""
    store = LtmStore(":memory:")
    episodes = _make_episodes(7)
    rt = HypnosRuntime(store, eta=0.01, sigma=0.95)

    for tick in range(100):
        rt.working_memory.set_episodes(episodes)
        # run Hebbian + SHY synchronously (no async needed in test)
        from noesis_brain.hypnos.consolidator import hebbian_pass, shy_downscale
        hebbian_pass(store, episodes, 0.01, tick)
        shy_downscale(store, 0.95)

    row = store._conn.execute("SELECT MAX(weight) FROM ltm_edges").fetchone()
    max_weight = row[0] if row and row[0] is not None else 0.0
    theoretical_max = 0.01 / (1 - 0.95)  # = 0.2
    assert max_weight <= theoretical_max + 0.01, (
        f"SHY boundedness violated: max_weight={max_weight:.6f} > {theoretical_max + 0.01:.4f}"
    )
```

---

## Shared Patterns

### SQLite WAL Constructor
**Source:** `brain/src/noesis_brain/iris/store.py` lines 36-53
**Apply to:** `brain/src/noesis_brain/hypnos/ltm_store.py`

The constructor signature `(db_path: str | Path = ":memory:", nous_did: str = "")` with directory auto-derive and `PRAGMA journal_mode=WAL` is the canonical pattern for all per-Nous SQLite stores. `ltm_store.py` MUST use this verbatim (changing only the db filename prefix).

### Sole-Producer Emitter Structure (8 validation steps)
**Source:** `grid/src/ananke/append-drive-crossed.ts` lines 1-134
**Apply to:** `grid/src/sleep/appendNousSleepEntered.ts`, `grid/src/sleep/appendNousSleepCompleted.ts`

Step ordering: DID regex → self-report → tick integer → (no enums for sleep) → closed-tuple Object.keys().sort() → explicit reconstruction → payloadPrivacyCheck → audit.append(). All 8 steps in this order.

### NousRunner switch-case (try/catch warn-and-continue)
**Source:** `grid/src/integration/nous-runner.ts` lines 634-653 (`case 'iris_belief_revised'`)
**Apply to:** `case 'sleep_entered'` and `case 'sleep_completed'`

Pattern: `try { appendFn(...) } catch (err) { console.warn(JSON.stringify({ event: 'hypnos.dispatch.rejected', ... })) }`.

### ActionType enum entry
**Source:** `brain/src/noesis_brain/rpc/types.py` lines 36-41 (iris entries)
**Apply to:** Phase 16 SLEEP_ENTERED, SLEEP_COMPLETED

Docstring MUST say: string value matches Grid NousRunner switch case; forwarded to Grid; metadata key count (1 key); Grid injects nous_did+tick.

### Optional-dep injection in BrainHandler
**Source:** `brain/src/noesis_brain/rpc/handler.py` lines 77-88 (`_iris_runtime`)
**Apply to:** `_hypnos_runtime` and `_obs_learner` construction

Pattern: `if foo_db_dir is not None: construct ... else: self._foo = None`. Guard all usage with `if self._hypnos_runtime is not None`.

### asyncio.create_task discipline (T-16-02 critical)
**Source:** `brain/src/noesis_brain/rpc/handler.py` (Iris elicit usage, lines 276-283)
**Apply to:** `HypnosRuntime.run_sleep()` call in on_tick and `ObservationalLearner.observe_trade()` call

`asyncio.create_task(...)` — NEVER `await` in the tick path. The sleep math is O(21) edge updates and may be fast, but the contract is non-blocking regardless.

### Test vitest structure (Grid)
**Source:** `grid/test/ananke/append-drive-crossed.test.ts` lines 1-182
**Apply to:** `grid/test/sleep/sleep-producer-boundary.test.ts`, `grid/test/sleep/sleep-privacy.test.ts`

Sections: happy path describe → closed-tuple rejection describe → DID regex + self-report describe → tick validation describe. Use `beforeEach(() => { chain = new AuditChain(); })`.

### Additive-widening kwarg for system prompt
**Source:** `brain/src/noesis_brain/prompts/system.py` lines 31-107
**Apply to:** `ltm_memories: list[str] | None = None` kwarg insertion BEFORE `peer_voices` kwarg (line 34), with corresponding `if ltm_memories:` block inserted after skills block and BEFORE peer_voices block.

---

## No Analog Found

All Phase 16 files have analogs or close role-matches. The following are partial-match items where no exact code exists yet:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `brain/src/noesis_brain/hypnos/working_memory.py` | utility | CRUD | No prior ring-buffer module in codebase; uses stdlib `collections.deque(maxlen=7)` — no code to copy, pattern is trivial |
| `brain/src/noesis_brain/hypnos/types.py` | model | — | No prior Episode/ConceptNode dataclass; follows `@dataclass` pattern from `brain/src/noesis_brain/iris/types.py` (inferred) but Phase 17 iris/types.py not read — use standard `@dataclass` with `from __future__ import annotations` |
| `grid/src/sleep/index.ts` | module-init | — | Barrel export — clone any existing `index.ts` in grid/src/ananke/ or grid/src/iris/ |
| `brain/test/hypnos/test_zero_diff.py` | test | integration | Zero-diff pattern described in Phase 10a CONTEXT but no test file was read directly; planner designs based on FixtureBrainAdapter pattern |
| `brain/test/hypnos/test_ltm_retrieval_perf.py` | test | perf | p95 timing test pattern; no existing perf test analog found in session |

---

## Metadata

**Analog search scope:** `brain/src/noesis_brain/` (iris/, memory/, rpc/, prompts/, learning/), `grid/src/` (ananke/, audit/, integration/, sleep/), `protocol/src/`, `grid/test/ananke/`
**Files scanned:** 14 source files read in full or partial
**Pattern extraction date:** 2026-05-15
