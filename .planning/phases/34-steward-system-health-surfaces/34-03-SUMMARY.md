---
phase: 34-steward-system-health-surfaces
plan: "03"
subsystem: steward
tags:
  - steward
  - components
  - sparkline
  - health-cards
  - OBS-11
  - OBS-12
  - OBS-13
dependency_graph:
  requires:
    - "34-02"  # use-health-detailed.ts, health-reason-labels.ts, event-family-colors.ts
  provides:
    - "3 new cards on /system above Allowlist Monitor"
    - "FrameCounterSparkline component"
    - "EventsPerMinuteSparkline component"
  affects:
    - "steward/src/app/system/page.tsx"
tech_stack:
  added: []
  patterns:
    - "raw inline SVG sparkline (v2.4 invariant)"
    - "CSS-div bar sparkline (D-34-A1 deliberate exception)"
    - "REST-poll with AbortController + clearInterval cleanup"
    - "Set-based reason key partitioning (AUDIT_REASONS / FIREHOSE_REASONS)"
    - "divergenceBand() green/amber/red color function"
key_files:
  created:
    - "steward/src/components/FrameCounterSparkline.tsx (90 lines)"
    - "steward/src/components/EventsPerMinuteSparkline.tsx (174 lines)"
  modified:
    - "steward/src/app/system/page.tsx (188 lines inserted, 831 total)"
decisions:
  - "D-34-A1 honored: EventsPerMinuteSparkline uses raw SVG; FrameCounterSparkline uses CSS divs (single-signal exception)"
  - "D-34-A2 honored: 60 buckets × 5s = 5-minute window for EPM sparkline"
  - "D-34-A3 honored: 12 buckets × 5s for FrameCounterSparkline; dropped row uses var(--terracotta)"
  - "D-34-B3 honored: reasons sub-line between stat-grid and sparkline (Firehose); grace_period exception under status=ok (Audit)"
  - "Pre-existing /culture build failure is out-of-scope (confirmed same failure on base commit before changes)"
metrics:
  duration: "262s (~4.4 min)"
  completed: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 34 Plan 03: System Health Cards Summary

Three new cards added to Steward `/system` above the Allowlist Monitor, using the `useHealthDetailed()` hook from Plan 02 and the `EVENT_FAMILY_COLORS` / `getReasonLabel` utilities also from Plan 02.

## One-liner

Audit Pipeline Health (OBS-11), Firehose Diagnostics (OBS-12), and Events-per-Minute-by-Family (OBS-13) cards on `/system`, with divergence color banding, reasons sub-lines partitioned by domain, and a REST-driven SVG sparkline that survives firehose failure.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create FrameCounterSparkline.tsx | 772b57e | steward/src/components/FrameCounterSparkline.tsx |
| 2 | Create EventsPerMinuteSparkline.tsx | 946c376 | steward/src/components/EventsPerMinuteSparkline.tsx |
| 3 | Insert 3 cards into system/page.tsx | d96c15b | steward/src/app/system/page.tsx |

## Component Details

### FrameCounterSparkline.tsx (90 lines)

- Two-row CSS-div bar layout (D-34-A1 deliberate exception — single-signal bars don't need SVG)
- 12-bucket × 5s ring (D-34-A3: RING_CAPACITY = 12)
- Sent row: `var(--ink)` at 40% opacity (neutral palette)
- Dropped row: `var(--terracotta)` (warning palette)
- `padRing()` pads cold-start sparse rings with zeros to maintain 12-bar width
- `scaleBar()` height-encodes delta relative to ring max; minimum 1px for non-zero values
- No SVG, no canvas, no chart libraries

### EventsPerMinuteSparkline.tsx (174 lines)

- Raw inline SVG (v2.4 Culture Dashboard invariant — no d3/recharts/react-flow/cytoscape)
- 60 buckets × 5s = 5-minute window (D-34-A2: BUCKET_COUNT = 60, BUCKET_WINDOW_MS = 5_000)
- REST-driven: fetches `/api/v1/audit/trail?limit=200` every 5s (NOT WebSocket — REQ OBS-13)
- `bucketEntries()` slots entries by age into right-to-left bucket array (bucket 0 = most recent)
- `familyColor()` resolves family name → `EVENT_FAMILY_COLORS[prefix].leftBorder`
- Stacked bars per bucket colored by event-family prefix
- Family legend below SVG showing families seen in current window
- AbortController + clearInterval cleanup on unmount
- PII discipline: only `event_type` + `created_at` consumed per entry

## Card Insertion Verification

Line-number ordering confirms cards are inside SystemPage return tree and above Allowlist Monitor:

```
function SystemPage: line 196
{/* Audit Pipeline Health: line 537
{/* Firehose Diagnostics: line 597
{/* Events per Minute by Family: line 668
{/* Allowlist Monitor: line 683
```

N1=196 < N2=537 < N3=597 < N4=668 < N5=683 — ordering verified.

## D-34-B3 Placement Verification

Within the Firehose Diagnostics block (lines 597-668), `firehoseReasons.map(getReasonLabel)` appears at relative line 63 and `<FrameCounterSparkline` appears at relative line 66.

63 < 66 — reasons sub-line sits BETWEEN the stat-grid and the sparkline as required.

## Reason Key Partitioning

Module-scope Sets at the top of system/page.tsx:

```typescript
const AUDIT_REASONS = new Set(['grace_period', 'divergence_above_critical',
    'persist_error_with_divergence', 'divergence_above_degraded', 'reconcile_stale']);
const FIREHOSE_REASONS = new Set(['no_frames_with_clients', 'stale_frames']);
```

- `auditReasons = allReasons.filter(r => AUDIT_REASONS.has(r))` — rendered below divergence banner
- `firehoseReasons = allReasons.filter(r => FIREHOSE_REASONS.has(r))` — rendered between stat-grid and sparkline
- D-34-B3 EXCEPTION: `grace_period` is in AUDIT_REASONS and renders whenever present (including under `status === 'ok'`)

## Color Banding

`divergenceBand(div)` function:
- `null` → muted (no data yet)
- `0` → green: `#2d7a2d` text, `rgba(34,139,34,0.06)` bg, `rgba(34,139,34,0.3)` border
- `1-10` → amber: `#b88a2f` text, `rgba(184,138,47,0.08)` bg, `rgba(184,138,47,0.35)` border
- `>10` → red: `var(--terracotta)` text, `rgba(184,84,47,0.08)` bg, `rgba(184,84,47,0.4)` border, 4px left border accent

## Existing Sections Untouched

- Grid Status: 2 occurrences (still present)
- Clock Control: 2 occurrences (still present)
- Regions: 14 occurrences (still present)
- Allowlist Monitor anchor: 1 occurrence (unchanged)
- `firehose/page.tsx`: 0 diff lines (untouched — Plan 04 owns that file)

## Build Status

- `npm run typecheck` (steward): PASSED (no output = clean)
- `npm run build` (steward): Pre-existing failure on `/culture` page (`useSearchParams()` missing Suspense boundary) — confirmed same failure existed on base commit `3b8c30a` before any Plan 03 changes. Out-of-scope per deviation rule scope boundary.

## Deviations from Plan

None — plan executed exactly as written.

The `/culture` build failure is pre-existing and out of scope. Logged to deferred items below.

## Deferred Issues

- **Pre-existing `/culture` build failure**: `useSearchParams()` in `/culture/page.tsx` not wrapped in Suspense boundary. Fails `npm run build` at static page generation. Exists on base commit before any Phase 34 changes. Not introduced by this plan. Deferred to future phase (culture page maintenance).

## Known Stubs

None. All three cards wire live data through `useHealthDetailed()` (Audit + Firehose cards) or the REST fetch in `EventsPerMinuteSparkline` (EPM card). No hardcoded empty values or placeholder text that would prevent the plan's goal from being achieved.

## Threat Flags

None. All files created/modified in this plan are within the trust boundaries already defined in the plan's `<threat_model>`:
- T-34-08 mitigated: `EventsPerMinuteSparkline` consumes only `event_type` + `created_at`
- T-34-09 mitigated: reasons sub-lines use React text children (auto-escaped); no `dangerouslySetInnerHTML`
- T-34-10 accepted: 5s REST polling within capacity
- T-34-11 accepted: card ordering anchored by source comment `{/* Allowlist Monitor */}`

## Self-Check: PASSED

Files exist:
- `steward/src/components/FrameCounterSparkline.tsx`: FOUND
- `steward/src/components/EventsPerMinuteSparkline.tsx`: FOUND
- `steward/src/app/system/page.tsx`: FOUND (modified)

Commits exist:
- `772b57e` (FrameCounterSparkline): FOUND
- `946c376` (EventsPerMinuteSparkline): FOUND
- `d96c15b` (system/page.tsx cards): FOUND
