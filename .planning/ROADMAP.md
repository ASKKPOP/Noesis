# Roadmap: Noēsis — v2.0 Dashboard (Sprint 14)

## Overview

Sprint 14 delivers the real-time dashboard that makes Nous life observable. Research-driven reshape: Phase 1 is pure internal plumbing (no WS, no UI — preserves all 944 tests). Phase 2 exposes the stream server-side, testable with a CLI WebSocket client before any UI work. Phase 3 lands the first user-visible dashboard. Phase 4 completes the inspector, economy, and ships clean on `docker compose up`.

## Milestones

- ✅ **v1.0 Genesis** — Phases 1-10 (shipped 2026-04-17)
- ✅ **v2.0 First Life (Sprints 11-13)** — E2E integration, persistence, Docker (shipped 2026-04-17)
- 🚧 **v2.0 Dashboard (Sprint 14)** — Phases 1-4 (in progress)

## Phases

- [ ] **Phase 1: AuditChain Listener API + Broadcast Allowlist** — Make the audit chain observable via `onAppend()` and define the default-deny privacy allowlist. No network, no UI.
- [ ] **Phase 2: WsHub + `/ws/events` Endpoint** — Server-side WebSocket with per-client ring buffer, drop-oldest backpressure, and `lastSeenId` resume protocol.
- [ ] **Phase 3: Dashboard v1 — Firehose + Heartbeat + Region Map** — Scaffold Next.js, ship reconnecting WS client, render live event feed, tick heartbeat, and region map.
- [ ] **Phase 4: Nous Inspector + Economy + Docker Polish** — Per-Nous detail panel (Psyche/Telos/Thymos/memory), economy snapshot, clean `docker compose up` experience.

## Phase Details

### Phase 1: AuditChain Listener API + Broadcast Allowlist
**Goal**: AuditChain supports observable listeners without changing its integrity contract or measurably regressing performance
**Depends on**: Nothing (first phase — pure internal)
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. `AuditChain.onAppend(fn)` returns an unsubscribe function and fires synchronously after each append, with per-listener try/catch isolation (a thrown listener cannot corrupt chain state or crash the caller)
  2. `AuditChain.loadEntries()` (MySQL restore path) does NOT fire listeners — restore is silent
  3. All 944 existing TS tests pass unchanged; `AuditChain.verify()` still returns `{valid: true}` with listeners attached
  4. Determinism test: 100-tick simulation with 0 vs 10 listeners produces byte-identical audit chain hashes
  5. A `broadcast-allowlist` module exists with default-deny semantics and an initial whitelist covering `nous.spawned`, `nous.moved`, `nous.spoke`, `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`
  6. Benchmark: `append()` p99 adds <100µs per attached listener
**Plans**: 3 plans
  - [x] 01-01-PLAN.md — RingBuffer<T> bounded-FIFO utility with drop-oldest semantics (INFRA-01)
  - [x] 01-02-PLAN.md — AuditChain.onAppend() listener API + determinism regression + p99 benchmark (INFRA-01)
  - [x] 01-03-PLAN.md — Broadcast allowlist module with default-deny + payload privacy lint (INFRA-02)

### Phase 2: WsHub + `/ws/events` Endpoint
**Goal**: The Grid server streams allowlisted audit events to any connected WebSocket client in real time, with backpressure that can never slow the simulation
**Depends on**: Phase 1
**Requirements**: ACT-01, ACT-02
**Success Criteria** (what must be TRUE):
  1. A developer can open a WebSocket connection to `ws://localhost:{PORT}/ws/events` and receive a `hello` frame followed by live `event` frames
  2. Every allowlisted AuditChain event appears on every connected socket within one tick of `append()` returning
  3. Multiple clients connect simultaneously; each receives the full filtered event stream without cross-contamination
  4. Slow client with full send buffer does NOT slow `append()` — events drop to a 256-entry ring buffer; on overflow, server emits `{type:"dropped", sinceId, latestId}` and the slow client can refill via `GET /api/v1/audit/trail?offset=sinceId`
  5. On Grid restart, clients receive a clean `bye` frame or 1001 close code (not a silent hang); reconnecting with `{type:"subscribe", sinceId: N}` replays missed events from in-memory chain or tells client to use REST
  6. 10k connect/disconnect cycles leave `WsHub.clients.size === 0` and Node heap stable (no socket leak)
**Plans**: 3 plans
  - [ ] 02-01-PLAN.md — Install @fastify/websocket@^11 + author ws-protocol.ts frame types (ACT-01)
  - [ ] 02-02-PLAN.md — WsHub + ClientConnection with ring-buffered backpressure + unit tests (ACT-02)
  - [ ] 02-03-PLAN.md — Wire /ws/events into buildServer + integration tests including 10k leak guard (ACT-01, ACT-02)

### Phase 3: Dashboard v1 — Firehose + Heartbeat + Region Map
**Goal**: A developer can open the dashboard in a browser and watch the Grid tick, see events stream, and see Nous move between regions
**Depends on**: Phase 2
**Requirements**: ACT-03, MAP-01, MAP-02, MAP-03, AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. `dashboard/` workspace is scaffolded (Next.js 15 app router, TypeScript) and `npm run dev` inside it serves a working page on port 3001
  2. The dashboard WebSocket client reconnects with exponential backoff + jitter, tracks `lastSeenId`, and refills gaps via the REST `/api/v1/audit/trail` endpoint on receipt of a `dropped` frame
  3. The `/grid` route renders a live firehose panel showing the last 500 events (ring-buffered in memory, DOM-capped) with event type, actor name, timestamp, and payload
  4. The `/grid` route renders a region map (SVG or react-flow) showing all regions as nodes with edges for connections; each region node lists currently-present Nous names
  5. When a Nous moves, their marker shifts on the map within one browser render cycle of the `nous.moved` event arriving
  6. A tick heartbeat widget displays the current tick count and "last event N seconds ago" indicator that turns stale/red if no events arrive within 2× tick rate
  7. The firehose is filterable by event type (trade, message, movement, law)
**Plans**: 6 plans
  - [ ] 03-01-PLAN.md — Grid-side infra: CORS + regions.connections + tick audit emission (MAP-01, AUDIT-03)
  - [ ] 03-02-PLAN.md — Dashboard Next.js workspace scaffold + Vitest/Playwright + MockWebSocket fixtures (AUDIT-01)
  - [ ] 03-03-PLAN.md — Protocol mirrors + WsClient + full-jitter backoff + refill (AUDIT-02, AUDIT-03)
  - [ ] 03-04-PLAN.md — FirehoseStore + PresenceStore + HeartbeatStore + event-type categorization (ACT-03, AUDIT-02)
  - [ ] 03-05-PLAN.md — /grid route: firehose + heartbeat + filter, WsClient wiring (ACT-03, AUDIT-01, AUDIT-03)
  - [ ] 03-06-PLAN.md — RegionMap SVG component + Nous markers + Playwright E2E smoke (MAP-01, MAP-02, MAP-03)
**UI hint**: yes

### Phase 4: Nous Inspector + Economy + Docker Polish
**Goal**: All five table-stakes views work and `docker compose up` produces a functional dashboard on first run
**Depends on**: Phase 3
**Requirements**: NOUS-01, NOUS-02, NOUS-03, ECON-01, ECON-02, ECON-03
**Success Criteria** (what must be TRUE):
  1. Clicking a Nous (in firehose, map, or a roster view) opens a side panel showing Big Five personality scores (Psyche), active goal list (Telos), and current emotional state vector (Thymos)
  2. Inspector panel shows the five most recent episodic memory entries for that Nous, fetched from the Grid API at open time (not stale cached data — requires a `get_current_state(nous_id)` RPC on the brain side if not already present)
  3. Economy panel lists every Nous with their current Ousia balance, refreshed on `trade.settled` events
  4. Economy panel shows the last 20 completed trades with counterparties, amounts, and timestamps
  5. Economy panel lists active shops and the services each shop is currently offering
  6. From a clean checkout, `docker compose up` brings the full stack (Grid + Brain + MySQL + Dashboard) and the dashboard connects to the Grid's WebSocket on first attempt
  7. All PITFALLS.md integrity non-negotiables hold: chain hash unchanged by observer count, no listener can crash append, no privacy leak in the broadcast allowlist, clean shutdown via `app.close()`
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. AuditChain Listener API | 0/3 | Not started | - |
| 2. WsHub + `/ws/events` | 0/3 | Not started | - |
| 3. Dashboard v1 | 0/TBD | Not started | - |
| 4. Inspector + Economy + Docker | 0/TBD | Not started | - |

## Research Artifacts

Deep research committed to `.planning/research/`:
- **STACK.md** — exact packages to install (`@fastify/websocket@^11`, `@fastify/static@^8`) and the "don't install" list
- **FEATURES.md** — table stakes vs differentiators vs anti-features, ranked and tied to Noēsis philosophy
- **ARCHITECTURE.md** — data flow, component inventory, the critical seam at `AuditChain.append → WsHub → broadcast`
- **PITFALLS.md** — 6 critical + 8 moderate + 5 minor pitfalls with prevention strategies
- **SUMMARY.md** — synthesis with TL;DR, integrity non-negotiables, and open questions for the planner

## Open Questions (Planner Must Resolve)

1. **Brain introspection RPC for Phase 4** — does `get_current_state(nous_id)` exist in the Python brain, or does Phase 4 add it?
2. **Trade event taxonomy** — does AuditChain already distinguish `trade.proposed` / `trade.countered` / `trade.settled`? Affects economy view fidelity.
3. **Consistency model** — confirm "broadcast best-effort, REST authoritative" is acceptable; if stricter needed, Phase 2 must wait on MySQL persistence in `append()`.

---
*Roadmap created: 2026-04-17*
*Last updated: 2026-04-17 — reshape after deep research synthesis*
