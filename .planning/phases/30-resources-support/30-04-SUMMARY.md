---
phase: 30-resources-support
plan: "04"
title: Getting Started Guide + Grid Progress Endpoint
subsystem: portal-help
tags: [help-center, progress-tracking, dashboard, grid-api]
requirements: [HELP-02]

dependency_graph:
  requires: [30-01]
  provides: [guide-page, progress-endpoint]
  affects: [dashboard/portal/help, grid/api/portal/support]

tech_stack:
  added: []
  patterns: [fastify-route, next-client-component, mysql2-pool-query]

key_files:
  created:
    - grid/src/api/portal/support.ts
    - dashboard/src/app/portal/help/guide/page.tsx
  modified:
    - grid/src/api/portal/index.ts

decisions:
  - "Progress endpoint queries audit_trail for human.spoke and human.transferred using actor_did column (human is actor for these events)"
  - "hasChatted/hasTipped failures are non-fatal — catch block keeps flags false rather than returning 500"
  - "humanPool absence returns zeroed flags (not 503) — Grid may init without DB in some deployments"
  - "Step 3 (Explore Nous Profiles) always shows as actionable — no tracking for profile views"
  - "Pre-existing test type errors in dashboard (ConversationPane, NousSidebar, TipPanel test files) are out of scope; guide page itself has no TypeScript errors"

metrics:
  duration: "~10 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 30 Plan 04: Getting Started Guide + Grid Progress Endpoint Summary

Getting Started Guide at `/portal/help/guide` with 6 hardcoded steps and live completion checkmarks driven by `GET /api/v1/portal/human/me/progress`.

## What Was Built

### Grid Progress Endpoint (`grid/src/api/portal/support.ts`)

New file `grid/src/api/portal/support.ts` with function `registerSupportRoutes` exposing:

**`GET /api/v1/portal/human/me/progress`**
- JWT-authed via `request.session.humanDid`; returns 401 if unauthenticated
- Returns `{ onboarded, hasNous, hasChatted, hasTipped }` — four boolean flags
- `onboarded`: queries `human_users WHERE did = ?` — true if `onboarding_goal IS NOT NULL`
- `hasNous`: queries `nous_registry WHERE human_owner = ?` — true if any row exists
- `hasChatted`: queries `audit_trail WHERE actor_did = ? AND event_type = 'human.spoke'`
- `hasTipped`: queries `audit_trail WHERE actor_did = ? AND event_type = 'human.transferred'`
- Audit trail queries are wrapped in try/catch — non-fatal; flags default false on failure
- No audit event emitted (allowlist unchanged at 53)

`registerSupportRoutes` registered at the bottom of `registerPortalRoutes` in `grid/src/api/portal/index.ts`. File includes comment noting ticket routes will be added in Plan 05.

### Getting Started Guide (`dashboard/src/app/portal/help/guide/page.tsx`)

`'use client'` component with:
- `useEffect` fetch to `/api/v1/portal/human/me/progress` with `credentials: 'include'`
- `STEPS` array of 6 hardcoded steps (no DB dependency for step content)
- Completion state: bronze filled circle with `✓` + `DONE` badge for completed steps; numbered circle for incomplete
- Progress subtitle: `"X of 6 steps complete."` when authenticated, `"6 steps to explore the Grid."` when not
- Loading state: `opacity: 0.6` on all step cards while fetch in flight

The 6 steps:
1. Connect Your Wallet — always marked done (user is authenticated if page loads)
2. Complete Sophia Onboarding — `p.onboarded`
3. Explore Nous Profiles — always actionable (no tracking for profile views)
4. Chat with a Nous — `p.hasChatted`
5. Send a Cyber Coin Tip — `p.hasTipped`
6. Spawn Your Own Nous — `p.hasNous`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints beyond those declared in the plan's threat model (`T-30-04`, `T-30-05`, `T-30-06`).

## Self-Check

### Created files exist:
- `grid/src/api/portal/support.ts` — FOUND
- `dashboard/src/app/portal/help/guide/page.tsx` — FOUND

### Commits exist:
- `f2b7d2f` — feat(30-04): Grid progress endpoint + register support routes — FOUND
- `f8f24ec` — feat(30-04): Getting Started Guide with 6 steps and live progress — FOUND

### Verification:
- Grid `tsc --noEmit` exits 0 — PASS
- Dashboard guide page has no TypeScript errors — PASS
- `grep "registerSupportRoutes" index.ts` returns 2 lines (import + call) — PASS
- `grep "me/progress" support.ts` returns 3 lines — PASS
- `grep "me/progress" guide/page.tsx` returns 1 line — PASS

## Self-Check: PASSED
