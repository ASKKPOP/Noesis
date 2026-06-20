# Noēsis Grid-Viz (prototype)

Self-contained prototypes of the **Genesis Grid visualization** from
[`.planning/research/v3.0/GRID-VIZ-PLAN.html`](../../../.planning/research/v3.0/GRID-VIZ-PLAN.html).

## ▶ `orbital.html` — current direction (3D, canonical)

The **off-Earth orbital scene** (three.js): a central Grid core (civic seed) in orbit above
Earth, the 6 zones as orbital station-nodes, and **functional objects the Nous learns to build**
— each object's shape encodes its function (Compute, Memory, Energy, …), not decoration.

- `orbital.html` + `orbital.js` — the scene · `vendor/` — local three.js (no CDN at runtime)
- `physics-gate.js` — **Phase S1** physics contract (6 laws); every object is gated before it can appear.
  Tests: `node --test physics-gate.test.cjs` (10 cases, TDD). Dual browser-global / CommonJS.
- `object-gen.js` — **Phase S2** the Nous generates a unique design per spec (generate-once → atlas cache,
  localStorage); `fal.ai` is a stubbed hook (`setUseFal(true)` + fill `falGenerate`), procedural is the
  offline fallback. Tests: `node --test object-gen.test.cjs` (6 cases, TDD).
- `learning.js` — **Phase S3** the learning loop: `fitness` scores capability/efficiency, `evolve` keeps
  the fittest (elitism) and breeds `specialize`d variants — only physical (S1-gated) children survive,
  best fitness never regresses. "Nous: evolve generation" runs it live. Tests: `node --test learning.test.cjs`
  (8 cases, TDD).

- `simulate.js` — **Phase S4** `simulateZone()` runs a zone's one-tick energy ledger (inflow/demand/
  surplus → powered/brownout) and **conserves energy** (never serves more than produced). Click a
  zone-node to drill in: its modules highlight, the rest dim, and the live sim shows. `learning.js` also
  gained **niche** diversity (`evolve({niche})`) so the population doesn't collapse to a monoculture.
  Tests: `node --test simulate.test.cjs` (6 cases, TDD).

Run all grid-viz tests: `node --test *.test.cjs` (31 cases).
- "Nous: build object" button demonstrates the Nous constructing new functional modules (gated)
- Must be **served over http** (three.js ES modules); `http://localhost:3000/grid-viz/orbital.html`
  via the dashboard, or any static server. Zone IDs stay canonical (D-V3-32); labels are demo-only.

## `index.html` — earlier isometric prototype (alternative)

The original ground-city metaphor, kept as a reference/alternative. Superseded by `orbital.html`.

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
