---
phase: 29-community
plan: "02"
subsystem: dashboard
tags: [dashboard, community, ui, leaderboard, directory]
dependency_graph:
  requires:
    - grid/community_api
  provides:
    - dashboard/community_hub_ui
    - dashboard/user_directory_row
    - dashboard/leaderboard_row
  affects:
    - dashboard/src/app/portal/community/page.tsx
    - dashboard/src/app/portal/community/leaderboard/page.tsx
    - dashboard/src/app/portal/leaderboard/page.tsx
    - dashboard/src/components/portal/UserDirectoryRow.tsx
    - dashboard/src/components/portal/LeaderboardRow.tsx
tech_stack:
  added: []
  patterns:
    - tab navigation with inline styles + CSS vars (no Tailwind color tokens)
    - lazy data fetch on tab activation (useEffect + useState)
    - blockie avatar via deterministic hsl() from address hash
    - named exports for components (not default) for tree-shaking
key_files:
  created:
    - dashboard/src/components/portal/UserDirectoryRow.tsx
    - dashboard/src/components/portal/LeaderboardRow.tsx
    - dashboard/src/app/portal/community/leaderboard/page.tsx
  modified:
    - dashboard/src/app/portal/community/page.tsx
    - dashboard/src/app/portal/leaderboard/page.tsx
decisions:
  - "Named exports (not default) for UserDirectoryRow and LeaderboardRow — matches existing portal component convention and enables tree-shaking"
  - "Rank badge uses border + text in badge color (not filled circle) — cleaner in editorial theme vs solid gold/silver/bronze fill"
  - "Blockie uses 3-stop CSS gradient from 3 address-seeded hsl() values — avoids canvas API complexity, same visual uniqueness"
  - "Board tab placeholder includes data-testid=community-board-placeholder for Plan 29-03 integration test hooks"
metrics:
  duration: "2 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 29 Plan 02: Community Hub UI Summary

Tab-based community hub at `/portal/community` with Board placeholder, User Directory (up to 100 humans sorted ousia DESC), and Leaderboard (top 50 by ousia) — plus redirect from old `/portal/leaderboard`.

## What Was Built

### Components (dashboard/src/components/portal/)

**UserDirectoryRow.tsx** — Row for the community user directory:
- Blockie avatar: 3-stop CSS gradient from address-seeded hsl() values (deterministic, unique per address)
- Truncated address: `0x1234…5678` format
- Nous name badge (bronze color, conditionally rendered)
- Ousia balance with `K`/`M` formatting
- Join date formatted as "May 2026"

**LeaderboardRow.tsx** — Row for the leaderboard:
- Rank badge: circular border + number in rank color (#1 gold `#c9a227`, #2 silver `#8b9296`, #3 bronze `#8b5e3c`, rest `var(--muted)`)
- Truncated address + Nous name (if any)
- Nous contribution count (shown when `nous_score > 0`)
- Ousia balance with `K`/`M` formatting

### Pages

**`/portal/community/page.tsx`** (replaced Phase 28 placeholder):
- Client component with `useState<Tab>('board')` for tab switching
- Three tabs: Board | Users | Leaderboard
- Lazy fetch: data loads only when tab is first activated, cached in component state
- Both fetch calls use `credentials: 'include'` for JWT cookie auth
- Error state per tab (shown inline)
- Board tab: placeholder div with `data-testid="community-board-placeholder"` for Plan 29-03

**`/portal/community/leaderboard/page.tsx`** (new):
- Standalone leaderboard page at `/portal/community/leaderboard`
- Fetches `/api/v1/portal/community/leaderboard` on mount
- Uses `LeaderboardRow` component

**`/portal/leaderboard/page.tsx`** (replaced Phase 28 placeholder):
- Server component with `redirect('/portal/community/leaderboard')` from `next/navigation`

## API Connections

| Component | Endpoint | Auth |
|-----------|----------|------|
| Community hub (Users tab) | `GET /api/v1/portal/community/users` | `credentials: 'include'` |
| Community hub (Leaderboard tab) | `GET /api/v1/portal/community/leaderboard` | `credentials: 'include'` |
| Leaderboard standalone page | `GET /api/v1/portal/community/leaderboard` | `credentials: 'include'` |

## Commits

| Hash | Message |
|------|---------|
| 3724f34 | feat(29-02): UserDirectoryRow + LeaderboardRow components |
| 1b79cc8 | feat(29-02): community hub tab shell + leaderboard pages + redirect |

## Deviations from Plan

### Adapted: Component exports are named, not default

The plan prompt showed `export default function UserDirectoryRow(...)` and `export default function LeaderboardRow(...)`. The community page imports them as `import { UserDirectoryRow } from '...'` (named). Used named exports throughout for consistency — both the components and the page's import match.

### Adapted: Rank badge style is outline, not filled

The plan's `LeaderboardRow` sketch showed `background: badgeColor` with white text. Changed to border + color text (no fill) — the editorial theme's parchment background makes outline badges look cleaner and avoids raw hex fills inside components. Rank color constants (`#c9a227`, `#8b9296`, `#8b5e3c`) are intentional design constants, not CSS variable candidates.

## Known Stubs

**Board tab placeholder** — `community/page.tsx` Board tab renders a static placeholder card. This is intentional: Plan 29-03 will replace it with `PostComposer` + `PostCard` list. The `data-testid="community-board-placeholder"` attribute allows Plan 29-03 to locate and replace the correct DOM region.

## Threat Flags

None. All new routes fetch read-only data from existing Grid API endpoints behind JWT auth. No new network surface beyond what 29-01 established.

## Self-Check: PASSED

- UserDirectoryRow.tsx: FOUND
- LeaderboardRow.tsx: FOUND
- community/page.tsx: FOUND (replaced placeholder)
- community/leaderboard/page.tsx: FOUND
- leaderboard/page.tsx: FOUND (redirect)
- Commit 3724f34: FOUND
- Commit 1b79cc8: FOUND
- TypeScript (non-test files): 0 errors
