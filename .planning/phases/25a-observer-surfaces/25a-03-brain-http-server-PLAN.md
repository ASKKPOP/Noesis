---
phase: 25a
plan: 03
type: execute
wave: 2
depends_on: [25a-01]
files_modified:
  - brain/pyproject.toml
  - brain/src/noesis_brain/http/__init__.py
  - brain/src/noesis_brain/http/server.py
  - brain/src/noesis_brain/http/cognitive_snapshot.py
  - brain/src/noesis_brain/__main__.py
  - brain/test/test_cognitive_snapshot.py
  - brain/test/test_http_server.py
autonomous: true
requirements: [OBS-COGNITIVE-INSPECTOR]
tags: [brain, http-server, aiohttp, cognitive-snapshot, plaintext-gate]
user_setup:
  - service: brain-runtime
    why: "New aiohttp dependency requires reinstalling Brain Python env"
    env_vars:
      - name: BRAIN_HTTP_SECRET
        source: "Generate a random shared secret (e.g., `openssl rand -hex 32`). Set in both Brain runtime env AND Grid env. Recorded in CONTEXT-continuation."
      - name: BRAIN_HTTP_PORT
        source: "Default 8090; set per Brain process if running multiple Brains on same host"
must_haves:
  truths:
    - "Brain process starts an aiohttp HTTP server alongside the existing RPCServer on the same asyncio event loop"
    - "GET /cognitive-snapshot/<did> returns 5-key JSON: {drive_levels, last_sleep_tick, reflexion_count, rule_count, skill_titles_topk}"
    - "Endpoint requires X-Brain-Secret header matching BRAIN_HTTP_SECRET env (401 otherwise)"
    - "Response NEVER contains reflexion_text, creed_text, rule_text, skill_body, lore_body, whisper_plaintext"
    - "skill_titles_topk contains TITLES only (skill.name field), never bodies (skill.body field)"
    - "Drive levels return all 5 DriveName enum keys (hunger, curiosity, safety, boredom, loneliness)"
    - "check-cognitive-snapshot-plaintext.mjs exits 0 after Brain code lands"
  artifacts:
    - path: "brain/src/noesis_brain/http/server.py"
      provides: "BrainHttpServer class with start() and stop()"
      contains: "class BrainHttpServer"
    - path: "brain/src/noesis_brain/http/cognitive_snapshot.py"
      provides: "handle_cognitive_snapshot aiohttp handler"
      contains: "async def handle_cognitive_snapshot"
    - path: "brain/pyproject.toml"
      provides: "aiohttp dependency declared"
      contains: "aiohttp"
    - path: "brain/test/test_cognitive_snapshot.py"
      provides: "pytest coverage of endpoint shape + forbidden-key invariants"
  key_links:
    - from: "brain/src/noesis_brain/__main__.py"
      to: "brain/src/noesis_brain/http/server.py"
      via: "BrainApp.start() instantiates BrainHttpServer alongside RPCServer"
      pattern: "BrainHttpServer"
    - from: "brain/src/noesis_brain/http/cognitive_snapshot.py"
      to: "brain/src/noesis_brain/rpc/handler.py BrainHandler"
      via: "reads _ananke_runtimes, _last_sleep_tick, _memory_store, _skill_store"
      pattern: "handler\\._(ananke_runtimes|last_sleep_tick|skill_store|memory_store)"
---

<objective>
Ship the FIRST Brain HTTP server in the Noēsis codebase. The Brain currently exposes only a Unix-domain-socket JSON-RPC server; this plan adds a new aiohttp HTTP server (TCP, configurable port) that serves a single read-only endpoint: `GET /cognitive-snapshot/<did>`. The endpoint returns scrubbed cognitive metadata (D-25a-03) consumed by the Steward cognitive inspector via a Grid proxy (Plan 05).

Purpose: This is the architectural pivot of 25a. Brain-private state must remain Brain-private — but operator observability requires a controlled, audited, plaintext-gated read surface. Skill titles (not bodies) are the ONE Brain-internal text field permitted to cross out via this endpoint (D-25a-05 exemption). All other plaintext keys MUST be absent from the response (enforced by the CI grep gate shipped in Plan 01).

Output: aiohttp dependency added, HTTP server module, cognitive_snapshot handler, lifecycle wiring in __main__.py, pytest coverage, plaintext gate green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/25a-observer-surfaces/25a-CONTEXT.md
@.planning/phases/25a-observer-surfaces/25a-RESEARCH.md
@.planning/phases/25a-observer-surfaces/25a-PATTERNS.md
@.planning/phases/25a-observer-surfaces/25a-UI-SPEC.md
@.planning/phases/25a-observer-surfaces/25a-01-foundation-PLAN.md
@brain/pyproject.toml
@brain/src/noesis_brain/__main__.py
@brain/src/noesis_brain/rpc/server.py
@brain/src/noesis_brain/rpc/handler.py
@brain/src/noesis_brain/skills/store.py
@brain/src/noesis_brain/ananke/types.py

<interfaces>
<!-- DriveName enum (brain/src/noesis_brain/ananke/types.py) — AUTHORITATIVE -->
```python
class DriveName(str, Enum):
    HUNGER = "hunger"
    CURIOSITY = "curiosity"
    SAFETY = "safety"
    BOREDOM = "boredom"
    LONELINESS = "loneliness"
```

<!-- BrainHandler internal state (rpc/handler.py) — fields the endpoint reads -->
```python
class BrainHandler:
    _ananke_runtimes: dict[str, AnankeRuntime]  # keyed by nous_did
    _last_sleep_tick: int = 0
    _skill_store: SkillStore                     # has list_all() -> list[Skill]
    _memory_store: MemoryStore                   # has count(MemoryType) or query API
```

<!-- AnankeRuntime.state.values shape -->
```python
state.values: dict[DriveName, float]  # 5 entries
```

<!-- Cognitive-snapshot endpoint response contract (D-25a-03) -->
```json
{
  "drive_levels": {"hunger": float, "curiosity": float, "safety": float, "boredom": float, "loneliness": float},
  "last_sleep_tick": int,
  "reflexion_count": int,
  "rule_count": int,
  "skill_titles_topk": [str, ...]   // up to K=10 titles, sorted by last_used_at DESC
}
```
NOTE: `creed_violation_count` is NOT returned here — Grid assembles it from `nous.creed_violation` audit events (handled in Plan 05).

<!-- Forbidden response keys (D-25a-05) -->
NEVER include: reflexion_text, rule_text, creed_text, skill_body, lore_body, whisper_plaintext
PERMITTED exception: skill_title (in skill_titles_topk values)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add aiohttp dependency + BrainHttpServer skeleton + lifecycle wiring</name>
  <read_first>
    - brain/pyproject.toml (full file — current deps)
    - brain/src/noesis_brain/__main__.py (full file — BrainApp.start() lifecycle, RPCServer instantiation)
    - brain/src/noesis_brain/rpc/server.py (full file — pattern for asyncio-based server start/stop)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"Recommended New Brain HTTP Server Architecture" (lines 370-390)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"Brain HTTP server" (lines 295-339)
    - Confirm Brain has NO existing HTTP server: run `grep -rn "aiohttp\\|web.Application\\|asyncio.start_server" brain/src/ --include="*.py"` BEFORE writing anything. If results appear, STOP and consult RESEARCH Open Question Q1.
  </read_first>
  <behavior>
    - `aiohttp` declared in `brain/pyproject.toml` dependencies (latest stable, e.g. `aiohttp>=3.10,<4`)
    - `brain/src/noesis_brain/http/__init__.py` exists (empty package marker)
    - `BrainHttpServer` class with:
      - `__init__(self, handler: BrainHandler, secret: str, port: int)`
      - `async def start(self) -> None` — creates `web.AppRunner`, starts on `0.0.0.0:port`
      - `async def stop(self) -> None` — cleanup
      - Routes registered: `GET /cognitive-snapshot/{did}`
    - `BrainApp.start()` (in `__main__.py`) instantiates `BrainHttpServer` and awaits `start()` alongside `RPCServer.start()`, ON THE SAME asyncio event loop (no threading)
    - `BrainApp` shutdown path calls `await http_server.stop()` before `await rpc_server.stop()`
    - Env vars: `BRAIN_HTTP_SECRET` (required; raise on missing at startup), `BRAIN_HTTP_PORT` (default 8090)
  </behavior>
  <action>
    1. Run pre-check: `grep -rn "aiohttp\\|web.Application\\|asyncio.start_server" brain/src/ --include="*.py"`. If empty (expected per RESEARCH), proceed. If non-empty, document the finding in SUMMARY and adapt the plan.
    2. Edit `brain/pyproject.toml` — add `aiohttp>=3.10,<4` to the `dependencies` (or `[project] dependencies`) array. Pin upper bound to 4.0 for stability.
    3. Create `brain/src/noesis_brain/http/__init__.py` (empty file, just package marker).
    4. Create `brain/src/noesis_brain/http/server.py`:
       ```python
       from __future__ import annotations
       from typing import TYPE_CHECKING
       from aiohttp import web

       if TYPE_CHECKING:
           from ..rpc.handler import BrainHandler

       class BrainHttpServer:
           def __init__(self, handler: 'BrainHandler', secret: str, port: int) -> None:
               self._handler = handler
               self._secret = secret
               self._port = port
               self._app = web.Application()
               # Routes registered in Task 2 (cognitive_snapshot.py provides handle_cognitive_snapshot)
               from .cognitive_snapshot import handle_cognitive_snapshot
               self._app.router.add_get(
                   '/cognitive-snapshot/{did}',
                   lambda req: handle_cognitive_snapshot(req, self._handler, self._secret),
               )
               self._runner: web.AppRunner | None = None
               self._site: web.TCPSite | None = None

           async def start(self) -> None:
               self._runner = web.AppRunner(self._app)
               await self._runner.setup()
               self._site = web.TCPSite(self._runner, '0.0.0.0', self._port)
               await self._site.start()

           async def stop(self) -> None:
               if self._site is not None:
                   await self._site.stop()
               if self._runner is not None:
                   await self._runner.cleanup()
       ```
    5. Edit `brain/src/noesis_brain/__main__.py`:
       - At top: `import os` (if not already) and `from .http.server import BrainHttpServer`
       - In `BrainApp.__init__` or wherever services are constructed: read `BRAIN_HTTP_SECRET` from `os.environ` (raise `RuntimeError("BRAIN_HTTP_SECRET required")` if missing); read `BRAIN_HTTP_PORT` (default `int(os.environ.get('BRAIN_HTTP_PORT', '8090'))`).
       - Construct: `self._http_server = BrainHttpServer(self._handler, secret, port)`
       - In `BrainApp.start()`: after `await self._rpc_server.start()`, add `await self._http_server.start()`
       - In `BrainApp.stop()` (or shutdown path): before `await self._rpc_server.stop()`, add `await self._http_server.stop()`
    6. Create `brain/test/test_http_server.py` (pytest, asyncio-aware) — tests BrainHttpServer lifecycle WITHOUT the endpoint handler (handler tested in Task 2):
       - Constructs BrainHttpServer with a mock handler, secret="test", port=0 (ephemeral)
       - `await start()` — server listens
       - `await stop()` — server cleanly shuts down (idempotent)
       - Pre-check test: `from aiohttp import web` works (import succeeds)
    7. Install the new dep + run pytest:
       - `cd brain && pip install -e .` (or whatever the repo's standard install is — read pyproject.toml or existing Dockerfile to confirm)
       - `cd brain && python -m pytest test/test_http_server.py -x -q`
  </action>
  <verify>
    <automated>cd brain && python -m pytest test/test_http_server.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "aiohttp" brain/pyproject.toml` returns a match in dependencies
    - `test -f brain/src/noesis_brain/http/__init__.py && test -f brain/src/noesis_brain/http/server.py`
    - `grep -c "class BrainHttpServer" brain/src/noesis_brain/http/server.py` returns 1
    - `grep -n "BrainHttpServer" brain/src/noesis_brain/__main__.py` returns at least 2 lines (import + instantiation + start + stop)
    - `grep -n "BRAIN_HTTP_SECRET" brain/src/noesis_brain/__main__.py` returns a match (env read with raise on missing)
    - pytest exits 0 on test_http_server.py
    - Existing Brain tests still pass: `cd brain && python -m pytest test/ -x -q` exits 0
  </acceptance_criteria>
  <done>aiohttp added; BrainHttpServer skeleton runs alongside RPCServer; lifecycle correct; env vars wired; existing tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: cognitive_snapshot endpoint handler + plaintext gate verification</name>
  <read_first>
    - brain/src/noesis_brain/rpc/handler.py (full file — confirm `_ananke_runtimes`, `_last_sleep_tick`, `_skill_store`, `_memory_store` attribute names and types)
    - brain/src/noesis_brain/skills/store.py (full file — `list_all()` API, Skill model `name` vs `body`, `last_used_at` ordering)
    - brain/src/noesis_brain/ananke/types.py (DriveName enum)
    - brain/src/noesis_brain/ananke/runtime.py (AnankeRuntime.state.values shape)
    - brain/src/noesis_brain/memory/ (look for MemoryStore + MemoryType.REFLECTION — confirm API for counting reflexions; also confirm wiki-page query API for self_model_rule_* counting)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"Brain Data Sources for the Cognitive-Snapshot Response" (lines 222-238)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"cognitive_snapshot.py" data-source map (lines 326-336)
    - scripts/check-cognitive-snapshot-plaintext.mjs (shipped in Plan 01 — confirm scope includes new files)
  </read_first>
  <behavior>
    - `handle_cognitive_snapshot(request, handler, secret)`:
      1. Validates `X-Brain-Secret` header == secret → `401 Unauthorized` otherwise
      2. Extracts `did` from URL path (`request.match_info['did']`)
      3. Looks up `handler._ananke_runtimes.get(did)` → if None, drive_levels = `{}` (all 5 keys with 0.0 — see below)
      4. Returns JSON with exactly 5 keys: `drive_levels`, `last_sleep_tick`, `reflexion_count`, `rule_count`, `skill_titles_topk`
    - `drive_levels`: always includes all 5 DriveName enum values as keys (hunger, curiosity, safety, boredom, loneliness) with float values; if runtime absent, all 0.0
    - `skill_titles_topk`: `handler._skill_store.list_all()` sorted by `last_used_at` DESC, take first 10, extract `.name` field ONLY (NEVER `.body`). K=10 per UI-SPEC + RESEARCH.
    - `reflexion_count`: count of MemoryType.REFLECTION entries in `handler._memory_store` (use the existing count/query API discovered during read_first; if no direct count, use `len(list(...))` with filter)
    - `rule_count`: count of wiki pages with `WikiCategory.SELF_MODEL` whose title starts with `self_model_rule_`
    - `last_sleep_tick`: `handler._last_sleep_tick` (int)
    - Response NEVER contains any of: `reflexion_text`, `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext`
    - Response IS PERMITTED to contain `skill_titles_topk` (titles, not bodies — D-25a-05 exemption)
  </behavior>
  <action>
    1. Create `brain/src/noesis_brain/http/cognitive_snapshot.py`:
       ```python
       from __future__ import annotations
       from typing import TYPE_CHECKING
       from aiohttp import web

       from ..ananke.types import DriveName

       if TYPE_CHECKING:
           from ..rpc.handler import BrainHandler

       SKILL_TITLES_TOPK = 10  # K per D-25a-03 + UI-SPEC

       async def handle_cognitive_snapshot(
           request: web.Request,
           handler: 'BrainHandler',
           secret: str,
       ) -> web.Response:
           if request.headers.get('X-Brain-Secret', '') != secret:
               raise web.HTTPUnauthorized()
           did = request.match_info['did']

           # Drive levels — always 5 keys
           drive_levels: dict[str, float] = {d.value: 0.0 for d in DriveName}
           runtime = handler._ananke_runtimes.get(did)
           if runtime is not None:
               for drive_name, value in runtime.state.values.items():
                   drive_levels[drive_name.value] = float(value)

           # Skill titles — titles ONLY, never bodies
           skills = handler._skill_store.list_all()
           skills_sorted = sorted(skills, key=lambda s: s.last_used_at, reverse=True)
           skill_titles_topk: list[str] = [s.name for s in skills_sorted[:SKILL_TITLES_TOPK]]

           # Reflexion count — see memory_store API discovered in read_first
           reflexion_count = ...  # FILL based on actual MemoryStore API

           # Rule count — wiki pages with WikiCategory.SELF_MODEL, title prefix "self_model_rule_"
           rule_count = ...  # FILL based on actual wiki API

           return web.json_response({
               'drive_levels': drive_levels,
               'last_sleep_tick': handler._last_sleep_tick,
               'reflexion_count': reflexion_count,
               'rule_count': rule_count,
               'skill_titles_topk': skill_titles_topk,
           })
       ```
       Fill the `reflexion_count` and `rule_count` blocks based on the exact MemoryStore / wiki API discovered in read_first. If the API requires async, propagate `await`.
    2. Create `brain/test/test_cognitive_snapshot.py` (pytest + aiohttp test client). Cases:
       - **Auth gate:** request without `X-Brain-Secret` → 401; wrong secret → 401; correct secret → 200
       - **Shape:** response is JSON object with EXACTLY these top-level keys, sorted: `drive_levels`, `last_sleep_tick`, `reflexion_count`, `rule_count`, `skill_titles_topk` (use `set(response.keys()) == set(EXPECTED)`)
       - **Drive shape:** `drive_levels` always has 5 keys: `hunger`, `curiosity`, `safety`, `boredom`, `loneliness`; all values are floats
       - **Missing runtime:** when did is not in `_ananke_runtimes`, all 5 drive_levels are 0.0
       - **Skill titles only:** with a SkillStore populated with skills having `name="title1", body="SECRET BODY"`, response includes `"title1"` and does NOT include `"SECRET BODY"` anywhere
       - **K=10 limit:** with 15 skills, response includes exactly 10 entries
       - **Plaintext gate:** assert that `json.dumps(response_body)` contains NONE of: `reflexion_text`, `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext` (string-level check)
       - **Counts:** with seeded memory_store (3 reflexions, 2 self_model_rules) → `reflexion_count == 3`, `rule_count == 2`
    3. Run plaintext gate: `node scripts/check-cognitive-snapshot-plaintext.mjs` — must exit 0 (no forbidden keys in the new files).
    4. Run pytest: `cd brain && python -m pytest test/test_cognitive_snapshot.py -x -q`
    5. Run full Brain suite: `cd brain && python -m pytest test/ -x -q` — no regression.
  </action>
  <verify>
    <automated>cd brain && python -m pytest test/test_cognitive_snapshot.py -x -q && node scripts/check-cognitive-snapshot-plaintext.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `test -f brain/src/noesis_brain/http/cognitive_snapshot.py`
    - `grep -c "async def handle_cognitive_snapshot" brain/src/noesis_brain/http/cognitive_snapshot.py` returns 1
    - `grep -E "reflexion_text|creed_text|skill_body|lore_body|whisper_plaintext|rule_text" brain/src/noesis_brain/http/cognitive_snapshot.py` returns ZERO matches (forbidden keys absent)
    - `grep -n "skill_titles_topk\\|\\.name" brain/src/noesis_brain/http/cognitive_snapshot.py` shows `.name` accessor used (NOT `.body`)
    - `grep -n "\\.body" brain/src/noesis_brain/http/cognitive_snapshot.py` returns ZERO matches
    - `grep -n "DriveName" brain/src/noesis_brain/http/cognitive_snapshot.py` confirms enum import
    - `node scripts/check-cognitive-snapshot-plaintext.mjs; echo $?` prints `0`
    - pytest test_cognitive_snapshot.py exits 0
    - full brain pytest suite exits 0
  </acceptance_criteria>
  <done>cognitive_snapshot.py endpoint shipped; all 6 forbidden keys absent; K=10 skill TITLES only; full auth + shape + count tests green; CI gate green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grid → Brain HTTP | TCP socket on Docker internal network; first HTTP surface from Brain |
| External → Brain HTTP | NOT EXPECTED (Brain runs on internal network); X-Brain-Secret defense if accidentally exposed |
| BrainHandler internal state → JSON response | Plaintext keys must NEVER cross this boundary except skill_title |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-03-01 | Information Disclosure | Brain HTTP endpoint accessible without auth | mitigate | X-Brain-Secret header required; mismatched → 401; secret read from env at startup |
| T-25a-03-02 | Information Disclosure | Endpoint leaks reflexion_text / rule_text / creed_text / skill_body / lore_body / whisper_plaintext (D-25a-05 critical) | mitigate | (a) Code review: handler never reads these fields; (b) CI grep gate `check-cognitive-snapshot-plaintext.mjs` scans endpoint + tests; (c) Closed-tuple schema check on Grid client side (Plan 05); (d) pytest assert json.dumps contains none of these keys |
| T-25a-03-03 | Information Disclosure | Skill bodies leak via `.body` accessor instead of `.name` | mitigate | Code review + grep gate: `grep "\.body" cognitive_snapshot.py` returns 0; pytest asserts skill body content not in response |
| T-25a-03-04 | Tampering | Replay attack with stolen X-Brain-Secret | accept | Secret is per-deployment; rotation procedure documented in user_setup; internal-network scope only |
| T-25a-03-05 | Repudiation | Brain endpoint queries are not logged on Brain side | accept | Grid proxy emits `operator.inspected` (Plan 05) — single audit trail point; Brain logging would be redundant |
| T-25a-03-06 | Denial of Service | Skill store list_all() on very large stores | accept | Sorted-then-sliced K=10; even 100K skills sort in <100ms; acceptable for operator-tier query |
| T-25a-03-07 | Elevation of Privilege | Endpoint runs without DID validation, accepts any string | accept | Grid proxy enforces DID_REGEX before calling Brain (Plan 05); Brain trusts caller authenticated by X-Brain-Secret |
| T-25a-03-08 | Spoofing | Brain HTTP server accidentally exposes to public internet | mitigate | Server binds 0.0.0.0 — relies on Docker network isolation; document in deploy notes; X-Brain-Secret as backup |
</threat_model>

<verification>
- aiohttp dep added; pyproject.toml updated
- BrainHttpServer + cognitive_snapshot module created
- Handler returns exact 5-key shape with all 5 drive names always present
- Skill TITLES only (no bodies); K=10 limit applied
- All 6 forbidden plaintext keys absent (grep + json.dumps test)
- X-Brain-Secret gate (401 on mismatch)
- Lifecycle wired into __main__.py alongside RPCServer
- CI grep gate exits 0
- Full Brain pytest suite green (no regression)
</verification>

<success_criteria>
- D-25a-02 (new Brain endpoint): SHIPPED
- D-25a-03 (5-field contract): SHIPPED — all 5 keys present, drive_levels has all 5 enum values
- D-25a-05 (plaintext gate): SHIPPED — forbidden keys absent, gate green
- Brain HTTP server is FIRST in the codebase (verified by pre-check grep)
- No regression in existing Brain tests
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-03-SUMMARY.md` documenting:
- aiohttp version pin
- Endpoint URL path + auth header name
- BRAIN_HTTP_SECRET env var (rotation procedure)
- BRAIN_HTTP_PORT default + override path
- Exact response shape (5 keys, sorted)
- Decision IDs implemented: D-25a-02, D-25a-03, D-25a-05
- Plaintext gate evidence: grep results + json.dumps test passes
- Confirmed: Brain has zero existing HTTP server before this plan (per pre-check grep)
</output>
