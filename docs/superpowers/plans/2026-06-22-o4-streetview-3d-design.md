# O4 "street-view" — 3D first-person navigable city (design)

**Date:** 2026-06-22 · **Decision:** 3D first-person via Three.js (reuse the orbital grid-viz),
not 2.5D isometric, not a zoomed SVG map.

## What it is

A **walkable 3D view of the Genesis city** — drop to ground level and move through the 6 zones,
seeing real parcels and structures where they actually are. It complements (does not replace) the
top-down SVG civic map; the SVG map stays the operator's authoritative diagram (D-V3-06).

## What already exists (reuse)

- **Three.js viz** — `dashboard/public/grid-viz/` (orbital.js): vendored **Three.js r150** +
  `OrbitControls`, a proven `scene / PerspectiveCamera / WebGLRenderer / requestAnimationFrame`
  pipeline that already fetches backend objects (`GET /api/v1/orbital/objects`) and reads
  `grid-environments.js`. Directly reusable scaffolding.
- **City data model** — parcels carry **ring / sector / level** (D-NH-10; `grid/src/civic/types.ts`),
  6 zones, structure `{type, visibility}`. Routes: `GET /api/v1/civic/parcels` (+ `/:id`,
  `/:id/interior`), `GET /api/v1/civic-map/state` (zone polygons + Nous stubs),
  `GET /api/v1/civic/presence`.
- **CyberWorldMap** — `dashboard/src/components/worldmap/CyberWorldMap.tsx`: an isometric Canvas
  city **prototype, not wired to live data** — a visual reference only, not the build base.

## The gaps street-view must fill

1. **Coordinate mapping** — no `(ring, sector, level) → (x, y, z)` function exists. Define one:
   `x = ring·R·cos(sector°) · π/180`, `z = ring·R·sin(...)`, `y = level·FLOOR_H`. This is the
   spatial spine; it must match the civic-map's radial convention (core = ring 0).
2. **City geometry generator** — ground plane per zone (6 radial wedges), a plot per parcel, a
   simple massing block per structure type (home/shop/workshop/venue → distinct box+color).
3. **Live parcel renderer** — fetch `GET /api/v1/civic/parcels`, place a structure mesh at each
   parcel's mapped position; color by zone; label owner-hash on click.
4. **First-person navigation** — `PointerLockControls` (WASD + mouse-look) for ground-level walking,
   with a toggle back to an orbit/overview camera.
5. **Inspect interaction** — raycast click on a structure → fetch `GET /api/v1/civic/parcels/:id`
   (+ interior if entry-policy allows) → detail panel.

## Scope — phased (YAGNI)

**Phase O4a (MVP):** coordinate mapping + city geometry from **real parcels** + first-person
controls + click-to-inspect. A visitor walks the actual Genesis city and clicks a building to see
who owns it and what it is.

**Deferred (explicit):**
- **Nous avatars in the street** — the Nous↔parcel binding is a Phase-36/37 stub (`civic-map`
  `nous[]` is empty); presence has status but no ground position. Add when that binding lands.
- **Live firehose updates** — re-render on `zoning.structure_built` / purchase events; MVP is a
  load-time snapshot + manual refresh.
- **Walk-into interiors** — render the Phase-59 interior tree (areas/furniture) as 3D rooms.
- **Asset-quality models** — MVP uses procedural massing blocks, not modelled buildings.

## Architecture

```
street-view (new dashboard/public/grid-viz/street.{html,js}, reuses vendor/three + OrbitControls)
  ├─ fetch GET /api/v1/civic/parcels  ──▶ for each parcel: place(structureMesh, map(ring,sector,level))
  ├─ ground: 6 zone wedges (radial) colored per civic-map zone palette
  ├─ camera: PointerLockControls (walk) ⇄ OrbitControls (overview)
  └─ raycast click ──▶ GET /api/v1/civic/parcels/:id ──▶ detail panel
```

Pure client-side over existing public/read routes — **no Grid/backend changes for the MVP**.
A small new lib `address-to-world.js` holds the coordinate mapping (shared, unit-testable).

## Files

- `dashboard/public/grid-viz/street.html` + `street.js` (NEW — reuse `vendor/three.module.js`, `OrbitControls`)
- `dashboard/public/grid-viz/address-to-world.js` (NEW — the (ring,sector,level)→(x,y,z) map)
- `dashboard/public/grid-viz/PointerLockControls.js` (vendored, NEW)
- optional `dashboard/src/app/portal/street/page.tsx` (NEW — embeds the viz in the Portal)

## Verification

Unit-test `address-to-world` (a parcel at ring 0 sits at origin; ring 5 sits at the outer radius;
sector 90° maps to +x/−z per convention) with vitest. Browser-verify via the preview tools:
load real Genesis parcels, walk the city, click a structure → correct owner/zone in the panel,
0 console errors (mirror the orbital.js browser-verify discipline).

## Open decisions for review

1. **Embed location** — standalone `grid-viz/street.html` (like orbital), or a Portal route
   `/portal/street`? (affects auth — public visitor view vs. signed-in.)
2. **Radial convention lock** — confirm ring 0 = Government core and sector 0° = North, so the
   3D map and the SVG civic map agree exactly (avoids a "north is different" mismatch).
3. **MVP without avatars** — is a city of buildings (no walking Nous yet) acceptable for v1, with
   avatars following once the Nous↔parcel binding ships?
