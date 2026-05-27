---
phase: 40-local-ai-integration
verified: 2026-05-27T00:00:00Z
status: human_needed
score: 5/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to http://localhost:3000/system/local-ai while Brain and Ollama are running"
    expected: "Page loads; 3 model dropdowns are populated from Ollama (not empty); temperature and max_tokens fields show saved values"
    why_human: "Visual rendering + real Ollama/Brain integration cannot be verified without live services"
  - test: "Change temperature to 1.0 and click Save"
    expected: "Amber 'Restart Brain to apply changes.' banner appears immediately after save"
    why_human: "Banner state change requires live browser interaction"
  - test: "Stop Ollama (pkill ollama), wait 15 seconds, observe /system/local-ai"
    expected: "Red banner appears with text containing 'Local AI offline' and 'Memory content is leaving this machine.'"
    why_human: "Requires live Ollama process control + polling wait"
  - test: "Restart Ollama, wait up to 15 seconds"
    expected: "Red banner disappears (polling auto-recovers)"
    why_human: "Requires live process restart + polling verification"
  - test: "Restart Brain after changing model selection"
    expected: "Brain log shows: '[Brain] Settings fetched: small=<selected> primary=<selected> large=<selected>'; Brain uses new model"
    why_human: "Requires live Brain restart and log inspection"
---

# Phase 40: Local AI Integration Verification Report

**Phase Goal:** Make Local AI (Ollama) production-grade as Brain's default LLM provider — operator selects models via Steward Console, settings persist to Grid DB, Brain startup fetches settings and wires 3-tier ModelRouter, fallback to cloud LLM with mandatory constitutional transparency banner.
**Verified:** 2026-05-27
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator opens /system/local-ai and sees 3 model dropdowns populated from Brain | ? HUMAN | File exists, fetch path correct (`/api/brain/local-ai/models`), Brain endpoint live — visual rendering requires human |
| 2 | Operator can change temperature/max_tokens and click Save; settings persist to Grid DB | ✓ VERIFIED | PATCH `/api/v1/operator/me/settings` wired; `operator-settings-store.ts` uses real MySQL upsert (migration v29); 9 tests pass |
| 3 | 'Restart Brain to apply' amber banner appears after any successful Save | ? HUMAN | Code path confirmed (`setSaved(true)` on 200 response → amber banner renders) — visual verification required |
| 4 | Red banner 'Local AI offline — using cloud fallback. Memory content is leaving this machine.' visible when Brain status is degraded | ? HUMAN | Q-V3-I text confirmed in `page.tsx:148`; 10s polling path verified — live Ollama required to test |
| 5 | Brain startup fetches settings from Grid and wires 3-tier ModelRouter before first tick | ✓ VERIFIED | `_fetch_operator_settings()` + `async create_brain_app_from_env()` + `register_tier(SMALL/PRIMARY/LARGE)` all verified in `__main__.py` |
| 6 | GET /local-ai/models returns installed model list; returns empty list (not 500) when Ollama offline | ✓ VERIFIED | `handle_local_ai_models` catches `LLMError` and returns `{"models": [], "ollama_available": false}`; route registered in `server.py`; 5 tests pass |
| 7 | Per-tick recovery detection: is_available() polled once per tick while in fallback; logs local_ai_recovered on return | ✓ VERIFIED | `check_recovery()` in `router.py`; `hasattr(self.llm, "check_recovery")` guard in `handler.py:748`; structured log event confirmed |

**Score:** 5/7 truths fully verified (2 require human confirmation — code path is correct but live services needed)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/db/schema.ts` | Migration v29: operator_settings table | ✓ VERIFIED | `version: 29` at line 512; `CREATE TABLE IF NOT EXISTS operator_settings` confirmed |
| `grid/src/operator/data/operator-settings-store.ts` | getSettings + updateSettings with real MySQL; qwen3:4b defaults | ✓ VERIFIED | Exports `LocalAiSettings`, `OperatorSettings`, `getSettings`, `updateSettings`; uses `SELECT … FROM operator_settings`; upsert via `INSERT … ON DUPLICATE KEY UPDATE` |
| `grid/src/api/routes/operator-me/brain-settings.ts` | Brain-JWT-authenticated settings endpoint | ✓ VERIFIED | Exports `registerOperatorMeBrainSettingsRoutes`; registered in `operator-me/index.ts`; policy entry `'GET /api/v1/operator/me/brain-settings': 'public'` in `policy.ts` |
| `brain/src/noesis_brain/llm/router.py` | ModelRouter(LLMAdapter) + check_recovery + availability events | ✓ VERIFIED | `class ModelRouter(LLMAdapter)` at line 14; `_in_fallback_mode`, `local_ai_unavailable`, `local_ai_recovered`, `check_recovery` all present |
| `brain/src/noesis_brain/__main__.py` | async create_brain_app_from_env + _fetch_operator_settings + 3-tier wiring | ✓ VERIFIED | `async def create_brain_app_from_env()`, `_fetch_operator_settings`, `register_tier(SMALL/PRIMARY/LARGE)` all at expected lines |
| `brain/src/noesis_brain/http/local_ai.py` | handle_local_ai_models + handle_local_ai_status | ✓ VERIFIED | File exists; both handlers present; `LLMError` catch for graceful offline response |
| `brain/src/noesis_brain/http/server.py` | GET /local-ai/models + GET /local-ai/status routes | ✓ VERIFIED | Both routes registered at lines 63-64; import inside `__init__` |
| `steward/src/app/api/brain/[...path]/route.ts` | Server-side Brain HTTP proxy; no NEXT_PUBLIC_ secret | ✓ VERIFIED | `BRAIN_HTTP_SECRET` at `process.env.BRAIN_HTTP_SECRET` (no NEXT_PUBLIC_ prefix); `X-Brain-Secret` header injected server-side |
| `steward/src/app/system/local-ai/page.tsx` | 3 dropdowns + sliders + amber + red banner + Q-V3-I text | ✓ VERIFIED | All UI elements present in file; `/api/brain/local-ai/models` fetch; `/api/v1/operator/me/settings` PATCH; `brainStatus.status === 'degraded'` red banner; mandatory text at line 148 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `/api/brain/local-ai/models` | `fetch('/api/brain/local-ai/models')` in useEffect | ✓ WIRED | Line 48 |
| `page.tsx` | `/api/v1/operator/me/settings` | `fetch('/api/v1/operator/me/settings', {credentials:'include'})` | ✓ WIRED | Lines 47, 94 |
| `brain/[...path]/route.ts` | `BRAIN_HTTP_URL` | `process.env.BRAIN_HTTP_URL` (server-side only) | ✓ WIRED | Lines 17-18; no NEXT_PUBLIC_ prefix confirmed |
| `__main__.py` | `GET /api/v1/operator/me/brain-settings` | `httpx.AsyncClient.get` with `Authorization: Bearer` | ✓ WIRED | `_fetch_operator_settings` at line 274; called in `create_brain_app_from_env` at line 357 |
| `__main__.py` | `ModelRouter.register_tier` | Direct call with SMALL/PRIMARY/LARGE OllamaAdapters | ✓ WIRED | Lines 208-210 |
| `handler.py` | `ModelRouter.check_recovery` | `hasattr(self.llm, 'check_recovery')` guard in `on_tick` | ✓ WIRED | Lines 748-749 |
| `brain-settings.ts` | `operator-settings-store.ts` | `getSettings(pool, gridName, operatorDid)` call | ✓ WIRED | Confirmed via grep; registered in `operator-me/index.ts` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `page.tsx` | `models` state | `GET /api/brain/local-ai/models` → Brain `list_models()` → Ollama | Ollama real data (LLMError fallback returns empty list gracefully) | ✓ FLOWING |
| `page.tsx` | `draft` (settings) | `GET /api/v1/operator/me/settings` → Grid MySQL `operator_settings` table | Real MySQL SELECT; defaults returned when no row | ✓ FLOWING |
| `page.tsx` | `brainStatus` | `GET /api/brain/local-ai/status` → `is_available()` → PRIMARY OllamaAdapter | Real Ollama availability check via `httpx` | ✓ FLOWING |
| `local_ai.py:handle_local_ai_models` | `models` | `handler.llm.list_models()` → ModelRouter → PRIMARY OllamaAdapter | Real Ollama API call; LLMError returns `[]` not hardcoded | ✓ FLOWING |
| `operator-settings-store.ts:getSettings` | Row data | `SELECT settings FROM operator_settings WHERE ...` | Real MySQL query; JSON.parse of stored settings | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires live Brain HTTP server and Ollama process. Cannot test without running services.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOCAL-01 | 40-02, 40-04, 40-05 | Brain supports Ollama as production LLM provider; operator-selectable model via Steward Console; selection persists | ✓ SATISFIED | DB persistence (migration v29), `/system/local-ai` page with 3 dropdowns, Brain fetches at startup |
| LOCAL-02 | 40-02, 40-05 | Brain Local AI config: model name, temperature, max_tokens, top_p; no hot reload | ⚠ PARTIAL | `temperature` and `max_tokens` implemented; `top_p` intentionally excluded per D-40-02 decision (schema locked to 5 fields); no hot-reload confirmed; amber banner present |
| LOCAL-03 | 40-03, 40-04, 40-05 | Brain falls back to degraded cognition mode if Local AI unavailable; structured warning; continues tick cycle; blocks Sophia narrative generation until LLM restored | ⚠ PARTIAL | Structured `local_ai_unavailable` log event verified; tick cycle continues via cloud fallback (confirmed); red banner on `/system/local-ai`; "Sophia narrative blocking" intentionally NOT implemented per D-40-05 CONTEXT.md override — cloud fallback handles generation instead of blocking |
| MGR-01 | 40-05 | Local Nous Manager surface in Steward Console | ✓ SATISFIED | `/system/local-ai` page is the Tier-1 Local Nous Manager surface per D-V3-36 |
| MGR-02 | 40-05 | Local Nous Manager Local AI panel: model selection + temperature + restart Brain | ⚠ PARTIAL | Model selection, temperature, max_tokens implemented; system prompt override deferred (MGR-02 extension note in RESEARCH.md); restart button not present (operator restarts Brain manually) |

**Note on orphaned requirements:** MGR-01 and MGR-02 are mapped to Phase 40 in REQUIREMENTS.md traceability table. MGR-01 is fully satisfied. MGR-02 core (model + temperature) is satisfied; extensions (system prompt override, restart button) are not — RESEARCH.md explicitly notes these as future MGR-02 extensions.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `router.py` | 68 | `log.warning("Provider %s not available, trying next", ...)` | ℹ Info | Informational; not a stub — this is real error handling in the fallback chain |

No blockers found. No placeholder text. No hardcoded empty returns in production paths.

### Human Verification Required

#### 1. Local AI Settings Page Renders Correctly

**Test:** Start Brain (with Ollama running), navigate to `http://localhost:3000/system/local-ai`
**Expected:** Page loads without errors; 3 model dropdowns show installed Ollama models; temperature and max_tokens show saved values (or qwen3:4b defaults on first load)
**Why human:** Visual rendering + real Ollama API responses cannot be verified without live services

#### 2. Save Settings Shows Amber Banner

**Test:** Change temperature to 1.0, click "Save Settings"
**Expected:** Amber banner appears immediately: "Restart Brain to apply changes."
**Why human:** Banner state transition requires live browser + portal session cookie

#### 3. Ollama Offline Red Banner (Q-V3-I Constitutional Check)

**Test:** Stop Ollama (`pkill ollama`), wait up to 15 seconds on `/system/local-ai`
**Expected:** Red banner appears containing: "Local AI offline — using [provider] fallback. Memory content is leaving this machine."
**Why human:** Requires live process control + polling wait

#### 4. Ollama Recovery Auto-Dismisses Red Banner

**Test:** Restart Ollama (`ollama serve`), wait up to 15 seconds
**Expected:** Red banner disappears without page refresh
**Why human:** Requires live process restart + polling cycle verification

#### 5. Brain Startup Uses Selected Model

**Test:** Change primary_model to a different Ollama model (e.g., `llama3.2`), save, restart Brain
**Expected:** Brain log shows: `[Brain] Settings fetched: primary=llama3.2`; Brain uses `llama3.2` for LLM generation
**Why human:** Requires live Brain restart and log inspection

### Gaps Summary

No blocking code gaps were found. All production artifacts exist, are substantive (no stubs), are wired correctly, and data flows are connected to real data sources.

**Documented intentional deviations from ROADMAP Success Criteria (not blocking gaps):**

1. **top_p missing from UI and schema (LOCAL-02 / ROADMAP SC #2):** REQUIREMENTS.md LOCAL-02 lists `top_p` as a configurable parameter. CONTEXT.md D-40-02 (phase planning decision) locked the `LocalAiSettings` schema to 5 fields (`small_model`, `primary_model`, `large_model`, `temperature`, `max_tokens`, `_version`) with no `top_p`. The RESEARCH.md notes this but treats D-40-02 as authoritative. LOCAL-02 is partially satisfied; `top_p` support deferred.

2. **Sophia narrative generation NOT blocked (LOCAL-03 / ROADMAP SC #3):** REQUIREMENTS.md LOCAL-03 says "blocks new Sophia narrative generation until LLM restored." CONTEXT.md D-40-05 explicitly overrides this: "No Sophia narrative blocking. Brain continues full tick cycle via cloud LLM." RESEARCH.md documents the conflict and marks CONTEXT.md as authoritative. The implementation follows D-40-05 — cloud fallback handles generation instead of blocking.

3. **Red banner on /system/local-ai, not on "Nous inspector" (ROADMAP SC #3):** CONTEXT.md D-40-05 places the banner on the `/system/local-ai` page. The ROADMAP SC #3 says "Steward Console surfaces a red banner on the Nous inspector." The planning decision moved this to the Local AI settings page (the appropriate surface for Tier-1 management per D-V3-36).

4. **Human checkpoint not yet approved (Plan 05):** Plan 40-05 was marked `autonomous: false` with a blocking human checkpoint (`<task type="checkpoint:human-verify" gate="blocking">`). No approval is recorded in the SUMMARY. The human verification items above cover this checkpoint.

---

_Verified: 2026-05-27_
_Verifier: Claude (gsd-verifier)_
