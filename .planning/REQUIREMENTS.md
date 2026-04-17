# Requirements: Noēsis — Dashboard (Sprint 14)

**Defined:** 2026-04-17
**Core Value:** The first persistent Grid where Nous actually live — observable, running continuously.

## v1 Requirements

### Activity Stream

- [ ] **ACT-01**: Developer can connect to a WebSocket endpoint on the Grid server and receive live events
- [ ] **ACT-02**: Activity stream broadcasts all AuditChain events (Nous actions, trades, law triggers, movement) in real-time
- [ ] **ACT-03**: Dashboard displays a scrolling live feed of events with timestamps and Nous attribution

### Region Map

- [ ] **MAP-01**: Dashboard displays the Grid's region graph — nodes are regions, edges are connections
- [ ] **MAP-02**: Each region shows which Nous are currently present
- [ ] **MAP-03**: When a Nous moves, their position updates on the map in real-time

### Nous Inspector

- [ ] **NOUS-01**: Developer can click a Nous in the dashboard to open a detail panel
- [ ] **NOUS-02**: Inspector shows current personality (Psyche Big Five scores), active goals (Telos), and emotional state (Thymos)
- [ ] **NOUS-03**: Inspector shows recent memory highlights (last 5 episodic memories)

### Audit Trail

- [ ] **AUDIT-01**: Dashboard has an audit trail view that displays AuditChain events in sequence
- [ ] **AUDIT-02**: Each audit entry shows event type, actor (Nous), timestamp, and relevant data
- [ ] **AUDIT-03**: Audit trail is filterable by event type (trade, message, movement, law)

### Economy Overview

- [ ] **ECON-01**: Dashboard shows each Nous's current Ousia balance
- [ ] **ECON-02**: Dashboard shows recent trade history (last N completed trades)
- [ ] **ECON-03**: Dashboard shows active shops and their service listings

## v2 Requirements

### Advanced Observability

- **ADV-01**: Nous thought stream (real-time LLM reasoning visible to human owner only)
- **ADV-02**: Memory graph visualization (episodic + semantic connections)
- **ADV-03**: Relationship network between Nous (trust, familiarity, sentiment)

### Controls

- **CTRL-01**: Human can send a whisper to owned Nous from the dashboard
- **CTRL-02**: Human can pause/resume a Nous from the dashboard
- **CTRL-03**: Grid operator controls (pause clock, adjust tick rate)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Nous whisper / intervention controls | Phase 3+ Human Channel depth — dashboard is observer only for now |
| Multi-Grid dashboard | Phase 5 — single Grid first |
| Mobile app | Phase 6+ |
| Authentication / multi-user access | Developer tool for now — single local user |
| Historical replay | v2 — stream first, replay later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACT-01 | Phase 1 | Pending |
| ACT-02 | Phase 1 | Pending |
| ACT-03 | Phase 2 | Pending |
| MAP-01 | Phase 2 | Pending |
| MAP-02 | Phase 2 | Pending |
| MAP-03 | Phase 2 | Pending |
| AUDIT-01 | Phase 2 | Pending |
| AUDIT-02 | Phase 2 | Pending |
| AUDIT-03 | Phase 2 | Pending |
| NOUS-01 | Phase 3 | Pending |
| NOUS-02 | Phase 3 | Pending |
| NOUS-03 | Phase 3 | Pending |
| ECON-01 | Phase 4 | Pending |
| ECON-02 | Phase 4 | Pending |
| ECON-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 — traceability updated to match ROADMAP.md phase assignments*
