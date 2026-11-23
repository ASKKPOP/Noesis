# viz-rs — the Grid Station View in Bevy (option C, D-V3-45)

Both levels of the Grid Station View — the station in orbit and a district along the inside
of a ring — drawn by [Bevy](https://bevy.org) and compiled to WebAssembly for the dashboard.
The three.js scenes (`orbital-station-scene.ts`, `district-scene.ts`) stay as the fallback.

| File | What it is |
|------|------------|
| `src/layout.rs` | Pure layout: parcel positions, render status, zone colours and signs, camera fit, picking geometry. A port of `orbital-layout.ts`, `zone-view.ts`, `grid-focus.ts`. |
| `src/scene.rs` | The Bevy scene: station, rings, modules, Moon & Mars, objects, pulses, camera, picking. Talks to the page through a command queue and a `Host`. |
| `src/district.rs` | The district level: same app, its own camera on render layer 1; lots arrive already laid out by `district-layout.ts`. |
| `src/web.rs` | wasm-bindgen exports used by `dashboard/src/components/worldmap/orbital-bevy.ts`. |
| `fixtures/layout-parity.json` | Recorded from the TypeScript; `tests/parity.rs` replays it. |
| `tests/scene_smoke.rs` | Runs the real scene systems headless (no window, no GPU). |

## Rules

- **The layout is one definition.** Change `orbital-layout.ts` / `zone-view.ts` / `grid-focus.ts`
  → re-record the fixture (`cd dashboard && UPDATE_VIZ_PARITY=1 npx vitest run test/orbital-layout-parity.test.ts`)
  → change `src/layout.rs` in the same PR until `cargo test` passes.
- Bevy reports system-parameter conflicts (B0001) only when an app runs; the smoke test runs one.

## Build and test

Bevy 0.20 needs Rust ≥ 1.97.1. Docker pins everything (stage 0 of `docker/Dockerfile.dashboard`):

```bash
docker build -f docker/Dockerfile.dashboard --target viz-test .
docker build -f docker/Dockerfile.dashboard --target viz-out -o dashboard/public/viz .
```

With a local toolchain: `cargo test` (all tests) or `cargo test --no-default-features` (layout only, no Bevy).
