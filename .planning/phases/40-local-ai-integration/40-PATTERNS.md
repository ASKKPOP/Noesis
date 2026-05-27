# Phase 40: Local AI Integration - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 11
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/operator/data/operator-settings-store.ts` | service (data store) | CRUD | `grid/src/operator/data/operator-quota-store.ts` | exact |
| `grid/src/db/schema.ts` | config (migration) | batch | `grid/src/db/schema.ts` v5 (`grid_config`) | exact |
| `grid/src/api/routes/operator-me/settings.ts` | route | request-response | itself (Phase 39 stub — routes already correct) | verify-only |
| `brain/src/noesis_brain/http/local_ai.py` | handler | request-response | `brain/src/noesis_brain/http/cognitive_snapshot.py` | exact |
| `brain/src/noesis_brain/http/server.py` | config (route wiring) | request-response | itself (add 2 routes following existing pattern) | exact |
| `brain/src/noesis_brain/__main__.py` | config (startup wiring) | request-response | itself (`create_brain_app_from_env` + `GridWireClient` wiring block) | exact |
| `steward/src/app/system/local-ai/page.tsx` | component | request-response | `steward/src/app/system/operators/page.tsx` | exact |
| `steward/src/app/api/brain/[...path]/route.ts` | middleware (proxy) | request-response | `steward/src/app/api/operator/[...path]/route.ts` | exact |
| `grid/test/operator-me-settings.test.ts` | test | request-response | `grid/test/api/operator-me-quota.test.ts` | exact |
| `brain/test/test_local_ai_http.py` | test | request-response | `brain/test/test_http_server.py` + `brain/test/test_llm_ollama.py` | exact |
| `brain/test/test_startup_settings.py` | test | request-response | `brain/test/test_llm_ollama.py` (httpx mock pattern) | role-match |

---

## Pattern Assignments

### `grid/src/operator/data/operator-settings-store.ts` (service, CRUD)

**Analog:** `grid/src/operator/data/operator-quota-store.ts`

**Imports pattern** (quota-store.ts lines 1-5):
```typescript
import type { Pool, RowDataPacket } from 'mysql2/promise';
```
Phase 40 needs the same import. No additional types needed beyond `Pool`.

**Interface pattern** (quota-store.ts lines 7-11):
```typescript
export interface QuotaRecord {
    brainProcessLimit: number;
    eventRatePerDidPerMin: number;
    p2pBandwidthCapBytes: number | null;
}
```
Replace with `LocalAiSettings` and `OperatorSettings` interfaces per D-40-02. The existing file has `OperatorSettings { local_ai: null; _version: 1 }` at lines 8-11 — replace both the interface and the default constant.

**CRUD read pattern — SELECT with default fallback** (quota-store.ts lines 13-33):
```typescript
export async function getQuotaLimit(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<number> {
    const [rows] = await pool.query<Array<{ config_value: string } & RowDataPacket>>(
        `SELECT config_value FROM grid_config
         WHERE grid_name = ? AND config_key = ? LIMIT 1`,
        [gridName, operatorDid],
    );
    return rows[0] ? (JSON.parse(rows[0].config_value) as number) : 3;
}
```
For `getSettings`: use `pool.execute(SELECT settings FROM operator_settings WHERE grid_name = ? AND operator_did = ?)`. If no row, return `DEFAULT_LOCAL_AI` constant — do NOT insert on GET (Pitfall 3 from RESEARCH.md).

**CRUD upsert pattern** (quota-store.ts lines 77-96):
```typescript
await pool.query(
    `INSERT INTO operator_quota_overrides
         (grid_name, operator_did, brain_process_limit, ...)
     VALUES (?, ?, ?, ...)
     ON DUPLICATE KEY UPDATE
         brain_process_limit = VALUES(brain_process_limit), ...`,
    [gridName, operatorDid, limit, rate, bw],
);
```
For `updateSettings`: use single `settings JSON` column with `INSERT INTO operator_settings (grid_name, operator_did, settings) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE settings = VALUES(settings)`. Merge current+patch before JSON.stringify.

**Full function signature pattern** (quota-store.ts lines 56-74 — `getFullQuota`):
```typescript
export async function getFullQuota(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<QuotaRecord> {
    const [rows] = await pool.query<Array<QuotaRecord & RowDataPacket>>(...);
    if (rows[0]) return rows[0];
    // Defaults
    ...
}
```
Phase 40 `getSettings` and `updateSettings` follow the exact same `(pool, gridName, operatorDid, ...)` signature. The CI gate (`check-operator-scope-typing.mjs`) requires `operatorDid: string` in all exported functions — this is already satisfied by the stub signature at operator-settings-store.ts lines 19-26.

---

### `grid/src/db/schema.ts` (config — migration addition)

**Analog:** `grid/src/db/schema.ts` migration v5 (lines 88-102)

**Migration entry pattern** (schema.ts lines 88-102):
```typescript
{
    version: 5,
    name: 'create_grid_config',
    up: `
        CREATE TABLE IF NOT EXISTS grid_config (
            grid_name    VARCHAR(63)  NOT NULL,
            config_key   VARCHAR(127) NOT NULL,
            config_value JSON         NOT NULL,
            updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, config_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS grid_config`,
},
```
Phase 40 migration v29 follows this identical structure. Replace `config_key/config_value` with `operator_did VARCHAR(255) NOT NULL` + `settings JSON NOT NULL`. Primary key is `(grid_name, operator_did)`. Add `ON UPDATE CURRENT_TIMESTAMP(3)` to `updated_at` column as in v5.

The full `MIGRATIONS` array is append-only — push the new entry at the end. Do not renumber.

---

### `grid/src/api/routes/operator-me/settings.ts` (route — verify only)

**Analog:** itself (Phase 39 stub, lines 1-38)

This file is already correct for Phase 40. The routes call `getSettings` and `updateSettings` with the right signatures. The only dependency is that the store implementation changes. **Planner: no code changes needed in this file** — verify it compiles cleanly after the store interface update.

**Existing route structure** (settings.ts lines 16-38):
```typescript
app.get('/api/v1/operator/me/settings', async (req, reply) => {
    const operatorDid = await operatorScope(req, reply);
    if (!operatorDid) return; // 403 already sent
    const { pool, gridName } = services;
    if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
    const settings = await getSettings(pool, gridName, operatorDid);
    return reply.code(200).send(settings);
});

app.patch<{ Body: Record<string, unknown> }>('/api/v1/operator/me/settings', async (req, reply) => {
    const operatorDid = await operatorScope(req, reply);
    if (!operatorDid) return; // 403 already sent
    const { pool, gridName } = services;
    if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
    const patch = (req.body ?? {}) as Record<string, unknown>;
    const updated = await updateSettings(pool, gridName, operatorDid, patch as never);
    return reply.code(200).send(updated);
});
```

**Critical open question (A3 from RESEARCH.md):** `operatorScope` enforces portal session cookie (D-39-05). Brain fetches settings using a **Brain JWT bearer token** (Phase 38 mechanism), not a portal cookie. These are different auth paths. The planner MUST verify whether the Brain JWT is accepted by `operatorScope` or whether a second, Brain-JWT-authenticated endpoint is needed for the Brain startup fetch. Check `grid/src/api/preHandlers/operatorScope.ts` before planning the Brain startup task.

---

### `brain/src/noesis_brain/http/local_ai.py` (handler, request-response)

**Analog:** `brain/src/noesis_brain/http/cognitive_snapshot.py`

**Imports pattern** (cognitive_snapshot.py lines 1-32):
```python
from __future__ import annotations
from typing import TYPE_CHECKING
from aiohttp import web
if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler
```
Identical imports for `local_ai.py`. No additional imports needed — `OllamaAdapter` is accessed via `handler._llm` (or the primary tier adapter).

**Auth gate pattern** (cognitive_snapshot.py lines 53-55):
```python
if request.headers.get("X-Brain-Secret", "") != secret:
    raise web.HTTPUnauthorized()
```
Copy verbatim to both `handle_local_ai_models` and `handle_local_ai_status`. X-Brain-Secret is the only auth mechanism for Brain HTTP endpoints.

**Handler function signature pattern** (cognitive_snapshot.py lines 43-47):
```python
async def handle_cognitive_snapshot(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
```
`handle_local_ai_models` and `handle_local_ai_status` use the same 3-argument signature. The `secret` arg is captured from the BrainHttpServer closure (see server.py lines 45-46).

**JSON response pattern** (cognitive_snapshot.py lines 75-81):
```python
return web.json_response({
    "drive_levels": drive_levels,
    "last_sleep_tick": handler._last_sleep_tick,
    ...
})
```
For models: `return web.json_response({"models": models, "ollama_available": True})`. For status: `return web.json_response({"status": "ok" | "degraded", "provider": "ollama", "fallback_provider": ...})`.

**Error/unavailability pattern** (skills_lookup.py lines 37-42):
```python
memory = getattr(handler, "memory", None)
if memory is None:
    return web.json_response({"error": "unavailable"}, status=503)
```
For models: wrap `list_models()` in try/except `LLMError` and return `{"models": [], "ollama_available": False}` on failure (Pitfall 4 from RESEARCH.md — never 500 when Ollama is offline).

---

### `brain/src/noesis_brain/http/server.py` (config — route wiring)

**Analog:** itself (lines 40-55)

**Route registration pattern** (server.py lines 40-55):
```python
from .cognitive_snapshot import handle_cognitive_snapshot  # noqa: PLC0415
from .skills_lookup import handle_skills_lookup            # noqa: PLC0415

_h = self._handler
_s = self._secret

async def _cognitive_snapshot_route(req: web.Request) -> web.Response:
    return await handle_cognitive_snapshot(req, _h, _s)

async def _skills_lookup_route(req: web.Request) -> web.Response:
    return await handle_skills_lookup(req, _h, _s)

self._app.router.add_get("/cognitive-snapshot/{did}", _cognitive_snapshot_route)
self._app.router.add_get("/skills/{hash}", _skills_lookup_route)
```

Phase 40 adds inside `__init__`, following the same closure pattern:
```python
from .local_ai import handle_local_ai_models, handle_local_ai_status  # noqa: PLC0415

async def _local_ai_models_route(req: web.Request) -> web.Response:
    return await handle_local_ai_models(req, _h, _s)

async def _local_ai_status_route(req: web.Request) -> web.Response:
    return await handle_local_ai_status(req, _h, _s)

self._app.router.add_get("/local-ai/models", _local_ai_models_route)
self._app.router.add_get("/local-ai/status", _local_ai_status_route)
```

Place the new import alongside the existing `cognitive_snapshot` import at lines 41-42. Place the route wrappers and `add_get` calls after the existing routes at lines 54-55.

---

### `brain/src/noesis_brain/__main__.py` (config — startup wiring)

**Analog:** itself (`create_brain_app_from_env`, lines 251-320)

**GridWireClient wiring pattern** (__main__.py lines 287-313 — the established "add async block in env factory" pattern):
```python
# Wire the HTTP server (requires BRAIN_HTTP_SECRET in env).
app.http_server = _build_http_server(app.handler)

# Phase 38 WIRE-01 (D-38-A2): wire GridWireClient when GRID_URL + DID env vars are set.
if grid_url:
    civic_did = os.environ.get("CIVIC_DID")
    nous_did = ...
    if civic_did and nous_did:
        from noesis_brain.wire.client import GridWireClient  # noqa: PLC0415
        ...
        app.handler._grid_wire_client = grid_wire_client
        log.info("[Brain] GridWireClient wired: ...")
    else:
        log.warning("[Brain] GRID_URL set but CIVIC_DID/NOUS_DID missing ...")
```
Phase 40 adds a **settings fetch block** BEFORE `create_brain_app()` is called, inside `create_brain_app_from_env()`. The block is async-compatible because `main()` is `async def` and `create_brain_app_from_env()` must be made `async` (Pitfall 2 from RESEARCH.md).

**httpx async client pattern** (wire/client.py):
```python
import httpx
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
        log.error("{event: 'settings_fetch_failed', reason: '%s'}", str(e))
        sys.exit(1)
```

**Token construction pattern** (__main__.py lines 295-302):
```python
signing_key = derive_existence_signing_key(nous_did)
token_manager = TokenManager(
    existence_did=nous_did,
    civic_did=civic_did,
    signing_key=signing_key,
)
```
For settings fetch: reuse the `token_manager` already constructed for `GridWireClient`. Call `token_manager.get_token()` to obtain the Bearer JWT before the `httpx.AsyncClient` call.

**Startup failure pattern** (validate_grid_url in wire/client.py lines 44-59):
```python
if not condition:
    raise ValueError("clear error message")
```
For settings fetch failure: `log.error(...)` then `sys.exit(1)` — matches D-40-01 "exit non-zero". Use `sys.exit(1)`, not `raise SystemExit` — consistent with Python convention.

**CRITICAL NOTE (RESEARCH.md Critical Finding):** `create_brain_app()` currently takes `llm_model: str` (single model). Phase 40 needs to pass 3 model names from `LocalAiSettings`. The factory signature must be extended OR `create_brain_app_from_env()` constructs the 3 `OllamaAdapter` instances directly and passes a pre-built `ModelRouter` to `create_brain_app()`. The planner must choose approach and verify `BrainHandler.__init__` accepts `ModelRouter` (it takes `llm: LLMAdapter`; `ModelRouter` must satisfy the `LLMAdapter` protocol — check `router.py` line 14: `ModelRouter` does NOT inherit `LLMAdapter` directly). **Read `brain/src/noesis_brain/rpc/handler.py` before planning this task.**

---

### `steward/src/app/system/local-ai/page.tsx` (component, request-response)

**Analog:** `steward/src/app/system/operators/page.tsx`

**File-level structure** (operators/page.tsx lines 1-11):
```typescript
'use client';

/**
 * Phase 39 — Steward Console /system/operators
 * Tier-2 Grid Manager surface (D-V3-36 / D-39-07).
 * ...
 */
import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';
```
Phase 40 page starts identically: `'use client'`, jsdoc comment referencing Phase 40 + D-V3-36 Tier-1 surface, same React imports, same `StewardShell` wrapper.

**Data loading pattern** (operators/page.tsx lines 32-56):
```typescript
useEffect(() => {
    async function load() {
        try {
            const res = await fetch('/api/v1/grid-manager/operator-overview', {
                credentials: 'include',
            });
            if (!res.ok) {
                setError(`Grid API returned ${res.status}`);
                return;
            }
            const data = await res.json() as { ... };
            setUnowned(data.unowned_brains ?? []);
            setOperators(data.operators ?? []);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }
    void load();
}, []);
```
Phase 40 uses two `useEffect` calls:
1. Load settings on mount: `fetch('/api/v1/operator/me/settings', { credentials: 'include' })`
2. Load models: `fetch('/api/brain/local-ai/models')` (via Steward Brain proxy — no `credentials: 'include'` since Brain proxy injects X-Brain-Secret server-side)
3. Status polling (every 10s): `fetch('/api/brain/local-ai/status')` via `setInterval` — clear on unmount.

**Error banner pattern** (operators/page.tsx lines 68-72):
```tsx
{error && (
    <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
        Error loading operator overview: {error}
    </div>
)}
```
Red banner for `status === 'degraded'` follows the same `bg-red-50 border border-red-200` pattern. Constitutional requirement (Q-V3-I D-40-05): banner text MUST include both which cloud provider is active AND "Memory content is leaving this machine."

**Warning/informational banner pattern** (operators/page.tsx lines 148-152):
```tsx
<div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
    Edit controls will be activated when the Grid Manager admin write API is wired.
</div>
```
"Restart Brain to apply" banner uses same `text-amber-600 bg-amber-50 border-amber-200` pattern — shown after any successful PATCH, dismissed on next page load.

**Page shell pattern** (operators/page.tsx lines 58-65):
```tsx
return (
    <StewardShell>
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-1">...</h1>
            <p className="text-sm text-gray-500 mb-6">...</p>
```
Phase 40 page wraps in `<StewardShell>` with identical `p-6 max-w-5xl mx-auto` container. No new CSS framework — Tailwind utility classes only (existing ones in operators page).

**Save/PATCH pattern:** No direct analog in operators page (it doesn't write yet). Pattern comes from standard controlled-form in React — `useState` for each field, `onClick` on Save button calls `fetch('/api/v1/operator/me/settings', { method: 'PATCH', credentials: 'include', body: JSON.stringify(draft) })`.

---

### `steward/src/app/api/brain/[...path]/route.ts` (middleware proxy, request-response)

**Analog:** `steward/src/app/api/operator/[...path]/route.ts`

**Full proxy structure** (operator/[...path]/route.ts lines 1-64 — copy and adapt):
```typescript
import { NextRequest, NextResponse } from 'next/server';

const GRID_ORIGIN = process.env.GRID_ORIGIN ?? process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const STEWARD_OPERATOR_ID = process.env.STEWARD_OPERATOR_ID ?? ...;

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
    const gridPath = path.join('/');
    const gridUrl = `${GRID_ORIGIN}/api/v1/operator/${gridPath}`;

    const headers: Record<string, string> = {
        'x-operator-id': STEWARD_OPERATOR_ID,
    };
    // ... forward content-type, body
    const upstream = await fetch(gridUrl, { method: req.method, headers, body });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
}

export async function POST(req, { params }) { ... }
export async function GET(req, { params }) { ... }
```

Phase 40 Brain proxy changes:
- Replace `GRID_ORIGIN` + `STEWARD_OPERATOR_ID` with `BRAIN_HTTP_URL` + `BRAIN_HTTP_SECRET` env vars
- Replace `x-operator-id` header injection with `X-Brain-Secret` header injection
- Target URL: `${BRAIN_HTTP_URL}/${path.join('/')}` (no `/api/v1/` prefix — Brain routes are at root)
- Export only `GET` handler (Brain local-ai endpoints are GET-only)
- `BRAIN_HTTP_SECRET` is server-side only (no `NEXT_PUBLIC_` prefix) — never in client bundle (Pitfall 5 from RESEARCH.md)

---

### `grid/test/operator-me-settings.test.ts` (test, request-response)

**Analog:** `grid/test/api/operator-me-quota.test.ts`

**Test file structure** (operator-me-quota.test.ts lines 1-55):
```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../../src/operator/data/operator-settings-store.js', () => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
}));

import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SignJWT } from 'jose';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';
```
Phase 40 settings test has identical imports. Mock `operator-settings-store.js` (not quota-store). Import `getSettings` and `updateSettings` from the store for `vi.mocked()` calls.

**Portal cookie helper** (operator-me-quota.test.ts lines 34-43):
```typescript
const OP_A_DID = 'did:portal:noesis:operator-a';

async function makePortalCookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}
```
Copy verbatim — same DID format (must use `did:portal:noesis:*` to match `ANY_DID_RE`, per test file comment line 33).

**Test app builder** (operator-me-quota.test.ts lines 45-55):
```typescript
function buildTestApp(pool?: object): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        registry: new NousRegistry(),
        pool: pool as import('mysql2/promise').Pool,
    });
}
```
Copy verbatim — `pool: {}` for route-level tests that mock the store layer.

**it() pattern** (operator-me-quota.test.ts lines 69-96):
```typescript
it('returns 200 with shape {...}', async () => {
    vi.mocked(getFullQuota).mockResolvedValue({ ... });
    const cookie = await makePortalCookie(OP_A_DID);
    const res = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/me/quota',
        cookies: { [COOKIE_NAME]: cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ... }>();
    expect(body.brain_processes.current).toBe(...);
});
```
Phase 40 tests use `vi.mocked(getSettings).mockResolvedValue({ local_ai: { small_model: 'qwen3:4b', ... }, _version: 2 })`. PATCH test uses `app.inject({ method: 'PATCH', url: '/api/v1/operator/me/settings', cookies: ..., payload: { local_ai: { temperature: 1.0 } } })`.

**Auth test** (operator-me-quota.test.ts lines 155-161):
```typescript
it('returns 401 when no Portal session cookie is present', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/operator/me/quota' });
    expect(res.statusCode).toBe(401);
});
```
Include identical test for settings routes.

---

### `brain/test/test_local_ai_http.py` (test, request-response)

**Analog:** `brain/test/test_http_server.py` + `brain/test/test_llm_ollama.py`

**aiohttp test client pattern** (test_http_server.py lines 1-66):
```python
from __future__ import annotations
import pytest
from unittest.mock import MagicMock
from aiohttp import web
from noesis_brain.http.server import BrainHttpServer

def _make_mock_handler() -> MagicMock:
    handler = MagicMock()
    handler._ananke_runtimes = {}
    handler._last_sleep_tick = 0
    ...
    return handler

class TestBrainHttpServerLifecycle:
    async def test_start_and_stop(self) -> None:
        handler = _make_mock_handler()
        server = BrainHttpServer(handler=handler, secret="test-secret", port=0)
        await server.start()
        assert server._runner is not None
        await server.stop()
```
Phase 40 test creates `BrainHttpServer(handler=mock_handler, secret="test-secret", port=0)` and makes requests via `aiohttp.test_utils.TestClient`. The mock handler must expose `_llm` (or whichever attribute `handle_local_ai_models` reads from handler) with a mock `list_models()` and `is_available()`.

**httpx mock pattern for LLM** (test_llm_ollama.py lines 1-17):
```python
import httpx
import pytest
from noesis_brain.llm.base import LLMError
from noesis_brain.llm.ollama import OllamaAdapter

def _mock_transport(handler):
    return httpx.MockTransport(handler)

class TestOllamaAdapter:
    @pytest.mark.asyncio
    async def test_generate_basic(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_ollama_chat_response("I am Sophia."))
        adapter = OllamaAdapter(model="qwen3:4b")
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))
```
For `test_local_ai_http.py`: mock `OllamaAdapter.list_models` with `AsyncMock` on the mock handler attribute, rather than patching the httpx transport. Example:
```python
mock_handler._llm.list_models = AsyncMock(return_value=["qwen3:4b", "qwen3.5:latest"])
mock_handler._llm.is_available = AsyncMock(return_value=True)
```

**Test structure for endpoint tests:**
```python
async def test_models_endpoint_returns_list():
    handler = _make_mock_handler()
    handler._llm = MagicMock()
    handler._llm.list_models = AsyncMock(return_value=["qwen3:4b"])
    server = BrainHttpServer(handler=handler, secret="test-secret", port=0)
    await server.start()
    async with aiohttp.ClientSession() as session:
        port = server._site._server.sockets[0].getsockname()[1]
        async with session.get(
            f"http://localhost:{port}/local-ai/models",
            headers={"X-Brain-Secret": "test-secret"},
        ) as resp:
            assert resp.status == 200
            body = await resp.json()
            assert "qwen3:4b" in body["models"]
    await server.stop()
```

---

### `brain/test/test_startup_settings.py` (test, request-response)

**Analog:** `brain/test/test_llm_ollama.py` (httpx mock pattern) + `brain/src/noesis_brain/__main__.py` (startup factory)

**httpx mock for Grid settings fetch:**
```python
import httpx
import pytest
from unittest.mock import AsyncMock, patch
import json

def _mock_settings_response(settings: dict) -> httpx.Response:
    return httpx.Response(200, json=settings)

DEFAULT_SETTINGS = {
    "local_ai": {
        "small_model": "qwen3:4b",
        "primary_model": "qwen3:4b",
        "large_model": "qwen3:4b",
        "temperature": 0.7,
        "max_tokens": 2048,
        "_version": 2,
    },
    "_version": 2,
}
```

**Test: startup failure on Grid unreachable:**
```python
async def test_settings_fetch_failure_exits():
    """Brain startup must sys.exit(1) if Grid is unreachable."""
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("refused")):
        with pytest.raises(SystemExit) as exc_info:
            await _fetch_operator_settings("http://localhost:8080", "fake-token")
        assert exc_info.value.code == 1
```

**Test: recovery detection per tick:**
```python
async def test_recovery_detection_logs_recovered(caplog):
    """When is_available() returns True after False, log local_ai_recovered."""
    # Use mock OllamaAdapter where is_available flips True after first False
    ...
```

---

## Shared Patterns

### X-Brain-Secret Authentication (Brain HTTP endpoints)
**Source:** `brain/src/noesis_brain/http/cognitive_snapshot.py` lines 53-55
**Apply to:** `brain/src/noesis_brain/http/local_ai.py` (both handlers)
```python
if request.headers.get("X-Brain-Secret", "") != secret:
    raise web.HTTPUnauthorized()
```
This is the only auth mechanism for Brain HTTP routes. No bearer token, no session cookie. Always the first check in every handler function.

### Brain HTTP Proxy (Steward server-side secret injection)
**Source:** `steward/src/app/api/operator/[...path]/route.ts` lines 14-47
**Apply to:** `steward/src/app/api/brain/[...path]/route.ts`
```typescript
const BRAIN_HTTP_URL = process.env.BRAIN_HTTP_URL ?? 'http://localhost:8090';
const BRAIN_HTTP_SECRET = process.env.BRAIN_HTTP_SECRET ?? '';
// Inject server-side — never expose in client bundle
headers['X-Brain-Secret'] = BRAIN_HTTP_SECRET;
```
The secret must be a server-only env var (no `NEXT_PUBLIC_` prefix). This proxy pattern ensures the browser never sees the Brain HTTP secret.

### operatorScope preHandler (Grid routes)
**Source:** `grid/src/api/routes/operator-me/settings.ts` lines 9, 17-18
**Apply to:** `grid/src/api/routes/operator-me/settings.ts` (already applied — verify it remains)
```typescript
import { operatorScope } from '../../preHandlers/operatorScope.js';
const operatorDid = await operatorScope(req, reply);
if (!operatorDid) return; // 403 already sent
```
All `operator/me/*` routes use this pattern. Returns the operator's DID on success or sends 403 and returns null. The route body must guard with `if (!operatorDid) return`.

### Python Structured Logging Pattern (Brain events)
**Source:** `brain/src/noesis_brain/llm/router.py` lines 64-68
**Apply to:** `brain/src/noesis_brain/__main__.py` (settings fetch failure) + `brain/src/noesis_brain/llm/router.py` (availability events)
```python
log = logging.getLogger(__name__)
log.warning("Provider %s not available, trying next", adapter.provider_name)
```
Phase 40 adds structured event shape per D-40-05:
```python
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
Use `log.warning` for degraded state (not `log.error` — it's a handled condition). Use `log.info` for recovery.

### MySQL INSERT … ON DUPLICATE KEY UPDATE (Grid upserts)
**Source:** `grid/src/operator/data/operator-quota-store.ts` lines 77-96 and `grid/src/db/stores/brain-token-store.ts` lines 89-107
**Apply to:** `grid/src/operator/data/operator-settings-store.ts` `updateSettings()`
```typescript
await pool.query(
    `INSERT INTO table (pk_col, ..., data_col)
     VALUES (?, ..., ?)
     ON DUPLICATE KEY UPDATE
         data_col = VALUES(data_col)`,
    [pkValue, ..., dataValue],
);
```
Standard MySQL upsert — the only write pattern used in Grid stores. Use `pool.execute()` (not `pool.query()`) for parameterized queries — consistent with existing stores.

### aiohttp Route Closure Pattern (Brain HTTP server)
**Source:** `brain/src/noesis_brain/http/server.py` lines 44-55
**Apply to:** `brain/src/noesis_brain/http/server.py` (new route additions)
```python
_h = self._handler
_s = self._secret

async def _new_route(req: web.Request) -> web.Response:
    return await handle_new_thing(req, _h, _s)

self._app.router.add_get("/new-path", _new_route)
```
Closures capture `_h` and `_s` from the `__init__` scope. This avoids the aiohttp deprecation warning about bare function signatures without `web.Request`.

### vitest Mock + Fastify inject Pattern (Grid tests)
**Source:** `grid/test/api/operator-me-quota.test.ts` lines 5-17, 69-96
**Apply to:** `grid/test/operator-me-settings.test.ts`
```typescript
vi.mock('../../src/operator/data/operator-settings-store.js', () => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
}));
// ... later:
vi.mocked(getSettings).mockResolvedValue({ local_ai: {...}, _version: 2 });
const res = await app.inject({
    method: 'GET',
    url: '/api/v1/operator/me/settings',
    cookies: { [COOKIE_NAME]: cookie },
});
expect(res.statusCode).toBe(200);
```
The `vi.mock()` call must be before `import` statements (hoisted by vitest). `app.inject` with `cookies` object (not `headers`) — the quota test uses `cookies: { [COOKIE_NAME]: cookie }` format, which is the correct Fastify inject syntax.

---

## No Analog Found

All 11 files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Critical Decisions for Planner (from Pattern Analysis)

1. **BrainHandler LLM type compatibility** — Before planning the `__main__.py` task, the planner MUST read `brain/src/noesis_brain/rpc/handler.py` to verify: (a) whether `BrainHandler.__init__` accepts `LLMAdapter` or specifically `OllamaAdapter`, and (b) whether `ModelRouter` satisfies the protocol. `ModelRouter` at `llm/router.py` line 14 does NOT inherit `LLMAdapter` — it only duck-types `generate()`. If `BrainHandler` type-checks strictly, a thin wrapper or explicit isinstance check may be needed.

2. **operatorScope + Brain JWT compatibility** — `settings.ts` uses `operatorScope` which enforces portal session cookie (D-39-05). Brain startup uses a Bearer token (Phase 38 EdDSA JWT). These may be different auth paths. The planner MUST read `grid/src/api/preHandlers/operatorScope.ts` before committing to the startup fetch implementation.

3. **`create_brain_app_from_env()` must become async** — currently sync. `main()` at `__main__.py` line 325 is `async def` and calls `create_brain_app_from_env()` synchronously. To `await` the settings fetch, `create_brain_app_from_env()` must be refactored to `async def`. All callers (tests + `main()`) must be updated.

---

## Metadata

**Analog search scope:** `grid/src/`, `grid/test/`, `brain/src/`, `brain/test/`, `steward/src/`
**Files scanned:** 14 source files + 3 test files
**Pattern extraction date:** 2026-05-27
