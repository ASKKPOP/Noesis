---
phase: 40-local-ai-integration
plan: 03
subsystem: brain-llm-routing
tags: [wave-2, local-ai, model-router, brain-startup, settings-fetch, tdd]
dependency_graph:
  requires:
    - brain/src/noesis_brain/llm/base.py (LLMAdapter ABC)
    - brain/src/noesis_brain/llm/router.py (ModelRouter — pre-change)
    - brain/src/noesis_brain/__main__.py (create_brain_app_from_env — pre-change)
    - grid/src/api/routes/operator-me/brain-settings.ts (Plan 02 — GET /api/v1/operator/me/brain-settings)
    - brain/test/test_startup_settings.py (Plan 01 stubs → Plan 03 real tests)
  provides:
    - brain/src/noesis_brain/llm/router.py (ModelRouter now extends LLMAdapter)
    - brain/src/noesis_brain/__main__.py (_fetch_operator_settings + async factory + 3-tier wiring)
  affects:
    - brain/test/test_llm_router.py (9 new TestModelRouterLLMAdapterProtocol tests)
    - brain/test/test_startup_settings.py (stubs → 3 real tests)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (4 commits: 2 RED + 2 GREEN)
    - LLMAdapter ABC extension (Python ABC inheritance + abstract method override)
    - httpx.AsyncClient context manager for settings fetch
    - sys.exit(1) on Grid startup failure (D-40-01 blocking requirement)
    - 3-tier OllamaAdapter construction from fetched settings
key_files:
  created: []
  modified:
    - brain/src/noesis_brain/llm/router.py
    - brain/src/noesis_brain/__main__.py
    - brain/test/test_llm_router.py
    - brain/test/test_startup_settings.py
decisions:
  - "ModelRouter(LLMAdapter): 4 abstract methods added after existing generate(); existing 17 tests unchanged"
  - "provider_name/list_models/is_available all delegate to PRIMARY tier; 'model_router' fallback when unregistered"
  - "create_brain_app_from_env() made async; settings fetched BEFORE create_brain_app() call"
  - "create_brain_app() extended with 5 None-default override params (backward compatible)"
  - "LLMConfig(provider=..., models={...}) — NOT LLMConfig(model=...) — fixed Rule 1 bug"
  - "No-Grid dev path: falls back to LLM_MODEL env var (all 3 tiers same model)"
metrics:
  duration: "8m"
  completed_date: "2026-05-27"
  task_count: 2
  file_count: 4
---

# Phase 40 Plan 03: ModelRouter LLMAdapter + Async Brain Startup Summary

**One-liner:** ModelRouter extends LLMAdapter (4 new methods delegating to PRIMARY tier) + async Brain startup that fetches 3-tier model settings from Grid before constructing OllamaAdapters.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | ModelRouter(LLMAdapter) failing tests | a3b3784 | brain/test/test_llm_router.py |
| 1 GREEN | ModelRouter extends LLMAdapter | 1332ece | brain/src/noesis_brain/llm/router.py |
| 2 RED | Brain async startup failing tests | cd234bc | brain/test/test_startup_settings.py |
| 2 GREEN | Async startup + settings fetch + 3-tier wiring | 9cedc97 | brain/src/noesis_brain/__main__.py |

## What Was Built

### Task 1 — ModelRouter extends LLMAdapter

**`brain/src/noesis_brain/llm/router.py`** — Surgical change:

- `class ModelRouter` → `class ModelRouter(LLMAdapter)` (1-line change)
- Added 4 LLMAdapter abstract method implementations after existing `generate()`:
  - `provider_name` (property): delegates to `_adapters[PRIMARY].provider_name`; returns `"model_router"` if PRIMARY unregistered
  - `list_models()`: delegates to PRIMARY; returns `[]` if unregistered
  - `is_available()`: delegates to PRIMARY; returns `False` if unregistered
- Existing `generate()` signature unchanged (`tier=ModelTier.PRIMARY` default satisfies base class contract)
- All 17 existing `TestModelRouter` tests continue to pass

**`brain/test/test_llm_router.py`** — 9 new tests in `TestModelRouterLLMAdapterProtocol`:
- isinstance check, generate() without tier → PRIMARY, generate() with tier kwarg
- provider_name delegation, provider_name fallback, list_models delegation + empty fallback, is_available delegation + False fallback

### Task 2 — Async Brain Startup with Settings Fetch

**`brain/src/noesis_brain/__main__.py`** — Three changes:

**`_fetch_operator_settings(grid_url, token)`** — New async helper:
- Calls `GET /api/v1/operator/me/brain-settings` with `Authorization: Bearer <token>`
- 10s timeout; returns `resp.json()` on HTTP 200
- Calls `sys.exit(1)` on non-200 or any httpx error (D-40-01 blocking startup requirement)
- Logs `{event: 'settings_fetch_failed', reason: ..., url: ...}` before exit

**`create_brain_app_from_env()` → `async`**:
- Fetches bearer token via `await token_manager.get_token()` (Phase 38 pattern)
- Calls `await _fetch_operator_settings()` to get `small_model`, `primary_model`, `large_model`, `temperature`, `max_tokens` from Grid
- Falls back to `LLM_MODEL` env var (all 3 tiers equal) when Grid is not configured
- Passes all 5 settings to `create_brain_app()` as override params

**`create_brain_app()` extended (5 new `None`-default params)**:
- `small_model_override`, `primary_model_override`, `large_model_override`, `temperature_override`, `max_tokens_override`
- Replaces single `OllamaAdapter(model=...)` with 3-tier `ModelRouter`:
  ```python
  router = ModelRouter(config=LLMConfig(provider="ollama", models={...}, ...))
  router.register_tier(ModelTier.SMALL, OllamaAdapter(model=_small, ...))
  router.register_tier(ModelTier.PRIMARY, OllamaAdapter(model=_primary, ...))
  router.register_tier(ModelTier.LARGE, OllamaAdapter(model=_large, ...))
  llm = router
  ```
- `main()`: `app = await create_brain_app_from_env()`

**`brain/test/test_startup_settings.py`** — 3 stubs → 3 real tests:
- `test_returns_settings_on_200`: mocks httpx.AsyncClient, verifies return dict + correct URL/headers
- `test_exits_on_non_200`: 503 response → SystemExit(1)
- `test_exits_on_network_error`: httpx.ConnectError → SystemExit(1)

## Verification Results

| Check | Result |
|-------|--------|
| `class ModelRouter(LLMAdapter)` grep | PASS |
| `async def create_brain_app_from_env` grep | PASS |
| `_fetch_operator_settings` grep | PASS |
| `register_tier` grep | PASS |
| `await create_brain_app_from_env` grep | PASS |
| `uv run pytest test/ -x -q` | 771 passed, 6 skipped, 0 failures |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong LLMConfig field name**
- **Found during:** Task 2 GREEN implementation
- **Issue:** Plan spec used `LLMConfig(model=_primary, temperature=..., max_tokens=...)` but `LLMConfig` dataclass has `provider: str` + `models: dict[str, str]` — no `model` field. This caused `TypeError: LLMConfig.__init__() got an unexpected keyword argument 'model'` in `test_main.py`.
- **Fix:** Changed to `LLMConfig(provider="ollama", models={"small": _small, "primary": _primary, "large": _large}, temperature=_temp, max_tokens=_max_tok)`
- **Files modified:** `brain/src/noesis_brain/__main__.py`
- **Commit:** 9cedc97 (included in same GREEN commit)

## Known Stubs

None. All production code in this plan implements real behavior. The one remaining skip in `test_startup_settings.py` (`TestRecoveryDetection.test_logs_recovered_after_unavailable`) is an intentional Wave 0 stub for Plan 04 (recovery detection per D-40-07).

## Threat Flags

None. This plan adds no new network endpoints, auth paths, or schema changes. The `_fetch_operator_settings` function uses the Phase 38 EdDSA Bearer token (T-40-03-01: mitigated). Model names from Grid settings flow to OllamaAdapter as string parameters (T-40-03-02: accepted — Ollama rejects unknown models).

## TDD Gate Compliance

Task 1:
- RED commit a3b3784: `TestModelRouterLLMAdapterProtocol` — `test_is_instance_of_llm_adapter` fails with `AssertionError: assert False` (18 existing pass, 1 new fails)
- GREEN commit 1332ece: All 27 router tests pass

Task 2:
- RED commit cd234bc: `TestFetchOperatorSettings.test_returns_settings_on_200` fails with `ImportError: cannot import name '_fetch_operator_settings'`
- GREEN commit 9cedc97: All 3 new tests + 771 total pass

## Self-Check: PASSED
