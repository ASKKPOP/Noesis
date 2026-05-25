---
phase: 34-steward-system-health-surfaces
plan: "04"
subsystem: steward-firehose
tags:
  - steward
  - firehose
  - watchdog
  - event-family-colors
  - OBS-14
dependency_graph:
  requires:
    - "34-02"  # useHealthDetailed hook + event-family-colors.ts
  provides:
    - firehose-watchdog
    - firehose-event-family-colors-single-source
  affects:
    - steward/src/app/firehose/page.tsx
tech_stack:
  added: []
  patterns:
    - "useEffect watchdog with suppression ref (lastWatchdogCloseAtRef)"
    - "shared-lib import to eliminate inline duplicate (closes behavioral skew)"
key_files:
  created: []
  modified:
    - steward/src/app/firehose/page.tsx
decisions:
  - "Surgical inline addition (no use-firehose-ws.ts extraction) per CLAUDE.md §Surgical Changes and CONTEXT.md §Claude's Discretion"
  - "60s suppression window via lastWatchdogCloseAtRef prevents reconnect storm when last_frame_at remains briefly stale post-reconnect"
  - "Watchdog fires wsRef.current?.close(); delegates to existing ws.onclose → scheduleReconnect path — no new reconnect logic"
  - "EVENT_FAMILY_COLORS extraction done in this plan (not deferred to Phase 35) because Plan 02 + Plan 03 would create cross-page color divergence for portal.* and bios.* events during the same phase window"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-25T18:29:02Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 34 Plan 04: Firehose Watchdog + EVENT_FAMILY_COLORS Shared Import Summary

Client-side firehose watchdog (REQ OBS-14) that closes the WS on stale-frame detection, plus replacement of the inline EVENT_FAMILY_COLORS block with a single import from `@/lib/event-family-colors` — closes the Phase 34 cross-page color-skew window for `portal.*` and `bios.*` events.

## What Was Built

### Task 1: Watchdog Effect

Added to `steward/src/app/firehose/page.tsx`:

- `import { useHealthDetailed } from '@/lib/use-health-detailed'` — polls `/health/detailed` every 5s
- `const { data: health } = useHealthDetailed()` hook call inside `FirehosePage`
- `const lastWatchdogCloseAtRef = useRef<number | null>(null)` — suppression window ref
- A new `useEffect([health])` block that:
  - Returns early if `health` is null, `last_frame_at` is null, or `client_count <= 0`
  - Computes `stalenessMs = Date.now() - last_frame_at`; returns early if `<= 60_000`
  - Checks suppression: if `Date.now() - lastWatchdogCloseAtRef.current <= 60_000`, skips
  - Satisfies predicate: sets `lastWatchdogCloseAtRef.current = Date.now()` then calls `wsRef.current?.close()`
  - The existing `ws.onclose → scheduleReconnect()` path fires automatically

### Task 2: EVENT_FAMILY_COLORS Shared Import

Removed from `steward/src/app/firehose/page.tsx` (was lines 9–42):
- `const EVENT_FAMILY_COLORS: Record<...> = { ... }` (10 families + unknown — 11 entries)
- `function getFamilyColors(eventType: string) { ... }`
- `function getFamilyName(eventType: string): string { ... }`

Added:
```typescript
import { EVENT_FAMILY_COLORS, getFamilyColors, getFamilyName } from '@/lib/event-family-colors';
```

This closes the behavioral-skew window opened by Plan 02 + Plan 03: `portal.*` and `bios.*` events now render with their named family colors on `/firehose` (matching `/system` EventsPerMinuteSparkline). Previously, those prefixes fell through to the `unknown` fallback (`#dbd8cc` left border, muted badge).

## Diff Stat

```
steward/src/app/firehose/page.tsx | 32 insertions(+), 33 deletions(-)
```

Net: -1 line (inline block removed ~35 lines, watchdog effect added ~27 lines, two imports added +2).

## Frozen Code Paths Verification

All existing WS machinery UNCHANGED (verified by grep):

| Invariant | Check | Result |
|-----------|-------|--------|
| `function connect()` | count = 1 | PASS |
| `function scheduleReconnect()` | count = 1 | PASS |
| `Math.min(delay * 2, 30)` (backoff cap) | present | PASS |
| `const wsRef = useRef` | count = 1 | PASS |
| `const retryTimerRef = useRef` | count = 1 | PASS |
| `const countdownTimerRef = useRef` | count = 1 | PASS |
| `const retryDelayRef = useRef` | count = 1 | PASS |
| Unmount cleanup (wsRef.close + clearTimeout + clearInterval) | present | PASS |

## Watchdog Predicate Verification

| Predicate Component | Check | Result |
|--------------------|-------|--------|
| `stalenessMs <= 60_000` (60s stale threshold) | exactly 1 | PASS |
| `Date.now() - lastClose <= 60_000` (60s suppression) | exactly 1 | PASS |
| `clientCount <= 0` (client-count gate) | exactly 1 | PASS |
| `wsRef.current?.close()` (trigger action) | exactly 1 | PASS |
| `Phase 34 OBS-14` comment | present | PASS |

## EVENT_FAMILY_COLORS Rewire Verification

| Check | Result |
|-------|--------|
| `const EVENT_FAMILY_COLORS` declaration | 0 (removed) |
| `function getFamilyColors` declaration | 0 (removed) |
| `function getFamilyName` declaration | 0 (removed) |
| `from '@/lib/event-family-colors'` import | 1 (single import) |

## Behavioral Change — Color Rendering

**Before Plan 04** (with Plan 02 + 03 shipped): `/firehose` still used inline 10-family palette; `portal.*` and `bios.*` events rendered as `unknown` fallback (`#dbd8cc` left border, muted badge `#8a8479`).

**After Plan 04**: `/firehose` imports the 12-family shared palette. `portal.auth.login`, `portal.auth.register`, `bios.*` events render:
- `portal.*` — `#4a7a6a` left border, `rgba(74,122,106,0.10)` badge background, `#3a6a5a` badge text
- `bios.*` — `#a06a2e` left border, `rgba(160,106,46,0.10)` badge background, `#8a5a20` badge text

These now match the colors rendered by `/system` EventsPerMinuteSparkline (Plan 03 consumer of the same shared lib). Cross-page color-divergence window closed.

## Build Status

- `npm run typecheck` (`tsc --noEmit`): PASS (0 errors)

## Commit

- `017f3f3` — `feat(34-04): add firehose watchdog + replace inline EVENT_FAMILY_COLORS with shared-lib import`

## Deviations from Plan

None — plan executed exactly as written. Both tasks applied in one edit (same file, same commit) since applying them sequentially then committing each is equivalent to a single atomic commit for a single-file change; the plan's two-task structure was organizational, not requiring separate commits that would leave the file in a half-refactored state.

## Self-Check: PASSED

- [x] `steward/src/app/firehose/page.tsx` exists and contains watchdog effect
- [x] `017f3f3` commit exists in git log
- [x] Typecheck clean
- [x] No unexpected file deletions
