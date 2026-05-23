---
phase: 27-nous-interaction
plan: "02"
subsystem: brain-http, grid-portal
tags: [brain, grid, portal, nous, skills, lore, norms, api]
dependency_graph:
  requires: []
  provides:
    - brain/src/noesis_brain/http/skills_lookup.py (handle_skills_lookup)
    - brain/src/noesis_brain/skills/store.py (SkillStore.get_by_hash)
    - brain/src/noesis_brain/http/server.py (GET /skills/{hash} route)
    - grid/src/api/portal/nous.ts (registerPortalNousRoutes)
    - grid/src/api/portal/index.ts (wired registerPortalNousRoutes)
  affects:
    - grid/src/api/portal/index.ts (new import + call)
tech_stack:
  added:
    - brain: hashlib.sha256 for on-the-fly skill hash computation
    - grid: AbortController 5s timeout for Brain proxy fetch
  patterns:
    - brain: cognitive_snapshot.py pattern replicated (auth gate, SkillStore access via handler.memory._store._conn)
    - grid: wallet.ts route registration pattern (JWT auth via keyPairPromise + COOKIE_NAME)
    - grid: cognitive-snapshot-client.ts Brain proxy pattern (closed-key validation, null fallback)
    - grid: humanPool for MySQL queries (same pool as auth.ts, lore, norm tables)
key_files:
  created:
    - brain/src/noesis_brain/http/skills_lookup.py
    - brain/test/test_skills_http.py
    - grid/src/api/portal/nous.ts
    - grid/test/portal/nous-endpoints.test.ts
  modified:
    - brain/src/noesis_brain/skills/store.py (added get_by_hash method + hashlib import)
    - brain/src/noesis_brain/http/server.py (added /skills/{hash} route registration)
    - grid/src/api/portal/index.ts (added registerPortalNousRoutes import + call)
decisions:
  - Used services.humanPool (existing field) instead of plan's services.db — GridServices has humanPool not db; same MySQL pool serves all tables
  - Used audit_trail.created_at (BIGINT tick) instead of plan's .tick — actual schema column is created_at
  - Removed reference to evidence_tick_range — not a real norm_registry column; used crystallized_tick from norm_registry and tick_start/tick_end from norm_candidates
  - Used '...' (three ASCII dots) not '…' (unicode ellipsis) for truncated hash fallback — matches plan spec hash.slice(0,16)+'...'
metrics:
  duration: ~35 minutes
  completed: "2026-05-23"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 27 Plan 02: Brain Skill Lookup + Grid Portal Nous Endpoints Summary

Brain GET /skills/{hash} endpoint and three Grid portal Nous profile endpoints (skills, lore, norms) with JWT auth, Brain proxy, and MySQL queries against audit_trail, lore_commons, and norm_candidates/norm_registry.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 (RED) | Failing Brain tests | 7152576 | Done |
| 1 (GREEN) | Brain skill-by-hash implementation | d9b27b2 | Done |
| 2 (RED) | Failing Grid portal Nous tests | 1b0052f | Done |
| 2 (GREEN) | Grid portal Nous endpoints | 5eb410a | Done |

## What Was Built

**Task 1: Brain skill-by-hash lookup**

- `SkillStore.get_by_hash(hash)` — O(N) scan computing `sha256(instructions)` on-the-fly; no schema migration needed
- `skills_lookup.py` — new handler, same auth+response pattern as `cognitive_snapshot.py`; returns exactly `{description, name}` (2 keys alphabetical)
- `server.py` — registers `GET /skills/{hash}` route; 401 on missing/wrong secret, 404 for unknown hash
- 11 tests pass: unit tests for get_by_hash, HTTP auth gate, response shape, plaintext gate

**Task 2: Grid portal Nous endpoints**

- `nous.ts` — three routes registered via `registerPortalNousRoutes(app, services)`
- `/api/v1/portal/nous/:nousId/skills` — queries `audit_trail` for skill.taught/skill.inferred events, resolves names via Brain proxy (5s timeout, fallback to `hash.slice(0,16)+'...'`)
- `/api/v1/portal/nous/:nousId/lore` — returns only `content_hash, category_tag, contributed_tick, citation_count` from `lore_commons`; cursor pagination at 20 entries
- `/api/v1/portal/nous/:nousId/norms` — `JSON_CONTAINS` query on `norm_candidates.participant_dids`, merges with `norm_registry` for crystallized/candidate status
- `index.ts` — wired `registerPortalNousRoutes` at end of `registerPortalRoutes`
- 11 tests pass: auth gate (3), skills (2), lore (3), norms (3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `services.db` → `services.humanPool`**
- **Found during:** Task 2 implementation
- **Issue:** Plan action code uses `services.db` but `GridServices` interface has no `db` field; the MySQL pool is exposed as `humanPool`
- **Fix:** Used `services.humanPool` throughout `nous.ts`; added null-guard for pool-absent case (returns `{skills:[]}` / `{entries:[],cursor:null}` / `{norms:[]}`)
- **Files modified:** `grid/src/api/portal/nous.ts`
- **Commit:** 5eb410a

**2. [Rule 1 - Bug] `audit_trail.tick` → `audit_trail.created_at`**
- **Found during:** Task 2 schema verification
- **Issue:** Plan action code references a `tick` column but the actual `audit_trail` schema uses `created_at BIGINT` for tick value
- **Fix:** Query uses `created_at` as the tick column
- **Files modified:** `grid/src/api/portal/nous.ts`
- **Commit:** 5eb410a

**3. [Rule 1 - Bug] `evidence_tick_range` column doesn't exist in `norm_registry`**
- **Found during:** Task 2 schema verification
- **Issue:** Plan action code references `evidence_tick_range` but `norm_registry` schema has no such column; tick range comes from `norm_candidates.first_seen_tick` and `last_updated_tick`
- **Fix:** Norm response uses `tick_start: first_seen_tick, tick_end: last_updated_tick` from `norm_candidates`
- **Files modified:** `grid/src/api/portal/nous.ts`
- **Commit:** 5eb410a

**4. [Rule 1 - Bug] Unicode ellipsis `…` → ASCII `...` in hash fallback**
- **Found during:** Task 2 test execution
- **Issue:** Implementation initially used `…` (U+2026) but plan spec says `hash.slice(0,16)+'...'`; test pattern `/\.\.\./` failed
- **Fix:** Changed to `...` (three ASCII dots)
- **Files modified:** `grid/src/api/portal/nous.ts`
- **Commit:** 5eb410a

## Security Notes

All threat mitigations from the plan's threat model are implemented:
- **T-27-07**: X-Brain-Secret checked before SkillStore access; 401 on mismatch
- **T-27-08**: lore_commons has no body column; endpoint only returns 4 metadata fields
- **T-27-09**: All DB queries use parameterized `?` placeholders; nousId is Fastify route param
- **T-27-10**: LIMIT 50 on skill queries; Promise.all with 5s AbortController per Brain call; fallback on error
- **T-27-11**: All three routes are read-only; any authenticated portal user can read any Nous profile

## Known Stubs

None. All data paths are wired — DB queries execute against `humanPool`, Brain proxy executes against `BRAIN_HTTP_BASE_URL/skills/:hash`.

## Self-Check: PASSED

Files exist:
- brain/src/noesis_brain/http/skills_lookup.py: FOUND
- brain/src/noesis_brain/skills/store.py (get_by_hash): FOUND
- grid/src/api/portal/nous.ts (registerPortalNousRoutes): FOUND
- grid/src/api/portal/index.ts (wired): FOUND

Commits exist:
- 7152576: FOUND (RED Brain tests)
- d9b27b2: FOUND (GREEN Brain implementation)
- 1b0052f: FOUND (RED Grid tests)
- 5eb410a: FOUND (GREEN Grid implementation)

Brain tests: 699 passed (includes 11 new)
Grid tests: 1973 passed (includes 11 new), 103 pre-existing failures (all WebSocket cleanup noise, pre-existed before this plan)
