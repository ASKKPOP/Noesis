---
phase: 40-local-ai-integration
plan: 05
subsystem: steward-local-ai-ui
tags: [wave-3, local-ai, steward-console, brain-proxy, ui, q-v3-i]
dependency_graph:
  requires:
    - brain/src/noesis_brain/http/local_ai.py (Plan 04 — /local-ai/models + /local-ai/status endpoints)
    - brain/src/noesis_brain/http/server.py (Plan 04 — route registration)
    - steward/src/app/api/operator/[...path]/route.ts (proxy pattern analog)
    - steward/src/app/system/operators/page.tsx (page structure analog)
    - steward/src/components/StewardShell.tsx (shell with title+breadcrumb props)
  provides:
    - steward/src/app/api/brain/[...path]/route.ts (server-side Brain HTTP proxy)
    - steward/src/app/system/local-ai/page.tsx (Tier-1 Local Nous Manager surface)
  affects:
    - steward/src/components/StewardShell.tsx (nav link added under Local Admin)
tech_stack:
  added: []
  patterns:
    - Next.js 15 catch-all route with Promise<params> pattern (same as operator proxy)
    - Server-side secret injection via process.env (no NEXT_PUBLIC_ prefix)
    - 10s polling with clearInterval cleanup in useEffect
    - Promise.all for parallel settings + models fetch
    - Steward inline CSS design tokens (var(--terracotta), var(--ink), var(--muted), var(--parchment))
    - steward-card and StewardShell.title+breadcrumb patterns
key_files:
  created:
    - steward/src/app/api/brain/[...path]/route.ts
    - steward/src/app/system/local-ai/page.tsx
  modified:
    - steward/src/components/StewardShell.tsx
decisions:
  - "Used inline CSS design tokens (var(--terracotta), var(--mono), etc.) instead of Tailwind classes to match system/page.tsx pattern — the most complete recent analog"
  - "StewardShell requires title+breadcrumb props — operators/page.tsx was written against an older version; followed system/page.tsx which uses the current API correctly"
  - "Nav link added under Local Admin section in StewardShell — /system/local-ai is Tier-1 Local Nous Manager per D-V3-36, correctly placed with local admin tools"
  - "Red banner uses brainStatus?.status === 'degraded' check — fallback_provider shown in banner text; falls back to 'cloud' if null per Q-V3-I requirement"
  - "Removed duplicate settings state — only draft state needed; setDraft on successful save"
  - "Used ReturnType<typeof setInterval> for pollRef type instead of NodeJS.Timeout for cross-platform compatibility"
metrics:
  duration: "8m"
  completed_date: "2026-05-27"
  task_count: 2
  file_count: 3
---

# Phase 40 Plan 05: Steward Brain Proxy + Local AI Settings Page Summary

**One-liner:** Server-side Steward → Brain HTTP proxy with X-Brain-Secret injection + /system/local-ai Tier-1 Local Nous Manager page with 3 model dropdowns, sliders, amber restart banner, and red Q-V3-I cloud fallback banner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Brain HTTP proxy (steward/src/app/api/brain/[...path]/route.ts) | e5f1e37 | steward/src/app/api/brain/[...path]/route.ts |
| 2 | Steward Console /system/local-ai page (D-40-03 Tier-1 surface) | 08d4a94 | steward/src/app/system/local-ai/page.tsx, steward/src/components/StewardShell.tsx |

## What Was Built

### Task 1 — Brain HTTP Proxy

**`steward/src/app/api/brain/[...path]/route.ts`** — New file:

- Catch-all GET route that proxies requests from Steward to Brain HTTP server
- `BRAIN_HTTP_URL` and `BRAIN_HTTP_SECRET` read from `process.env` server-side only — no `NEXT_PUBLIC_` prefix
- Injects `X-Brain-Secret` header on every upstream request (T-40-05-01 mitigation)
- Graceful 503 JSON error when Brain is unreachable (`error: 'brain_unreachable'`)
- Next.js 15 `Promise<params>` pattern matches existing `operator/[...path]/route.ts`
- Exports `GET` only (Brain local-ai endpoints are read-only)

### Task 2 — /system/local-ai Page

**`steward/src/app/system/local-ai/page.tsx`** — New file:

- `'use client'` page using existing `StewardShell` component with `title` and `breadcrumb` props
- Parallel load on mount: Grid settings (`GET /api/v1/operator/me/settings`) + Brain models (`GET /api/brain/local-ai/models`)
- 3 model dropdowns for small/primary/large tiers; populated from Brain; falls back to showing current saved model when Brain offline
- Temperature input (0.0–2.0, step 0.1) and max_tokens input (256–8192, step 128)
- Save → `PATCH /api/v1/operator/me/settings` → amber "Restart Brain to apply changes." banner
- 10s polling of `GET /api/brain/local-ai/status` via `setInterval` + `clearInterval` cleanup
- Red banner when `brainStatus.status === 'degraded'` with Q-V3-I mandatory text:
  `"Local AI offline — using {fallback_provider} fallback. Memory content is leaving this machine."`
- All styling uses project design tokens (`var(--terracotta)`, `var(--ink)`, `var(--muted)`, etc.)

**`steward/src/components/StewardShell.tsx`** — Modified:
- Added `<NavItem href="/system/local-ai" label="Local AI" />` under "Local Admin" section

## Verification Results

| Check | Result |
|-------|--------|
| `ls steward/src/app/api/brain/[...path]/route.ts` | PASS |
| `ls steward/src/app/system/local-ai/page.tsx` | PASS |
| `grep "Memory content is leaving this machine" page.tsx` | PASS (Q-V3-I) |
| `grep "NEXT_PUBLIC" route.ts` (code lines only) | PASS — only in JSDoc comment explaining constraint |
| `grep "X-Brain-Secret" route.ts` | PASS |
| `grep "local-ai" route.ts` | PASS |
| Post-commit deletion check | PASS — no deletions |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StewardShell requires title+breadcrumb props**
- **Found during:** Task 2
- **Issue:** Plan template used `<StewardShell>` without props, but the component has required `title: string` and `breadcrumb: string` props. `operators/page.tsx` (the stated analog) was written against an older version of the shell.
- **Fix:** Added `title="Local AI Settings"` and `breadcrumb="Steward · Local Admin · Local AI"` to both `StewardShell` instances in the page
- **Files modified:** `steward/src/app/system/local-ai/page.tsx`
- **Commit:** 08d4a94

**2. [Rule 2 - Missing] Inline CSS instead of Tailwind classes**
- **Found during:** Task 2
- **Issue:** Plan template used Tailwind classes (`bg-red-50 border border-red-200...`) but the system page (the more current/complete analog) uses inline CSS with design tokens. CLAUDE.md says "match existing style."
- **Fix:** Used inline CSS with project design tokens throughout the page
- **Files modified:** `steward/src/app/system/local-ai/page.tsx`
- **Commit:** 08d4a94

## Known Stubs

None. Both files are complete implementations.

## Threat Flags

None. The two new files follow established security patterns:
- T-40-05-01 mitigated: `BRAIN_HTTP_SECRET` injected server-side only, no `NEXT_PUBLIC_` prefix
- T-40-05-03 mitigated: Q-V3-I "Memory content is leaving this machine." text hardcoded in red banner

## Self-Check: PASSED
