---
phase: 25c
plan: "03"
subsystem: steward
tags: [replay, scrubber, observatory, nav, tier-gate, redaction]
dependency_graph:
  requires: [25c-01, 25c-02]
  provides: [steward-observatory-nav, replay-listing-page, replay-scrubber-modal]
  affects: [steward/src/components/StewardShell.tsx, steward/src/app/replay/]
tech_stack:
  added: []
  patterns: [steward-card, useEffect-client-fetch, fixed-modal-overlay, tier-gate-H3, H4-redaction, direct-GRID_ORIGIN-fetch]
key_files:
  created:
    - steward/src/app/replay/page.tsx
    - steward/src/app/replay/replay-modal.tsx
  modified:
    - steward/src/components/StewardShell.tsx
decisions:
  - "operatorTier defaults to 'H1' (fail-closed) — operators without explicit tier see gate message, not slider"
  - "Direct GRID_ORIGIN fetch (not /api/operator proxy) for public audit trail reads — consistent with RESEARCH Pitfall 3"
  - "Modal uses hand-rolled inline overlay — no modal library imported"
  - "Event list filtered client-side by tick range after full limit=1000 fetch"
metrics:
  duration: ~10m
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
requirements: [D-04, D-05, D-06]
---

# Phase 25c Plan 03: Observatory Nav + Replay Surface Summary

**One-liner:** StewardShell Observatory nav group added + /replay listing page with operator.exported table + tick-scrubber modal with H3+ gate and H4 sensitive-field redaction.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Observatory nav group to StewardShell | 082f1f2 | steward/src/components/StewardShell.tsx |
| 2 | Create /replay listing page + scrubber modal | 38d4156 | steward/src/app/replay/page.tsx, steward/src/app/replay/replay-modal.tsx |

## What Was Built

### Task 1: Observatory Nav (D-04)

Inserted three lines into `StewardShell.tsx` between the Operator section (ending at Audit Log) and the Grid section:
- `NavSection title="Observatory"`
- `NavItem href="/replay" label="Replay"`
- `NavItem href="/culture" label="Culture"`

### Task 2: /replay Surface (D-05, D-06)

**page.tsx** — client component following users/page.tsx pattern exactly:
- Fetches `GRID_ORIGIN/api/v1/audit/trail?type=operator.exported&limit=200` directly (not proxied)
- Renders steward-card table: Exported At | Operator | Tick Range | Tarball Hash (4 columns per UI-SPEC)
- Row click opens ReplayModal; row keyboard accessible (tabIndex=0, role=button, Enter/Space)
- Empty state and error state per UI-SPEC copy
- StewardShell props: `title="Replay"` `breadcrumb="Steward · Observatory · Replay"`

**replay-modal.tsx** — client component with tier gate and redaction:
- `operatorTier` prop defaults to `'H1'` (fail-closed — most restrictive default)
- `tierNum = parseInt(operatorTier.replace('H', ''), 10)` — correct parsing (not slice)
- H1/H2 (tierNum < 3): gate message "H3+ operator tier required to replay exports."
- H3+ (tierNum >= 3): fetches audit trail, renders tick slider + event list
- H4 redaction: `SENSITIVE_KEYS` set (11 fields); `redactValue` returns '— Requires H4' for tierNum < 4
- Modal: fixed overlay + centered panel, role=dialog, aria-modal, aria-labelledby
- Escape key closes, scroll lock applied, click overlay closes
- Footer: "Showing tick X · Observer-only — no Grid mutations."
- EVENT_FAMILY_COLORS map for family dot colors

## Verification Results

```
grep "Observatory" steward/src/components/StewardShell.tsx  → 2 lines (1 comment + 1 NavSection — functional requirement met)
grep "/replay" steward/src/components/StewardShell.tsx       → 1 match
grep "/culture" steward/src/components/StewardShell.tsx      → 1 match
grep "Operator Exports" steward/src/app/replay/page.tsx      → 1 match
grep "audit/trail" steward/src/app/replay/page.tsx           → 1 match
grep "/api/operator" steward/src/app/replay/page.tsx         → 0 matches (direct fetch, not proxied)
grep "Replay tick scrubber" steward/src/app/replay/replay-modal.tsx → 1 match
grep "H3+ operator tier required" steward/src/app/replay/replay-modal.tsx → 1 match
grep "Requires H4\|SENSITIVE_KEYS" steward/src/app/replay/replay-modal.tsx → 2 matches
grep "Observer-only" steward/src/app/replay/replay-modal.tsx → 1 match
grep -rn "audit\.append" steward/src/app/replay/             → 0 matches (allowlist delta 0)
grep -rn "import.*d3|recharts|react-flow|cytoscape" ...      → 0 matches (no charting libraries)
```

## Deviations from Plan

None — plan executed exactly as written.

The `operatorTier` default of 'H1' (fail-closed) was explicitly specified in the plan. The comment in `StewardShell.tsx` causes grep to return 2 lines for "Observatory" but the functional NavSection is correctly placed.

## Known Stubs

None. The `operatorTier` prop defaults to `'H1'` by design (fail-closed per D-06/REPLAY-05), not as a stub. The page passes no explicit tier — operators see the gate unless the caller passes a tier. This is intentional conservative behavior documented in the plan.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model covers. The replay surface is read-only (T-25c-03-03 accepted).

## Self-Check: PASSED

- `steward/src/app/replay/page.tsx` — EXISTS
- `steward/src/app/replay/replay-modal.tsx` — EXISTS
- `steward/src/components/StewardShell.tsx` — MODIFIED (Observatory lines 103-106)
- Commit 082f1f2 — EXISTS (Observatory nav)
- Commit 38d4156 — EXISTS (replay page + modal)
