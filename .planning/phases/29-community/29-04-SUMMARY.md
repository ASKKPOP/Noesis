---
phase: 29-community
plan: "04"
title: "COM-04 Follow Users — Dashboard FollowButton component"
subsystem: dashboard/portal/community
tags: [dashboard, community, follow, ui]
dependency_graph:
  requires: [29-01, 29-02]
  provides: [FollowButton, follow-graph-ui]
  affects: [community/page.tsx, UserDirectoryRow (sibling)]
tech_stack:
  added: []
  patterns: [optimistic-local-state, credential-cookie-fetch, self-row-suppression]
key_files:
  created:
    - dashboard/src/components/portal/FollowButton.tsx
  modified:
    - dashboard/src/app/portal/community/page.tsx
decisions:
  - "FollowButton rendered as sibling in page wrapper (not inside UserDirectoryRow) to keep UserDirectoryRow display-only"
  - "followingSet size === 0 guard prevents re-fetch on tab re-visits when user has no follows — acceptable for v2.5 scale"
  - "myDid fetched from /api/v1/portal/auth/me to identify self-row and suppress FollowButton"
metrics:
  duration: "5 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  files_changed: 2
---

# Phase 29 Plan 04: COM-04 Follow Users — FollowButton Summary

**One-liner:** Follow/unfollow toggle button wired into the community Users tab with self-row suppression and optimistic state updates via POST/DELETE /api/v1/portal/community/follow/:did.

## What Was Built

### FollowButton component (`dashboard/src/components/portal/FollowButton.tsx`)

Named export `FollowButton` with props `{ targetDid, initialFollowing, onFollowChange? }`.

- `initialFollowing` seeds local `useState` — no re-render cascade needed.
- On click: toggles between `POST` (follow) and `DELETE` (unfollow) to `/api/v1/portal/community/follow/${encodeURIComponent(targetDid)}` with `credentials: 'include'`.
- On success: flips local `following` state, calls `onFollowChange?.(newValue)` to update parent `followingSet`.
- On network error or non-OK response: silently reverts (button stays in prior state).
- Loading state shows `…` and sets `cursor: wait` on the button element.
- Styled with `--sans-portal`, `--navy`/`--rule`/`--muted` CSS variables consistent with portal design system.

### community/page.tsx changes

Two new state entries:
```tsx
const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
const [myDid, setMyDid] = useState<string | null>(null);
```

Two new fetch calls in the existing `useEffect([activeTab])`, guarded to fire only when `activeTab === 'users'`:
- `GET /api/v1/portal/auth/me` → stores `myDid` (fires once, guarded by `!myDid`)
- `GET /api/v1/portal/community/following` → populates `followingSet` (guarded by `followingSet.size === 0`)

Users tab rendering updated: each row is now wrapped in a flex container. `UserDirectoryRow` fills `flex: 1`. `FollowButton` is rendered as a sibling `div` with `padding: 0 16px` — only when `myDid` is known and `u.did !== myDid` (self-row suppression).

`onFollowChange` callback mutates `followingSet` via `new Set(prev)` (immutable update) so React re-renders correctly without an API round-trip.

## Threat Model Coverage

All STRIDE threats from the plan are addressed:

| Threat | Disposition | Implementation |
|--------|-------------|---------------|
| T-29-16 Spoofing (who follows) | mitigate | JWT cookie sent via `credentials: 'include'`; server authorizes |
| T-29-17 Self-follow | mitigate | Client hides button when `u.did === myDid`; server returns 400 |
| T-29-18 targetDid injection | mitigate | `encodeURIComponent(targetDid)` applied in fetch URL |
| T-29-19 Follow spam DoS | accept | No client-side rate limiting; server INSERT IGNORE handles duplicates |

## Deviations from Plan

**1. [Rule 3 - Deviation] UserDirectoryRow not modified**

The plan instructions in the prompt mentioned adding an `isFollowing` prop to `UserDirectoryRow`, but the plan XML (authoritative) specifies rendering FollowButton as a sibling in the page — not inside the component. The XML approach was followed: UserDirectoryRow remains display-only with no prop changes. The decision is documented as a key decision.

Otherwise — plan executed exactly as written.

## Known Stubs

None — follow state is fetched from the real API endpoint.

## Self-Check: PASSED

- `dashboard/src/components/portal/FollowButton.tsx` exists: FOUND
- `dashboard/src/app/portal/community/page.tsx` modified: FOUND
- Commit 2fd8fed exists: FOUND
- `npx tsc --noEmit` — zero errors in non-test files: PASSED
