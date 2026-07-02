---
milestone: cross-cutting
sources: 70+ (GitHub/vendor docs, surveyed live 2026-07-02)
tags: [visualization, three.js, knowledge-graph, digital-twin, oss]
---

# OSS Landscape — Living-World & Knowledge Visualization (2026-07)

> Web survey feeding the [[system-audit-2026-07|Full-System Audit]] Q2 (visualize what Nous build,
> continuously upgradeable). Constraints honored: no-build-step canon map (Three.js ES modules via
> unpkg), **orbital-station aesthetic locked** (nous-space-visualizer skill), bundled dashboard app
> also exists, upgrade-over-rewrite, "visualization IS the investment interface" (D-NH-01).

## 1. Three.js ecosystem (stay-vanilla upgrades)

| Project | URL | License | Use for Noēsis |
|---|---|---|---|
| three.js core (~r185) | github.com/mrdoob/three.js | MIT | Keep vanilla; pin importmap, bump quarterly; adopt **TSL/WebGPURenderer** opportunistically (WGSL+GLSL fallback) |
| **camera-controls** | github.com/yomotsu/camera-controls | MIT | Click → smooth fly-to → frame (`setLookAt`/`fitToBox`) — the core investment gesture; plain ESM |
| **three-mesh-bvh** | github.com/gkjohnson/three-mesh-bvh | MIT | Fast picking at thousands of objects; capsule collide-and-slide demo = no-physics-engine first-person walk |
| three-bvh-csg | github.com/gkjohnson/three-bvh-csg | MIT | Interior tree → geometry: CSG-carve corridors/rooms/windows; visible remodels |
| InstancedMesh / BatchedMesh + LOD | three.js core | MIT | Scaling path for orbital objects dozens → thousands (1-draw-call batches, ring-distance LOD) |
| troika-three-text | github.com/protectwise/troika | MIT | Crisp SDF in-scene labels (names/owners/knowledge titles) |
| react-three-fiber v9/v10 + drei | github.com/pmndrs/react-three-fiber | MIT | Dashboard-only embedded 3D panels; do NOT migrate the canon map |
| Rapier (if physics ever needed) | rapier.rs | Apache-2.0 | Prefer BVH kinematics for the canon map (no WASM/build) |

## 2. Alternative engines — verdict: stay vanilla

Babylon.js 8 (Apache-2.0, Havok plugin NOT OSS) · PlayCanvas (engine+editor now fully MIT — watch for a future visual world editor) · Godot web (wrong shape) · Wonderland (proprietary) · Needle (proprietary layer). **All cost a rewrite of locked canon and buy nothing the aesthetic needs.**

## 3. Space / orbital specific

| Project | URL | License | Use |
|---|---|---|---|
| satellite.js | github.com/shashwatak/satellite-js | MIT | Real ephemeris: station position + `sunPos` day/night lighting; later Moon/Mars transfer orbits |
| three-globe / globe.gl | github.com/vasturiano/three-globe | MIT | Earth layer upgrade: investment arcs Earth→station, activity points — drop-in Object3D |
| CesiumJS + **CZML pattern** | cesium.com | Apache-2.0 | Don't adopt engine; adopt CZML **time-interval packets** for scrub/replay/stream of Grid growth |
| satvis / sat-vis | github.com/Flowm/satvis | MIT | TLE→orbit→3D pipeline reference; fully-static live orbital viz proof |
| KeepTrack | github.com/thkruz/keeptrack.space | **AGPL-3.0 ⚠** | Study only (30k+ objects techniques); never vendor |
| **Assets**: Kenney Space/Station kits, Quaternius Sci-Fi MegaKit | kenney.nl · quaternius.com | **CC0** | Interiors/furniture/props for in-station walk |
| NASA 3D Resources + SVS Moon Kit / USGS | github.com/nasa/NASA-3D-Resources | US-Gov | Real ISS modules; Moon/Mars textures matching blue-marble Earth |
| Sketchfab CC0 | — | CC0 | **Act now:** CC0 can't migrate to Epic Fab — bulk-archive wanted sci-fi assets this quarter |

## 4. Voxel / buildable worlds (pattern donors)

Luanti/Minetest (LGPL-2.1, headless authoritative world + mutation API) · noa-engine (MIT) ·
**Voxelize** (MIT — Rust server + three.js client + chunk-diff protobuf: the design to copy if
interiors become cell-buildable) · **Hytopia SDK** (MIT — 2025's most direct "AI agents inhabiting
a visible world" precedent; server-relayed deterministic inputs).
**Transferable pattern:** server-authoritative event log → entity deltas over WS → client applies + **highlights diffs (new geometry glows)** — applies to modules/interiors without voxels.

## 5. Knowledge-graph visualization

| Project | URL | License | Scale | Use |
|---|---|---|---|---|
| **three-forcegraph / 3d-force-graph** | github.com/vasturiano/three-forcegraph | MIT | low-thousands | **Highest synergy:** a `THREE.Object3D` — knowledge constellations INSIDE the station (Library sphere); same no-build stack |
| **cosmos.gl** (Cosmograph) | github.com/cosmosgl/graph | MIT (OpenJS) | 100k–1M GPU | Civilization-scale knowledge map in the dashboard |
| sigma.js v3 + graphology | github.com/jacomyal/sigma.js | MIT | tens of thousands | Analytic 2D wiki/lore pages (communities = schools of thought, centrality = influence) |
| AntV G6 v5 | github.com/antvis/g6 | MIT | — | Fast polished graph panels (skill trees, governance explorers) |
| Cytoscape.js | js.cytoscape.org | MIT | 3–5k | Graph algorithms (paths/centrality/clustering), not the big renderer |
| **Quartz 4** | github.com/jackyzha0/quartz | MIT | — | Publish per-Nous personal wikis + lore commons as sites with graph views |
| Juggl | github.com/HEmile/juggl | GPL-3.0 ⚠ | — | Styling inspiration only (typed-edge graph stylesheets) |
| Gource | gource.io | GPL-3.0 | — | The "watch it grow" replay reference; our audit chain is exactly its event log |

## 6. Live / streaming world updates

- **Colyseus + @colyseus/schema** (MIT): authoritative rooms + **incremental delta state sync**
  (ChangeTrees, patch rate); 50k CCU case studies. Adopt rooms or just copy the
  **snapshot + WS delta + patch-rate** model over plain WS.
- geckos.io (BSD-3): WebRTC datachannels — only if sub-100ms shared presence ever matters.
- **Time-lapse pattern** = CZML-style intervals + audit chain as event source + a scrubber that
  re-applies events into the scene. Assembly, not research.
- Hytopia determinism invariant: clients are pure renderers of Grid truth → investment interface stays un-spoofable.

## 7. Digital-twin dashboards

Eclipse Ditto (EPL-2.0 — mirror its twin-state + change-stream + search **API shape**, don't adopt) ·
OpenTwins (research — adopt its **bidirectional 3D⇄panel selection linkage**: click module in 3D →
economics/lore/owner panels update, and vice versa) · iTwin.js (MIT — skim "changed elements/version
compare" for world visual-diff) · F´/F-Prime = NASA flight software, aesthetic inspiration only.

## Top-5 recommendations (impact vs effort)

1. **Snapshot + WS delta stream + audit-chain replay** (Colyseus schema pattern, CZML time packets): live map, glow-on-build, time scrubber — "watch the city grow" is the investment pitch made visible. *Highest impact · moderate effort · zero canon risk.*
2. **camera-controls + three-mesh-bvh now**; PointerLockControls + BVH capsule walk next. *High · low.*
3. **Knowledge constellations**: three-forcegraph in-station; cosmos.gl civilization view in dashboard; sigma.js analytic pages; Quartz per-Nous wikis. *High · low-moderate.*
4. **Instancing/LOD/labels scaling pass** (InstancedMesh/BatchedMesh/LOD/troika) — 60fps at 100× object growth. *Prerequisite · low-moderate.*
5. **CSG interiors + CC0 asset pipeline** (three-bvh-csg + Kenney/Quaternius/NASA; archive Sketchfab CC0 now). Upgrades become *visible remodels*. *High · moderate.*

**Engine verdict:** remain vanilla no-build three.js; adopt TSL/WebGPU opportunistically. Voxel/Hytopia/Ditto contribute patterns, not dependencies.

Related: [[system-audit-2026-07]] · [[oss-agent-learning-landscape]] · [[nous-house-research|Nous House research (D-NH axioms)]] · [[v3.0/CIVIC-ARCHITECTURE|v3.0 Civic Architecture]]
