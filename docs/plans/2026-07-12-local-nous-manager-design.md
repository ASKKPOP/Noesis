# Design — Tier 1 Local Nous Manager (desktop app)

**Date:** 2026-07-12 · **Milestone:** v3.3 Mind · **Phase:** 75 (desktop app only — the
operator-bridge *providers* of 75–76 remain HELD)
**Stack (user-validated):** Electron + React + Vite. **Scope (user-validated):** Full Tier 1 —
monitor + control + memory browser.

## What it is

The **Tier 1 Local Nous Manager** (D-V3-36): the operator's local control room for their own
Type-A Nous. A desktop app at `apps/local-nous-manager/` that:

1. **Runs the Brain** — start/stop the local `python -m noesis_brain` process, stream its logs.
2. **Monitors cognition** — live view of `get_state` (psyche · thymos · telos · memory
   highlights + the v3.3 `aisthesis` / `praxis` / `synopsis` snapshots).
3. **Browses memory** — the Tier 1 "memory inspector": recent episodic memories and
   personal-wiki pages (episteme).
4. **Local AI** — Ollama status + models via the existing `/local-ai/*` endpoints.
5. **Edits Brain config** — open/edit the Nous YAML with save-back.

**Cut from v1 (honesty over stubs):** the fork button. `noesis fork` is a Grid-mediated
Phase-43 ceremony, not a local action; a button that can't do the real flow violates the
no-mock rule. Also NOT here: any operator-bridge provider (real apps/camera/PDFs) — still held.

## Architecture

```
Electron main (Node)                    Brain (Python, aiohttp :8090)
├─ BrainProcessManager  ── spawn/kill ─→  python -m noesis_brain
├─ Brain API client     ── HTTP+secret ─→  /local/state
│   (fetch in main; secret never          /local/memory/recent
│    enters the renderer)                 /local/wiki/pages
├─ config file IO                         /local-ai/status · /local-ai/models
└─ IPC (contextBridge, preload)
        ↑
React renderer (Vite, claude.ai light theme)
Overview · Faculties · Memory · Wiki · Local AI · Process/logs · Settings
```

- All Brain HTTP calls happen **in the Electron main process** (Node fetch) and cross to the
  renderer over IPC — avoids CORS and keeps `BRAIN_HTTP_SECRET` out of renderer JS.
- Renderer polls state every 2s while connected.

## Brain-side addition (75-01): `/local/*` inspect endpoints

New `brain/src/noesis_brain/http/local_inspect.py`, registered on `BrainHttpServer`:

| Route | Returns |
|---|---|
| `GET /local/state` | full `handler.get_state()` (incl. aisthesis/praxis/synopsis) |
| `GET /local/memory/recent?limit=N` | recent episodic memories (full content) |
| `GET /local/wiki/pages?category=C` | personal-wiki pages (episteme) |

Same `X-Brain-Secret` gate as existing routes. **Boundary note:** the D-25a-05 plaintext gate
protects the *Grid-facing* cognitive-snapshot contract; `/local/*` is the sanctioned Tier 1
memory inspector (D-V3-36) — the operator reading their own Nous on their own machine, still
secret-gated. These endpoints emit no Grid events and add no audit surface.

## Testing

- Brain: `brain/test/test_local_inspect_http.py` — auth gate (401), state shape passthrough,
  memory/wiki responses, limit clamping. Real aiohttp test client, mock handler (existing
  pattern from `test_http_server.py`).
- App: `tsc --noEmit` + `vite build` must pass; manual run (`npm run dev`) is the runtime
  verification (Electron cannot run headless here).

## Docs sync

ROADMAP (Phase 75 split: desktop ✅ / bridge providers still held), STATE, TASK-LOG,
`wiki/4-reference/handbook.md` Tier-1 row gains the app pointer, this design doc.
