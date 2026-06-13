# Phase 58 · Wave 5 — Summary (Dashboard orbital map)

**Plan:** `58-06-PLAN.md` · **Requirements:** R-58-11, R-58-12 · **Decision:** D-58-09 (D-NH-01/11/12)

## What shipped

Made the land VISIBLE (D-NH-01) via an additive orbital Genesis Core map in the dashboard.

### New files
- `dashboard/src/components/worldmap/OrbitalGenesisMap.tsx` — live orbital map component.
  - Live-fetches `GET /api/v1/civic/parcels` (`${NEXT_PUBLIC_GRID_ORIGIN}`), with a graceful
    fallback to the embedded **53-parcel `GENESIS_SEED`** on fetch failure / empty payload.
  - Earth below (D-NH-12, blue-marble radial gradient + atmosphere halo).
  - Government Core monument at ring 0 (`data-testid="government-core"`, gravity centre).
  - Ghost frames flip to **lit SOLID modules** keyed on `owner_civic_did_hash` presence
    (`data-owned`); unowned parcels stay dashed ghost frames.
  - Occupancy lights driven by `occupant_count` (`data-testid="occupancy-light"`, one per occupant).
  - NY clock (D-NH-11) rendered ONLY here at the display boundary (`Date`/NY-calendar usage
    confined to this component; not in any wallclock-gated path).
  - **No raw owner DID is ever rendered** — only `owner_civic_did_hash` (HEX64) surfaces.
  - Rendered as DOM/SVG (the canonical `docs/noesis-genesis-core-map.html` is a Three.js canvas;
    this port keeps the orbital language — radial shells, Earth below, monument, ghost/lit —
    while staying inspectable + testable in jsdom).
- `dashboard/src/app/worldmap/orbital/page.tsx` — additive `/worldmap/orbital` route (dynamic
  import, `ssr:false`).
- `dashboard/test/orbital-genesis-map.test.tsx` — 9 tests (render + mock-fetch pattern from
  `governance-voting-history.test.tsx`): 53 seed parcels on fallback (52 modules + 1 core),
  Government Core + Earth + NY clock render, lit vs ghost from `owner_civic_did_hash`, occupancy
  lights from counts, and **no raw DID rendered** (only the hash) even when the feed leaks one.

### Surgical link additions (additive)
- `dashboard/src/app/LandingView.tsx` — added an "Explore the orbital map" `<Link href="/worldmap/orbital">`
  in the live virtual-map section (the destination of the hero "Explore the map ↓" anchor), beside
  the existing "Open full map" / "Browse the Civic Map" links.
- `dashboard/src/app/portal/civic-map/page.tsx` — added an "Explore the orbital map →" link in the
  page header.

### Deliberately UNCHANGED
- `dashboard/src/app/worldmap/page.tsx` — the existing CyberGrid city view is untouched
  (`git status` clean). `/worldmap/orbital` is new beside it.
- `dashboard/src/components/portal/CyberGrid.tsx` — untouched. It is a pure canvas component with
  no link surface; the landing's "Explore the map" links actually live in `LandingView.tsx` and the
  civic-map page, which is where the orbital links were added. (The plan's `files_modified` named
  CyberGrid, but the link surface is in LandingView — the functional intent is satisfied without
  restructuring the canvas component.)

## Gates / self-check
- `npm run test:unit -- orbital-genesis-map` → **9 passed**. Combined with `CivicMap` → 18 passed.
- `node scripts/check-wallclock-forbidden.mjs` → **exit 0** (no tick→calendar leak into
  grid/audit/consensus; the only `Date`/NY-calendar usage is in the dashboard orbital component,
  which is not a wallclock-gated path).
- `npx tsc --noEmit` → **no NEW errors** from the new files. 10 pre-existing errors remain, all in
  unrelated `portal/chat/*.test.tsx` files (missing test-runner globals).
- `/worldmap` city view + `CyberGrid.tsx` confirmed unchanged via `git status --porcelain`.

## Notes for downstream
- The component's `ParcelFeedEntry` interface mirrors the Wave 3 `publicView` shape in
  `grid/src/api/routes/civic-parcels.ts` (`status` 'available'|'owned', `owner_civic_did_hash` HEX64
  or null, `occupant_count`). `GENESIS_SEED` is exported for tests and offline render.
