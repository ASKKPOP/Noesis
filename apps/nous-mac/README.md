# Nous (Mac)

The native Local Nous Manager (D-V3-42, Tier 1 of D-V3-36): a SwiftUI app over the Rust
Brain core in `brain-rs/`. It replaces the Electron `apps/local-nous-manager` once it
covers the same functions; until then both exist.

## What it does today

Everything the Electron manager did, plus chat, a dashboard and a model picker:

| Screen | What it is | Source |
|--------|------------|--------|
| Dashboard | the Nous at a glance: running or not, model, mood, goals, latest memories | Rust core + running Brain |
| Chat | talk with your own Nous; stays on this Mac, never sent to a Grid | Brain `POST /local/chat` |
| Profile | identity, goals, needs and drives at any tick, the exact system prompt | Rust core (`noesis_nous_view`) |
| Live State | what the running Nous is right now | Brain `/local/state` |
| Memory · Personal Wiki | the Nous's memories and written knowledge | Brain `/local/memory/recent`, `/local/wiki/pages` |
| Local AI | models installed on this Mac; choose the one the Nous thinks with | Ollama `/api/tags`, Brain `/local-ai/status` |
| Brain Process | start, stop, logs | the app runs `python -m noesis_brain` |
| Map | the Portal's live 3D map of Grids, shown in the app (address in Settings; default `https://noesiis.com/worldmap/orbital`) | Portal web page |
| Grid Access | the Grid address (`GRID_URL`), this Nous's ID and Brain public key to register on the Portal, citizenship status; opens Portal sign-in and registration in Map | settings + Brain data folder |
| Configuration | the Nous's file as grouped settings (identity, personality, values, emotions, goals, thinking) or as text; the Rust core reads it, merges changes in and checks the result; previous version kept as `.bak` | file + Rust core |
| Settings | Brain directory, Python, port, extra environment, the local secret | Application Support |

The Nous itself still runs on the **Python Brain**, which this app starts and stops. The
Rust core cannot run a Nous yet; it powers Profile, the dashboard header and the
configuration check. In chat the Nous is shown the last 20 messages of the conversation, and
keeps each exchange as one of its own memories.

App data lives in `~/Library/Application Support/Nous/`: `settings.json`, `brain-secret`
(readable only by you), `chats/`, and `brain-data/<nous>/` (the Nous's own memory).

## Build and run

    ./build.sh                                   # Rust core, then the app → build/Nous.app
    open build/Nous.app --args ../../brain/data/nous/sophia.yaml

Needs Xcode and Rust (`~/.cargo/bin/cargo`). The bundle is ad-hoc signed: it runs on the
Mac that built it and is not distributable.

## Layout

- `Sources/CNoesisBrain/` — the C header of the Rust core's interface.
- `Sources/NousMac/BrainCore.swift` — the only place that calls the core.
- `Sources/NousMac/BrainProcess.swift`, `BrainAPI.swift` — the Python Brain's process and local port.
- `Sources/NousMac/*Pane.swift`, `RootView.swift` — the screens.
