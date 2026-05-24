---
phase: 29-community
plan: "05"
title: "COM-05 Live Activity Feed — /portal/activity page"
subsystem: dashboard/portal
tags: [dashboard, community, activity, feed, ui, polling]
completed: "2026-05-23"

dependency_graph:
  requires: [29-01]
  provides: [portal-activity-page, ActivityEventCard]
  affects: [dashboard/src/app/portal/activity/page.tsx]

tech_stack:
  added: []
  patterns: [useEffect-polling, setInterval-cleanup, named-export-component]

key_files:
  created:
    - dashboard/src/components/portal/ActivityEventCard.tsx
  modified:
    - dashboard/src/app/portal/activity/page.tsx

decisions:
  - "Named export for ActivityEventCard (not default) — consistent with other portal components"
  - "Pre-existing tsc errors in chat test files are out of scope; new files compile cleanly"
  - "Accent colors for event types (spawn green, lore purple, join blue) are intentional design constants, not Tailwind tokens"

metrics:
  duration: "~3 minutes"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 29 Plan 05: COM-05 Live Activity Feed — Summary

**One-liner:** Replaced Phase 27 placeholder with live polling activity feed — `ActivityEventCard` component + 10s interval `setInterval`/`clearInterval` pattern against `GET /api/v1/portal/activity`.

## What Was Built

### ActivityEventCard component
`dashboard/src/components/portal/ActivityEventCard.tsx`

Named export. Renders a single Grid audit event with:
- Circular icon container with event-type border color
- SVG icon (chat bubble for speech, sparkle for spawns, book for lore, user-plus for joins)
- Human-readable label via `eventLabel()` — e.g. "abc123…ef90 joined the Grid"
- Event type badge in monospace uppercase
- Relative timestamp ("just now", "5m ago", "2h ago", "1d ago")

All 6 event types handled:
| event_type | icon | label pattern |
|---|---|---|
| `nous.spoke` | chat bubble (navy) | `{actor} spoke` |
| `human.spoke` | chat bubble (bronze) | `{actor} sent a message` |
| `nous.spawned_by_human` | sparkle (green) | `{actor} spawned a Nous` |
| `lore.contributed` | book (purple) | `{actor} contributed lore` |
| `human.joined` | user-plus (blue) | `{actor} joined the Grid` |
| `nous.spawned` | sparkle (teal) | `{actor} was born` |

### Activity page
`dashboard/src/app/portal/activity/page.tsx`

Replaced the Phase 27 placeholder. Key behaviors:
- `useEffect` starts polling on mount with `setInterval(fetchFeed, 10_000)`
- `useRef` stores interval handle for proper `clearInterval` cleanup on unmount
- All fetches: `credentials: 'include'`
- 401 → "Sign in to view activity" error state
- Network error → "Network error — retrying…" (continues polling)
- Empty state: "The Grid is quiet" card
- Live state: bordered parchment card list of `ActivityEventCard` rows
- Header shows "Updated HH:MM:SS" timestamp after first load
- Footer: "Refreshes every 10 seconds"

## Deviations from Plan

None — plan executed exactly as written. The prompt provided complete implementation code which was used verbatim with the addition of the named export form (matching portal component conventions).

## Known Stubs

None. The page wires directly to `GET /api/v1/portal/activity` (implemented in 29-01). No placeholder data.

## Self-Check: PASSED

- `/Users/desirey/Programming/src/Noesis/dashboard/src/components/portal/ActivityEventCard.tsx` — FOUND
- `/Users/desirey/Programming/src/Noesis/dashboard/src/app/portal/activity/page.tsx` — FOUND (no longer a placeholder)
- Commit `952a369` — FOUND
- `npx tsc --noEmit` — no errors in new files (pre-existing chat test errors are unrelated, out of scope)
