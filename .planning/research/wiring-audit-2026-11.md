---
milestone: cross-cutting
sources: 4
tags: [audit, wiring, readme, brain, grid, visualization]
---

# What is wired — source audit (2026-11-23)

Made for the README rewrite. Four read-only passes over `main` (run paths; Brain and Rust; Grid and
economy; web and visualization), then the serious findings re-checked by hand. "Not wired" means the
code is in the tree and nothing in the running system calls it. Nothing was executed; no test was run.

## Brain (`brain/`)

- **Live each tick:** Psyche, Thymos, Telos, Ananke, Bios (starvation death), Chronos.
- **Live with a Grid connection:** Aisthesis; cycles decision 20 / planner 200 / economic 50 / social 60 /
  conversation 1 / tool 50 (needs a tool-capable model, curiosity ≥ 0.6) / reflection. Property 100 is off
  unless `BRAIN_PROPERTY_CYCLE=on`.
- **Not wired:** `__main__` never passes `iris_db_dir` or `hypnos_db_dir` to `BrainHandler`, so Iris,
  Hypnos sleep, the skill store, the observational learner and quarantine are all off. Lore is never set
  up (`MemoryStream` has no `_conn`). `send_whisper` / `receive_loop` have no caller outside `whisper/`.
  WebRTC is answer-side only. `PersonalWiki` has no writer outside `episteme/`. No file in `brain/src`
  contains "pneuma". Hermes needs an outside checkout and `brain/tools/noesis_grid_tools.py`, which does
  not exist. The OpenAI-compatible adapter is not selectable. Relevance is keyword overlap (no embeddings).
- **No cycle chooses:** propose, trade_request, most land verbs.

## Grid (`grid/`)

- **The Polis-session gap.** `government_only` routes need a JWT issued as
  `did:gov:noesis:genesis-polis` (`civic-registry/government-session.ts`); the file only verifies, and no
  production code signs one. Unreachable until that exists: zone add/relabel/remove routes, legislative
  session open/close, enact, repeal, Police convict, IRS disburse, curator election, procurement award and
  settle (so duty-by-public-work cannot complete), Type B endowment.
- **Live:** land (buy, build, furnish, roles, task board, IOUs, give-to-polis), upkeep 10,080 ticks with
  worn/derelict/reclaim at 1/2/3 missed periods, civic duty with the gate (`api/civic-duty-gate.ts`, four
  open routes), registration with Brain-key binding, owner-only fork, scene feed, 161 allowlist members,
  migrations to v81.
- **Law:** the v2.2 commit-reveal engine is the live path; its store is `createInMemoryStore` (lost on
  restart). An H3 operator can add, amend and delete laws (`api/operator/governance-laws.ts`).
- **Money:** one wei ledger; `initialSupply: 0`; endowment off by default; nothing outside
  `grid/src/onchain/` imports it; contracts have no deployment record. "Compute-labor" is not a code concept.
- **Not there:** Type B runtime (spawn refused `forbidden_in_v3.0`), cross-Grid (503), reputation updates,
  preset shops, negotiation rounds. Portal "chat with Sophia/Hermes/Themis" is a persona prompt on the
  Grid's Ollama, not the Nous's Brain. USDT wallet, tip panel and paid spawn remain in the tree.

## Run paths

- Production: `docker-compose.yml` + `docker-compose.aws.yml` via `deploy.sh`, nginx. `docker-compose.prod.yml`
  (Traefik) is unused. `.env.example` still documents the Traefik layout.
- `docker-compose.yml` gives the three Brain containers `GRID_ENDPOINT`; no code reads it (the Brain reads
  `GRID_URL`, https/wss only). The local Brains never reach the local Grid.
- `scripts/quickstart.sh` does not set `GRID_COOKIE_SECURE=false`, so sign-in on localhost fails.
- `cli/` runs a Grid in its own process; `protocol/` is imported by no source file.
- `docs/noesis-deploy-runbook.html` describes an Apache/askkpop layout that conflicts with `deploy.sh`.

## Web and visualization

- Bevy is the default for the outside and district levels; three.js on no WebGL2, load failure, 20 s
  without a frame, or a later Bevy stop. `dashboard/public/viz/` is gitignored, so `npm run dev` always
  uses three.js. Interior level and the city seen from outside are not built.
- Steward is live at `/console`; the dashboard's `/grid/*` overlaps it. `/nous` hardcodes `ws://localhost:8080`.
- Not verified at run time: steward pages call `/api/operator/...` without the `/console` base path.

## Consequence

The public wiki describes several of the not-wired parts (whisper, sleep, theory of mind, skills, lore,
Polis acts) as system behaviour. The README now marks them; the wiki has not been corrected.
