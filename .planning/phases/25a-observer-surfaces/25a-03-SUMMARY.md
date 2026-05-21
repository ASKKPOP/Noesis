---
phase: 25a
plan: "03"
subsystem: brain/http
tags: [brain, http-server, aiohttp, cognitive-snapshot, plaintext-gate, tdd]
requires:
  - 25a-01 (check-cognitive-snapshot-plaintext.mjs CI gate)
provides:
  - Brain HTTP server on TCP port (aiohttp, configurable via BRAIN_HTTP_PORT)
  - GET /cognitive-snapshot/{did} endpoint (auth-gated, 5-key JSON contract)
  - D-25a-02: first Brain read endpoint outside RPC tick contract
  - D-25a-03: 5-field cognitive snapshot contract
  - D-25a-05: all 6 forbidden plaintext keys absent; CI gate green
affects:
  - Plan 25a-05 (Grid proxy to this endpoint)
tech-stack:
  added:
    - aiohttp>=3.10,<4 (brain/pyproject.toml)
  patterns:
    - BrainHttpServer wraps aiohttp AppRunner + TCPSite on same asyncio event loop as RPCServer
    - cognitive_snapshot handler reads handler._ananke_runtimes, handler.memory._store, handler._last_sleep_tick
    - SkillStore constructed transiently from shared SQLite connection (handler.memory._store._conn)
    - Direct SQL COUNT for reflexion_count (avoid loading all rows)
    - wiki_pages_by_category(SELF_MODEL) + title prefix filter for rule_count
key-files:
  created:
    - brain/src/noesis_brain/http/__init__.py
    - brain/src/noesis_brain/http/server.py
    - brain/src/noesis_brain/http/cognitive_snapshot.py
    - brain/test/test_http_server.py
    - brain/test/test_cognitive_snapshot.py
  modified:
    - brain/pyproject.toml (aiohttp dependency added)
    - brain/src/noesis_brain/__main__.py (BrainHttpServer lifecycle wired)
decisions:
  - "aiohttp>=3.10,<4 pinned with upper bound for stability"
  - "BrainHttpServer optional in BrainApp (http_server=None default); wired by create_brain_app_from_env() only — avoids breaking existing tests that construct BrainApp directly"
  - "SkillStore created transiently in cognitive_snapshot.py from handler.memory._store._conn rather than adding _skill_store to BrainHandler — surgical change, no handler API changes"
  - "reflexion_count uses direct SQL COUNT query rather than recent_memories() to avoid loading all rows"
  - "BrainApp.http_server is None by default; BRAIN_HTTP_SECRET is only required at runtime (create_brain_app_from_env), not in tests"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 2
---

# Phase 25a Plan 03: Brain HTTP Server Summary

**One-liner:** aiohttp Brain HTTP server with auth-gated GET /cognitive-snapshot/{did} returning 5-key scrubbed cognitive metadata; all 6 forbidden plaintext keys absent; CI gate green.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | aiohttp dep + BrainHttpServer skeleton + lifecycle wiring | adb226a | pyproject.toml, http/server.py, http/__init__.py, __main__.py, test_http_server.py |
| 2 | cognitive_snapshot endpoint handler + plaintext gate verification | 0875299 | http/cognitive_snapshot.py, test_cognitive_snapshot.py |

## Artifacts

### Endpoint URL + Auth

```
GET /cognitive-snapshot/{did}
Header: X-Brain-Secret: <secret>
Returns: 200 JSON | 401 Unauthorized
```

Auth mechanism: shared secret (`X-Brain-Secret` header). Secret is per-deployment and must be set in both Brain and Grid environments.

### Dependency

```toml
"aiohttp>=3.10,<4"
```

Installed version resolved at: `aiohttp>=3.10,<4` (latest stable in range at time of install).

### Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `BRAIN_HTTP_SECRET` | (required) | Raise `RuntimeError` on startup if missing. Generate: `openssl rand -hex 32`. Must match the Grid-side `BRAIN_HTTP_SECRET`. |
| `BRAIN_HTTP_PORT` | `8090` | TCP port Brain HTTP server binds on. Override per-process if running multiple Brains on same host. |

**Rotation procedure:** To rotate `BRAIN_HTTP_SECRET`, update the secret in both Brain and Grid environments simultaneously and restart both processes. No session state is tied to the secret.

### Response Shape (D-25a-03) — exactly 5 keys

```json
{
  "drive_levels": {
    "hunger":    0.0,
    "curiosity": 0.0,
    "safety":    0.0,
    "boredom":   0.0,
    "loneliness": 0.0
  },
  "last_sleep_tick":   0,
  "reflexion_count":   0,
  "rule_count":        0,
  "skill_titles_topk": []
}
```

- `drive_levels`: always all 5 DriveName enum keys; values 0.0 when Ananke runtime absent for the requested DID.
- `skill_titles_topk`: up to K=10 skill `.name` strings sorted by `last_used_at` DESC. NEVER includes `.instructions` content.
- `reflexion_count`: direct SQL `COUNT(*)` on `memories WHERE memory_type = 'reflection'`.
- `rule_count`: wiki pages with `category = 'self_model'` AND `title LIKE 'self_model_rule_%'`.
- `last_sleep_tick`: `handler._last_sleep_tick` (int, 0 if no sleep yet).

### Decision IDs Implemented

- **D-25a-02**: First Brain read endpoint outside the tick RPC contract. Coexists with RPCServer on the same asyncio event loop (no threading).
- **D-25a-03**: 5-field cognitive snapshot contract implemented exactly as specified.
- **D-25a-05**: All 6 forbidden plaintext keys absent from implementation and tests. CI gate exits 0.

### Plaintext Gate Evidence

**Forbidden keys (D-25a-05):** `reflexion_text`, `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext`

```
node scripts/check-cognitive-snapshot-plaintext.mjs
✅ check-cognitive-snapshot-plaintext: clean (0 violations across all scopes)
Exit: 0
```

Forbidden keys appear ONLY in the module docstring comment — not as JSON property keys. The CI script uses property-key-position regex and reports 0 violations.

**json.dumps assertion in tests:** `test_cognitive_snapshot.py::TestPlaintextGate::test_forbidden_keys_absent_from_json` asserts that `json.dumps(response_body)` contains none of the 6 forbidden keys. Passes.

**Skill body check:** `test_cognitive_snapshot.py::TestSkillTitlesOnly::test_skill_name_in_response_not_instructions` seeds a skill with `instructions="SECRET INSTRUCTIONS BODY TEXT"` and asserts that string is absent from the serialized response. Passes.

### Brain HTTP Server Architecture

```
BrainApp.start()
  ├── await self.rpc.start()        # existing Unix socket RPC
  └── await self.http_server.start() # NEW aiohttp TCP server

BrainApp.stop()
  ├── await self.http_server.stop() # HTTP first
  └── await self.rpc.stop()
```

`BrainHttpServer` is `None` by default in `BrainApp`; `create_brain_app_from_env()` calls `_build_http_server()` which reads `BRAIN_HTTP_SECRET` and constructs it. Existing test code that constructs `BrainApp(handler, rpc, nous_name)` directly is unaffected.

### Pre-Check Result

```bash
grep -rn "aiohttp|web.Application|asyncio.start_server" brain/src/ --include="*.py"
# (no output) — Brain had ZERO existing HTTP server before this plan.
```

## Deviations from Plan

### Auto-adaptation: BrainHandler has no _skill_store instance attribute

**Found during:** Task 2 read_first (rpc/handler.py)

**Issue:** The plan's interface specification stated `handler._skill_store: SkillStore` as a readable attribute, but `_skill_store` is a local variable in `BrainHandler.__init__()` and is NOT stored as an instance attribute. It is passed to `_obs_learner` and `_peer_filter` but not retained on `self`.

**Fix:** `cognitive_snapshot.py` constructs a transient `SkillStore` from `handler.memory._store._conn` (the shared SQLite connection). This avoids adding a new attribute to `BrainHandler` (surgical change). The `SkillStore` constructor is idempotent and safe to construct multiple times from the same connection.

**Files modified:** `brain/src/noesis_brain/http/cognitive_snapshot.py` (helper `_get_skill_titles_topk`)

**Rule:** Rule 1 (auto-adapt — implementation did not match plan interface spec)

### Auto-adaptation: Skill type uses .instructions not .body

**Found during:** Task 2 read_first (skills/types.py)

**Issue:** The plan refers to `skill.body` as the forbidden field in tests, but the actual `Skill` dataclass has `instructions` (not `body`). The forbidden key in D-25a-05 is named `skill_body` but the Skill field is `.instructions`.

**Fix:** Tests assert that `skill.instructions` content does not appear in the response (not a field named `skill_body`). The `cognitive_snapshot.py` uses `s.name` exclusively. The CI gate forbids a JSON property key named `skill_body` — which would never appear since we only use `s.name`.

**Rule:** Rule 1 (auto-adapt — plan pseudocode used wrong field name)

### Adaptation: BrainHttpServer uses http_server=None default to avoid breaking tests

**Found during:** Task 1

**Issue:** `create_brain_app()` is called in existing tests without `BRAIN_HTTP_SECRET`. If the HTTP server were wired unconditionally, all existing tests would fail with `RuntimeError("BRAIN_HTTP_SECRET required")`.

**Fix:** `BrainApp.__init__()` accepts `http_server: BrainHttpServer | None = None`. The HTTP server is only constructed and wired by `create_brain_app_from_env()` (runtime path), not by `create_brain_app()` (test-friendly factory). This is the correct separation of concerns.

**Rule:** Rule 2 (prevent breaking existing tests — correctness requirement)

## Known Stubs

None — endpoint returns live data from `handler._ananke_runtimes`, `handler.memory`, and `handler._last_sleep_tick`.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-tcp-endpoint | brain/src/noesis_brain/http/server.py | First TCP-facing surface in Brain (previously Unix-socket only). Binds 0.0.0.0 — relies on Docker network isolation + X-Brain-Secret defense. Documented in T-25a-03-08. |

## Self-Check: PASSED

Files verified present:
- `brain/src/noesis_brain/http/__init__.py` — EXISTS
- `brain/src/noesis_brain/http/server.py` — EXISTS
- `brain/src/noesis_brain/http/cognitive_snapshot.py` — EXISTS
- `brain/test/test_http_server.py` — EXISTS
- `brain/test/test_cognitive_snapshot.py` — EXISTS

Commits verified in git log:
- `adb226a` — feat(25a-03): add aiohttp dep + BrainHttpServer skeleton + lifecycle wiring
- `0875299` — feat(25a-03): cognitive_snapshot endpoint + plaintext gate + tests
