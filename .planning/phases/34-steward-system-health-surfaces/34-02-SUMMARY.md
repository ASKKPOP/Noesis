---
phase: 34-steward-system-health-surfaces
plan: "02"
subsystem: steward
tags:
  - steward
  - hooks
  - lib
  - allowlist-static-fix
dependency_graph:
  requires: []
  provides:
    - steward/src/lib/use-health-detailed.ts
    - steward/src/lib/health-reason-labels.ts
    - steward/src/lib/event-family-colors.ts
    - steward/src/app/system/page.tsx (ALLOWLIST_STATIC 56 entries)
  affects:
    - steward/src/app/system/page.tsx
tech_stack:
  added: []
  patterns:
    - React hook with setInterval + AbortController (plain useState/useEffect/useRef)
    - Pure data module with Record<string, string> label table
    - Shared color palette with prefix-match helper
key_files:
  created:
    - steward/src/lib/use-health-detailed.ts
    - steward/src/lib/health-reason-labels.ts
    - steward/src/lib/event-family-colors.ts
  modified:
    - steward/src/app/system/page.tsx
decisions:
  - "reasons field typed as optional (readonly reasons?: readonly string[]) for parallel-wave safety with Plan 01"
  - "portal. color: sage/teal #4a7a6a (visually distinct from nous. and human.)"
  - "bios. color: warm terracotta-adjacent #a06a2e (visually distinct from operator. terracotta)"
  - "ALLOWLIST_STATIC count 57 per grep -c (includes type declaration line); actual array entries = 56"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-25"
  tasks_completed: 4
  files_created: 3
  files_modified: 1
requirements:
  - OBS-11
  - OBS-12
---

# Phase 34 Plan 02: Steward Lib Substrate Summary

Three new Steward lib modules plus the ALLOWLIST_STATIC inline fix. Delivers the polling hook, label table, and shared color palette consumed by Plans 03 and 04.

## What Was Built

### steward/src/lib/health-reason-labels.ts (31 lines)

Pure data module mapping the 7 snake_case reason keys from `computeStatus()` to short English labels. No imports, no React, no I/O. `getReasonLabel(key)` returns the label or the raw key as fallback — unknown future grid-side additions do not break the UI.

Keys covered: `grace_period`, `divergence_above_critical`, `persist_error_with_divergence`, `divergence_above_degraded`, `no_frames_with_clients`, `stale_frames`, `reconcile_stale`.

### steward/src/lib/event-family-colors.ts (51 lines)

Shared event-family color palette extracted from `firehose/page.tsx` (copy-only in this plan; Plan 04 wires the import and removes the inline duplicate). Added `portal.` (sage/teal, #4a7a6a) and `bios.` (warm terracotta-adjacent, #a06a2e) to the original 10 prefixes. Covers 12 named families + `unknown` fallback. `getFamilyColors()` and `getFamilyName()` are exact copies of the helpers inline in `firehose/page.tsx`.

### steward/src/lib/use-health-detailed.ts (140 lines)

Custom React hook polling `GET ${GRID_ORIGIN}/health/detailed` every 5000ms. Returns `{ data, error, isLoading, sentDeltas, droppedDeltas }`.

- 12-entry ring buffer for `frames_sent` and `frames_dropped` deltas (60s window, D-34-A3)
- AbortController cancels in-flight fetch on unmount; `clearInterval` clears the poll timer
- `reasons` field typed as `readonly reasons?: readonly string[]` (optional) for parallel-wave safety — works correctly whether Plan 01 has landed on the grid side or not
- Plain `useState`/`useEffect`/`useRef` — no SWR, no react-query (v2.1 frontend invariant)
- 503 special-cased: surfaces as "Health endpoint not ready." vs generic "HTTP N" for other errors

### steward/src/app/system/page.tsx — ALLOWLIST_STATIC fix (D-34-C1)

- Comment header updated: `(45 events as of Phase 24)` → `(56 events as of Phase 33)`
- Added positions 46-56 (11 new entries) with exact producer file paths verified against real files in `grid/src/audit/`
- Badge `{ALLOWLIST_STATIC.length} events` auto-updates to "56 events" from array length — no separate badge change needed
- All other sections of the file untouched (Plans 03 and 04 add the health cards and watchdog wiring)

## Verification Results

| Check | Result |
|-------|--------|
| `test -f steward/src/lib/health-reason-labels.ts` | PASS |
| `test -f steward/src/lib/event-family-colors.ts` | PASS |
| `test -f steward/src/lib/use-health-detailed.ts` | PASS |
| `cd steward && npx tsc --noEmit` | PASS (clean) |
| ALLOWLIST_STATIC array entries | 56 confirmed (positions 1-56) |
| All 11 new producer file paths exist on disk | PASS |
| `git diff steward/src/app/firehose/page.tsx` | empty (untouched) |
| No SWR/react-query imports in hook | PASS |
| 7 reason keys in health-reason-labels.ts | PASS |
| `portal.` and `bios.` in event-family-colors.ts | PASS |
| setInterval(fetchHealth, 5000) cadence | PASS |
| RING_CAPACITY = 12 | PASS |
| AbortController + clearInterval discipline | PASS |
| Math.max(0, ...) clamps for sent + dropped | PASS (2 occurrences) |

## ALLOWLIST_STATIC Entry Count Note

`grep -c "position: "` returns 57 because the TypeScript type declaration line `Array<{ position: number; ... }>` also contains `position: `. The actual array has exactly 56 entries (positions 1 through 56 inclusive), verified by `grep -c "{ position:"` against the data lines.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1: health-reason-labels.ts | 85d34ee | feat(34-02): create health-reason-labels.ts |
| Task 2: event-family-colors.ts | 1cda17a | feat(34-02): create event-family-colors.ts |
| Task 3: use-health-detailed.ts | 50d6ce3 | feat(34-02): create use-health-detailed.ts |
| Task 4: ALLOWLIST_STATIC fix | f9555e8 | fix(34-02): update ALLOWLIST_STATIC 45→56 |

## Deviations from Plan

None — plan executed exactly as written. All four files modified per the plan's `files_modified` list. No files outside the plan scope were touched.

## Known Stubs

None. The three new lib modules are complete implementations. The `steward/src/lib` directory (newly created) contains no placeholder code.

## Threat Flags

No new security-relevant surface introduced by this plan. The three new files are:
- A pure data module (health-reason-labels.ts) — no network, no I/O
- A pure data module with helpers (event-family-colors.ts) — no network, no I/O
- A read-only fetch hook (use-health-detailed.ts) — fetches the same public read-only endpoint already in scope per T-34-04 (accept)

ALLOWLIST_STATIC is a static literal — no user input flows through it.

## Self-Check: PASSED

Files created:
- steward/src/lib/health-reason-labels.ts: FOUND
- steward/src/lib/event-family-colors.ts: FOUND
- steward/src/lib/use-health-detailed.ts: FOUND

Commits verified in git log:
- 85d34ee: FOUND
- 1cda17a: FOUND
- 50d6ce3: FOUND
- f9555e8: FOUND
