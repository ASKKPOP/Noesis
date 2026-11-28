# Grid Builder Crew — design

*2026-11-27 · status: for operator approval (all operator questions answered) · origin: a design session that analysed the
Anthropic talk "1,000 Claude Agents Formalized Fermat's Last Theorem" (Lance Martin) and then
designed the Genesis Grid structure with the operator.*

## 1. Intent — what this is and why

A **new service, separate from the noesiis.com service**, in which a **crew of AI agents builds a
Grid for the planner**. Today the Genesis Grid structure exists only as a hand-made design page
(`docs/reports/noesis-genesis-grid-structure-v0-2026-11-27.html`). The operator wants Grid space to
be *built automatically by an AI team*, the way the talk's 1,000-agent team formalized a proof:
a lead and helpers that organise themselves through a few shared primitives, a strict checker
that decides what is correct, and monitors at the edges.

- **Who it serves:** the planner (today: the operator; later, others who join as planners).
- **What the planner does:** writes a **brief**, may talk with the crew during a run (never
  required; the crew never waits), and **checks only the finished result**.
- **Who builds:** a **builder crew** of AI agents working for the planner. The Grid's own citizens
  (Nous) are **not** the builders; they move in later.
- **What the crew delivers:** a **Grid model as data** — every structural part, parcel and Nous
  chamber as versioned, checked records — plus **3D pages generated from that model**. The model
  can later be imported into Noēsis as the Grid's real structure.
- **Runs in parallel** with Noēsis/noesiis development, which continues in other sessions.

## 2. Goals, non-goals, anti-goals

**Goals (v1)**
1. From a brief, a crew produces a complete Genesis Grid model that passes the checker.
2. The planner can watch a run live, optionally talk to the lead, and review the result: a
   generated 3D page plus a checker report.
3. Every agent action is recorded; every run has a hard budget and a kill switch.
4. The v1 acceptance run, from the default Genesis brief, lands a model whose skeleton matches the
   reference (section 6) within tolerance and whose 24 home chambers and outside detail pass every
   checker rule, within the run budget.

**Non-goals (v1)**
- Writing into the live Noēsis Grid or its database. Export/import into Noēsis is a later phase.
- Nous (Grid citizens) taking part in building.
- Generating renderer code. The 3D page is produced by our own deterministic generator from the
  model; agents write model data, not code.
- Hundreds or thousands of agents. v1 starts at **1 lead + 4 helpers**, configurable.

**Anti-goals — failures even if it "works"**
- A crew that lands parts the checker did not pass, or a checker the crew can rewrite.
- Runaway cost: any run that can exceed its budget without being stopped.
- Any path from an agent sandbox to the open internet, the noesiis production database, or
  secrets other than its own model key.
- Interiors or exteriors that copy a film's sets, names or logos, or a Tron-style neon look
  inside (operator rules, section 6).

## 3. Constraints

- **Separation:** own repository, own containers, own database. It shares no data and no code
  paths with Noēsis.
- **Where it runs (operator, 2026-11-27):** **v1 runs on the operator's desktop** (Apple M5 Pro,
  18 cores, 48 GB RAM, 596 GB free; Docker Desktop for the sandboxes; Node 26). The web app
  listens on localhost only. After the first build works, the service is extended to a server
  (proposed: a separate small instance at builder.noesiis.com).
- **Physics gate:** Noēsis's rule is that Nous never violate physical law. Genesis's 1 g comes from
  a **gravity generator declared as a Grid law** (spin at one turn per 60 minutes gives
  ~0.0002 g). The checker must treat that as the one named exception and enforce everything else
  as physics/geometry.
- **Cost:** model usage is the main running cost. Every run has caps (agents, wall-clock, tokens
  and dollars) and stops itself when any cap is reached.
- **Deploy rule:** the operator's global rule is that "deploy" means the remote production target
  unless the operator explicitly chooses local. For this service's v1 the operator chose the
  desktop ("use my desktop first"), so v1 is done when it runs on the desktop and the acceptance
  run is verified there. The server phase follows the normal remote rule. Noēsis/noesiis.com keep
  the remote-only rule.
- **Privacy:** the Result pages may be public only if they contain no secrets; run logs and talk
  transcripts are private to the planner.

## 4. Approaches considered

| # | Approach | Trade-off | Decision |
|---|---|---|---|
| 1 | **Own service**: new repo, containers and Postgres; agents via the Anthropic Agent SDK in locked-down sandboxes; web UI with Brief / Talk / Live / Result | Most to build; full control over sandboxes, checker, monitors and cost | **Chosen by the operator** — v1 on the operator's desktop, a server later |
| 2 | Anthropic-hosted agent sandboxes + a thin coordinator, DB and UI of ours | Less infrastructure; less control over sandboxing and monitoring; depends on a hosted product | Not chosen |
| 3 | Crews launched from Claude Code on the operator's Mac | Fastest to try; not a service, cannot run unattended | Not chosen (may be used once as a throwaway spike) |

## 5. Decided design

### 5.1 Parts of the service

```
            planner (browser, signed in)
   ┌──────────── Brief · Talk · Live · Result ────────────┐
   │                    web app (API)                     │
   └──────┬───────────────┬────────────────┬──────────────┘
          │ starts/stops  │ reads           │ reads
   ┌──────▼──────┐  ┌─────▼──────┐   ┌──────▼──────────┐
   │ run manager │  │  Postgres  │   │ result generator │
   │ (budget,    │  │  system +  │   │ model → 3D page  │
   │ kill switch)│  │  run schema│   └──────────────────┘
   └──────┬──────┘  └─────▲──────┘
          │ spawns        │ SQL (only)
   ┌──────▼─────────────────────────────┐      ┌────────────┐
   │ agent sandboxes: lead + N helpers  │─git─▶│ run repo   │
   │ (Agent SDK, one container each)    │      │ (bare git) │
   └──────┬──────────────────────┬──────┘      └─────▲──────┘
          │ every tool call       │ "land" request     │ commit on pass
   ┌──────▼──────┐          ┌─────▼──────┐            │
   │ live monitor│          │  checker   │────────────┘
   └─────────────┘          └────────────┘
          offline monitor: every 10 min, summarises the run for the planner
```

1. **Web app** — four views for the signed-in planner:
   - **Brief:** goal text plus structured settings (which Grid, which parts, budget caps).
   - **Talk:** an optional chat with the lead. Planner messages are written into the run's
     announce/notes tables as *planner notes*; the lead reads them when it chooses. No agent ever
     blocks waiting for the planner.
   - **Live:** run status, budget used, agents and what each is doing, tables the lead created,
     landed parts over time, monitor alerts.
   - **Result:** the generated 3D page of the landed model, the checker report, the run summary,
     and a diff against the previous run of the same Grid.
2. **Run manager** — creates a run (DB schema + git repo + sandboxes), enforces caps, offers a
   kill switch, tears down sandboxes at the end.
3. **Agent sandboxes** — one container per agent, running the Anthropic Agent SDK. Network is
   limited to: the Anthropic API, the run's Postgres schema, and the run's git repo. No other
   internet, no host filesystem, no other secrets.
4. **Shared primitives (as in the talk)** — exactly two:
   - **SQL:** each run gets its own Postgres schema. The lead may create tables in it (the talk's
     lead invented announce / roles / notes / subtasks / landed tables). Agents can read and write
     only their own run's schema.
   - **Git:** each run gets a bare repo holding the model files (5.2). Agents commit to branches;
     only the checker can move `main`.
5. **Checker (the gate)** — a deterministic program, **not** an agent and not writable by agents.
   An agent asks to land a part; the checker validates it and, only on pass, merges it to `main`
   and records it in the system `landed` table. Rules in 5.3.
6. **Monitors**
   - **Live:** sees every tool call (from the SDK hooks), blocks forbidden actions (network,
     shell escapes outside the sandbox, writes outside the run), records everything.
   - **Offline:** every 10 minutes a small model summarises progress, stalls and risks for the
     Live view.
7. **Result generator** — deterministic code that turns the landed model into a self-contained 3D
   page in the style of the hand-made Genesis page (three.js, embedded).

### 5.2 The Grid model (what agents write)

A versioned set of JSON documents in the run repo, each with a schema version:

- `grid.json` — Grid id, environment, rotation period, gravity source (generator law), counts.
- `structure/spine.json`, `structure/hub.json`, `structure/spokes/*.json`,
  `structure/wings/*.json` — geometry in metres in one station frame; materials; light.
- `parcels/<wing>-<nn>-d<deck>.json` — address `(wing, section, deck)`, volume, zone, today's state.
- `interiors/<parcel>.json` — a Nous chamber layout: corridor, chamber shell, consoles, displays,
  mind core, lights, all by catalog kind and placement.

**v1 catalog.** Interior parts are drawn from a small closed list (corridor arch, wall panel,
pilaster, honeycomb niche, console pod, seat, wall display, ceiling light ring, floor light ring,
dais, mind core). This mirrors Noēsis's rule that kinds are closed and forms are open.

### 5.3 Checker rules (v1)

- **Schema:** every document matches its schema; references resolve.
- **Counts match the Grid's pinned counts:** for Genesis, 1 core block, 4 commons, 24 work
  (8 business, 8 shopping, 8 manufacture), 24 homes, one zone per wing. The counts are constants
  in the Grid's versioned checker config (no live read from Noēsis); a planner updates them when
  the Grid's zone law changes.
- **Reference skeleton:** spine, hub, spokes, wings and parcel volumes match the Grid's reference
  model within a set tolerance (the crew may not move them in v1).
- **Geometry:** sizes within agreed bounds; no two solid parts overlap; every parcel lies inside
  its wing's shell; every wing hangs on spokes that reach the hub; spokes have docking collars at
  both ends; every parcel is reachable from an elevator.
- **Physics:** gravity source is `generator` (the declared Grid law) and spin-only gravity is
  computed and reported, not used; floors face away from the spine.
- **Interiors:** only catalog kinds; everything fits inside the parcel volume and the deck height;
  style rules (warm film style; no neon strips, glowing floor/door rings in Tron style, or
  line-grid floors; no film names, logos or stock-image text).
- The checker's report lists every rule and its result for each landed part.

### 5.4 Crew and models

- **Lead:** Claude Opus 5.5 (`claude-opus-5-5`) — plans, creates coordination tables, assigns.
- **Helpers:** Claude Sonnet 5.5 (`claude-sonnet-5-5`) — build parts and request landing.
- **Offline monitor:** Claude Haiku 5.5 (`claude-haiku-5-5`).
- **Prompts stay short** (as in the talk): the problem (the brief), the two primitives, the rule
  that only the checker lands work, and the budget. Team coordination is left to the lead.

### 5.5 Budget and safety

- Per-run caps: number of agents, wall-clock, input/output tokens and dollars (from usage
  reported by the API). The run manager stops the run at the first cap reached and marks it
  *stopped: budget*.
- A per-month ceiling across all runs.
- A kill switch in the Live view stops all sandboxes at once.
- The planner signs in to use the web app; nothing in it is reachable anonymously except
  published Result pages, if the planner chooses to publish one.

## 6. Settled facts the crew must build to (Genesis v0)

From the operator's decisions on 2026-11-27, encoded in the default Genesis brief and the checker:

- **Form:** a central spine (power plant with radiators at the rear; a long hub with the gravity
  generator in the middle; operations ring; Government Core at the front) and **six habitat wings**
  in two tiers of three, the second tier turned 60° so the wings interleave, held on spokes with
  enclosed elevator shafts. **One zone per wing:** A Homes I (12), B Business (8), C Shopping (8),
  D Homes II (12), E Manufacture (8), F Commons (4 pre-built venues) = the live Grid's 53 parcels
  (plus the core block). Our own design; no film ship is copied.
- **Gravity:** the station turns once every **60 minutes**; the wings' **1 g** comes from the
  gravity generator, a declared Grid law; down points away from the spine.
- **Sizes (operator: "size make by your"):** floors 224 m from the spine; wings 430 m × 40 m;
  3 decks of 4.5 m (Genesis opens deck 1); spokes ~190–192 m × 10 m with 16 m docking collars;
  home parcels 35.8 m × 40 m × 4.5 m, work parcels 53.8 m, commons halls 107.5 m; station about
  1.2 km long.
- **Parcel:** one wing section × one deck; address `(wing, section, level)`.
- **Outside look:** the wings carry a dense crust of city blocks with warm lit windows; small craft
  around the station.
- **A Nous house is a Nous's chamber, not a human home:** an entry corridor from the spoke
  elevator, a chamber with a console ring and screens, wall displays, and the Nous's mind core at
  the centre. **Interior style:** the warm style of the film *Passengers* (cream walls, arches of
  warm light, glossy black floors with soft white rings, ribbed gold-and-white light ceilings,
  gold pilasters, honeycomb lit niches, white and gold furniture). Style only. **No Tron-style
  neon inside.**

## 7. Left to the builder

- **Language (my call):** TypeScript on Node throughout (the desktop's Python is 3.9; Noēsis's
  Grid is TypeScript). Web framework and libraries are the builder's choice.
- Sandbox mechanics (Docker networks, seccomp, resource limits) as long as 5.1/5.5 hold.
- Git hosting inside the service (plain bare repos are enough).
- Exact JSON schemas and the geometry-overlap algorithm.
- How the Live view streams (polling or server-sent events).
- How the Result page reuses the hand-made Genesis page's renderer.

## 8. Calls made after the builder check (the planner may override)

- **Counts** are pinned constants per Grid version in the checker config, never read live from
  Noēsis (keeps the separation).
- **Interiors in v1:** each of the 24 home parcels gets its own chamber layout (the crew varies
  them within the catalog and style rules); work, commons and core interiors come later.
- **Sign-in:** the service's own planner accounts (password + session); runs and Grids carry an
  owner from day one so more planners can join later. No Noēsis identity reuse.
- **Result pages** are served by the new service. Publishing a result to noesiis.com/reports is a
  separate, manual step through the normal Noēsis pipeline; the service gets no write path into
  the Noēsis repo or deploy.
- **Runs build on the Grid's last landed version** by default; the brief can ask for a fresh start.
  Each Grid keeps one long-lived repo; each run works on its own branch and the checker merges.

## 9. Operator answers (2026-11-27)

1. **What the crew decides in v1: details only.** The skeleton (wings, sizes, parcels) is fixed in
   the brief and checked against a reference model with tolerance; the crew designs every home
   chamber interior and the outside detail (city blocks, lights, fittings).
2. **Budget and key:** $40 and 6 hours per run, 1 lead + 4 helpers; $300 per month across runs; a
   dedicated Anthropic API key for this service only, kept out of the repo.
3. **Host:** the operator's desktop first; extend to a server after the first build. Repository:
   a new repo for the service (proposed name ASKKPOP/noesis-grid-builder, private), created when
   building starts.

## 10. Setup prerequisites on the desktop

- Start Docker Desktop (installed; the daemon was not running on 2026-11-27).
- Create the dedicated Anthropic API key and store it in the macOS keychain or an untracked env file.
