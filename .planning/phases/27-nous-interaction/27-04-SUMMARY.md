---
phase: 27-nous-interaction
plan: "04"
subsystem: dashboard-portal
tags: [dashboard, portal, nous, profile, hero-card, skills, lore, norms, chat]
dependency_graph:
  requires:
    - "27-02"  # Grid portal Nous endpoints (skills/lore/norms APIs)
  provides:
    - dashboard/src/app/portal/nous/[id]/page.tsx (NousProfilePage)
    - dashboard/src/app/portal/nous/[id]/HeroCard.tsx
    - dashboard/src/app/portal/nous/[id]/ProfileTabBar.tsx
    - dashboard/src/app/portal/nous/[id]/SkillsTab.tsx
    - dashboard/src/app/portal/nous/[id]/LoreTab.tsx
    - dashboard/src/app/portal/nous/[id]/NormsTab.tsx
    - dashboard/src/components/portal/avatars/SophiaAvatar.tsx
    - dashboard/src/components/portal/avatars/HermesAvatar.tsx
    - dashboard/src/components/portal/avatars/ThemisAvatar.tsx
  affects:
    - dashboard/src/app/portal/nous/[id]/ProfilePage.test.tsx (test stub)
tech_stack:
  added:
    - viem formatUnits: Ousia USDT display (6 decimals)
    - inline SVG geometric avatars: phi-spiral (Sophia), caduceus (Hermes), scales (Themis)
  patterns:
    - portal-pulse skeleton: same animation class used in WalletPanel
    - credentials-include fetch: consistent with all portal Grid calls
    - CSS variables only: no raw hex, no Tailwind color tokens anywhere in phase 27 components
    - KNOWN_NOUS allowlist: path-level guard before any fetch (T-27-18 mitigation)
key_files:
  created:
    - dashboard/src/app/portal/nous/[id]/page.tsx
    - dashboard/src/app/portal/nous/[id]/HeroCard.tsx
    - dashboard/src/app/portal/nous/[id]/ProfileTabBar.tsx
    - dashboard/src/app/portal/nous/[id]/SkillsTab.tsx
    - dashboard/src/app/portal/nous/[id]/LoreTab.tsx
    - dashboard/src/app/portal/nous/[id]/NormsTab.tsx
    - dashboard/src/app/portal/nous/[id]/ProfilePage.test.tsx
    - dashboard/src/components/portal/avatars/SophiaAvatar.tsx
    - dashboard/src/components/portal/avatars/HermesAvatar.tsx
    - dashboard/src/components/portal/avatars/ThemisAvatar.tsx
  modified: []
decisions:
  - Avatar components created as stubs in this plan because Plan 03 (chat page) runs in parallel; geometric SVG designs follow D-14 (phi-spiral/caduceus/scales) but are minimal implementations — Plan 03 may produce richer SVGs
  - content_hash grep invariant check (plan verification) produces a false positive on `entry.content_hash` because the field name contains 'content'; no prose body text is rendered — invariant is preserved in spirit and code
metrics:
  duration: ~30 minutes
  completed: "2026-05-23"
  tasks_completed: 3
  files_created: 10
  files_modified: 0
---

# Phase 27 Plan 04: Nous Profile Page Summary

Nous profile page (`/portal/nous/[id]`) with hero card (name/tagline/region/ousia/chat button), three-tab panel (Skills/Lore/Norms), geometric avatar stubs, and D-08a lore metadata-only invariant preserved.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Stub test file ProfilePage.test.tsx | cb89c8d | Done |
| 2 | HeroCard + ProfileTabBar + page.tsx | 5fa04cd | Done |
| 3 | SkillsTab + LoreTab + NormsTab | b61d2dd | Done |

## What Was Built

**Task 1: Wave 0 stub test**

- `ProfilePage.test.tsx` using vitest `vi.mock`/`vi.fn` (not jest) matching existing test suite pattern
- Minimal page.tsx stub created alongside test to resolve the import at test compile time
- Test is picked up and executed by `npm run test:unit` (not 0 tests); fails with pre-existing "React is not defined" issue affecting all RTL tests in the suite

**Task 2: HeroCard + ProfileTabBar**

- `page.tsx`: full NousProfilePage — KNOWN_NOUS allowlist guard (`['sophia','hermes','themis']`), roster fetch from `/api/v1/grid/nous`, tab state management, unknown-id error state with "Return to chat" link
- `HeroCard.tsx`: top terracotta gradient stripe, 80px avatar slot, serif 28px 600 name, tagline + region + ousia (formatUnits 6 decimals), "Chat with [Name]" button → `router.push('/portal/chat?nous=${nousId}')`
- `ProfileTabBar.tsx`: Skills/Lore/Norms tabs with `var(--terracotta-2)` active underline
- Avatar stubs: SophiaAvatar (phi-spiral, `--bronze`), HermesAvatar (caduceus, `--terracotta`), ThemisAvatar (scales, `--navy`)

**Task 3: SkillsTab + LoreTab + NormsTab**

- `SkillsTab.tsx`: roster fetch with portal-pulse skeleton (3 rows), TAUGHT/SELF-INFERRED source badges, skill name in serif (or mono if hash fallback), tick value T{n}
- `LoreTab.tsx`: D-08a locked override — only `category_tag`, `contributed_tick`, `citation_count`, `content_hash.slice(0,16)` rendered; no body text fields; cursor-based load-more button
- `NormsTab.tsx`: fingerprint truncated `fp.slice(0,4)+'…'+fp.slice(-4)`, convergence badge, CRYSTALLIZED (`var(--terracotta-2)`) / CANDIDATE (`var(--muted)`) status badge, participating count, tick range

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Avatar components missing — created stubs**
- **Found during:** Task 2 (HeroCard imports SophiaAvatar/HermesAvatar/ThemisAvatar)
- **Issue:** Plan 03 (chat page with avatars) runs in a parallel worktree; avatars directory did not exist
- **Fix:** Created minimal geometric SVG avatar stubs in `dashboard/src/components/portal/avatars/` following D-14 spec (phi-spiral/caduceus/scales, correct color vars)
- **Files created:** SophiaAvatar.tsx, HermesAvatar.tsx, ThemisAvatar.tsx
- **Commit:** 5fa04cd

**2. [Rule 1 - Bug] jest.mock → vi.mock in test stub**
- **Found during:** Task 1 (plan provided jest-style test stub)
- **Issue:** Project uses vitest (not jest); `jest.mock` and `jest.Mock` would cause errors
- **Fix:** Used vitest equivalents: `vi.mock`, `vi.fn()`, `vi.stubGlobal`, proper imports from 'vitest'
- **Files modified:** ProfilePage.test.tsx
- **Commit:** cb89c8d

### Known Limitations

**LoreTab grep invariant check false positive:**
The plan's verification grep `grep -n "\.body\|\.content\|\.description\|body_text\|lore_text"` produces matches on `entry.content_hash` because the field name contains "content". This is a false positive — `content_hash` is a metadata hash identifier (the only content field in the LoreEntry type from Plan 02), not prose body text. No prose body text is rendered anywhere in LoreTab. The D-08a invariant is fully preserved.

**Pre-existing build failure:**
`npm run build` fails with `Module not found: Can't resolve '../server/htmlescape'` in `next/dist/pages/_document.js`. This is a pre-existing webpack configuration issue that existed before Plan 04. TypeScript type-check passes clean with no errors from Plan 04 files.

**Pre-existing "React is not defined" test failures:**
All RTL tests that use `render(<Component />)` fail with "React is not defined" in the jsdom/OXC JSX transform pipeline. This affects the ProfilePage.test.tsx stub but is pre-existing (same error appears in layout.test.tsx, hooks.test.tsx, etc.). The test is picked up and runs — it is not a 0-tests result.

## Security Notes

Threat mitigations from plan threat model are implemented:
- **T-27-17**: LoreTab renders only 4 metadata fields; no body/prose/description fields; `content_hash` is identifier only
- **T-27-18**: KNOWN_NOUS allowlist at page level — `['sophia','hermes','themis']`; any other ID shows "Nous not found." before any fetch executes
- **T-27-19**: Accepted — ousia is public Nous balance displayed to authenticated users
- **T-27-20**: Accepted — load-more requires user click; no auto-pagination

## Known Stubs

**Avatar components** (`SophiaAvatar.tsx`, `HermesAvatar.tsx`, `ThemisAvatar.tsx`): The geometric SVG designs are minimal implementations meeting D-14 spec (correct colors, accept `size` prop). Plan 03 (parallel wave) may produce more refined SVG paths. The stubs are functional and can be replaced without any changes to HeroCard.tsx.

## Self-Check: PASSED

Files exist:
- dashboard/src/app/portal/nous/[id]/page.tsx: FOUND
- dashboard/src/app/portal/nous/[id]/HeroCard.tsx: FOUND
- dashboard/src/app/portal/nous/[id]/ProfileTabBar.tsx: FOUND
- dashboard/src/app/portal/nous/[id]/SkillsTab.tsx: FOUND
- dashboard/src/app/portal/nous/[id]/LoreTab.tsx: FOUND
- dashboard/src/app/portal/nous/[id]/NormsTab.tsx: FOUND
- dashboard/src/app/portal/nous/[id]/ProfilePage.test.tsx: FOUND
- dashboard/src/components/portal/avatars/SophiaAvatar.tsx: FOUND
- dashboard/src/components/portal/avatars/HermesAvatar.tsx: FOUND
- dashboard/src/components/portal/avatars/ThemisAvatar.tsx: FOUND

Commits exist:
- cb89c8d: FOUND (test stub)
- 5fa04cd: FOUND (HeroCard + ProfileTabBar)
- b61d2dd: FOUND (SkillsTab + LoreTab + NormsTab)

TypeScript: 0 errors (`npx tsc --noEmit`)
Tailwind tokens: PASS (none found in portal/nous/)
