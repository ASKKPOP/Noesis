---
phase: 20-lore-commons
plan: "02"
subsystem: lore
tags: [mysql-migration, lore-storage, sqlite-fts5, brain-lore, action-type, wave-1]
dependency_graph:
  requires:
    - 20-01 (LORE_FORBIDDEN_KEYS, lore types contract, RED test stubs)
  provides:
    - MySQL migration version 8 (create_lore_commons) in grid/src/db/schema.ts
    - LoreStorage MySQL wrapper (grid/src/lore/LoreStorage.ts)
    - LoreEntry dataclass and LORE_CATEGORIES frozenset (brain/src/noesis_brain/lore/types.py)
    - LoreStore with FTS5 retrieval and FIFO eviction (brain/src/noesis_brain/lore/store.py)
    - Brain lore module package (brain/src/noesis_brain/lore/__init__.py)
    - ActionType with 5 LORE_* entries (brain/src/noesis_brain/rpc/types.py)
    - Brain lore test suite green (brain/test/lore/test_lore_store.py)
    - lore-migration.test.ts GREEN (was RED in Plan 01)
  affects:
    - Plans 03-04 — data layer foundation for NousRunner dispatch and REST endpoint
tech_stack:
  added: []
  patterns:
    - MySQL INSERT IGNORE + citation_count denormalized cache (mirrors NormStorage pool pattern)
    - SQLite FTS5 content table with AFTER INSERT/UPDATE/DELETE sync triggers (mirrors sqlite_store.py skills_fts pattern)
    - Shared MemoryStore connection pattern (LoreStore uses conn passed in, no new connection)
    - FIFO eviction at capacity via received_tick ORDER BY ASC LIMIT excess
key_files:
  modified:
    - grid/src/db/schema.ts
    - brain/src/noesis_brain/rpc/types.py
  created:
    - grid/src/lore/LoreStorage.ts
    - brain/src/noesis_brain/lore/__init__.py
    - brain/src/noesis_brain/lore/types.py
    - brain/src/noesis_brain/lore/store.py
    - brain/test/lore/__init__.py
    - brain/test/lore/test_lore_store.py
decisions:
  - "FTS5 AFTER INSERT/UPDATE/DELETE triggers added to _ensure_tables — required for content= virtual table auto-sync (mirrors sqlite_store.py skills_fts pattern exactly)"
  - "LoreStore uses INSERT OR REPLACE for idempotency — eviction runs after every add()"
  - "LoreStorage.incrementCitationCount swallows errors — citation_count is denormalized cache, audit chain is truth"
  - "LoreStorage.queryEntries propagates errors — REST endpoint caller handles them"
  - "title_hash stored in MySQL lore_commons table but NOT in audit payload (Pitfall 6 / T-20-06 mitigation)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_created: 6
---

# Phase 20 Plan 02: Wave 1 Data Layer Summary

**One-liner:** MySQL migration v8 (lore_commons 7-column table) + LoreStorage MySQL wrapper + Brain LoreStore with FTS5/FIFO + ActionType LORE_* entries — full data layer foundation for Plans 03-04.

## What Was Built

### Task 1 — MySQL migration v8 and LoreStorage wrapper

**`grid/src/db/schema.ts`** — Migration version 8 (`create_lore_commons`) appended to MIGRATIONS array:

- 7-column table: `grid_name`, `content_hash` (CHAR 64), `contributor_did`, `title_hash` (CHAR 64), `category_tag`, `citation_count` (INT UNSIGNED DEFAULT 0), `contributed_tick`
- PRIMARY KEY on `(grid_name, content_hash)`
- 3 indexes: `idx_category`, `idx_contributor`, `idx_tick`
- `down` SQL: `DROP TABLE IF EXISTS lore_commons`

**`grid/src/lore/LoreStorage.ts`** — New MySQL wrapper (mirrors NormStorage pool pattern):

- `upsertContribution()` — INSERT IGNORE, swallows errors with console.warn
- `incrementCitationCount()` — UPDATE citation_count + 1, swallows errors (denormalized cache)
- `queryEntries()` — category-optional filter, limit clamped 1-100, propagates errors

`lore-migration.test.ts` turns GREEN: 8/8 tests pass.

### Task 2 — Brain LoreStore, LoreEntry types, and ActionType additions

**`brain/src/noesis_brain/lore/types.py`** — New file:
- `LoreEntry` dataclass with 6 fields: `content_hash`, `contributor_did`, `category_tag`, `title`, `content`, `received_tick`
- `from_row()` classmethod supporting sqlite3.Row (key-based) and tuple (index-based)
- `to_prompt_block()` formats as `[category_tag] **title**: content`
- `LORE_CATEGORIES` frozenset with 4 values: `cultural`, `historical`, `observation`, `synthesis`

**`brain/src/noesis_brain/lore/store.py`** — New LoreStore:
- Accepts shared `sqlite3.Connection` (Pitfall 7 avoided — no new connection)
- `_ensure_tables()` creates `lore_entries` table + `lore_entries_fts` FTS5 virtual table + 3 sync triggers (ai/au/ad — mirrors sqlite_store.py skills_fts pattern)
- `add()` uses INSERT OR REPLACE; evicts oldest by `received_tick` if over capacity
- `has()`, `count()`, `retrieve_by_hash()` — direct table lookups
- `retrieve()` — FTS5 BM25 over title+content, empty query guard, safe_query sanitization, over-fetches k*4 then slices

**`brain/src/noesis_brain/lore/__init__.py`** — Barrel export: `LoreEntry`, `LORE_CATEGORIES`, `LoreStore`

**`brain/src/noesis_brain/rpc/types.py`** — ActionType extended with 5 LORE_* entries after `SKILL_REJECTED`:
- `LORE_CONTRIBUTE = "lore_contribute"` — Grid-forwarded; 2-key Brain metadata
- `LORE_CITED = "lore_cited"` — Grid-forwarded; 1-key Brain metadata
- `LORE_DISCOVER = "lore_discover"` — Brain-internal only
- `LORE_REQUEST = "lore_request"` — Brain-internal only
- `LORE_RESPONSE = "lore_response"` — Brain-internal only

**`brain/test/lore/test_lore_store.py`** — 10 unit tests: add/has/count/idempotent/eviction/empty-query/FTS5/retrieve-miss/retrieve_by_hash-present/retrieve_by_hash-absent/LORE_CATEGORIES — all GREEN.

## Verification Results

```
grid lore-migration.test.ts: 8/8 passing (GREEN — was RED in Plan 01)
brain test/lore/: 10/10 passing
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FTS5 content table requires sync triggers**
- **Found during:** Task 2 — test_retrieve_fts5 failed with empty results
- **Issue:** FTS5 virtual table with `content='lore_entries'` does NOT auto-index on INSERT into the base table. Without AFTER INSERT/UPDATE/DELETE triggers, the FTS index stays empty and all MATCH queries return zero rows.
- **Fix:** Added three triggers (`lore_entries_fts_ai`, `lore_entries_fts_au`, `lore_entries_fts_ad`) to `_ensure_tables()` executescript, exactly mirroring the `skills_fts` trigger pattern in `sqlite_store.py` (lines 101-119).
- **Files modified:** `brain/src/noesis_brain/lore/store.py`
- **Commit:** b4b2e64

## Threat Surface Scan

No new network endpoints or auth paths introduced. Two threat mitigations from the plan's threat register are now in place:

| Threat | Mitigation Status |
|--------|------------------|
| T-20-05 DoS via LoreStore capacity | MITIGATED — FIFO eviction at capacity=50 tested in test_eviction_fifo |
| T-20-06 Pitfall 6 title_hash vs content_hash | MITIGATED — title_hash stored in MySQL lore_commons but NOT in audit payload; lore-migration.test.ts confirms title_hash CHAR(64) column presence |

T-20-04 (sha256 verification before add()) deferred to Plan 03 as specified — BrainHandler.on_message() is Plan 03 scope.

## Self-Check: PASSED

Files exist:
- grid/src/db/schema.ts: MODIFIED (version: 8 present)
- grid/src/lore/LoreStorage.ts: CREATED
- brain/src/noesis_brain/lore/__init__.py: CREATED
- brain/src/noesis_brain/lore/types.py: CREATED
- brain/src/noesis_brain/lore/store.py: CREATED
- brain/test/lore/__init__.py: CREATED
- brain/test/lore/test_lore_store.py: CREATED
- brain/src/noesis_brain/rpc/types.py: MODIFIED (LORE_CONTRIBUTE present)

Commits exist:
- 0ec592b: feat(20-02): add MySQL migration v8 create_lore_commons and LoreStorage wrapper
- b4b2e64: feat(20-02): Brain lore module (LoreStore, LoreEntry, LORE_CATEGORIES) and ActionType LORE_* entries
