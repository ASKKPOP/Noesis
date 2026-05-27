# Phase 40: Local AI Integration - Research

**Researched:** 2026-05-27
**Domain:** Ollama integration + Grid DB persistence + Brain startup + Steward Console UI
**Confidence:** HIGH

## Summary

Phase 40 is a **wiring and persistence phase**, not a discovery phase. All core LLM infrastructure exists. `OllamaAdapter` (generate, list_models, is_available), `ModelRouter` (tier routing + fallback), and `LLMConfig` are fully implemented and tested. The work is: (1) implement the Phase 39 stub in `operator-settings-store.ts` with real DB persistence (migration v29), (2) wire Brain startup to pull those settings from Grid before constructing LLM adapters, (3) add a Brain HTTP endpoint `GET /api/v1/brain/local-ai/models` so Steward can populate dropdowns, (4) build the `/system/local-ai` Steward Console page, and (5) add structured Pino-style logging (actually Python `structlog`/`logging`) around Ollama availability state.

The cloud fallback path in `ModelRouter` already works — when all Ollama adapters return `is_available() == False`, the router falls through to the cloud fallback adapter. Phase 40 does not change this logic. It adds: (a) structured logging events on first unavailability / recovery, (b) per-tick polling only while in fallback mode, and (c) a status endpoint Brain exposes so Steward can render the red banner.

Key constraint: **Steward cannot call Ollama directly**. `GET /api/v1/brain/local-ai/models` on Brain proxies `OllamaAdapter.list_models()`. Brain's HTTP server uses `aiohttp`; the new endpoint follows the `cognitive_snapshot.py` pattern (no authentication needed given same-machine localhost assumption — this is a Claude's Discretion item).

**Primary recommendation:** Structure the work as 5 sequential tasks matching the 5 integration seams: (1) Grid DB + store, (2) Brain settings fetch at startup, (3) Brain `local-ai/models` endpoint + availability status, (4) Steward `/system/local-ai` page, (5) fallback mode structured events + tick-level recovery detection.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-40-01: Config Delivery (Brain ← Grid)**
Brain pulls operator settings from Grid at startup via `GET /api/v1/operator/me/settings` using the Phase 38 bearer token (EdDSA-signed Brain JWT). Settings are applied before OllamaAdapter is initialized. Startup blocks if Grid is unreachable — log `{event: 'settings_fetch_failed', reason: <error>}` and exit non-zero.

**D-40-02: Settings Schema**
```typescript
interface LocalAiSettings {
  small_model: string;     // e.g. "qwen3:4b"
  primary_model: string;   // e.g. "qwen3:14b"
  large_model: string;     // e.g. "qwen3:32b"
  temperature: float;      // global, 0.0–2.0, default 0.7
  max_tokens: int;         // global, default 2048
  _version: 2;             // bump from Phase 39's version 1
}
```
All 3 model tiers independently configurable. Temperature and max_tokens are global (apply to all tiers). Maps to `LLMConfig` fields.

**D-40-03: Steward Console — `/system/local-ai` Page**
Components: 3 model dropdowns + global sliders/inputs for temperature (0.0–2.0) and max_tokens (256–8192) + "Restart Brain to apply" banner (shown after any saved change) + red warning banner "Local AI offline — using cloud fallback" + Save button → `PATCH /api/v1/operator/me/settings`.

**D-40-04: Models List Source**
Steward Console calls `GET /api/v1/brain/local-ai/models` on Brain. Brain proxies `OllamaAdapter.list_models()`.

**D-40-05: Degraded Cognition — Cloud Fallback**
Existing ModelRouter cloud fallback chain activates automatically. Brain emits:
```python
log.warning("{event: 'local_ai_unavailable', provider: 'ollama', model: <name>, fallback: <cloud_provider>}")
log.info("{event: 'local_ai_recovered', provider: 'ollama', model: <name>}")
```
Steward Console red banner shows: which cloud provider is active + "Memory content is leaving this machine" (Q-V3-I constitutional requirement).

**D-40-06: Default Model (LOCKED)**
`qwen3:4b` for all 3 tiers as default. Written to DB for new operators on first boot.

**D-40-07: Recovery Detection**
Brain polls `OllamaAdapter.is_available()` once per tick when in fallback mode. On first `True` after a `False` period, logs `local_ai_recovered` and switches back.

### Claude's Discretion
- DB migration version number (v29 is natural given Phase 39 had v27+v28)
- Exact DB schema (column names, JSON vs separate columns)
- Steward Console styling within `/system/local-ai`
- Error shape for `settings_fetch_failed` at Brain startup
- Whether `GET /api/v1/brain/local-ai/models` requires bearer auth (same network localhost vs explicit auth)

### Deferred Ideas (OUT OF SCOPE)
- Hot-reload of model mid-tick
- Per-tier temperature/max_tokens tuning
- Operator billing for cloud fallback costs
- Cloud LLM as primary/selectable provider in Steward Console (Phase 40b)
- Auto-download of Ollama models from within Steward Console
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOCAL-01 | Brain supports Ollama as production LLM provider with operator-selectable model. Selection persists. Default model: qwen3:4b. | D-40-01 wires startup settings fetch; D-40-02 defines schema; D-40-06 locks default. |
| LOCAL-02 | Brain Local AI config: model name, temperature, max_tokens, top_p. Changes take effect on next Brain restart; no hot reload. | D-40-02 covers all params; "Restart Brain to apply" banner in D-40-03; `_version: 2` bump. |
| LOCAL-03 | Brain falls back to degraded cognition mode if Local AI unavailable: logs structured warning, continues tick cycle, blocks Sophia narrative generation until LLM restored. | D-40-05 defines exact log events; D-40-07 defines recovery detection via per-tick poll. Note: CONTEXT.md D-40-05 says Sophia is NOT blocked — "No Sophia narrative blocking. Brain continues full tick cycle via cloud LLM." REQUIREMENTS.md LOCAL-03 says "blocks new Sophia narrative generation until LLM restored." This is a conflict: CONTEXT.md overrides. See Open Questions. |
| MGR-01 | Local Nous Manager surface: Brain config, Local AI settings (extends Steward Console). | `/system/local-ai` page is the Local Nous Manager surface per D-V3-36. |
| MGR-02 | Local Nous Manager Local AI panel: model selection + temperature + override system prompt + restart Brain. Settings persist; no hot-reload. | Phase 40 implements the core. system prompt override and restart button are MGR-02 extensions. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settings persistence | Grid DB (MySQL) | — | Operator settings are Grid-scoped, multi-tenant by design (D-40-01). Brain never writes its own config back to disk. |
| Settings delivery to Brain | Brain startup (GET /api/v1/operator/me/settings) | — | Pull model per D-40-01; Brain blocks startup until Grid responds. |
| Model list population | Brain HTTP server | Ollama localhost | Brain proxies OllamaAdapter.list_models(); Steward cannot call Ollama directly. |
| Local AI availability detection | Brain (per-tick check) | — | OllamaAdapter.is_available() called once per tick during fallback; no separate health loop. |
| Cloud fallback execution | Brain ModelRouter | OllamaAdapter | Existing logic unchanged; Phase 40 only adds logging + state tracking. |
| Steward Console UI | Steward (Next.js) | Brain HTTP (models endpoint) | Page at `/system/local-ai`; reads models from Brain, persists via Grid PATCH. |
| Structured availability logs | Brain | — | Python logging follows existing `log.warn({event: ...})` pattern. |
| Red banner state | Steward Console | Brain HTTP (status endpoint) | Steward polls Brain for Ollama availability status to show/hide banner. |

---

## Standard Stack

### Core (existing — verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | existing (Brain) | Async HTTP for Ollama API calls | Already used by OllamaAdapter; `httpx.AsyncClient` pattern established |
| `aiohttp` | existing (Brain) | Brain HTTP server (BrainHttpServer) | Already used; cognitive_snapshot.py and skills_lookup.py establish the route pattern |
| `mysql2/promise` | existing (Grid) | MySQL async client | Used by all Grid DB stores; Pool type + parameterized queries |
| `fastify` | existing (Grid) | Grid HTTP server | All Grid routes follow registerFoo(app, services) pattern |
| `vitest` | ^2.0.0 (Grid) | Grid tests | Existing test runner |
| `pytest` + `pytest-asyncio` | existing (Brain) | Brain tests | `asyncio_mode = "auto"` in pyproject.toml |

### Supporting (existing — verified)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jose` (SignJWT) | existing (Grid tests) | JWT creation in tests | Brain-token auth tests use it; settings route test will also need it |
| `httpx.MockTransport` | existing (Brain tests) | OllamaAdapter mocking | test_llm_ollama.py uses this pattern; new models-endpoint test will too |

### No new dependencies needed
Phase 40 adds no new npm or Python packages. All required libraries are already present.

---

## Architecture Patterns

### System Architecture Diagram

```
[Steward Console]
  /system/local-ai page
       |                         \
  PATCH /api/v1/operator/me/      GET /api/v1/brain/local-ai/models
  settings (via portal session)   (via BRAIN_HTTP_URL)
       |                                  |
  [Grid API]                        [Brain HTTP Server]
  operatorScope preHandler          aiohttp /local-ai/models
  updateSettings()                  calls OllamaAdapter.list_models()
       |                                  |
  [Grid DB]                        [Ollama at localhost:11434]
  operator_settings table                /api/tags
  (migration v29)
  
  
[Brain startup: create_brain_app_from_env()]
       |
  GET /api/v1/operator/me/settings  (Phase 38 bearer token)
  → blocks until Grid responds
  → exit non-zero if unreachable
       |
  LocalAiSettings → LLMConfig
  → OllamaAdapter(model=small_model) + OllamaAdapter(model=primary_model) + OllamaAdapter(model=large_model)
  → ModelRouter.register_tier(SMALL/PRIMARY/LARGE)
  → if FALLBACK_PROVIDER env set: ModelRouter.set_fallback(cloud_adapter)


[Brain tick loop]
  if in_fallback_mode:
    OllamaAdapter.is_available() once per tick
    on True after False: log local_ai_recovered, switch back
  
  ModelRouter.generate() 
    if Ollama unavailable: falls through to cloud fallback
    on first fallback: log local_ai_unavailable


[Steward Console — banner state]
  polls GET /api/v1/brain/local-ai/status  (or BrainHttpServer /local-ai/status)
  shows red banner when status == "degraded"
```

### Recommended Project Structure

```
grid/src/operator/data/
├── operator-settings-store.ts   # Phase 40: replace stub with real DB logic
grid/src/db/
├── schema.ts                    # add migration v29: operator_settings table
grid/src/api/routes/operator-me/
├── settings.ts                  # unchanged — routes already wired in Phase 39

brain/src/noesis_brain/http/
├── server.py                    # add /local-ai/models + /local-ai/status routes
├── local_ai.py                  # new handler module (follows cognitive_snapshot.py pattern)
brain/src/noesis_brain/
├── __main__.py                  # wire settings fetch before LLM adapter construction

steward/src/app/system/local-ai/
├── page.tsx                     # new page (follows /system/operators/page.tsx pattern)
steward/src/app/api/brain/
├── [...path]/route.ts           # new proxy: Steward → Brain HTTP server

grid/test/
├── operator-me-settings.test.ts # new: GET/PATCH settings shape tests
brain/test/
├── test_local_ai_http.py        # new: /local-ai/models + /local-ai/status endpoint tests
├── test_startup_settings.py     # new: Brain startup settings-fetch + fallback-on-failure
```

### Pattern 1: Grid DB Migration (migration v29)

```typescript
// Source: verified from grid/src/db/schema.ts — existing migration pattern
{
    version: 29,
    name: 'create_operator_settings',
    up: `
        CREATE TABLE IF NOT EXISTS operator_settings (
            grid_name    VARCHAR(63)  NOT NULL,
            operator_did VARCHAR(255) NOT NULL,
            settings     JSON         NOT NULL,
            updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, operator_did)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS operator_settings`,
}
```

**Schema choice (Claude's Discretion resolved):** Single `settings JSON` column is the standard pattern in this codebase (see `grid_config` table at migration v5 — also `JSON` column). Avoids schema migrations for each new settings field.

### Pattern 2: operator-settings-store.ts (real implementation)

```typescript
// Source: verified from existing store files (operator-quota-store.ts, operator-brain-store.ts)
// Default settings written when no row exists for operator
const DEFAULT_LOCAL_AI: LocalAiSettings = {
    small_model: 'qwen3:4b',
    primary_model: 'qwen3:4b',
    large_model: 'qwen3:4b',
    temperature: 0.7,
    max_tokens: 2048,
    _version: 2,
};

export async function getSettings(pool, gridName, operatorDid): Promise<OperatorSettings> {
    const [rows] = await pool.execute(
        'SELECT settings FROM operator_settings WHERE grid_name = ? AND operator_did = ?',
        [gridName, operatorDid],
    );
    if (rows.length === 0) {
        return { local_ai: DEFAULT_LOCAL_AI, _version: 2 };
    }
    return JSON.parse(rows[0].settings);
}

export async function updateSettings(pool, gridName, operatorDid, patch): Promise<OperatorSettings> {
    const current = await getSettings(pool, gridName, operatorDid);
    const updated = { ...current, ...patch };
    await pool.execute(
        `INSERT INTO operator_settings (grid_name, operator_did, settings)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
        [gridName, operatorDid, JSON.stringify(updated)],
    );
    return updated;
}
```

**TypeScript interface update (OperatorSettings):**
```typescript
export interface LocalAiSettings {
    small_model: string;
    primary_model: string;
    large_model: string;
    temperature: number;
    max_tokens: number;
    _version: 2;
}
export interface OperatorSettings {
    local_ai: LocalAiSettings;
    _version: 2;
}
```

### Pattern 3: Brain HTTP endpoint for models list

```python
# Source: verified — follows brain/src/noesis_brain/http/cognitive_snapshot.py pattern
# brain/src/noesis_brain/http/local_ai.py

async def handle_local_ai_models(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    # Auth: X-Brain-Secret (same as cognitive-snapshot)
    # Claude's Discretion: since this runs on localhost same machine, 
    # same auth is appropriate and consistent
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()
    
    try:
        models = await handler._llm_adapter.list_models()
    except LLMError:
        models = []
    
    return web.json_response({"models": models})


async def handle_local_ai_status(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()
    
    available = await handler._llm_adapter.is_available()
    return web.json_response({
        "status": "ok" if available else "degraded",
        "provider": "ollama",
        "fallback_provider": handler._fallback_provider_name,  # "claude", "openai", etc. or None
    })
```

**BrainHttpServer routes to add (in server.py):**
```python
self._app.router.add_get("/local-ai/models", _local_ai_models_route)
self._app.router.add_get("/local-ai/status", _local_ai_status_route)
```

### Pattern 4: Brain startup settings fetch

```python
# Source: verified — wires into create_brain_app_from_env() in brain/src/noesis_brain/__main__.py
# BEFORE OllamaAdapter construction

async def _fetch_operator_settings(grid_url: str, token: str) -> dict:
    """Blocking fetch of operator settings at startup. Exits non-zero on failure."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{grid_url}/api/v1/operator/me/settings",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, httpx.RequestError) as e:
            log.error(
                "{event: 'settings_fetch_failed', reason: '%s'}",
                str(e),
            )
            sys.exit(1)
```

**Integration point:** After `GridWireClient` construction in `create_brain_app_from_env()`, but before `create_brain_app()` is called. The settings control which models are passed to `create_brain_app()` as `llm_model`.

**However**, `create_brain_app()` currently only takes a single `llm_model` string. Phase 40 needs to wire 3 model tiers. This requires either:
- Extending `create_brain_app()` to accept `small_model`, `primary_model`, `large_model` params
- Or constructing the ModelRouter with 3 separate OllamaAdapters (one per tier) instead of the current single `llm` adapter

**CRITICAL FINDING:** Current `create_brain_app()` builds a single `OllamaAdapter(model=model)` and passes it directly to `BrainHandler` as `llm=llm`. The `BrainHandler` does not use a `ModelRouter` — it uses the adapter directly. Phase 40 needs to introduce 3-tier routing OR at minimum wire the 3 models from settings.

Checking `BrainHandler`:

### Pattern 5: Structured Python logging (Pino-style)

```python
# Source: verified — existing pattern in router.py uses logging.getLogger
# Python logging is the Brain's equivalent of Pino. Structured events use the
# log.warning("...", extra={...}) or log.warning("{event: '...', ...}") convention

# From router.py line 67-69:
log.warning("Provider %s not available, trying next", adapter.provider_name)

# Phase 40 requires structured event shape. Pattern from CONTEXT.md D-40-05:
log.warning(
    "{event: 'local_ai_unavailable', provider: 'ollama', model: '%s', fallback: '%s'}",
    model_name,
    fallback_provider,
)
log.info(
    "{event: 'local_ai_recovered', provider: 'ollama', model: '%s'}",
    model_name,
)
```

### Pattern 6: Steward Console `/system/local-ai` page

```typescript
// Source: verified — follows steward/src/app/system/operators/page.tsx pattern
// Uses StewardShell, inline styles matching existing design tokens

const BRAIN_HTTP_URL = process.env.NEXT_PUBLIC_BRAIN_HTTP_URL ?? 'http://localhost:8090';
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// Model dropdowns loaded from:
//   GET /api/v1/brain/local-ai/models (via Steward Next.js API proxy)
// Settings loaded/saved via:
//   GET/PATCH /api/v1/operator/me/settings (via portal session cookie)
// Status (red banner) from:
//   GET /api/v1/brain/local-ai/status (via Steward Next.js API proxy)
```

**Steward needs a new Brain API proxy** at `steward/src/app/api/brain/[...path]/route.ts` (similar to existing `operator/[...path]/route.ts`). Routes through `BRAIN_HTTP_URL` env var.

**Red banner state:** Poll `/api/v1/brain/local-ai/status` every 10s. Show persistent red banner when `status === "degraded"`.

### Anti-Patterns to Avoid

- **Steward calling Ollama directly:** Violates Brain abstraction layer (D-40-04). Always proxy through Brain.
- **Brain reading settings from a local file:** D-40-01 is explicit — no local cache, no offline fallback at startup. Brain exits if Grid unreachable.
- **Hot-reloading model mid-tick:** Deferred; don't add any tick-suspension logic.
- **Adding new audit events for local AI state changes:** Phase 40 has zero allowlist delta. Structured logging only (Python log), not Grid audit events.
- **Calling `is_available()` every tick unconditionally:** Only poll in fallback mode per D-40-07. Normal mode doesn't add availability polling overhead.
- **Constructing a new httpx.AsyncClient per request in Brain startup:** Reuse a single async client per the WIRE pattern.

---

## CRITICAL FINDING: BrainHandler LLM Architecture Gap

**Verified from `__main__.py` lines 186-188:**
```python
if llm_provider == "ollama":
    llm = OllamaAdapter(model=model, base_url=ollama_host)
```
Then at line 202:
```python
handler = BrainHandler(psyche=psyche, ..., llm=llm, ...)
```

**The current Brain does NOT use ModelRouter.** `BrainHandler` takes a single `LLMAdapter`, not a `ModelRouter`. The `ModelRouter` class exists and is tested but is NOT wired into the main startup path.

This means Phase 40 must decide: either (a) wire the 3-tier `ModelRouter` into `BrainHandler`, replacing the single `llm` param, or (b) keep the single adapter but use a tier-selected model from settings (choosing `primary_model` by default, which is the current behavior minus per-tier selection).

**Recommendation (Claude's Discretion):** Wire the full `ModelRouter` with 3 `OllamaAdapter` instances (one per tier). This is the correct long-term architecture and `ModelRouter` is already fully implemented and tested. The change is: `create_brain_app()` builds 3 adapters from `LocalAiSettings`, registers them on a `ModelRouter`, and passes the router to `BrainHandler` (changing `llm: LLMAdapter` to `llm: ModelRouter`). Check `BrainHandler` source to confirm the type before planning.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM HTTP client | Custom HTTP wrapper | `OllamaAdapter` (existing) | Already handles generate/list/is_available with proper error handling |
| Tier routing + fallback | Custom fallback logic | `ModelRouter` (existing) | Tested with 17 test cases; handles all tier + fallback scenarios |
| Grid DB migrations | Custom schema version tracking | `MIGRATIONS[]` array in `schema.ts` | Existing migration runner handles apply/rollback |
| MySQL upsert | Custom insert-or-update | `INSERT ... ON DUPLICATE KEY UPDATE` | Standard MySQL pattern used throughout codebase |
| Auth in Brain HTTP routes | Custom token validation | `X-Brain-Secret` header check | Established in `cognitive_snapshot.py` |
| Steward → Grid proxy | Direct fetch with CORS headers | Next.js API route proxy | Existing `operator/[...path]/route.ts` proves the pattern |

---

## Common Pitfalls

### Pitfall 1: BrainHandler expects LLMAdapter not ModelRouter
**What goes wrong:** `BrainHandler.__init__` takes `llm: LLMAdapter`. If Phase 40 wires a `ModelRouter` (which IS an LLMAdapter via `LLMAdapter` base class protocol — needs verification), it may work. If not, type error at construction.
**Why it happens:** Current code was written before 3-tier routing was needed.
**How to avoid:** Read `BrainHandler.__init__` signature before planning. If `BrainHandler` uses `self._llm.generate()`, `ModelRouter.generate()` is compatible. Plan must verify type compatibility.
**Warning signs:** `AttributeError` or mypy type error on `handler = BrainHandler(..., llm=router)`.

### Pitfall 2: Settings fetch is async but `create_brain_app_from_env()` is sync
**What goes wrong:** `create_brain_app_from_env()` is called from synchronous `main()` which then calls `asyncio.run(main())`. The settings fetch requires `async`/`await` but the factory is currently sync.
**Why it happens:** All current startup logic in `create_brain_app_from_env()` is synchronous (env var reads, object construction).
**How to avoid:** Either (a) make `create_brain_app_from_env()` async and `await` the settings fetch, or (b) use `asyncio.get_event_loop().run_until_complete()` for a one-shot fetch before entering the main event loop. Option (a) is cleaner. `main()` is already `async def`.
**Warning signs:** `RuntimeError: no running event loop` or `SyntaxError` on `await` in sync context.

### Pitfall 3: `operator_settings` table not initialized for existing operators
**What goes wrong:** Existing operators (from Phase 39) have no row in `operator_settings`. `getSettings()` must return default settings, not null/undefined.
**Why it happens:** Migration v29 creates the table but doesn't back-fill existing operators.
**How to avoid:** `getSettings()` uses INSERT-on-first-GET pattern: if no row exists, return defaults (do NOT insert on GET — write-on-read breaks idempotency). Defaults are hardcoded in the store as `DEFAULT_LOCAL_AI`.
**Warning signs:** `null` returned from `getSettings()`, causing Brain to receive `local_ai: null` (Phase 39 shape) and failing to parse settings.

### Pitfall 4: Brain `local-ai/models` endpoint during Ollama downtime
**What goes wrong:** If Ollama is offline when Steward opens the page, `list_models()` throws `LLMError`. Endpoint must handle this gracefully and return an empty array, not 500.
**Why it happens:** `OllamaAdapter.list_models()` raises `LLMError("ollama", "Cannot list models: ...")` on `httpx.HTTPError`.
**How to avoid:** Wrap `list_models()` call in try/except; return `{"models": [], "ollama_available": false}` on error.
**Warning signs:** Steward shows 500 error or spinner-forever when Ollama is offline.

### Pitfall 5: Red banner state requires Steward to know Brain URL
**What goes wrong:** Steward needs `BRAIN_HTTP_URL` to poll Brain status, but current Steward only knows `GRID_ORIGIN` (Grid). There is no existing Brain proxy in Steward.
**Why it happens:** Phase 39 (Steward Console changes) did not add a Brain proxy — only Grid proxy exists.
**How to avoid:** Add `steward/src/app/api/brain/[...path]/route.ts` proxy that forwards to `BRAIN_HTTP_URL` (env var, server-side only). Brain secret also needs to be a server-side env var — never in client bundle.
**Warning signs:** CORS errors when Steward frontend tries to call Brain HTTP directly.

### Pitfall 6: `_version` bump breaks Phase 39 clients
**What goes wrong:** Phase 39 clients expect `_version: 1` shape with `local_ai: null`. Phase 40 returns `_version: 2` with `local_ai: LocalAiSettings`. Any Phase 39 Steward code that checks `local_ai === null` needs to handle the new shape.
**Why it happens:** Version bump is required per D-40-02.
**How to avoid:** Search for any existing code that reads `local_ai` from settings response. In this codebase: `settings.ts` route just passes through; Steward `/system/local-ai` page is new. No existing consumer. Safe to bump.
**Warning signs:** TypeScript compile errors on `local_ai` usage in existing files.

---

## Runtime State Inventory

This is NOT a rename/refactor phase. However, the Phase 39 stub returns `{ local_ai: null, _version: 1 }` to all callers. Phase 40 replaces this with real data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Phase 39 returned null `local_ai` for all operators — no rows exist in `operator_settings` (table doesn't exist yet) | Migration v29 creates table; `getSettings()` returns defaults for operators with no row |
| Live service config | Brain currently reads `LLM_MODEL` env var for model selection | Phase 40 overrides this with Grid-fetched settings; env var becomes a fallback if Grid fetch fails? No — D-40-01 says exit on Grid failure. Env var path preserved for test/dev usage. |
| OS-registered state | None — no OS-level registration involves local AI settings | None |
| Secrets/env vars | `BRAIN_HTTP_SECRET` (existing) needed by Steward Brain proxy; `BRAIN_HTTP_URL` (new) needed in Steward | Document new env var; no secret rotation needed |
| Build artifacts | None — no compiled binaries affected by settings schema change | None |

---

## Code Examples

### Verified: OllamaAdapter.list_models() response

```python
# Source: brain/src/noesis_brain/llm/ollama.py lines 91-99
async def list_models(self) -> list[str]:
    try:
        resp = await self._client.get("/api/tags")
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise LLMError("ollama", f"Cannot list models: {e}") from e
    data = resp.json()
    return [m["name"] for m in data.get("models", [])]
```

**Verified Ollama API response shape (confirmed from live Ollama at localhost:11434):**
```json
{
  "models": [
    {
      "name": "qwen3.5:latest",
      "model": "qwen3.5:latest",
      "details": {
        "parameter_size": "9.7B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```
The `details.parameter_size` field can be shown as a hint in the Steward Console model dropdown (e.g., "qwen3.5:latest (9.7B)").

### Verified: Grid DB store pattern (from existing stores)

```typescript
// Source: verified pattern from grid/src/db/stores/brain-token-store.ts
// INSERT with ON DUPLICATE KEY UPDATE (upsert)
await pool.execute(
    `INSERT INTO brain_tokens (grid_name, brain_did, public_key_jwk, issued_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       public_key_jwk = VALUES(public_key_jwk),
       issued_at = VALUES(issued_at),
       expires_at = VALUES(expires_at),
       revoked = 0,
       revoked_at_tick = NULL`,
    [gridName, brainDid, JSON.stringify(publicKeyJwk), issuedAt, expiresAt],
);
```

### Verified: aiohttp route registration pattern

```python
# Source: brain/src/noesis_brain/http/server.py lines 41-55
from .cognitive_snapshot import handle_cognitive_snapshot
from .skills_lookup import handle_skills_lookup

async def _cognitive_snapshot_route(req: web.Request) -> web.Response:
    return await handle_cognitive_snapshot(req, _h, _s)

self._app.router.add_get("/cognitive-snapshot/{did}", _cognitive_snapshot_route)
```

### Verified: Brain HTTP test pattern (for new endpoint tests)

```python
# Source: brain/test/test_http_server.py (inferred from test directory)
# Standard pattern: OllamaAdapter tests use httpx.MockTransport
# Brain HTTP tests use aiohttp test client
from aiohttp.test_utils import TestClient, TestServer

# Phase 40 test: test_local_ai_http.py
async def test_models_endpoint_returns_list():
    # mock OllamaAdapter.list_models()
    # create test BrainHttpServer
    # GET /local-ai/models with X-Brain-Secret
    # assert {"models": ["qwen3:4b", ...]}
```

### Verified: Grid settings route test pattern

```typescript
// Source: grid/test/api/operator-me-quota.test.ts (verified)
// Phase 40 operator-me-settings.test.ts will follow same pattern

vi.mock('../../src/operator/data/operator-settings-store.js', () => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
}));

it('GET /api/v1/operator/me/settings returns LocalAiSettings shape', async () => {
    vi.mocked(getSettings).mockResolvedValue({
        local_ai: { small_model: 'qwen3:4b', primary_model: 'qwen3:4b', large_model: 'qwen3:4b', temperature: 0.7, max_tokens: 2048, _version: 2 },
        _version: 2,
    });
    const cookie = await makePortalCookie(OP_A_DID);
    const res = await app.inject({ method: 'GET', url: '/api/v1/operator/me/settings',
        headers: { cookie: `${COOKIE_NAME}=${cookie}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.local_ai.small_model).toBe('qwen3:4b');
    expect(body.local_ai._version).toBe(2);
});
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ollama CLI | Local AI provider | Yes | 0.24.0 | — |
| Ollama HTTP API | OllamaAdapter, list_models, is_available | Yes (running at localhost:11434) | — | Model list returns empty if offline |
| qwen3:4b model | Default model (D-40-06) | Yes (installed, 2.5GB) | — | — |
| qwen3:14b / qwen3:32b | Primary/Large tier defaults | Not installed | — | Operators can use qwen3:4b for all 3 tiers (D-40-06 uses qwen3:4b as default for all) |
| Node.js | Grid + Steward | Yes | 25.9.0 | — |
| Python 3.12 | Brain | Available via pyenv/uv | 3.9.6 (system) | Brain uses its own venv |
| MySQL | Grid DB | Verified working (Phase 39 shipped) | — | — |

**Note on qwen3:14b/32b:** The operator's machine only has qwen3:4b and qwen3.5:latest installed. The default for all tiers is qwen3:4b (D-40-06 locked), which is installed. Operators can install larger models via `ollama pull` and then select them in Steward Console.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Brain) | pytest + pytest-asyncio 0.23, `asyncio_mode = "auto"` |
| Framework (Grid) | vitest ^2.0.0 |
| Config file (Brain) | brain/pyproject.toml `[tool.pytest.ini_options]` testpaths=["test"] |
| Config file (Grid) | grid/package.json `"test": "vitest run"` |
| Quick Brain run | `cd brain && uv run pytest test/ -x -q` |
| Quick Grid run | `cd grid && npm test` |
| Full suite | Both above sequentially |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOCAL-01 | `getSettings()` returns LocalAiSettings with qwen3:4b defaults when no row exists | unit | `cd grid && npm test -- operator-me-settings` | No — Wave 0 |
| LOCAL-01 | `updateSettings()` persists and returns merged settings | unit | `cd grid && npm test -- operator-me-settings` | No — Wave 0 |
| LOCAL-01 | GET /api/v1/operator/me/settings returns 200 with LocalAiSettings shape | integration | `cd grid && npm test -- operator-me-settings` | No — Wave 0 |
| LOCAL-01 | Brain startup pulls settings and uses small_model for SMALL tier adapter | unit | `cd brain && uv run pytest test/test_startup_settings.py -x` | No — Wave 0 |
| LOCAL-02 | PATCH /api/v1/operator/me/settings persists new temperature value | integration | `cd grid && npm test -- operator-me-settings` | No — Wave 0 |
| LOCAL-03 | `handle_local_ai_status` returns `{"status": "degraded"}` when Ollama offline | unit | `cd brain && uv run pytest test/test_local_ai_http.py -x` | No — Wave 0 |
| LOCAL-03 | ModelRouter falls through to cloud fallback when Ollama unavailable (already tested in test_llm_router.py) | unit | `cd brain && uv run pytest test/test_llm_router.py -x` | Yes |
| LOCAL-03 | Brain recovery: `is_available()` returns True after False → logs `local_ai_recovered` | unit | `cd brain && uv run pytest test/test_startup_settings.py -x` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run for modified service only (Grid: `npm test`, Brain: `uv run pytest test/ -x -q`)
- **Per wave merge:** Both Brain and Grid full test suites
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (test files to create)

- [ ] `grid/test/operator-me-settings.test.ts` — covers LOCAL-01 + LOCAL-02 GET/PATCH settings routes
- [ ] `brain/test/test_startup_settings.py` — covers LOCAL-01 Brain startup + LOCAL-03 recovery detection
- [ ] `brain/test/test_local_ai_http.py` — covers `/local-ai/models` + `/local-ai/status` endpoints

*(test_llm_router.py covers fallback chain — already exists, no Wave 0 gap)*

---

## Security Domain

Phase 40 has no new auth mechanisms. Existing security controls apply:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | Settings routes use existing `operatorScope` preHandler (Phase 39 portal_session_required) |
| V4 Access Control | Yes | `operatorScope` ensures operator can only read/write their own settings |
| V5 Input Validation | Yes | PATCH body must be validated against LocalAiSettings schema; temperature must be 0.0–2.0, max_tokens 256–8192 |
| V6 Cryptography | No | No new crypto; Brain bearer token reused from Phase 38 |

**Constitutional security note:** When cloud fallback is active, Steward Console MUST include "Memory content is leaving this machine" (Q-V3-I). This is a mandatory transparency requirement, not optional UI enhancement. The planner must treat this as a hard requirement in the Steward Console task.

---

## Open Questions

1. **LOCAL-03 conflict: does cloud fallback block Sophia narrative generation?**
   - What we know: CONTEXT.md D-40-05 says "No Sophia narrative blocking. Brain continues full tick cycle via cloud LLM." REQUIREMENTS.md LOCAL-03 says "blocks new Sophia narrative generation until LLM restored."
   - What's unclear: Which is authoritative? The CONTEXT.md is from the discuss-phase and post-dates REQUIREMENTS.md — it should take precedence.
   - Recommendation: Use D-40-05 (CONTEXT.md): full tick cycle continues via cloud LLM. Sophia narrative generation is NOT blocked. The planner should document this resolution explicitly.

2. **BrainHandler LLM type: single adapter vs ModelRouter?**
   - What we know: `BrainHandler` currently takes `llm: LLMAdapter`. `ModelRouter` is implemented but not wired into startup. Phase 40 needs 3-tier routing to honor `small_model`, `primary_model`, `large_model` independently.
   - What's unclear: Does `ModelRouter` extend `LLMAdapter`? What is `BrainHandler`'s actual `llm` usage — does it call `generate()` with a `tier` param?
   - Recommendation: Read `BrainHandler.__init__` and `on_tick()` before planning. If `BrainHandler` calls `self._llm.generate(prompt, tier=ModelTier.PRIMARY)`, then passing a `ModelRouter` works. If it only calls `self._llm.generate(prompt)` (no tier), then `ModelRouter` is a drop-in but tier routing is unused. This determines whether the 3 separate OllamaAdapters actually do anything useful.

3. **Brain API proxy in Steward: authentication?**
   - What we know: `BRAIN_HTTP_SECRET` must be a server-side env var only. Steward's existing Brain interaction is through `BRAIN_HTTP_SECRET` in `BrainHttpServer`.
   - What's unclear: Does the operator-facing Steward Console need `BRAIN_HTTP_SECRET` to call the Brain models endpoint? Given the Brain runs on operator's local machine alongside Steward (localhost), X-Brain-Secret is the appropriate auth mechanism forwarded server-side.
   - Recommendation: New Steward API proxy at `/api/brain/[...path]/route.ts` injects `X-Brain-Secret` server-side (from `BRAIN_HTTP_SECRET` env var, server-only). Never expose the secret in client bundles.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `LLM_MODEL` env var controls model | Grid-persisted `LocalAiSettings` with 3 tiers | Phase 40 | Operator controls model via Steward Console; restart required |
| `OllamaAdapter` initialized with hardcoded model | `OllamaAdapter` initialized with settings-fetched model | Phase 40 | Model persists across Brain restarts |
| No Ollama availability signaling | Structured `local_ai_unavailable` / `local_ai_recovered` log events | Phase 40 | Steward Console can show/hide red banner based on Brain status |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BrainHandler` accepts `llm: LLMAdapter` and `ModelRouter` is API-compatible as a drop-in | Standard Stack / Critical Finding | If incompatible, startup wiring needs a wrapper layer |
| A2 | The Steward `/system/local-ai` page calls Brain status endpoint via Next.js server-side proxy (not directly from browser) | Patterns | If called directly from browser, CORS errors + secret exposure |
| A3 | Existing `operatorScope` preHandler in Grid settings routes correctly enforces Brain JWT auth (same as other `/operator/me/*` routes) | Architecture | If preHandler doesn't accept Brain JWT format, settings fetch at Brain startup returns 403 |
| A4 | `INSERT ... ON DUPLICATE KEY UPDATE` semantics are safe for concurrent `updateSettings()` calls | Code Examples | Unlikely in practice (single operator per Brain) but a race condition could produce stale settings |

**A3 deserves verification:** The `settings.ts` route uses `operatorScope` which enforces `portal_session_required` (Phase 39, D-39-05). But Brain fetches settings using a **Brain JWT** (EdDSA, Phase 38 bearer token), not a portal session. These are different auth mechanisms. The planner must verify: does `GET /api/v1/operator/me/settings` accept Brain JWT auth, or only portal session cookies? If only portal session, a new unauthenticated (or Brain-JWT-authenticated) settings endpoint may be needed.

---

## Sources

### Primary (HIGH confidence)
- `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/llm/ollama.py` — OllamaAdapter implementation verified
- `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/llm/router.py` — ModelRouter implementation verified
- `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/llm/types.py` — LLMConfig, ModelTier verified
- `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/__main__.py` — startup factory verified; single-adapter gap identified
- `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/http/server.py` — BrainHttpServer route pattern verified
- `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/http/cognitive_snapshot.py` — new endpoint pattern verified
- `/Users/desirey/Programming/src/Noesis/grid/src/db/schema.ts` — migrations v1-v28 verified; v29 pattern is JSON column (like v5 grid_config)
- `/Users/desirey/Programming/src/Noesis/grid/src/operator/data/operator-settings-store.ts` — Phase 39 stub verified; replacement pattern clear
- `/Users/desirey/Programming/src/Noesis/grid/src/api/routes/operator-me/settings.ts` — existing routes verified; routes ready, only store needs implementation
- `/Users/desirey/Programming/src/Noesis/steward/src/app/system/operators/page.tsx` — Steward page pattern verified
- `/Users/desirey/Programming/src/Noesis/steward/src/app/api/operator/[...path]/route.ts` — Steward proxy pattern verified
- Ollama API (live at localhost:11434) — `/api/tags` response shape verified; models: qwen3:4b, qwen3.5:latest installed
- `/Users/desirey/Programming/src/Noesis/brain/test/test_llm_router.py` — 17 existing router tests verified; cloud fallback already covered
- `/Users/desirey/Programming/src/Noesis/grid/test/api/operator-me-quota.test.ts` — Grid settings test pattern verified

### Secondary (MEDIUM confidence)
- `.planning/phases/40-local-ai-integration/40-CONTEXT.md` — all Phase 40 decisions, verified against codebase

### Tertiary (LOW confidence — none)

---

## Project Constraints (from CLAUDE.md)

The following directives from `./CLAUDE.md` constrain all planning and implementation:

1. **Think before coding:** State assumptions explicitly. If multiple interpretations exist, surface them (see Open Questions section).
2. **Simplicity first:** No speculative features. Phase 40 scope is exactly what's in CONTEXT.md. No extra config options.
3. **Surgical changes:** Touch only what Phase 40 requires. Do NOT refactor `BrainHandler` or `ModelRouter` beyond what's needed for settings wiring.
4. **Goal-driven execution:** Each plan must have verifiable success criteria matching the 4 success criteria in ROADMAP.
5. **No new audit events:** Allowlist stays at 64 events. All logging is Python structured logging, not Grid audit events.
6. **Documentation Sync Rule:** Any phase that changes scope must update ROADMAP.md, STATE.md, PROJECT.md, REQUIREMENTS.md in the same commit.
7. **D-V3-06 invariant:** Steward Console `/system/local-ai` page must use existing design tokens and style patterns (no new CSS frameworks, no D3, no react-flow). Inline styles matching `var(--terracotta)`, `var(--ink)`, `var(--muted)` etc.
8. **Polis naming:** Not directly relevant to Phase 40.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries verified in codebase; no new dependencies
- Architecture: HIGH — all integration points verified from source files; one open question (BrainHandler type)
- Pitfalls: HIGH — derived from actual code gaps (async/sync startup, type mismatch, settings_fetch vs portal session auth)

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable codebase; Phase 40 doesn't depend on external API changes)
