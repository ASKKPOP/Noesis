---
phase: 29-community
plan: "03"
subsystem: dashboard
tags: [dashboard, community, board, posts, replies, ui]
dependency_graph:
  requires:
    - grid/community_api
    - dashboard/community_hub_ui
  provides:
    - dashboard/community_board_ui
    - dashboard/post_composer
    - dashboard/post_card
    - dashboard/reply_thread
  affects:
    - dashboard/src/app/portal/community/page.tsx
    - dashboard/src/app/portal/community/board/page.tsx
    - dashboard/src/components/portal/PostComposer.tsx
    - dashboard/src/components/portal/PostCard.tsx
    - dashboard/src/components/portal/ReplyThread.tsx
tech_stack:
  added: []
  patterns:
    - named exports for components (tree-shaking, matches 29-02 convention)
    - inline style with CSS vars (no Tailwind color tokens)
    - credentials: include on all community fetches
    - lazy board fetch on tab activation with refresh via onPosted callback
    - character limit enforced client-side (UX) with server enforcement in 29-01
    - relative timestamp helper (just now / Xm ago / Xh ago / Xd ago)
    - DID truncation via split(':').pop() + slice pattern
key_files:
  created:
    - dashboard/src/components/portal/PostComposer.tsx
    - dashboard/src/components/portal/ReplyThread.tsx
    - dashboard/src/components/portal/PostCard.tsx
    - dashboard/src/app/portal/community/board/page.tsx
  modified:
    - dashboard/src/app/portal/community/page.tsx
decisions:
  - "Named exports for all three components — matches UserDirectoryRow/LeaderboardRow convention from 29-02"
  - "loadPosts() defined as standalone function (not useCallback) for simplicity — called at mount and via onPosted"
  - "Board posts lazy-load only when board tab first activated (posts.length === 0 guard), same pattern as users/leaderboard tabs"
  - "/portal/community/board redirects to /portal/community — board content lives in tabbed hub, not a separate page"
  - "Reply refresh re-fetches GET replies after successful POST (no optimistic update) — simple, consistent with existing fetch pattern"
metrics:
  duration: "3 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 29 Plan 03: Community Board UI Summary

Three new client components (PostComposer, PostCard, ReplyThread) implement the community board social surface — post creation, post display with reply toggle, and threaded replies — wired into the Board tab of the community hub.

## What Was Built

### Components (dashboard/src/components/portal/)

**PostComposer.tsx** — Post creation form:
- Textarea with 500-char limit; counter shows remaining chars in red when approaching/exceeding limit
- POST `/api/v1/portal/community/posts` with `credentials: 'include'`
- Inline error display; button disabled while submitting or content empty/over-limit
- `onPosted()` callback fires after successful post (triggers list refresh in parent)

**ReplyThread.tsx** — Reply list + reply composer:
- Fetches GET `/api/v1/portal/community/posts/:id/replies` on mount (`credentials: 'include'`)
- Displays each reply with truncated DID (bronze monospace), relative timestamp, and content
- Inline reply textarea with 280-char limit counter
- POST reply then re-fetches the reply list for immediate refresh
- `truncateDid()` and `relativeTime()` helpers (private, not exported)

**PostCard.tsx** — Single post display with reply toggle:
- Shows truncated DID (bronze monospace), relative timestamp, post content (pre-wrap, break-word)
- Reply toggle button: shows reply count when > 0, "Reply" when 0, "Hide replies" when expanded
- Mounts `ReplyThread` inline when expanded
- Same `truncateDid()` and `relativeTime()` helpers

### Board Sub-page

**`/portal/community/board/page.tsx`** — Server component that calls `redirect('/portal/community')`. The board content lives in the tabbed hub, not a separate page.

### Community Hub Update (`/portal/community/page.tsx`)

- Imported `PostCard` and `PostComposer`
- Added `Post` interface, `posts: Post[]` state, `postsLoading` state
- Added `loadPosts()` function (fetch + setState)
- Extended `useEffect` to call `loadPosts()` when board tab is first activated
- Replaced `data-testid="community-board-placeholder"` with real board content: `PostComposer` + loading state + empty state + `PostCard` list

## API Connections

| Component | Endpoint | Method | Auth |
|-----------|----------|--------|------|
| PostComposer | `/api/v1/portal/community/posts` | POST | credentials: include |
| community/page.tsx | `/api/v1/portal/community/posts` | GET | credentials: include |
| ReplyThread | `/api/v1/portal/community/posts/:id/replies` | GET | credentials: include |
| ReplyThread | `/api/v1/portal/community/posts/:id/replies` | POST | credentials: include |

## Commits

| Hash | Message |
|------|---------|
| c4a11cb | feat(29-03): PostComposer, ReplyThread, PostCard components |
| 942a71b | feat(29-03): wire Board tab in community hub + add /board redirect page |

## Deviations from Plan

### Adapted: Explicit type annotation on fetch `.then()` callbacks

The plan showed `.then(d => setReplies(d.replies ?? []))` with implicit `any` inference. Added explicit type annotations (e.g., `.then((d: { replies?: Reply[] }) => ...)`) to satisfy TypeScript strict mode without `any` casts. Same pattern applied in `community/page.tsx` for the posts fetch. No behavior change.

### Adapted: Added `boxSizing: 'border-box'` to textarea styles

The plan's textarea styles omitted `boxSizing`. Added it to prevent width overflow when textarea `width: '100%'` is combined with padding. Minor correctness fix, no design change.

## Known Stubs

None. All board functionality is wired to real Grid API endpoints from Plan 29-01. No placeholder data.

## Threat Flags

None. All new fetches are to existing JWT-authenticated community endpoints established in 29-01. No new network surface.

## Self-Check: PASSED

- PostComposer.tsx: FOUND
- ReplyThread.tsx: FOUND
- PostCard.tsx: FOUND
- community/board/page.tsx: FOUND
- community/page.tsx: MODIFIED (Board tab wired)
- Commit c4a11cb: FOUND
- Commit 942a71b: FOUND
- TypeScript (non-test files): 0 errors
