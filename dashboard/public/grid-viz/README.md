# Noēsis Grid-Viz (prototype)

A self-contained, vanilla-JS prototype of the **Genesis Grid visualization** from
[`.planning/research/v3.0/GRID-VIZ-PLAN.html`](../../../.planning/research/v3.0/GRID-VIZ-PLAN.html).

Two layers, mirroring **Portal → Grid → City**:

| Layer | File | What it does |
|-------|------|--------------|
| **Portal** (off-Earth Noēsis-space) | `portal.js` | Constellation of Grids; Genesis is live, click it to enter |
| **City** (isometric 6-zone) | `city.js` | Renders the Genesis Grid; pan/zoom/hover |
| **Buildings** (unique + cached) | `buildings.js` | Per-parcel **procedural** buildings now; `fal.ai` AI hook stubbed |
| **Data** | `data.js` | 6 zones + Genesis layout (edit the ASCII map to reshape the city) |

> **World rule:** this is *synthetic Noēsis-space*, **not** real Earth. No map tiles, no lat/lon.

## Run

No build step, no server, no npm.

```
open dashboard/public/grid-viz/index.html
```

Or, via the Next.js dashboard (already serves `public/`):

```
http://localhost:3000/grid-viz/index.html
```

## How it works

- **Most objects differ** — `buildings.js` generates a unique descriptor per parcel
  (height, palette, setback, antenna) from a deterministic seed, so no two buildings match.
- **Generate-once → cache** — every descriptor is stored in an *atlas* (`localStorage`),
  so reloads reuse instead of regenerating. The header shows the growing catalog count.
- **Reshape the city** — edit `GENESIS_LAYOUT` in `data.js` (`G B S R I M`, `.` = street).

## Wire in real AI buildings (fal.ai)

The app works fully offline today. To make each building an **AI-generated isometric sprite**:

1. Open `buildings.js`, set `const USE_FAL = true;`
2. Fill in `falGenerate()` with your fal.ai model + key (skeleton is in the function body).
3. Return `{ source:'fal', spriteUrl }`; cache + render already handle it.

That's the "Nous builds the Grid with AI power" path — variety becomes the mechanism, not extra work.

## Status

Prototype / v0. Renderer is schematic boxes (procedural). Swapping in IsoCity sprites or
fal.ai output is a drop-in at the `buildings.js` layer — the Portal/City/router code is unchanged.
