---
phase: 20-lore-commons
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/prompts/system.py
  - brain/src/noesis_brain/lore/store.py
  - brain/src/noesis_brain/lore/types.py
  - brain/test/lore/test_lore_prompt_injection.py
  - brain/test/lore/test_lore_store.py
  - grid/src/genesis/launcher.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/lore/LoreQuotaTracker.ts
  - grid/test/lore/lore-wiring.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The Phase 20 lore commons implementation is well-structured overall. The `LoreStore` (FTS5 retrieval, FIFO eviction, capacity cap), `LoreQuotaTracker` (K=3 per epoch), `NousRunner` dispatch for `lore_contribute`/`lore_cited`, and the system-prompt injection path are all implemented correctly in isolation. The lore types, prompt builder, and unit tests are clean.

One critical bug was found: `handler.py` references the bare name `json` in an except clause inside a scope that only imported `json as _json`, which will raise a `NameError` when malformed JSON arrives in the quarantine sweep path. Four warnings surface additional correctness gaps: five methods are duplicated in `BrainHandler` (Python silently uses the second definition, making the first copy dead code); inbound lore response entries are stored with a hardcoded `received_tick=0` breaking FIFO eviction ordering; `_grid_base_url` is never set making the HTTP discovery poll permanently inoperative; and the LoreStore insert/evict split across two commits breaks atomicity.

---

## Critical Issues

### CR-01: `NameError` — bare `json` referenced after `import json as _json`

**File:** `brain/src/noesis_brain/rpc/handler.py:392`

**Issue:** Inside the quarantine sweep block, line 389 does `import json as _json`, but line 392 catches `json.JSONDecodeError` using the bare unaliased module name. The bare name `json` is not imported at module level in this file, so `json` is not in scope when the `except` clause is evaluated. Any time a quarantine sweep result has `source == "observed"` and `payload_json` contains malformed JSON, Python raises `NameError: name 'json' is not defined` rather than handling the decode error — crashing the entire `on_tick()` call for that Nous.

```python
# Current — broken (lines 386-393):
import json as _json
try:
    payload_data = _json.loads(result.payload_json)
    source_event_hash = payload_data.get("source_event_hash", result.skill_hash)
except (json.JSONDecodeError, ValueError):  # NameError: 'json' not defined
    source_event_hash = result.skill_hash
```

**Fix:** Use the local alias consistently:

```python
except (_json.JSONDecodeError, ValueError):
    source_event_hash = result.skill_hash
```

---

## Warnings

### WR-01: Five `BrainHandler` methods defined twice — first definition silently overwritten

**File:** `brain/src/noesis_brain/rpc/handler.py:1017-1512`

**Issue:** The following methods each appear twice inside `BrainHandler`:
- `hash_state` (approximately lines 1017 and 1040)
- `query_memory` (approximately lines 1081 and 1302)
- `force_telos` (approximately lines 1132 and 1353)
- `_build_refined_telos` (approximately lines 1181 and 1402)
- `_dialogue_driven_goal_set` (approximately lines 1241 and 1462)

Python silently overwrites the first definition with the second. The first copy of each method is dead code with no effect. The section header comment blocks ("Phase 8 AGENCY-05", "Phase 6 AGENCY-02", "Phase 7 DIALOG-02") are also duplicated. Both copies are currently textually identical so there is no behavioral regression, but any future edit to one copy will diverge silently from the other. This appears to be a copy-paste artifact from Phase 20 additions.

**Fix:** Delete the entire duplicate block (the second occurrence of each method, which starts at approximately line 1293 with the second "Phase 6 AGENCY-02" banner comment). The file should contain each of these five methods exactly once.

---

### WR-02: Inbound `__lore_response:` entries stored with `received_tick=0` — FIFO eviction broken

**File:** `brain/src/noesis_brain/rpc/handler.py:224`

**Issue:** When a `__lore_response:` message is received and decoded, the `LoreEntry` is constructed with a hardcoded `received_tick=0` regardless of when the message actually arrives:

```python
entry = _LoreEntry(
    content_hash=recv_hash,
    contributor_did=sender_did,
    category_tag="observation",
    title=title.strip(),
    content=body.strip(),
    received_tick=0,   # BUG: always 0
)
```

`LoreStore._evict_if_over_capacity()` orders eviction by `received_tick ASC`. Every entry received via `__lore_response:` has `received_tick=0`, so when the store fills, the eviction sweep treats all received-via-response entries as equally old — entries received at tick 10,000 are evicted as readily as entries from tick 1. The D-20-09 FIFO guarantee is broken for this path.

**Fix:** Use the tick from `params` if it is present in the message payload, or thread the world tick into `on_message()`. The Grid already injects `tick` into some message paths:

```python
received_tick = int(params.get("tick", 0)),
```

If the Grid does not send a tick in `__lore_response:` messages, store the last-known tick as `self._last_known_tick` (updated in `on_tick()`) and reference it here.

---

### WR-03: `_grid_base_url` never set — lore HTTP discovery poll is permanently a no-op

**File:** `brain/src/noesis_brain/rpc/handler.py:640-647`

**Issue:** The lore discovery poll closure captures `base_url: str = getattr(self, "_grid_base_url", "")`. The attribute `_grid_base_url` is never initialized in `BrainHandler.__init__` and is never assigned anywhere in the class. The `getattr` returns `""` on every call, so the guard `if not base_url: return` on line 647 fires immediately. The HTTP `GET /api/v1/grid/lore` is never issued. The entire peer lore discovery path (D-20-05/D-20-06) is silently inoperative in all environments.

**Fix:** Add `grid_base_url` as a constructor parameter and store it:

```python
# In __init__ signature:
grid_base_url: str = "",

# In __init__ body:
self._grid_base_url: str = grid_base_url
```

If this path is intentionally deferred, remove the HTTP poll scaffold and replace it with a `# TODO(D-20-11): lore HTTP discovery not yet wired` comment.

---

### WR-04: `LoreStore.add()` — INSERT committed before eviction, breaking atomicity

**File:** `brain/src/noesis_brain/lore/store.py:74-97`

**Issue:** `add()` commits the INSERT on line 83, then calls `_evict_if_over_capacity()` on line 84. These run in two separate transactions. If the process crashes between the committed INSERT and the eviction DELETE, the store is left over capacity permanently until the next successful `add()` call. More critically, if the eviction DELETE fails mid-way, the FTS5 virtual table and the base table can diverge (the FTS5 delete trigger fires per row as part of the DELETE statement, but if the DELETE transaction aborts after partial execution the FTS5 index is corrupted relative to the base table).

**Fix:** Run both the INSERT and the eviction in a single `with self._conn:` context (which issues a single `BEGIN`/`COMMIT`):

```python
def add(self, entry: LoreEntry) -> None:
    with self._conn:
        self._conn.execute(
            """INSERT OR REPLACE INTO lore_entries
               (content_hash, contributor_did, category_tag, title, content, received_tick)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entry.content_hash, entry.contributor_did, entry.category_tag,
             entry.title, entry.content, entry.received_tick),
        )
        count = self._conn.execute("SELECT COUNT(*) FROM lore_entries").fetchone()[0]
        if count > self._capacity:
            excess = count - self._capacity
            self._conn.execute("""
                DELETE FROM lore_entries WHERE content_hash IN (
                    SELECT content_hash FROM lore_entries
                    ORDER BY received_tick ASC LIMIT ?
                )
            """, (excess,))
    # with-block commits atomically; no separate self._conn.commit() needed.
```

---

## Info

### IN-01: Lore discovery poll fires at tick 0

**File:** `brain/src/noesis_brain/rpc/handler.py:635`

**Issue:** The condition `(tick % self._lore_poll_interval) == 0` is `True` at tick 0, scheduling a discovery poll on the very first tick. This is harmless while WR-03 exists (the empty `base_url` guard returns immediately), but once `_grid_base_url` is wired, the Brain will issue an HTTP request at tick 0 before any lore entries have been contributed to the Grid.

**Fix:** Guard with `tick > 0`:

```python
if self._lore_store is not None and tick > 0 and (tick % self._lore_poll_interval) == 0:
```

---

### IN-02: `lore-wiring.test.ts` does not exercise NousRunner quota gate through action dispatch

**File:** `grid/test/lore/lore-wiring.test.ts:42-59`

**Issue:** The test `'NousRunner loreDeps wiring: quotaTracker from launcher enforces K=3 and epoch reset'` calls `loreDeps.quotaTracker.tryConsume()` directly rather than dispatching a `lore_contribute` action through `NousRunner.executeActions()`. The test confirms the tracker logic works in isolation but does not exercise the NousRunner integration path. A bug in the `case 'lore_contribute':` branch wiring (e.g., `this.loreDeps?.quotaTracker` being accidentally `undefined`, or the quota check branch being short-circuited) would not be caught by this test.

**Fix:** Add a test that constructs a `NousRunner` with a mock bridge returning a `lore_contribute` action, a mock `audit`, and `loreDeps: { quotaTracker }`. Assert that `appendLoreContributed` is called for the first three dispatches and not called on the fourth within the same epoch. This exercises the full wiring from action dispatch through quota check to audit emit.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
