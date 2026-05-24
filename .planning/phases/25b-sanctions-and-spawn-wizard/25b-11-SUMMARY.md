---
phase: 25b-sanctions-and-spawn-wizard
plan: 11
subsystem: steward-ui
tags: [sanctions, nous-detail, header-auth, steward-ui]
requirements: [D-25b-07]

dependency_graph:
  requires: [25b-09, 25b-10]
  provides: [nous-sanctions-ui]
  affects: [steward/src/app/nous/[id]/page.tsx]

tech_stack:
  added: []
  patterns:
    - per-row useState for form state (reason, amount, status, submitting)
    - header-auth fetch pattern (x-operator-tier + x-operator-id, no body auth)
    - confirmation banner (success/error) matching existing steward-card shape

key_files:
  modified:
    - steward/src/app/nous/[id]/page.tsx

decisions:
  - Inline JSX per CLAUDE.md §3 — no extracted SanctionRow component; all state local
  - Sanctions card inserted between Force Telos (line ~839) and Danger Zone (line ~841)
  - Each sanction row is a self-contained <form> with its own submit handler
  - H3 rows send x-operator-tier: 3; H4 rows send x-operator-tier: 4 per route tier

metrics:
  duration: "~10 minutes"
  completed: "2026-05-21"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 25b Plan 11: Sanctions Card for /nous/[id] — Summary

**One-liner:** Sanctions card with 4 header-auth action rows (mute/force-sleep at H3, quarantine/slash at H4) added between Force Telos and Danger Zone on the Nous detail page.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add Sanctions card to /nous/[id] page | 1970843 | steward/src/app/nous/[id]/page.tsx |

## What Was Built

Added a "Sanctions" steward-card to `steward/src/app/nous/[id]/page.tsx` exposing all 4 Nous sanction routes from plans 09 and 10:

1. **Mute Broadcast (H3)** — reason textarea → `POST /api/v1/operator/nous/:did/mute`
2. **Force Sleep (H3)** — reason textarea → `POST /api/v1/operator/nous/:did/force-sleep`
3. **Quarantine (H4)** — reason textarea → `POST /api/v1/operator/nous/:did/quarantine`
4. **Slash Cyber Coin (H4)** — amount number input + reason textarea → `POST /api/v1/operator/nous/:did/slash`

Each row uses:
- `x-operator-tier` header (3 or 4 per route)
- `x-operator-id` header (from `NEXT_PUBLIC_STEWARD_OPERATOR_ID` env or fallback)
- Local `useState` for reason, amount (slash), submitting flag, and status message
- Success banner on 200; error code display on 4xx; "Network error" on catch

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm --prefix steward run build` — passed (Next.js 15.3.2, 0 TypeScript errors)
- `grep -c "x-operator-tier" steward/src/app/nous/[id]/page.tsx` → 6 (1 pre-existing cognitive-snapshot + 4 new sanction rows + 1 comment = 6, ≥4 new confirmed)
- `grep "JSON.stringify.*tier" steward/src/app/nous/[id]/page.tsx` → nothing (no body-tier)
- Sanctions card inserted between Force Telos and Danger Zone in JSX tree

## Known Stubs

None. All 4 fetch endpoints connect to routes shipped in plans 09 and 10. No placeholder data.

## Threat Flags

None beyond what was declared in the plan's threat model (T-25b-11-01: client-side tier value accepted; T-25b-11-02: reason text in browser).

## Self-Check: PASSED

- File exists: steward/src/app/nous/[id]/page.tsx — FOUND (modified)
- Commit exists: 1970843 — FOUND (`git log --oneline -1` confirms `feat(25b-11): add Sanctions card...`)
- Build: PASSED
