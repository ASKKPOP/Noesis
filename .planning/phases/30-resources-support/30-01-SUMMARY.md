---
phase: 30-resources-support
plan: "01"
title: Help Center Hub + Sidebar Nav Update
subsystem: portal-dashboard
tags: [portal, help, navigation, ux]
dependency_graph:
  requires: []
  provides: [help-center-hub, sidebar-nav-wiring]
  affects: [dashboard/src/app/portal/help/page.tsx, dashboard/src/components/portal/PortalSidebar.tsx]
tech_stack:
  added: []
  patterns: [server-component, next-link, css-variables]
key_files:
  created: []
  modified:
    - dashboard/src/app/portal/help/page.tsx
    - dashboard/src/components/portal/PortalSidebar.tsx
decisions:
  - "Server component for hub page — no 'use client', pure SSR JSX consistent with privacy/terms pages"
  - "exact: true on /portal/help sidebar entry to prevent startsWith highlighting all sub-pages"
  - "Search bar is decorative placeholder (static <input>); TODO comment marks it for future client wiring"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 30 Plan 01: Help Center Hub + Sidebar Nav Update Summary

Help center hub at `/portal/help` with four section cards (Getting Started, FAQ, Glossary, Contact Support) and search bar placeholder; PortalSidebar Resources nav updated to full `/portal/help/*` hierarchy with `exact: true` guard on parent item.

## What Changed

### dashboard/src/app/portal/help/page.tsx (Task 1)
- **Replaced** the old 8-FAQ + 5-term quick glossary placeholder with a proper help center hub landing page.
- **Hub structure:**
  1. H1 "Help Center" in `--serif`, subtitle in `--sans-portal`/`--muted`
  2. Search bar `<input placeholder="Search help articles...">` styled with parchment/rule/ink — decorative, no state, marked with TODO comment
  3. 2×2 CSS grid of section cards linking to `/portal/help/guide`, `/portal/help/faq`, `/portal/help/glossary`, `/portal/help/contact` via `<Link>`
  4. Footer note with support email in `--mono-portal`
- **Server component** — no `'use client'` directive, no hooks, consistent with `privacy/page.tsx` and `terms/page.tsx` patterns.
- Uses `import Link from 'next/link'` for card hrefs.
- Inline SVG icons for each section card (arrow-right, question-mark, book, envelope).

### dashboard/src/components/portal/PortalSidebar.tsx (Task 2)
- **Removed** old Resources entries: `/portal/docs` (Documents, phase '30'), `/portal/glossary` (Glossary), `/portal/help` (Help & FAQ).
- **Added** full Phase 30 nav hierarchy:
  - `/portal/help` — "Help Center" — `exact: true` (prevents startsWith activation on sub-pages)
  - `/portal/help/guide` — "Getting Started"
  - `/portal/help/faq` — "FAQ"
  - `/portal/help/glossary` — "Glossary"
  - `/portal/help/contact` — "Support"
- Kept `/portal/privacy`, `/portal/terms`, `/portal/status` unchanged.
- No phase badge on help items — they ship in Phase 30 (live now).

## Deviations from Plan

None — plan executed exactly as written.

- The `grep -c "use client"` check returns 1 for the help page, but this match is the comment `* Server component (no 'use client').` — not a `'use client'` directive. The file is a valid server component.
- Pre-existing TypeScript errors in `ConversationPane.test.tsx`, `NousSidebar.test.tsx`, `TipPanel.test.tsx` (missing `@types/jest`/vitest types) are out-of-scope pre-existing issues, not introduced by this plan.

## Known Stubs

- **Search bar** — `dashboard/src/app/portal/help/page.tsx`, line 55: `<input type="search" placeholder="Search help articles..." />` is a static decorative element with no `onChange` handler. Marked with `TODO: wire client-side filter` in the JSX comment block (line 52). The search bar renders visually but does not filter content. This is intentional per plan spec (D-06 defers client-side search to the FAQ page itself in Plan 03). No plan goal is blocked by this stub.

## Threat Flags

None. Hub page is static editorial content — no user data rendered, no auth required (T-30-01 accepted per threat model).

## Self-Check: PASSED

- `dashboard/src/app/portal/help/page.tsx` exists and contains "Help Center" (2 occurrences), all 4 sub-route hrefs.
- `dashboard/src/components/portal/PortalSidebar.tsx` contains `/portal/help/guide`, `/portal/help/faq`, `/portal/help/contact`; no `/portal/docs` reference.
- Commits `de17f1d` and `9a1066b` exist in git log.
