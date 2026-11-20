---
title: Grid Visualization — Research (2026-11-20)
tags: [research, visualization, engines, engagement, three.js]
---

# Grid Visualization — Research (2026-11-20)

Research behind `docs/noesis-grid-visualization-research-2026-11-20.html`. Operator brief:
the Grid must be visualization-first for end users (reference: NVIDIA smart-city pages);
research any engine. **Nothing here is decided or built.** Extends
[[oss-visualization-landscape]] (2026-07), which already recommended staying on vanilla three.js.

## Method
Three parallel surveys (engines by web; engagement evidence by web; the Grid's own visuals in
code) plus one fetch of the NVIDIA page. Web claims mostly from search summaries.

## Finding 1 — the gap is life, not the engine
Code survey (2026-11-20): the public orbital map fetches once on mount, uses no live channel,
and its data packets are decorative. Nous are a generic figure on every owned lot. `nous.moved`
is drawn only on the Steward console. `civic-map/state` always returns `nous: []`. Structure
kind/condition and interiors are dropped from the 3D view (the SVG `OrbitalGenesisMap` that drew
them is unmounted). The Steward replay calls a route that does not exist. `space/` regions and
parcel rings are two unrelated spatial models. No glTF/texture assets, no instancing/LOD/post;
three `^0.160.0`; Earth texture hotlinked. Public visitors get only `{tick, event_type, family}` live.

## Finding 2 — engines
| Option | Ceiling | Delivery | Cost @100 concurrent |
|---|---|---|---|
| Omniverse streaming / UE5 pixel streaming | 5 | GPU server → video | ~$18K (4 h/day) – ~$110K/mo (published per-minute rates) |
| Splat backdrop + live meshes (Spark) | 4.5 | browser | hosting + 50–250 MB assets |
| Authored + baked glTF + post-processing | 4 | browser | hosting |
| three.js / Babylon 9 / PlayCanvas | 3.5–4 | browser | hosting |
| Unity 6 web, Godot, Bevy, Needle, Wonderland | 3–3.5 | browser | hosting; rewrite |
| Cesium / deck.gl / iTwin | 3 | browser | Earth-coordinate stacks; poor fit |
NVIDIA stack: Omniverse (render), OpenUSD (format), Metropolis (camera analytics — n/a),
Cosmos (robot-training world models — n/a). three.js current r187; WebGPURenderer with
automatic WebGL2 fallback; WebGPU ≈ 89% of browsers. Streamed pixels are not agent-readable.

## Finding 3 — what holds attention
No retention study exists for AI-agent worlds. Best-supported, in order: personal stake
("your agent" lens); "while you were away"; reasoning shown beside action; curated highlights;
roster bar; own-agent-only alerts; shareable clips; time controls/time-lapse; few overlays;
poster-first load. Failure modes: nothing happening; spectacle without stake; authenticity
doubt; heavy 3D before value; engagement the user must seek out.

## Proposed order (for discussion)
V0 live + true map (public scene feed; regions↔rings) → V1 show Nous and acts ‖ V3 look
(assets, baked light, post, instancing, WebGPU, poster-first) → V2 your-Nous + away digest →
V4 buildings/interiors ‖ V5 replay/highlights/sharing → V6 splat backdrop + offline intro film.
Needs operator decisions on: browser vs streaming; public visibility of Nous names/acts;
who makes art; relaxing the "three.js from unpkg, no build" skill rule.

Related: [[oss-visualization-landscape]] · [[system-audit-2026-07]] · [[nous-house-research|Nous House research]] · [[grid-extension-research-2026-11]]
