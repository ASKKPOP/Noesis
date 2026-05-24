---
phase: 25a
plan: "06"
subsystem: steward-ui
tags: [steward, ui, firehose, cognitive-inspector, brain-health, allowlist-monitor, humans, observer-surfaces]
dependency_graph:
  requires: [25a-02, 25a-04, 25a-05]
  provides: [D-25a-14, D-25a-02, D-25a-06, D-25a-16, D-25a-17, D-25a-18, D-25a-19]
  affects: [steward/src/app/firehose, steward/src/app/humans, steward/src/app/nous, steward/src/app/system, steward/src/app/users, steward/src/components/StewardShell]
tech_stack:
  added: []
  patterns: [WebSocket with exponential backoff, ring-buffer event cap, 5s polling, Promise.allSettled multi-fetch, accessibility tablist pattern, role=meter for drive bars]
key_files:
  created:
    - steward/src/app/firehose/page.tsx
    - steward/src/app/humans/[did]/page.tsx
  modified:
    - steward/src/components/StewardShell.tsx
    - steward/src/app/system/page.tsx
    - steward/src/app/nous/[id]/page.tsx
    - steward/src/app/users/page.tsx
decisions:
  - "Drive bars use HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS per UI-SPEC Correction Notice (eros/logos absent)"
  - "Firehose ring buffer capped at 500 stored events, 200 pause buffer (T-25a-06-05 mitigation)"
  - "Skill tier badge is cosmetic; Grid enforces H3 tier — no client-side tier gate (T-25a-06-07 accepted)"
  - "ALLOWLIST_STATIC hardcoded 45 entries in system/page.tsx (simpler than build-time TS import)"
  - "Nous tab in /humans/[did] reads from /api/v1/grid/nous and filters by humanOwner client-side"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 4
---

# Phase 25a Plan 06: Steward UI Observer Surfaces Summary

Shipped five read-only Steward Console observer surfaces consuming all backends from Plans 02–05: live WebSocket firehose with 10-family color coding, Cognitive Inspector card with H3-gated cognitive snapshot, Brain Health 2×2 metric grid, Allowlist Monitor with 5s-polled drift detection and 45-entry static reference, and the /humans/[did] 3-tab drill-down with profile/history/Nous roster.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | /firehose page + StewardShell nav + Allowlist Monitor on /system | d8c4f74 | firehose/page.tsx, StewardShell.tsx, system/page.tsx |
| 2 | Cognitive Inspector + Brain Health cards on /nous/[id] | 40c073c | nous/[id]/page.tsx |
| 3 | /humans/[did] page + /users deep-link wiring | 1c5e2ff | humans/[did]/page.tsx, users/page.tsx |

---

## Endpoints Consumed

| Endpoint | Protocol | Consumer | Purpose |
|----------|----------|----------|---------|
| `WS /api/v1/audit/firehose` | WebSocket | /firehose | Live event stream with HelloFrame + EventFrame |
| `GET /api/v1/audit/drift-alerts` | REST (5s poll) | /system | Runtime allowlist drift detection |
| `GET /api/v1/humans/:did` | REST | /humans/[did] | Human profile record |
| `GET /api/v1/humans/:did/history` | REST | /humans/[did] | SIWE sessions, transfers, whispers, regions |
| `POST /api/v1/operator/nous/:did/cognitive-snapshot` | REST | /nous/[id] | H3-gated cognitive metadata (drive levels, skill titles, sleep tick, counts) |
| `GET /api/v1/nous/:did/tick-metrics` | REST | /nous/[id] | p50/p95 latency + queue depth |
| `GET /api/v1/audit/trail?type=...&actor=...` | REST (×8 queries) | /nous/[id] | Brain Health audit aggregations (reflections, skills, rules, drives, sleep, creed) |
| `GET /api/v1/grid/nous` | REST | /humans/[did] | Nous roster (filtered by humanOwner client-side) |

---

## Threat Model Verification

```
T-25a-06-01: No direct Brain calls from Steward
  grep "brain.*cognitive" steward/src/ → 0 matches  PASS

T-25a-06-02: Drive names correct (no eros/logos)
  grep -E "eros|logos" steward/src/app/nous/[id]/page.tsx → 0 matches  PASS

T-25a-06-04: No dangerouslySetInnerHTML in firehose or humans
  grep -rn "dangerouslySetInnerHTML" steward/src/app/firehose/ steward/src/app/humans/ → 0 matches  PASS

T-25a-06-06: No sanction stubs in /humans/[did]
  grep -E "ban-human|freeze-wallet|sanction" humans/[did]/page.tsx → 0 matches  PASS
```

---

## Decision IDs Implemented

- **D-25a-14**: Live firehose WebSocket UI — SHIPPED
- **D-25a-02..05**: Cognitive Inspector UI (H3 tier badge, drive bars, skill titles, sleep+creed metadata) — SHIPPED
- **D-25a-06**: Brain Health 4-card grid — SHIPPED
- **D-25a-16**: Drift Alert Panel (green confirmation on 0, red panel on >0) — SHIPPED
- **D-25a-17**: Static reference table + drift detector — SHIPPED
- **D-25a-18**: /humans/[did] 3-tab drill-down — SHIPPED
- **D-25a-19**: /users deep-link to /humans/[did] — SHIPPED

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Accepted Simplifications

**1. Allowlist static reference: position + event type + producer only**
- Plan permitted omitting payload-key column for MVP density
- Implemented 3 columns: Position, Event Type, Producer File
- Payload keys column omitted (shows `—` implicitly by absence)

**2. Cognitive-snapshot error states collapsed**
- `cogError` stores `'403'`, `'503'`, or HTTP error string
- Non-403/503 errors collapse to the Brain-offline 503 treatment (conservative)

**3. Brain Health drive bars use enum-level mapping (high/med/low → 0.9/0.5/0.15)**
- `ananke.drive_crossed` payload carries `level ∈ {low,med,high}` not float
- UI maps to representative float values; actual float only available via cognitive-snapshot

---

## Manual Smoke Test Checklist

- [ ] `/firehose` — route renders, connection status pill shows Connected/Connecting/Disconnected
- [ ] `/firehose` — rows appear with left-border family color and event-type badge
- [ ] `/firehose` — hover pauses auto-scroll; Paused pill appears; leave resumes
- [ ] `/firehose` — disconnect triggers countdown pill and reconnect
- [ ] `/system` — Allowlist Monitor section visible after Regions card
- [ ] `/system` — Drift Alert Panel shows green "No drift detected…" when clean
- [ ] `/system` — Static Reference Table shows 45 events with positions
- [ ] `/nous/[id]` — Cognitive Inspector card renders after Brain State card
- [ ] `/nous/[id]` — 5 drive bars render in order HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS
- [ ] `/nous/[id]` — Brain Health 2×2 grid renders below Cognitive Inspector, before Force Telos
- [ ] `/nous/[id]` — Tick Performance card shows p50/p95 or "Tick metrics unavailable."
- [ ] `/humans/[did]` — route accessible via /users DID click
- [ ] `/humans/[did]` — header card shows name + DID
- [ ] `/humans/[did]` — tabs Profile/History/Nous switch content
- [ ] `/humans/[did]` — arrow keys navigate tabs
- [ ] `/humans/[did]` — invalid DID shows "Human not found." (no redirect)
- [ ] `/users` — DID cells are links turning terracotta on hover

---

## Known Stubs

None. All data flows are wired to real Grid endpoints. Nous Tab 3 on /humans/[did] may appear empty in practice until Phase 27 populates `humanOwner` field — this is expected behavior per UI-SPEC, not a stub.

---

## Self-Check

### File existence
- `steward/src/app/firehose/page.tsx` — FOUND (450 lines, ≥150 required)
- `steward/src/app/humans/[did]/page.tsx` — FOUND (518 lines, ≥200 required)
- `steward/src/app/nous/[id]/page.tsx` — FOUND (945 lines, contains "Cognitive Inspector" and "Brain Health")
- `steward/src/app/system/page.tsx` — FOUND (632 lines, contains "Allowlist Monitor" and "Drift Alert")
- `steward/src/components/StewardShell.tsx` — FOUND (contains "/firehose" nav)

### Commits
- d8c4f74 — feat(25a-06): firehose page, StewardShell nav, and Allowlist Monitor on /system
- 40c073c — feat(25a-06): Cognitive Inspector + Brain Health 2x2 grid on /nous/[id]
- 1c5e2ff — feat(25a-06): /humans/[did] drill-down page + /users deep-link wiring

### Build
- `npx tsc --noEmit` — exits 0
- `npm run build` — exits 0, all 14 routes built including `/firehose` and `/humans/[did]`

## Self-Check: PASSED
