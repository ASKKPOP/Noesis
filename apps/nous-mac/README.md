# Nous (Mac)

The native Local Nous Manager (D-V3-42, Tier 1 of D-V3-36): a SwiftUI app over the Rust
Brain core in `brain-rs/`. It replaces the Electron `apps/local-nous-manager` once it
covers the same functions; until then both exist.

## What it does today

A Nous viewer. Open a Nous configuration (`.yaml`) and see who the Nous is, its goals,
its needs and drives at any tick since birth, and the exact system prompt for that tick.
Everything shown is computed by the Rust core (`noesis_nous_view`); the app holds no
Nous logic of its own. Drives and needs are shown as buckets only (low / med / high).

It does not run a Nous: no model calls, no Grid connection, no chat, no settings yet.

## Build and run

    ./build.sh                                   # Rust core, then the app → build/Nous.app
    open build/Nous.app --args ../../brain/data/nous/sophia.yaml

Needs Xcode and Rust (`~/.cargo/bin/cargo`). The bundle is ad-hoc signed: it runs on the
Mac that built it and is not distributable.

## Layout

- `Sources/CNoesisBrain/` — the C header of the Rust core's interface.
- `Sources/NousMac/BrainCore.swift` — the only place that calls the core.
- `Sources/NousMac/ContentView.swift` — the screens.
