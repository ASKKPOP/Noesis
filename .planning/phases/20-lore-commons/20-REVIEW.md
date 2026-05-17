---
phase: 20-lore-commons
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - brain/src/noesis_brain/lore/__init__.py
  - brain/src/noesis_brain/lore/store.py
  - brain/src/noesis_brain/lore/types.py
  - brain/src/noesis_brain/prompts/system.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/rpc/types.py
  - brain/test/ananke/test_loader.py
  - brain/test/lore/__init__.py
  - brain/test/lore/test_lore_store.py
  - grid/src/api/routes/lore.ts
  - grid/src/api/server.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/db/schema.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/lore/LoreCitationListener.ts
  - grid/src/lore/LoreCommonsListener.ts
  - grid/src/lore/LoreQuotaTracker.ts
  - grid/src/lore/LoreStorage.ts
  - grid/src/lore/appendLoreCited.ts
  - grid/src/lore/appendLoreContributed.ts
  - grid/src/lore/index.ts
  - grid/src/lore/types.ts
  - grid/test/audit/allowlist-twenty-six.test.ts
  - grid/test/audit/allowlist-twenty-two.test.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/audit/operator-exported-allowlist.test.ts
  - grid/test/audit/skill-allowlist.test.ts
  - grid/test/lore/appendLoreCited.test.ts
  - grid/test/lore/appendLoreContributed.test.ts
  - grid/test/lore/lore-allowlist-baseline.test.ts
  - grid/test/lore/lore-allowlist.test.ts
  - grid/test/lore/lore-citation-listener.test.ts
  - grid/test/lore/lore-migration.test.ts
  - grid/test/lore/lore-producer-boundary.test.ts
  - grid/test/lore/lore-quota.test.ts
  - grid/test/relationships/allowlist-frozen.test.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

Phase 20 introduces the Lore Commons feature: a Brain-local SQLite FTS5 store (`LoreStore`) for peer-contributed lore entries, a Grid-side MySQL hash index (`lore_commons`), quota enforcement (`LoreQuotaTracker`), REST discovery endpoint, two sole-producer audit emitters (`appendLoreContributed`, `appendLoreCited`), and pure-observer listeners. The privacy boundary discipline — lore body text is Brain-private, only `content_hash` crosses the wire — is consistently applied across both sides.

Two critical bugs were found, both in `brain/src/noesis_brain/rpc/handler.py`. The most severe is mass method duplication: five class methods (`hash_state`, `query_memory`, `force_telos`, `_build_refined_telos`, `_dialogue_driven_goal_set`) are each defined twice in `BrainHandler`. Python silently drops the first definition, making the first copy of each method dead code. The second critical bug is a `received_tick=0` hardcode when storing inbound lore responses, breaking FIFO eviction order. Three warnings and two info items round out the findings.

---

## Critical Issues

### CR-01: Five `BrainHandler` methods defined twice — first definition silently overwritten

**File:** `brain/src/noesis_brain/rpc/handler.py:1012-1507`

**Issue:** The following five methods each appear twice in `BrainHandler`:
- `hash_state` (lines 1012 and 1035)
- `query_memory` (lines 1076 and 1297)
- `force_telos` (lines 1127 and 1348)
- `_build_refined_telos` (lines 1176 and 1397)
- `_dialogue_driven_goal_set` (lines 1236 and 1457)

In Python, the second `def` statement for a name in a class body silently overwrites the first. The first copy of each of these methods is dead code and has no effect. The two copies are textually identical, so there is no behavioral regression right now, but the duplicated block (lines ~1027–1508) exists and any future edit to one copy will diverge silently from the other. This appears to be an artifact of a copy-paste during the Phase 20 additions.

**Fix:** Delete the duplicate block. Lines 1028–1507 are the redundant second definitions and should be removed entirely. The file should end after line 1027 (`return compute_pre_deletion_state_hash(self)`).

```python
# handler.py should contain each of these exactly ONCE:
async def hash_state(self, params: dict[str, Any]) -> dict[str, str]: ...
async def query_memory(self, params: dict[str, Any]) -> dict[str, Any]: ...
async def force_telos(self, params: dict[str, Any]) -> dict[str, Any]: ...
def _build_refined_telos(self, ctx: dict[str, Any]) -> Action | None: ...
def _dialogue_driven_goal_set(self, ctx: dict[str, Any]) -> dict[str, list[str]] | None: ...
```

---

### CR-02: Inbound lore entries stored with `received_tick=0` — FIFO eviction broken

**File:** `brain/src/noesis_brain/rpc/handler.py:222-224`

**Issue:** When a `__lore_response:` whisper is received and decoded, the `LoreEntry` is constructed with a hardcoded `received_tick=0`:

```python
entry = _LoreEntry(
    content_hash=recv_hash,
    contributor_did=sender_did,
    category_tag="observation",  # also see WR-01
    received_tick=0,             # BUG: always 0
)
```

`LoreStore._evict_if_over_capacity()` orders eviction by `received_tick ASC`, so every entry received through this path has the same tick (0). When the store fills, eviction becomes arbitrary among all received-via-response entries. Entries received later will be evicted as readily as the oldest ones, defeating the D-20-09 FIFO guarantee. Entries that arrived via the poll path do not store a tick either (the tick is not passed into `on_message`), but at minimum the tick from `params.get("tick", 0)` in `on_tick` context should be threaded through. The `on_message` handler does not have a `tick` parameter at all — `received_tick` should be set from a monotonic counter, a message parameter, or the world tick injected from the Grid.

**Fix:** Thread the current tick into the lore response handler. The quickest correct fix is to accept an optional `tick` in the whisper dispatch path and propagate it:

```python
# In the __lore_response: branch, use params.get("tick", 0) if available,
# or add a tick parameter to on_message():
entry = _LoreEntry(
    content_hash=recv_hash,
    contributor_did=sender_did,
    category_tag="observation",
    title=title.strip(),
    content=body.strip(),
    received_tick=params.get("tick", 0),  # use actual tick
)
```

---

## Warnings

### WR-01: Inbound lore entries force `category_tag="observation"` — contributor category lost

**File:** `brain/src/noesis_brain/rpc/handler.py:220`

**Issue:** The `__lore_response:` wire format is `{title}\n{body}`. When a peer serves content, the category tag is not included in the wire content. The Brain hardcodes `category_tag="observation"` for all received entries regardless of the category the contributor originally declared. If a peer contributed a `"historical"` or `"synthesis"` entry, the receiving Brain stores it as `"observation"`, making the stored metadata inconsistent with the Grid index.

The wire format was defined to be `"{title}\n{body}"` (handler.py line 238), which means category is knowingly omitted. This is either an intentional simplification (acceptable if documented) or a gap. There is no comment acknowledging this lossy behaviour; the D-20-07 reference only says "serve content to requesting peers" without specifying category preservation.

**Fix:** Either extend the wire format to include category (e.g., `"{category}\n{title}\n{body}"`), or add an explicit comment acknowledging the intentional lossy default and its consequences for FTS5 retrieval accuracy:

```python
# Wire format intentionally excludes category_tag (D-20-07 minimal spec).
# All received entries are stored as "observation"; this is acceptable because
# FTS5 retrieval ranks by content relevance, not category, and category is a
# UI-facing filter only.
category_tag="observation",
```

---

### WR-02: `json.JSONDecodeError` referenced without importing `json` at module level

**File:** `brain/src/noesis_brain/rpc/handler.py:390`

**Issue:** Line 390 catches `json.JSONDecodeError`:

```python
except (json.JSONDecodeError, ValueError):
```

The bare name `json` is not imported at the module level in this file. The only json import is a local alias `import json as _json` at lines 165 and 386 (inside function bodies). The bare `json` reference on line 390 would raise a `NameError` at runtime whenever the `except` branch is evaluated, because `json` is not bound in the enclosing scope.

This is partially masked because the `_json.loads(raw_json)` call on line 388 uses the local alias `_json`, but the `except` clause references the unaliased `json` module name. The except clause exists to catch malformed JSON — the path that matters for robustness — and it would fail with a `NameError` when triggered.

**Fix:**

```python
# Line 386-390 — use the local alias consistently:
import json as _json
try:
    payload_data = _json.loads(result.payload_json)
    source_event_hash = payload_data.get("source_event_hash", result.skill_hash)
except (_json.JSONDecodeError, ValueError):  # was: json.JSONDecodeError
    source_event_hash = result.skill_hash
```

---

### WR-03: `LoreStore._evict_if_over_capacity` called after commit, not inside the same transaction

**File:** `brain/src/noesis_brain/lore/store.py:74-97`

**Issue:** `add()` commits the INSERT on line 83, then calls `_evict_if_over_capacity()` on line 84. The eviction DELETE runs in a separate implicit transaction. If the process crashes between commit and eviction, the store will be over capacity until the next successful `add()` runs cleanup. More importantly, the FTS5 delete trigger fires for the evicted row — but only if that second DELETE commits. If it fails mid-way, FTS5 and the base table can diverge.

This is low-risk in practice (SQLite in-process crash is rare and the cap is a soft guard), but the sequence is not atomic. An over-capacity store that persists across restarts would not be caught until the next write.

**Fix:** Wrap both the INSERT and the eviction DELETE in a single `with self._conn:` transaction block, or run the eviction check within the same transaction before committing:

```python
def add(self, entry: LoreEntry) -> None:
    with self._conn:
        self._conn.execute(
            """INSERT OR REPLACE INTO lore_entries ...""",
            (...),
        )
        # Evict within same transaction — atomicity preserved.
        count = self._conn.execute("SELECT COUNT(*) FROM lore_entries").fetchone()[0]
        if count > self._capacity:
            excess = count - self._capacity
            self._conn.execute("""DELETE FROM lore_entries WHERE content_hash IN (
                SELECT content_hash FROM lore_entries ORDER BY received_tick ASC LIMIT ?
            )""", (excess,))
    # No separate commit() needed — `with conn:` handles it.
```

---

## Info

### IN-01: `_grid_base_url` attribute read via `getattr` but never set — lore polling silently no-ops

**File:** `brain/src/noesis_brain/rpc/handler.py:640`

**Issue:** The lore discovery poll uses:

```python
base_url: str = getattr(self, "_grid_base_url", ""),
```

`BrainHandler.__init__` never sets `self._grid_base_url`. The `getattr` default is an empty string, and the poll closure returns immediately if `base_url` is falsy (line 645: `if not base_url: return`). This means the HTTP-polling lore discovery path (`GET /api/v1/grid/lore`) is always a no-op in the current implementation — the Brain never actually discovers new lore hashes from the Grid.

This appears intentional (the poll path is best-effort), but `_grid_base_url` is a configuration point that is never wired. If it is meant to be supplied at construction time, it should be a documented `__init__` parameter. If lore discovery via HTTP is not yet implemented, the dead poll loop should be removed or replaced with a comment.

**Fix:** Either add `grid_base_url: str = ""` to `BrainHandler.__init__` and store it as `self._grid_base_url`, or remove the HTTP poll scaffold and leave a TODO comment referencing the design decision (D-20-11).

---

### IN-02: `lore-producer-boundary.test.ts` regex may miss audit calls with multiline formatting

**File:** `grid/test/lore/lore-producer-boundary.test.ts:62-65`

**Issue:** The grep pattern used to detect unauthorized `audit.append` calls is:

```javascript
const pattern = new RegExp(
    `\\b(?:audit|chain|this\\.audit|this\\.chain)\\.append[^;]{0,200}['"\`]${escapedEvent}['"\`]`,
    's'
);
```

The `[^;]{0,200}` quantifier stops at semicolons and is limited to 200 characters between `.append` and the event string. A call written across more than 200 characters or with a `;` in an intermediate argument (e.g., a template literal containing a semicolon) would not be detected. This is a weak negative assertion — it could give a false clean signal. The same pattern was presumably inherited from earlier phase boundary tests and carries the same limitation forward.

This is low-severity because the producer boundary tests for prior phases use the same pattern and have not caused an issue, but the limitation is worth noting for future phases that add more complex emitter calls.

**Fix:** Consider replacing the character-count-bounded regex with an AST-based check, or add a stricter grep for the event string literal alone (as the first check in the same test already does), relying on the two-gate combination for confidence.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
