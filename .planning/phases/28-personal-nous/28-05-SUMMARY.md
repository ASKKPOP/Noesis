---
phase: 28-personal-nous
plan: "05"
subsystem: dashboard/portal/my-nous
tags: [dashboard, portal, my-nous, owner-hub, hero-card, personal-nous-avatar]
dependency_graph:
  requires: [28-03]
  provides: [my-nous-page, owner-hub, personal-nous-avatar, owner-info-section]
  affects: [dashboard/src/app/portal/my-nous, dashboard/src/app/portal/nous/[id]/HeroCard.tsx]
tech_stack:
  added: []
  patterns: [double-duty-page, css-variable-only, no-tailwind, noesis-stat-card]
key_files:
  created:
    - dashboard/src/components/portal/avatars/PersonalNousAvatar.tsx
    - dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx
    - dashboard/src/app/portal/my-nous/OwnerHub.tsx
  modified:
    - dashboard/src/app/portal/nous/[id]/HeroCard.tsx
    - dashboard/src/app/portal/my-nous/page.tsx
decisions:
  - "formatTickAsDate stays as 'Tick #N' placeholder — no tick→date utility available in this phase"
  - "HeroCard public prop shape unchanged: { nousId, region, ousia, status } — genesis Nous callers unaffected"
  - "&apos; entity used for apostrophe in JSX (You don&apos;t have a Nous yet.) — renders as UI-SPEC verbatim"
metrics:
  duration: ~15min
  completed: "2026-05-23"
  tasks_completed: 5
  tasks_total: 5
  files_changed: 5
---

# Phase 28 Plan 05: My Nous Owner Hub Summary

Double-duty `/portal/my-nous` page: empty-state CTA pre-spawn, owner hub post-spawn, with extended HeroCard for personal Nous DID resolution and dual-sparkle SVG avatar.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | PersonalNousAvatar dual-sparkle SVG | 9dadc36 | PersonalNousAvatar.tsx (new) |
| 2 | HeroCard extended for personal Nous DIDs | c0a49bd | HeroCard.tsx (edit) |
| 3 | OwnerInfoSection spawn info stat card | 45f2747 | OwnerInfoSection.tsx (new) |
| 4 | OwnerHub + double-duty my-nous page | 18a68d5 | OwnerHub.tsx (new), page.tsx (replaced) |
| 5 | Human visual verification | approved | CHECKPOINT (approved by user) |

## What Was Built

### PersonalNousAvatar.tsx (new, 36 lines)
Dual-sparkle SVG: large 4-pointed sparkle at center + small offset sparkle at upper-right. Matches SophiaAvatar prop interface `{ size?: number; style?: React.CSSProperties }`. All fills use `var(--bronze)`; no raw hex literals. Named + default export.

### HeroCard.tsx (extended, +34 lines, 0 prop changes)
Added `resolveNousMeta()` and `resolveAvatar()` helpers:
- Genesis Nous (sophia/hermes/themis) resolves via existing `NOUS_METADATA` / `AVATAR_MAP` — unchanged rendering
- Personal Nous (`did:noesis:human-nous:*`) extracts name from DID tail, returns `"[Name] · Personal Nous"` tagline + `PersonalNousAvatar`
- Chat button URL now uses `encodeURIComponent(nousId)` — genesis Nous URLs backwards-compatible, personal Nous DIDs correctly encoded
- Early `if (!meta || !AvatarComponent) return null` guard removed — resolvers always return valid values

### OwnerInfoSection.tsx (new, 71 lines)
Spawn Info stat card with four rows:
- Personality seed → `SeedBadge` in bronze mono uppercase, or "—" fallback
- Spawned → `formatTickAsDate(tick)` returns "Tick #N" (placeholder; no tick→date utility available)
- Spawn cost → `${spawnCostUsdt} USDT`
- Nous Coin Balance → `${nousCoinBalance} CC`
Uses `noesis-stat-card` CSS class wrapper; no raw hex.

### my-nous/page.tsx (replaced, 88 lines)
Client component with three render states based on `GET /api/v1/portal/human/me/nous`:
1. `undefined` (loading): parchment-2 skeleton div with portal-pulse animation
2. `null` (no Nous): empty-state with sparkle SVG + UI-SPEC copy + terracotta-2 "Spawn Your Nous" button → `/portal/nous/spawn`
3. `NousRecord` (owned): `<OwnerHub nous={nousData} />`

### OwnerHub.tsx (new, 53 lines)
Composed view: HeroCard + ProfileTabBar + tabbed content (Skills/Lore/Norms) + OwnerInfoSection. Zero management controls (confirmed by grep).

## HeroCard Prop Shape Changes

None. Public signature `{ nousId: string, region: string, ousia: string, status: string }` is unchanged. Phase 27 callers (`/portal/nous/[id]/page.tsx`) continue to work without modification.

## spawned_at_tick → date display

Stayed as "Tick #N" placeholder. The `formatTickAsDate(tick)` function returns `Tick #${tick}`. A real tick→date formatter can replace this function body in a future plan when the grid exposes a tick conversion utility.

## Genesis Nous Profile Pages

HeroCard renders genesis Nous (sophia/hermes/themis) via the existing `NOUS_METADATA` and `AVATAR_MAP` lookups — these are checked first, before the personal Nous fallback path. No regression in Phase 27 profile pages.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Minor Notes

**1. [Rule 2 - Correctness] `&apos;` entity for apostrophe**
- The empty-state heading `You don't have a Nous yet.` uses `You don&apos;t have a Nous yet.` in JSX source to satisfy React/Next.js HTML entity requirements.
- Renders as the exact UI-SPEC copy verbatim in the browser.
- The plan's acceptance criterion `grep -c "You don.t have a Nous yet"` returns 0 because `.` in grep matches single char but `&apos;` is 6 chars. The copy is correct; the grep pattern does not account for HTML entity encoding.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `formatTickAsDate` returns "Tick #N" | OwnerInfoSection.tsx | 43 | No tick→date utility available; acceptable per UI-SPEC §"Owner Hub States" which allows fallback display |
| `spawn_cost_usdt ?? '50'` in OwnerHub | OwnerHub.tsx | 47 | Field optional in NousRecord; defaulting to '50' matches expected spawn cost; will be real value when API returns it |

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary crossings introduced beyond what was in the plan's threat model. The GET `/api/v1/portal/human/me/nous` endpoint was introduced in Plan 03; this plan adds only the UI that consumes it. No `dangerouslySetInnerHTML` used.

## Human Verification: APPROVED

Task 5 checkpoint was approved by the user after visual inspection of:
- Empty state (`/portal/my-nous` with no Nous owned): sparkle SVG, heading, copy, "Spawn Your Nous" CTA, routing to `/portal/nous/spawn`
- Owner hub (`/portal/my-nous` with Nous owned): HeroCard with PersonalNousAvatar, "Chat with [Name]" button with encoded DID, region/ousia rows, ProfileTabBar tabs, Spawn Info section with seed badge and spawn details
- Genesis Nous regression (`/portal/nous/sophia`): Sophia avatar still renders; no PersonalNousAvatar shown
- CSS variable compliance: computed styles confirmed using `--bronze`, `--ink`, `--terracotta-2`; no Tailwind utility classes in DOM

## Self-Check: PASSED

All created/modified files exist:
- `dashboard/src/components/portal/avatars/PersonalNousAvatar.tsx` ✓
- `dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx` ✓
- `dashboard/src/app/portal/my-nous/OwnerHub.tsx` ✓
- `dashboard/src/app/portal/my-nous/page.tsx` ✓ (replaced)
- `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` ✓ (extended)

Commits verified in git log: 9dadc36, c0a49bd, 45f2747, 18a68d5.

TypeScript: no new errors introduced (pre-existing test file type errors unrelated to this plan).

Next.js build: exits 0, `/portal/my-nous` route listed at 1.88 kB.
