---
phase: 41
plan: "06"
subsystem: civic-presence
tags: [civic-map, sleep-cycle, steward-console, grid-manager, presence-api]
dependency_graph:
  requires: [41-02, 41-03, 41-04, 41-05]
  provides: [SLEEP-01, SLEEP-02]
  affects: [dashboard/civic-map, steward/operators, grid/civic-presence, grid/api/routes]
tech_stack:
  added: []
  patterns: [presence-aware-rendering, option-a-inline-merge, portal_session_required-endpoint]
key_files:
  created:
    - grid/src/api/routes/grid-manager-presence.ts
  modified:
    - grid/src/civic-presence/presence-service.ts
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - grid/src/api/routes/civic-map.ts
    - dashboard/src/lib/use-civic-map.ts
    - dashboard/src/app/portal/civic-map/CivicMap.tsx
    - steward/src/app/system/operators/page.tsx
decisions:
  - "Option A chosen for civic-map presence merge: extended civic-map.ts NousMapEntry + route handler to include presence fields inline. Single endpoint, no client-side merge. See rationale below."
  - "gridName was already on GridServices (line 125 of server.ts) — no interface change needed"
  - "registerGridManagerPresenceRoute uses void (not await) to match buildServerWithHub sync pattern"
metrics:
  duration: "10 minutes"
  completed_date: "2026-05-27"
  tasks_completed: 4
  tasks_total: 5
  files_modified: 7
  files_created: 1
---

# Phase 41 Plan 06: Civic Map 4-State + Steward Section 4 + Grid Manager API — Summary (PARTIAL)

Tasks 1-4 complete. Task 5 (human-verify) pending orchestrator checkpoint.

## What Was Built

### Task 1: GET /api/v1/grid-manager/presence-overview

New endpoint backing Steward Console Section 4. Policy: `portal_session_required` (Tier-2 Grid Manager per D-V3-36).

- `PresenceService.queueDepthByRecipient()` — passthrough to `MessageQueueStore.depthByRecipient(gridName)`
- Route handler: composes `listAllPresence()` + `queueDepthByRecipient()` + brain_tokens JOIN for operator_did lookup
- Filter: only rows where `presenceStatus !== 'awake'` OR `queueDepth > 0` are returned
- Response shape: `{ presence_summary: PresenceOverviewRow[] }`
- ROUTE_DID_POLICY entry added (entry #130)

### Task 2: useCivicMap Hook + Civic Map Route Extension (Option A)

**Option A chosen** — extended `grid/src/api/routes/civic-map.ts` NousMapEntry interface to include `presence_status?` and `last_seen_at?` inline. The route handler merges presence data from `PresenceService.listAllPresence()` when Phase 37 populates nous[].

**Rationale for Option A over Option B:**
- Option A (inline merge): Single GET /api/v1/civic-map/state call returns everything; no client-side key-hashing dance; no second fetch from Dashboard
- Option B (two endpoints + client merge): Would require hashing civic_did on client to match civic_did_hash keys, OR exposing plaintext civic_did on the presence endpoint. More complex, more surface area.
- The civic-map route is a Phase 36 stub (nous[] always empty); extending its NousMapEntry type is backwards-compatible (optional fields). Phase 37 will populate nous[] and the presence merge block activates.
- No sole-producer constraints in civic-map.ts — it doesn't emit any audit events.

`use-civic-map.ts` changes:
- Polling interval: 5s → 30s (D-41-06 supersedes D-36-13)
- `NousMapEntry` extended: `presence_status?` + `last_seen_at?` optional fields
- Comment updated: `D-41-06` replaces `D-36-13` reference

### Task 3: CivicMap.tsx 4-State Presence Rendering

Replaced single `<circle>` with 4-state conditional render per UI-SPEC:

| State | Fill | Opacity | Filter | Hover | Cursor |
|-------|------|---------|--------|-------|--------|
| awake | type color | 1 | none | expand | pointer |
| away | type color | 0.4 | grayscale(100%) | expand | pointer |
| absent | #6a6a76 | 0.35 | grayscale(100%) | expand | pointer |
| presumed_departed | none (stroke #6a6a76 1.5px) | 1 | none | no expand | default |

- `<title>` tooltip added as first child of `<g>` (tooltip text for away/absent/presumed)
- `aria-label` updated to include `presence` status (was `n.status`)
- `presumed_departed` hitbox: `pointerEvents: none`, `cursor: default`, no onClick/onMouseEnter/onMouseLeave

### Task 4: Steward /system/operators Section 4

New "Message Queue Depth" section added after Section 3.

- `PresenceQueueRow` interface + `presenceSummary` state
- `formatRelative()` helper for ISO timestamp → human-readable
- `load()` extended with silent fetch of `/api/v1/grid-manager/presence-overview`
- Table: 5 columns (Operator DID, Nous, Status, Last Seen, Queued Messages)
- Row background: `bg-red-50` at >=50, `bg-amber-50` at 10-49, normal below 10
- Status pills: amber=away, orange=absent, red=presumed_departed
- Empty state: "All Nous are currently awake. No queued messages."

## Deviations from Plan

None — plan executed exactly as written. `gridName` was already on `GridServices` (no need to add it). `registerGridManagerPresenceRoute` uses `void` instead of `await` to match the sync pattern of `buildServerWithHub`.

## Known Stubs

- `nous_name` in `PresenceOverviewRow` is always `null` — Phase 44/46 will join civic_did_registry credential_json for display name. Steward Section 4 falls back to `row.civic_did.slice(0,24) + '…'`
- Civic Map presence merge block in `registerCivicMapRoute` is unreachable while `nous[]` stub is empty — activates when Phase 37 populates the array

## Deferred Issues

- Pre-existing: `steward/src/app/system/operators/page.tsx` TS2739 (`StewardShell` missing `title`/`breadcrumb` props). Not caused by Task 4. Out of scope.
- Pre-existing: `dashboard/src/app/portal/civic-map/CivicMap.test.tsx` fails with OXC JSX parse error. Not caused by Task 3. Out of scope.
- Pre-existing: 64 grid test failures (unchanged before/after Tasks 1-4).

## Task 5: Human Verify — PENDING

Task 5 (checkpoint:human-verify) is the orchestrator checkpoint. Awaiting human verification of:
1. Portal Civic Map 4 visual presence states
2. Steward Section 4 Message Queue Depth table
3. GET /api/v1/grid-manager/presence-overview JSON response

## Post-Task-5 Actions (DO NOT run until after human approval)

- Update ROADMAP.md: Phase 41 plans 0/6 → 6/6 complete
- Update STATE.md: shift focus to Phase 42
- Update REQUIREMENTS.md: SLEEP-01..05 marked Validated
- Update MILESTONES.md: append Phase 41 ship summary

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | 8b32173 | feat(41-06): GET /api/v1/grid-manager/presence-overview endpoint |
| 2 | dcf9bfd | feat(41-06): extend useCivicMap 30s polling + presence fields (Option A) |
| 3 | 3bcd0fd | feat(41-06): CivicMap 4-state presence rendering per UI-SPEC |
| 4 | 64c79ba | feat(41-06): Steward /system/operators Section 4 — Message Queue Depth |

## Self-Check: PASSED

Files created exist:
- grid/src/api/routes/grid-manager-presence.ts: FOUND

Commits exist (verified via git log):
- 8b32173: FOUND
- dcf9bfd: FOUND
- 3bcd0fd: FOUND
- 64c79ba: FOUND

Done criteria:
- ROUTE_DID_POLICY entry count for presence-overview: 1
- queueDepthByRecipient in presence-service.ts: 1
- registerGridManagerPresenceRoute in server.ts: 2 (import + call)
- 30_000 polling in use-civic-map.ts: 1 (5000 count: 0)
- presence_status in use-civic-map.ts: 1
- presence_status|isAway|isAbsent|isPresumed in CivicMap.tsx: 18
- grayscale in CivicMap.tsx: 2
- title tag in CivicMap.tsx: 1
- Message Queue Depth in operators/page.tsx: 4
- presence-overview in operators/page.tsx: 1
- queue_depth in operators/page.tsx: 6
- bg-red-50 in operators/page.tsx: 2
- bg-amber-50 in operators/page.tsx: 2
