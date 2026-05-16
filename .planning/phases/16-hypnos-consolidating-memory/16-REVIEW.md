---
phase: 16-hypnos-consolidating-memory
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - brain/src/noesis_brain/hypnos/__init__.py
  - brain/src/noesis_brain/hypnos/config.py
  - brain/src/noesis_brain/hypnos/consolidator.py
  - brain/src/noesis_brain/hypnos/ltm_store.py
  - brain/src/noesis_brain/hypnos/runtime.py
  - brain/src/noesis_brain/hypnos/types.py
  - brain/src/noesis_brain/hypnos/working_memory.py
  - brain/src/noesis_brain/prompts/system.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/rpc/types.py
  - brain/test/hypnos/test_ltm_determinism.py
  - brain/test/hypnos/test_ltm_retrieval_perf.py
  - brain/test/hypnos/test_shy_boundedness.py
  - brain/test/hypnos/test_sleep_trigger.py
  - brain/test/hypnos/test_working_memory.py
  - brain/test/hypnos/test_zero_diff.py
  - brain/test/test_hypnos_no_walltime.py
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/sleep/appendNousSleepCompleted.ts
  - grid/src/sleep/appendNousSleepEntered.ts
  - grid/src/sleep/index.ts
  - grid/src/sleep/types.ts
  - grid/test/audit/allowlist-twenty-six.test.ts
  - grid/test/audit/allowlist-twenty-two.test.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/audit/operator-exported-allowlist.test.ts
  - grid/test/relationships/allowlist-frozen.test.ts
  - grid/test/sleep/sleep-privacy.test.ts
  - grid/test/sleep/sleep-producer-boundary.test.ts
  - protocol/src/noesis/bridge/types.ts
  - scripts/check-relationship-graph-deps.mjs
  - scripts/check-wallclock-forbidden.mjs
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 16 introduces the Hypnos sleep-consolidation module: a Hebbian learning + SHY downscale LTM graph in SQLite, working memory ring buffer, async sleep cycle wired into `on_tick`, and two new Grid-side audit events (`nous.sleep.entered`, `nous.sleep.completed`). The privacy and sovereignty invariants are well-enforced throughout — LTM content never crosses the Brain↔Grid wire, the allowlist is properly extended, and the sole-producer emitter pattern is correctly applied to both sleep events.

One critical structural defect was found: five methods in `BrainHandler` are defined twice in the same class body. In Python, the second definition silently shadows the first — the duplicate block spanning lines 1061–1271 is dead code that also makes the file extremely hard to reason about. Three warnings cover a race condition in the async sleep completion signal, dead variables in the consolidator, and a stale API tick in the `on_message` LTM retrieval path. Four info items address duplicate declarations in protocol types, a misleading test name, a stale comment in the CI script, and a stale comment in an allowlist test.

---

## Critical Issues

### CR-01: Five `BrainHandler` methods defined twice — second definitions are dead code

**File:** `brain/src/noesis_brain/rpc/handler.py:776,799,840,1061,1112,1161,1221`

**Issue:** The following methods appear twice in `BrainHandler`, with byte-identical implementations. Python silently discards the first definition; the second definition at lines 1061–1271 is the one that executes at runtime, but it is indistinguishable from the first, so the duplication is purely accidental:

- `hash_state` — lines 776 and 799
- `query_memory` — lines 840 and 1061
- `force_telos` — lines 891 and 1112
- `_build_refined_telos` — lines 940 and 1161
- `_dialogue_driven_goal_set` — lines 1000 and 1221

Both blocks are preceded by identical section-header comments (`# Phase 6 AGENCY-02 — operator-agency handlers`), confirming this is a paste/merge error rather than intentional override. Because both implementations are identical there is no current behavioral difference, but the duplication:
1. Makes the class ~340 lines longer than it needs to be.
2. Creates a silent trap: any future edit to one copy will not affect the other, causing divergence bugs that are very hard to diagnose.
3. Triggers false confidence — a reader searching for `query_memory` finds it at line 840 and assumes they have seen the full implementation.

**Fix:** Delete lines 1054–1271 (the second header comment block through the end of the second `_dialogue_driven_goal_set`). The block to remove begins with the duplicate comment:

```python
    # ────────────────────────────────────────────────────────────────────
    # Phase 6 AGENCY-02 — operator-agency handlers (H2 Reviewer, H4 Driver)
    # ...
    # ────────────────────────────────────────────────────────────────────

    async def query_memory(self, params: dict[str, Any]) -> dict[str, Any]:
```

at line 1054 and ends at line 1271 (the closing of the second `_dialogue_driven_goal_set`).

---

## Warnings

### WR-01: Race condition — `_pending_sleep_completed` can be overwritten before drain

**File:** `brain/src/noesis_brain/rpc/handler.py:325-334`

**Issue:** `_pending_sleep_completed` is a single `str | None` slot. The sleep task is spawned via `asyncio.create_task` and writes its result hash into this slot asynchronously. If the async executor runs slowly and the next sleep cycle fires before the first task completes (which is possible if the event loop is busy with LLM calls), the second task will overwrite `_pending_sleep_completed` with the newer hash before the first value is ever drained. The first `SLEEP_COMPLETED` event is then silently lost — the Grid never receives it, creating a gap in the audit chain.

Concretely: sleep fires at tick 30 → task₃₀ starts. LLM call takes 100ms. Tick 60 arrives (SLEEP_MIN_INTERVAL=30). task₃₀ still running. `_last_sleep_tick` updates to 60. task₃₀ completes: `_pending_sleep_completed = hash₃₀`. tick 60 task completes immediately: `_pending_sleep_completed = hash₆₀`. tick 61 drains `hash₆₀` — `hash₃₀` is permanently lost.

**Fix:** Use a `collections.deque` (or `asyncio.Queue`) to accumulate pending hashes rather than a scalar:

```python
# In __init__:
self._pending_sleep_hashes: collections.deque[str] = collections.deque()

# In the async _run() closure:
self._pending_sleep_hashes.append(result_hash)

# In on_tick drain block:
while self._pending_sleep_hashes:
    h = self._pending_sleep_hashes.popleft()
    actions.append(
        Action(
            action_type=ActionType.SLEEP_COMPLETED,
            metadata={"ltm_snapshot_hash": h},
        ).to_dict()
    )
```

### WR-02: Dead variables `sh` and `dh` in `hebbian_pass`

**File:** `brain/src/noesis_brain/hypnos/consolidator.py:36-40`

**Issue:** In `hebbian_pass`, the tuple assignment on lines 36 and 38 unpacks four values — `src, dst, sh, dh` — where `sh` and `dh` are the canonical source and destination content hashes. After assignment, `store.upsert_node` is called on lines 39–40 using `hash_i` and `hash_j` directly, bypassing `sh`/`dh` entirely. `sh` and `dh` are never read after their assignment. This is dead code that obscures the intent: the canonical reordering of hashes was presumably planned but never wired in.

```python
# Current (lines 35-40):
if node_i < node_j:
    src, dst, sh, dh = node_i, node_j, hash_i, hash_j
else:
    src, dst, sh, dh = node_j, node_i, hash_j, hash_i
store.upsert_node(node_i, hash_i, tick)  # uses hash_i/hash_j, not sh/dh
store.upsert_node(node_j, hash_j, tick)
```

**Fix:** Either use `sh`/`dh` in `upsert_node` (if the intent was to pass the canonically reordered hashes), or remove them from the tuple:

```python
# Option A — remove dead variables:
if node_i < node_j:
    src, dst = node_i, node_j
else:
    src, dst = node_j, node_i
store.upsert_node(node_i, hash_i, tick)
store.upsert_node(node_j, hash_j, tick)
store.strengthen_edge(src, dst, delta=eta, tick=tick)

# Option B — use canonical hashes (if that was the intent):
if node_i < node_j:
    src, dst, src_hash, dst_hash = node_i, node_j, hash_i, hash_j
else:
    src, dst, src_hash, dst_hash = node_j, node_i, hash_j, hash_i
store.upsert_node(src, src_hash, tick)
store.upsert_node(dst, dst_hash, tick)
store.strengthen_edge(src, dst, delta=eta, tick=tick)
```

Note: currently `upsert_node` is called with `(node_i, hash_i)` and `(node_j, hash_j)` regardless of canonical ordering — this is correct because `upsert_node` is idempotent (first-seen wins) and node ordering only matters for the edge's `src`/`dst`. But the dead variable assignment is still confusing.

### WR-03: `retrieve_top_k(current_tick=0)` in `on_message` yields stale recency scores

**File:** `brain/src/noesis_brain/rpc/handler.py:164`

**Issue:** `on_message` calls `self._hypnos_runtime.retrieve_top_k(current_tick=0)`. The `retrieve_top_k` method computes `recency_factor = exp(-delta / tau)` where `delta = current_tick - first_seen_tick`. When `current_tick=0` and nodes were written at tick 30 or later, `delta` is negative, and the code falls back to `recency = 1.0` for all of them. This means recency discrimination is completely disabled in `on_message` — all LTM nodes rank purely by edge weight, ignoring age. For a Nous that has accumulated thousands of ticks of memory, this could surface stale concepts over recent ones.

The `on_message` RPC params do not carry a tick, so the real tick is not directly available. However, `_last_sleep_tick` is always set to the most recent tick at which sleep ran — it could serve as a reasonable proxy for `current_tick`.

**Fix:**

```python
# Use _last_sleep_tick as the best available tick proxy in on_message
ltm_memories = self._hypnos_runtime.retrieve_top_k(
    current_tick=self._last_sleep_tick
)
```

This is not perfect (stale by up to SLEEP_MIN_INTERVAL ticks) but avoids the constant-zero problem that zeroes out recency for all nodes.

### WR-04: `test_working_memory_overflow_evicts_oldest` tests the wrong behavior

**File:** `brain/test/hypnos/test_working_memory.py:25-40`

**Issue:** The test name and class docstring claim "Overflow evicts oldest (FIFO via deque)", but `set_episodes` silently prevents overflow by slicing the input list to `memories[:self.CAP]` before ever appending to the deque. The deque's `maxlen` overflow eviction is never triggered — the test passes (ep0..ep6 retained) for the wrong reason: input truncation, not FIFO overflow eviction.

This is a behavioral spec gap: if a caller were to build working memory via repeated individual appends rather than `set_episodes`, the deque's FIFO eviction would indeed drop the oldest item (ep0) and keep ep1..ep7. But the current `set_episodes` API makes this impossible from the outside. The discrepancy between the docstring/test name and actual behavior could mislead future developers.

**Fix:** Either update the test name and docstring to reflect the actual behavior (input truncation via slice):

```python
def test_working_memory_truncates_to_cap():
    """set_episodes with 8 inputs keeps only the first 7 (slice, not FIFO eviction)."""
```

Or, if FIFO eviction is the intended contract, change `set_episodes` to not pre-slice and let the deque handle overflow:

```python
def set_episodes(self, memories: list) -> None:
    self._buf.clear()
    for m in memories:  # let deque(maxlen=7) handle FIFO eviction
        content = getattr(m, "content", "") or ""
        mtype = str(getattr(m, "memory_type", "observation"))
        self._buf.append(Episode(content=content, memory_type=mtype))
```

---

## Info

### IN-01: `MemoryEntry` interface declared twice in `protocol/src/noesis/bridge/types.ts`

**File:** `protocol/src/noesis/bridge/types.ts:83-109`

**Issue:** The `MemoryEntry` interface is declared twice with identical content at lines 83–90 and 102–109. TypeScript merges duplicate interface declarations (declaration merging), so this has no runtime effect, but it is dead code that increases confusion for readers and will cause a lint/strict-mode warning in most TypeScript toolchains.

**Fix:** Remove the second occurrence (lines 102–109).

### IN-02: `allowlist-frozen.test.ts` header comment says size 26 but test body asserts 36

**File:** `grid/test/relationships/allowlist-frozen.test.ts:14`

**Issue:** The file-level JSDoc comment at line 14 states `1. Size === 26 (Phase 12 baseline: +4 governance events)`, but the actual test assertion at line 43 correctly checks `ALLOWLIST.size).toBe(36)`. The comment is a stale Phase 12 artifact that was not updated when Phase 15/16/17 extended the allowlist.

**Fix:** Update the file header comment to reflect the current baseline:

```typescript
// 1. Size === 36 (Phase 17 baseline: Phase 12 +4 governance, Phase 13 +1,
//    Phase 15 +3, Phase 16 +2, Phase 17 +4)
```

### IN-03: `check-relationship-graph-deps.mjs` comment history omits Phase 17 extension

**File:** `scripts/check-relationship-graph-deps.mjs:50`

**Issue:** The baseline history comment on line 50 documents phases up to 16 (`Phase 16 post-ship = 379`), but the script's baseline value correctly reflects the Phase 17 additions as well. The comment history is incomplete — a future maintainer amending the baseline for Phase 18+ will have an inaccurate change log.

**Fix:** Append Phase 17 to the history comment:

```javascript
//          Phase 17 post-ship = 379 (iris.* events added to ALLOWLIST_MEMBERS and
//          FORBIDDEN_KEY_PATTERN; iris comment block and IRIS_FORBIDDEN_KEYS export
//          approved in 17-CONTEXT.md D-17-17).
```

### IN-04: `check-wallclock-forbidden.mjs` final log message references only Bios/Chronos/retrieval

**File:** `scripts/check-wallclock-forbidden.mjs:236`

**Issue:** The final success message reads `No wall-clock reads in Bios/Chronos/retrieval paths (D-10b-09 OK)`, but Phase 16 extended Tier A scanning to include `brain/src/noesis_brain/hypnos/` (added at line 54). The log message does not reflect this addition, which could cause confusion when the script flags a `hypnos/` violation — the output name would not match what the operator expects to see covered.

**Fix:**

```javascript
console.log('✅ No wall-clock reads in Bios/Chronos/Hypnos/retrieval paths (D-10b-09, T-16-03 OK)');
```

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
