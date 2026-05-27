---
phase: 40
slug: local-ai-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Brain)** | pytest + pytest-asyncio 0.23, `asyncio_mode = "auto"` |
| **Framework (Grid)** | vitest ^2.0.0 |
| **Config file (Brain)** | `brain/pyproject.toml` — `[tool.pytest.ini_options]` testpaths=["test"] |
| **Config file (Grid)** | `grid/package.json` — `"test": "vitest run"` |
| **Quick Brain run** | `cd brain && uv run pytest test/ -x -q` |
| **Quick Grid run** | `cd grid && npm test` |
| **Full suite command** | Both above sequentially |
| **Estimated runtime** | ~30s (Grid) + ~20s (Brain) |

---

## Sampling Rate

- **After every task commit:** Run quick run for modified service only
- **After every plan wave:** Run full suite (both Brain and Grid)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~50 seconds (both suites combined)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-T1 | 01 | 0 | LOCAL-01 | — | `getSettings()` returns defaults (not null) for new operators | unit | `cd grid && npm test -- operator-me-settings` | ❌ W0 | ⬜ pending |
| 40-01-T2 | 01 | 0 | LOCAL-01 | — | `updateSettings()` persists merged settings | unit | `cd grid && npm test -- operator-me-settings` | ❌ W0 | ⬜ pending |
| 40-01-T3 | 01 | 0 | LOCAL-01 | A3 | GET /api/v1/operator/me/settings returns 200 with LocalAiSettings shape | integration | `cd grid && npm test -- operator-me-settings` | ❌ W0 | ⬜ pending |
| 40-01-T4 | 01 | 0 | LOCAL-02 | — | PATCH /api/v1/operator/me/settings persists new temperature | integration | `cd grid && npm test -- operator-me-settings` | ❌ W0 | ⬜ pending |
| 40-02-T1 | 02 | 0 | LOCAL-01 | A1 | Brain startup settings fetch wires small_model to SMALL tier | unit | `cd brain && uv run pytest test/test_startup_settings.py -x` | ❌ W0 | ⬜ pending |
| 40-03-T1 | 03 | 0 | LOCAL-03 | — | `/local-ai/status` returns `{"status": "degraded"}` when Ollama offline | unit | `cd brain && uv run pytest test/test_local_ai_http.py -x` | ❌ W0 | ⬜ pending |
| 40-03-T2 | 03 | 0 | LOCAL-03 | — | `/local-ai/models` returns empty array (not 500) when Ollama offline | unit | `cd brain && uv run pytest test/test_local_ai_http.py -x` | ❌ W0 | ⬜ pending |
| 40-03-T3 | 03 | 0 | LOCAL-03 | — | Recovery: `is_available()` True after False → logs `local_ai_recovered` | unit | `cd brain && uv run pytest test/test_startup_settings.py -x` | ❌ W0 | ⬜ pending |
| 40-05-T1 | 05 | 0 | LOCAL-03 | — | ModelRouter fallback chain already tested (existing) | unit | `cd brain && uv run pytest test/test_llm_router.py -x` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/operator-me-settings.test.ts` — stubs for LOCAL-01 + LOCAL-02 (GET/PATCH settings routes)
- [ ] `brain/test/test_startup_settings.py` — stubs for LOCAL-01 Brain startup settings fetch + LOCAL-03 recovery detection
- [ ] `brain/test/test_local_ai_http.py` — stubs for `/local-ai/models` + `/local-ai/status` endpoints

*Existing infrastructure covers fallback chain (test_llm_router.py already covers ModelRouter fallback).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Steward Console red banner shows "Memory content is leaving this machine" when cloud fallback active | LOCAL-03 / Q-V3-I | Requires live Ollama to be stopped and cloud fallback to activate — not easily reproducible in CI | 1. Start Brain with Ollama running. 2. Kill Ollama (`pkill ollama`). 3. Open Steward Console `/system/local-ai`. 4. Verify red banner appears with cloud provider name + "Memory content is leaving this machine". |
| Model dropdown populates correctly from live Ollama | LOCAL-01 | Requires live Ollama instance with installed models | 1. Open `/system/local-ai`. 2. Verify 3 dropdowns show installed models (e.g., "qwen3:4b", "qwen3.5:latest (9.7B)"). 3. Save selection. 4. Restart Brain. 5. Verify Brain log shows selected model at INFO. |
| "Restart Brain to apply" banner appears after Save | LOCAL-02 | UI interaction — requires browser | Change temperature in Steward Console → Save → Verify banner appears before restart. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
