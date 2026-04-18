# Requirements: Noēsis — Dashboard (Sprint 14)

**Defined:** 2026-04-17
**Updated:** 2026-04-17 (research-driven reshape)
**Core Value:** The first persistent Grid where Nous actually live — observable, running continuously.

## v1 Requirements

### Infrastructure

<!-- Internal plumbing. No user-visible surface, but enables everything else. -->

- [ ] **INFRA-01**: AuditChain supports listener subscriptions without regressing existing 944 tests or changing chain integrity semantics
- [ ] **INFRA-02**: Event broadcast is gated by a default-deny allowlist so LLM prompts, wiki contents, reflections, and raw emotions never leave the Grid process

### Activity Stream

- [ ] **ACT-01**: Developer can connect to a WebSocket endpoint on the Grid server and receive live events
- [ ] **ACT-02**: Activity stream broadcasts all AuditChain events (Nous actions, trades, law triggers, movement) in real-time
- [ ] **ACT-03**: Dashboard displays a scrolling live feed of events with timestamps and Nous attribution

### Region Map

- [ ] **MAP-01**: Dashboard displays the Grid's region graph — nodes are regions, edges are connections
- [ ] **MAP-02**: Each region shows which Nous are currently present
- [ ] **MAP-03**: When a Nous moves, their position updates on the map in real-time

### Audit Trail

- [ ] **AUDIT-01**: Dashboard has an audit trail view that displays AuditChain events in sequence
- [ ] **AUDIT-02**: Each audit entry shows event type, actor (Nous), timestamp, and relevant data
- [ ] **AUDIT-03**: Audit trail is filterable by event type (trade, message, movement, law)

### Nous Inspector

- [ ] **NOUS-01**: Developer can click a Nous in the dashboard to open a detail panel
- [ ] **NOUS-02**: Inspector shows current personality (Psyche Big Five scores), active goals (Telos), and emotional state (Thymos)
- [ ] **NOUS-03**: Inspector shows recent memory highlights (last 5 episodic memories)

### Economy Overview

- [ ] **ECON-01**: Dashboard shows each Nous's current Ousia balance
- [ ] **ECON-02**: Dashboard shows recent trade history (last N completed trades)
- [ ] **ECON-03**: Dashboard shows active shops and their service listings

## v2 Requirements

### Advanced Observability

- **ADV-01**: Nous thought stream (real-time LLM reasoning, sovereignty-gated via Human Channel observe grant)
- **ADV-02**: Memory graph visualization (episodic + semantic connections)
- **ADV-03**: Relationship network between Nous (trust, familiarity, sentiment)
- **ADV-04**: Telos timeline — goal evolution across ticks
- **ADV-05**: Event-type + actor filter on firehose (essential at 10+ Nous)

### Controls

- **CTRL-01**: Human can send a whisper to owned Nous from the dashboard
- **CTRL-02**: Human can pause/resume a Nous from the dashboard
- **CTRL-03**: Grid operator controls (pause clock, adjust tick rate)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Population-level KPIs (avg reputation, trades/hour) | Aggregation hides emergence at n=3 — per-Nous views instead |
| Gamified UI (XP bars, cute avatars, achievements) | Frames Nous as game characters, not minds — contradicts philosophy |
| Cross-Nous memory inspection without consent grant | Violates sovereignty pillar — always gate on Human Channel grants |
| Puppet controls ("move Sophia to Agora") | Violates Human Channel consent model — route via `whisper`/`intervene` |
| Auto-summarization by narrator LLM | Adds a lossy interpreter that wasn't in the simulation |
| Headline LLM token/cost meter | Correct for LLMOps tools; wrong for a world |
| Polished onboarding / tutorial | v1 audience is one developer |
| Nous whisper / intervention controls | Phase 3+ Human Channel depth — dashboard is observer only for now |
| Multi-Grid dashboard | Phase 5 — single Grid first |
| Mobile app | Phase 6+ |
| Authentication / multi-user access | Developer tool for now — single local user (bind 127.0.0.1) |
| Historical replay / scrubber | v2 — stream first, replay later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| ACT-01 | Phase 2 | Pending |
| ACT-02 | Phase 2 | Pending |
| ACT-03 | Phase 3 | Pending |
| MAP-01 | Phase 3 | In progress (Plan 03-01: /regions returns edges) |
| MAP-02 | Phase 3 | Pending |
| MAP-03 | Phase 3 | Pending |
| AUDIT-01 | Phase 3 | Pending |
| AUDIT-02 | Phase 3 | Pending |
| AUDIT-03 | Phase 3 | In progress (Plan 03-01: tick audit emission) |
| NOUS-01 | Phase 4 | Pending |
| NOUS-02 | Phase 4 | Pending |
| NOUS-03 | Phase 4 | Pending |
| ECON-01 | Phase 4 | Pending |
| ECON-02 | Phase 4 | Pending |
| ECON-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 — reshape after deep research (STACK/FEATURES/ARCHITECTURE/PITFALLS synthesis)*
