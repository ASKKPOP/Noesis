# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.
**Current milestone:** v2.0 — Phase 2: First Life
**Current focus:** Phase 1 — AuditChain Listener API + Broadcast Allowlist

## Current Position

Phase: 1 of 4 (AuditChain Listener API + Broadcast Allowlist)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-17 — Roadmap reshaped after deep research (4 research files + synthesis)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

*Updated after each plan completion*

## Accumulated Context

### Decisions

Recent decisions affecting current work:
- Research: Transport is WebSocket (single `/ws/events`), not SSE and not per-topic channels — client-side glob filtering
- Research: AuditChain itself becomes the event bus via `onAppend()` hook mirroring `WorldClock.onTick` — no EventEmitter, no Redis/NATS/Kafka for v1
- Research: Default-deny broadcast allowlist at the Grid boundary — LLM prompts, wiki, reflections, emotion deltas never leave the process
- Research: Backpressure via 256-entry ring buffer per client + drop-oldest + REST refill via `/api/v1/audit/trail`
- Research: Next.js 15 from day one in the empty `dashboard/` workspace — no vanilla-HTML detour
- Research: Install `@fastify/websocket@^11` + `@fastify/static@^8`; explicit "do not install" list in STACK.md
- Roadmap reshape: Phase 1 is pure internal (preserves 944 tests) → Phase 2 ships server WS → Phase 3 lands UI → Phase 4 completes inspector + economy + Docker polish

### Pending Todos

None yet.

### Blockers/Concerns

- `brain/uv.lock` is untracked — needs commit or gitignore entry before clean state

## Session Continuity

Last session: 2026-04-17
Stopped at: Roadmap created — ROADMAP.md and STATE.md written, REQUIREMENTS.md traceability updated
Resume file: None
