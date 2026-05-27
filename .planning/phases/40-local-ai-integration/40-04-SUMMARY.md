---
phase: 40-local-ai-integration
plan: 04
subsystem: brain-http-local-ai
tags: [wave-2, local-ai, brain-http, availability-events, recovery-detection, tdd]
dependency_graph:
  requires:
    - brain/src/noesis_brain/http/cognitive_snapshot.py (handler pattern — copied exactly)
    - brain/src/noesis_brain/http/server.py (route registration pattern)
    - brain/src/noesis_brain/llm/router.py (ModelRouter from Plan 03 — extended)
    - brain/src/noesis_brain/rpc/handler.py (on_tick — wired check_recovery)
    - brain/src/noesis_brain/llm/base.py (LLMError — caught in models handler)
  provides:
    - brain/src/noesis_brain/http/local_ai.py (handle_local_ai_models + handle_local_ai_status)
    - brain/src/noesis_brain/http/server.py (2 new routes: GET /local-ai/models + /local-ai/status)
    - brain/src/noesis_brain/llm/router.py (check_recovery + _in_fallback_mode + log events)
    - brain/src/noesis_brain/rpc/handler.py (check_recovery wired into on_tick)
  affects:
    - brain/test/test_local_ai_http.py (5 stubs → 5 real tests)
    - brain/test/test_llm_router.py (4 new availability event tests)
    - brain/test/test_startup_settings.py (TestRecoveryDetection stub → real test)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (4 commits: 2 RED + 2 GREEN)
    - aiohttp handler pattern (same structure as cognitive_snapshot.py)
    - X-Brain-Secret auth header on both endpoints
    - Structured log events (D-40-05 mandatory shapes)
    - hasattr guard for backward compatibility in on_tick
key_files:
  created:
    - brain/src/noesis_brain/http/local_ai.py
  modified:
    - brain/src/noesis_brain/http/server.py
    - brain/src/noesis_brain/llm/router.py
    - brain/src/noesis_brain/rpc/handler.py
    - brain/test/test_local_ai_http.py
    - brain/test/test_llm_router.py
    - brain/test/test_startup_settings.py
decisions:
  - "handler.llm used (not handler._llm) — BrainHandler uses self.llm as the public attribute since Plan 03"
  - "local_ai_unavailable fired at is_available() check (before generate call), not after failure — cleaner state transition"
  - "check_recovery uses PRIMARY tier only (not SMALL/LARGE) — PRIMARY is the canonical availability signal per ModelRouter.is_available()"
  - "hasattr guard on check_recovery in on_tick — makes wiring backward-safe for tests with plain OllamaAdapter"
metrics:
  duration: "7m"
  completed_date: "2026-05-27"
  task_count: 2
  file_count: 7
---

# Phase 40 Plan 04: Local AI HTTP Endpoints + Availability Events Summary

**One-liner:** Two Brain HTTP endpoints (/local-ai/models, /local-ai/status) with X-Brain-Secret auth + structured local_ai_unavailable/recovered log events + per-tick check_recovery() wired into BrainHandler.on_tick().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for /local-ai/models + /local-ai/status | 81a8685 | brain/test/test_local_ai_http.py |
| 1 GREEN | local_ai.py handlers + server.py route wiring | cf36a0a | brain/src/noesis_brain/http/local_ai.py, brain/src/noesis_brain/http/server.py |
| 2 RED | Failing tests for availability events + check_recovery | bd280d2 | brain/test/test_llm_router.py, brain/test/test_startup_settings.py |
| 2 GREEN | ModelRouter availability events + handler.on_tick wiring | 5b29940 | brain/src/noesis_brain/llm/router.py, brain/src/noesis_brain/rpc/handler.py |

## What Was Built

### Task 1 — Brain HTTP Local AI Endpoints

**`brain/src/noesis_brain/http/local_ai.py`** — New file:

- `handle_local_ai_models(request, handler, secret)`: Returns `{"models": [...], "ollama_available": true}`. On `LLMError` from Ollama: returns `{"models": [], "ollama_available": false}` (NOT 500 — Pitfall 4 compliance). Auth: X-Brain-Secret header.
- `handle_local_ai_status(request, handler, secret)`: Returns `{"status": "ok"|"degraded", "provider": "ollama", "fallback_provider": str|null}`. Reads `handler.llm._fallback.provider_name` if fallback is set.

**`brain/src/noesis_brain/http/server.py`** — Added 2 routes:
- `GET /local-ai/models` → `_local_ai_models_route`
- `GET /local-ai/status` → `_local_ai_status_route`
- Import added inside `__init__` using same `noqa: PLC0415` pattern as existing handlers.

### Task 2 — ModelRouter Availability Events + Recovery Detection

**`brain/src/noesis_brain/llm/router.py`** — Three surgical additions:

1. `_in_fallback_mode: bool = False` in `__init__` — tracks first-time fallback activation to suppress repeated log spam (T-40-04-03 mitigation).

2. Inside `generate()` loop: when `adapter is self._fallback` and `not self._in_fallback_mode` → sets `_in_fallback_mode = True` and emits:
   ```python
   log.warning("{event: 'local_ai_unavailable', provider: 'ollama', model: '%s', fallback: '%s'}", ...)
   ```
   This fires exactly once per unavailability episode (D-40-05 mandatory shape).

3. `check_recovery()` async method — polls `PRIMARY.is_available()` only when `_in_fallback_mode`. On first `True`: clears flag, emits `local_ai_recovered` info log, returns `True`. No-op when not in fallback.

**`brain/src/noesis_brain/rpc/handler.py`** — Added at END of `on_tick()`, after advisory logging:
```python
if hasattr(self.llm, "check_recovery"):
    await self.llm.check_recovery()
```
Per-tick recovery polling per D-40-07. `hasattr` guard preserves backward compatibility for tests using plain `OllamaAdapter`.

## Verification Results

| Check | Result |
|-------|--------|
| `grep "local-ai/models" server.py` | PASS |
| `grep "local-ai/status" server.py` | PASS |
| `grep "_in_fallback_mode" router.py` | PASS |
| `grep "local_ai_unavailable" router.py` | PASS |
| `grep "local_ai_recovered" router.py` | PASS |
| `grep "check_recovery" router.py` | PASS |
| `grep "check_recovery" handler.py` | PASS |
| `uv run pytest test/ -x -q` | 781 passed, 5 warnings, 0 failures |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used handler.llm not handler._llm**
- **Found during:** Task 1 GREEN — plan spec showed `handler._llm` but BrainHandler exposes LLM as `self.llm` (public attribute set in `__init__` as `self.llm = llm`)
- **Fix:** Used `handler.llm` in both local_ai.py handlers
- **Files modified:** `brain/src/noesis_brain/http/local_ai.py`
- **Commit:** cf36a0a (included in GREEN commit)

## Known Stubs

None. All 5 test_local_ai_http stubs and the TestRecoveryDetection stub from Plan 03 are now implemented with real behavior.

## Threat Flags

None. The two new endpoints follow the established X-Brain-Secret auth pattern exactly. T-40-04-01 (spoofing) is mitigated — secret check is the first action in both handlers. T-40-04-03 (log spam) is mitigated — `_in_fallback_mode` guard ensures `local_ai_unavailable` fires exactly once per unavailability episode.

## TDD Gate Compliance

Task 1:
- RED commit 81a8685: `test_local_ai_http.py` — 5 tests fail with `ModuleNotFoundError: No module named 'noesis_brain.http.local_ai'`
- GREEN commit cf36a0a: All 5 new tests pass; 776 total pass

Task 2:
- RED commit bd280d2: `TestModelRouterAvailabilityEvents::test_first_fallback_emits_local_ai_unavailable` fails with `AssertionError: assert 'local_ai_unavailable' in <caplog.text>`
- GREEN commit 5b29940: All 5 new tests (4 router + 1 recovery) pass; 781 total pass

## Self-Check: PASSED
