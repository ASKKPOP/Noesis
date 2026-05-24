---
phase: 30-resources-support
plan: "02"
title: "FAQ Page (/portal/help/faq)"
subsystem: dashboard/portal/help
tags: [faq, help, accordion, client-search, static-content]
dependency_graph:
  requires: []
  provides: ["/portal/help/faq page with accordion and client-side search"]
  affects: [dashboard/src/app/portal/help/faq/page.tsx]
tech_stack:
  added: []
  patterns: ["use client with useState for client-side search", "CSS details/summary accordion", "hardcoded FAQ data as typed const array"]
key_files:
  created:
    - dashboard/src/app/portal/help/faq/page.tsx
  modified: []
decisions:
  - "FAQ data hardcoded as const array — no DB fetch; 20 Q&As across 4 categories"
  - "details/summary elements used in a .map() loop — single source line renders 20 accordion items at runtime"
  - "No-empty-results state links to /portal/help/contact for escalation"
metrics:
  duration: "85s"
  completed: "2026-05-24"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
requirements: [HELP-03]
---

# Phase 30 Plan 02: FAQ Page (/portal/help/faq) Summary

**One-liner:** FAQ page with 20 Q&A pairs in 4 CSS-accordion categories and a real-time client-side search filter using useState.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /portal/help/faq page with accordion + client-side search | 06ef2ce | dashboard/src/app/portal/help/faq/page.tsx |

## What Was Built

Created `dashboard/src/app/portal/help/faq/page.tsx` — the full FAQ page with:

- **20 Q&A pairs** organized across 4 categories: Wallet & Auth (5), Cyber Coin (5), Nous & Agents (5), Community (5)
- **CSS-only accordion** using `<details>`/`<summary>` elements — no JavaScript library
- **Client-side search filter** via `useState` that filters Q&A pairs in real time as the user types
- **Breadcrumb** "Help / FAQ" with a Link back to `/portal/help`
- **No-results state** with a link to `/portal/help/contact` for escalation
- Fully static editorial content — no backend calls, no DB fetch

The 8 original FAQ entries from the old `help/page.tsx` placeholder were incorporated verbatim (Wallet & Auth + Nous & Agents categories), with 12 new entries added (Cyber Coin category — 5, Community category — 5, Wallet & Auth — 1 "wallet info storage", Nous & Agents — 1 "who are Sophia/Hermes/Themis" + 1 "can I chat").

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all FAQ content is final editorial text; no placeholder text or TODO markers present.

## Threat Flags

None — T-30-02 (entirely static editorial content; client-side search filter only; no user data crosses any boundary) confirmed as accepted.

## Self-Check: PASSED

- File exists: `dashboard/src/app/portal/help/faq/page.tsx` — FOUND
- Commit exists: `06ef2ce` — FOUND
- `'use client'` directive present — FOUND (count: 1)
- `useState` import + usage present — FOUND (count: 2)
- `<details>`/`</details>` accordion elements — FOUND (map loop renders 20 at runtime)
- Breadcrumb link to `/portal/help` — FOUND
- Wallet & Auth category — FOUND
- Cyber Coin category — FOUND
- TypeScript errors in `faq/page.tsx` — NONE (pre-existing test file errors in chat/ are out of scope)
