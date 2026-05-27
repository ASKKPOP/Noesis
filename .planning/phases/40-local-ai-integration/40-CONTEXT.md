# Phase 40: Local AI Integration - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Ollama production-grade as Brain's default LLM provider. Operator selects model (all 3 tiers independently) via Steward Console `/system/local-ai`; configuration persists to Grid DB; Brain pulls settings at startup. Router's cloud fallback activates automatically when Ollama is offline; Steward Console shows red warning banner during fallback.

New capability this phase: settings persistence + Steward Console local-ai page + Brain settings-pull at startup + structured Pino events for Ollama availability changes. No new audit events (allowlist unchanged at 64).

**Not in scope:** Cloud LLM as default (Q-V3-I — env opt-in only); hot-reload of model mid-tick; P2P or multi-Brain coordination; operator billing for cloud fallback costs.

</domain>

<decisions>
## Implementation Decisions

### D-40-01: Config Delivery (Brain ← Grid)

Brain pulls operator settings from Grid at startup via `GET /api/v1/operator/me/settings` using the Phase 38 bearer token (EdDSA-signed Brain JWT). Settings are applied before OllamaAdapter is initialized.

**Startup behavior if Grid is unreachable:** Brain **blocks startup** until Grid responds. No offline fallback, no cached settings file. Brain is not a standalone tool — it requires Grid connection. Log `{event: 'settings_fetch_failed', reason: <error>}` and exit non-zero.

**Implication for operator-settings-store.ts:** Phase 39 stub must be fully implemented — a real `operator_settings` DB table, `getSettings`/`updateSettings` with proper persistence.

### D-40-02: Settings Schema

The `OperatorSettings.local_ai` shape (Phase 39 typed as `null`) becomes:

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

All 3 model tiers are independently configurable. Temperature and max_tokens are **global** (apply to all tiers, not per-tier). This matches the current `LLMConfig` dataclass in `brain/src/noesis_brain/llm/types.py`.

### D-40-03: Steward Console — `/system/local-ai` Page

New Tier-1 Local Nous Manager page (D-V3-36). Components:
- **3 model dropdowns** (Small / Primary / Large) populated by calling `GET /api/v1/brain/local-ai/models` which proxies `OllamaAdapter.list_models()` from the locally-running Brain
- **Global sliders/inputs** for temperature (0.0–2.0) and max_tokens (256–8192)
- **"Restart Brain to apply" banner** shown after any change is saved (changes are not hot-reloaded mid-tick per ROADMAP SC2)
- **Red warning banner** "Local AI offline — using cloud fallback" shown when Brain reports Ollama is unreachable (Brain surfaces this via the existing `/health` or a dedicated status endpoint)
- **Save button** → `PATCH /api/v1/operator/me/settings` → Grid DB persists → operator restarts Brain

### D-40-04: Models List Source

Steward Console populates model dropdowns from a new Brain HTTP endpoint: `GET /api/v1/brain/local-ai/models`. Brain calls `OllamaAdapter.list_models()` (already implemented) and returns the list. This endpoint requires a valid operator bearer token (same Phase 38 auth).

Rationale: Ollama runs on operator's local machine alongside Brain — calling it directly from Steward Console's backend would bypass the Brain abstraction layer. Brain knows its own Ollama instance; Grid/Steward should ask Brain, not Ollama directly.

### D-40-05: Degraded Cognition — Cloud Fallback Mode

When Ollama is unreachable, the existing `ModelRouter` cloud fallback chain activates automatically (SMALL → PRIMARY → LARGE → cloud fallback adapter). No Sophia narrative blocking. Brain continues full tick cycle via cloud LLM.

Brain MUST emit structured Pino event on Ollama unavailability:
```python
log.warning("{event: 'local_ai_unavailable', provider: 'ollama', model: <name>, fallback: <cloud_provider>}")
```
And on recovery:
```python
log.info("{event: 'local_ai_recovered', provider: 'ollama', model: <name>}")
```

Steward Console red banner: persistent while `local_ai_unavailable` state is active; auto-dismisses when `local_ai_recovered` fires. Banner must show which cloud provider is active (e.g., "using Claude fallback").

**Cross-boundary memory warning (Q-V3-I):** When cloud fallback is active, Steward Console banner MUST include a note: "Memory content is leaving this machine." This is a constitutional operator transparency requirement.

### D-40-06: Default Model (Q-V3-B — LOCKED)

```
Default: qwen3:4b (all 3 tiers default to qwen3:4b at first boot)
```

`qwen3:4b` remains the code default in `OllamaAdapter.__init__` and in the default settings written to the DB for new operators. Operators change via Steward Console after first launch.

### D-40-07: Recovery Detection

Brain polls `OllamaAdapter.is_available()` once per tick when in fallback mode. On first `True` response after a `False` period, logs `local_ai_recovered` and switches back to local. No separate health check loop needed — tick cadence is sufficient for SC4's "within 10 ticks" requirement.

### Claude's Discretion
- DB migration version number for the operator_settings table (Phase 39 had v27+v28, so v29 is natural)
- Exact DB schema (column names, JSON vs separate columns)
- Steward Console styling details within `/system/local-ai` page
- Error shape for `settings_fetch_failed` at Brain startup
- Whether `GET /api/v1/brain/local-ai/models` is unauthenticated (same network, localhost) or bearer-required

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brain LLM Infrastructure (existing, carry-forward)
- `brain/src/noesis_brain/llm/ollama.py` — OllamaAdapter: `generate()`, `list_models()`, `is_available()`, `close()`. Do NOT replace — extend.
- `brain/src/noesis_brain/llm/router.py` — ModelRouter: tier routing + cloud fallback chain. Phase 40 adds Ollama availability detection on top of existing fallback logic.
- `brain/src/noesis_brain/llm/types.py` — LLMConfig, GenerateOptions, ModelTier. `OperatorSettings.local_ai` shape MUST map to `LLMConfig` fields.
- `brain/src/noesis_brain/__main__.py` — Brain startup factory: `create_brain_app()`. This is where Grid settings pull must be wired.

### Phase 39 Stubs (Phase 40 entry points)
- `grid/src/operator/data/operator-settings-store.ts` — Phase 39 stub returning `{ local_ai: null, _version: 1 }`. Phase 40 replaces with real DB persistence.
- `grid/src/api/routes/operator-me/settings.ts` — GET/PATCH routes already wired. Phase 40 routes are ready; only the store implementation changes.

### Architecture Decisions (locked, read before planning)
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` §Three-Layer — Portal/Grid/Brain separation. Brain on operator hardware; Grid hosted by Henry. Settings pull direction: Brain → Grid (not Grid → Brain push).
- `.planning/STATE.md` §v3.0 Phase 39 carry-forward — D-39-05 (portal_session_required for operator/me/*), operatorScope preHandler contract.

### D-V3-36: Management Taxonomy
- From `CLAUDE.md` and `.planning/ROADMAP.md` §D-V3-36 — Tier-1 Local Nous Manager (Brain config, Local AI settings). The `/system/local-ai` page IS the Tier-1 surface. Do not confuse with Tier-2 Grid Manager.

### Q-V3-I: Cloud LLM cross-boundary warning
- Operators MAY configure cloud LLM via env. When cloud fallback is active, Steward Console MUST show "Memory content is leaving this machine." Constitutional transparency requirement.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OllamaAdapter.list_models()` — returns `list[str]` of installed model names. Already implemented. Use directly for model dropdown population.
- `OllamaAdapter.is_available()` — returns `bool`. Already implemented. Use for degraded mode detection per tick.
- `ModelRouter.generate()` — already handles tier routing + fallback chain. Phase 40 does NOT rewrite this; it adds availability detection around it.
- `brain/data/nous/sophia.yaml` `llm` section — existing per-Nous YAML LLM config structure shows the 3-tier shape operators will configure.

### Established Patterns
- Phase 38 bearer token — Brain already authenticates with Grid via EdDSA JWT. Settings pull uses the same auth mechanism.
- `operatorScope` preHandler — already enforces operator isolation on `operator/me/*` routes. Settings routes already use it (Phase 39 stub).
- Pino structured logging — all events in the codebase use `log.warn({event: '...', ...})` shape. Use same pattern for `local_ai_unavailable` / `local_ai_recovered`.

### Integration Points
- Brain startup: `create_brain_app()` in `__main__.py` — add settings pull call before LLM adapter construction
- Grid DB: new `operator_settings` table (migration v29); `operator-settings-store.ts` fully implemented
- Steward Console: new page at `steward/src/app/system/local-ai/page.tsx`; follows existing `/system/operators` page pattern (Phase 39)
- Brain HTTP server: new endpoint `GET /api/v1/brain/local-ai/models` added to `brain/src/noesis_brain/http/server.py`

</code_context>

<specifics>
## Specific Ideas

- Red banner in Steward Console must include: which cloud provider is active + "Memory content is leaving this machine" — both mandatory
- "Restart Brain to apply" banner is informational only (no auto-restart) — operator manually restarts
- Model dropdown should show model name + size hint if available from `list_models()` response
- Ollama data directory is `~/.ollama` (models stored at `~/.ollama/models/`). The API still serves at `http://localhost:11434`. Planner should document this for operators and use it when validating Ollama installation.

</specifics>

<deferred>
## Deferred Ideas

- Hot-reload of model mid-tick (would require tick suspension and state snapshot) — v3.x
- Per-tier temperature/max_tokens tuning — v3.x
- Operator billing for cloud fallback costs — Henry's commercial concern, out of v3.0
- Cloud LLM (Claude/OpenAI) as primary/selectable provider in Steward Console — Phase 40b (ROADMAP mentions sub-phase)
- Auto-download of Ollama models from within Steward Console — future Tier-1 improvement

</deferred>

---

*Phase: 40-local-ai-integration*
*Context gathered: 2026-05-27*
