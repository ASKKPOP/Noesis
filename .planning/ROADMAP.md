# Roadmap: Noēsis — v2.0 Dashboard (Sprint 14)

## Overview

Sprint 14 delivers the real-time dashboard that makes Nous life observable. The work follows a single dependency chain: WebSocket infrastructure must exist before the browser can receive anything, live views consume that stream, the Nous inspector calls the Grid API directly, and the economy overview rounds out what a developer needs to watch their world run.

## Milestones

- ✅ **v1.0 Genesis** — Phases 1-10 (shipped 2026-04-17)
- ✅ **v2.0 First Life (Sprints 11-13)** — E2E integration, persistence, Docker (shipped 2026-04-17)
- 🚧 **v2.0 Dashboard (Sprint 14)** — Phases 1-4 (in progress)

## Phases

- [ ] **Phase 1: WebSocket Infrastructure** - Add WS endpoint to Grid's Fastify server; broadcast AuditChain events to all connected clients
- [ ] **Phase 2: Live Views** - Region map and audit trail — both render in real-time from the event stream
- [ ] **Phase 3: Nous Inspector** - Clickable Nous panel showing personality, goals, emotions, and memory highlights
- [ ] **Phase 4: Economy Overview** - Ousia balances, trade history, and active shop listings

## Phase Details

### Phase 1: WebSocket Infrastructure
**Goal**: Developers can connect to the Grid server over WebSocket and receive a live stream of all AuditChain events
**Depends on**: Nothing (first phase — Grid REST API already exists, this extends it)
**Requirements**: ACT-01, ACT-02
**Success Criteria** (what must be TRUE):
  1. A developer can open a WebSocket connection to `ws://localhost:{PORT}/ws` on the Grid server
  2. Every AuditChain event (Nous action, trade, movement, law trigger) appears on the socket within one tick of occurring
  3. Multiple browser tabs can connect simultaneously and each receives the full event stream
  4. When the Grid server restarts, clients receive a reconnectable error rather than a silent hang
**Plans**: TBD

### Phase 2: Live Views
**Goal**: The dashboard renders a live region map and a scrolling audit trail that update without page refresh
**Depends on**: Phase 1
**Requirements**: ACT-03, MAP-01, MAP-02, MAP-03, AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. The region map shows all Grid regions as nodes with edges representing connections between them
  2. Each region node displays the names of Nous currently present inside it
  3. When a Nous moves, their marker shifts to the new region within one browser render cycle of the event arriving
  4. The audit trail view shows AuditChain events in chronological order with event type, actor name, timestamp, and relevant payload
  5. A developer can filter the audit trail to show only trades, only messages, only movement, or only law events
**Plans**: TBD
**UI hint**: yes

### Phase 3: Nous Inspector
**Goal**: Developers can click any Nous and read their current inner state — personality, goals, emotions, and recent memories
**Depends on**: Phase 2
**Requirements**: NOUS-01, NOUS-02, NOUS-03
**Success Criteria** (what must be TRUE):
  1. Clicking a Nous on the region map (or in the audit trail) opens a side panel without leaving the page
  2. The panel shows the five Big Five personality scores (Psyche), the active goal list (Telos), and the current emotional state vector (Thymos)
  3. The panel shows the five most recent episodic memory entries for that Nous
  4. The panel reflects the current state fetched from the Grid API at open time (not stale cached data)
**Plans**: TBD
**UI hint**: yes

### Phase 4: Economy Overview
**Goal**: Developers can see the live economic state of the Grid — balances, recent trades, and active shops
**Depends on**: Phase 3
**Requirements**: ECON-01, ECON-02, ECON-03
**Success Criteria** (what must be TRUE):
  1. The economy view lists every Nous with their current Ousia balance
  2. The economy view shows the last 20 completed trades with counterparties, amounts, and timestamps
  3. The economy view lists active shops and the services each shop is currently offering
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. WebSocket Infrastructure | 0/TBD | Not started | - |
| 2. Live Views | 0/TBD | Not started | - |
| 3. Nous Inspector | 0/TBD | Not started | - |
| 4. Economy Overview | 0/TBD | Not started | - |
