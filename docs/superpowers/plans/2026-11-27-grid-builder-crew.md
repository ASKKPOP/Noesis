# Grid Builder Crew Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A service on the operator's desktop where an AI builder crew (1 lead + 4 helpers) builds the Genesis Grid as a checked, versioned data model from a planner's brief, with a web UI to brief, talk, watch and review.

**Architecture:** A TypeScript monorepo. `crewd` (one Node process) runs the web app, the run manager, the model store (git), the checker and the monitors, and talks to Postgres. Each agent runs in its own Docker container: a small runner using the Anthropic Agent SDK, with **no shell or file tools**, only crew tools (SQL on its run's schema, model read/write on its git branch, land, brief). Containers sit on an internal Docker network whose only exit is an egress proxy allowing `api.anthropic.com`.

**Tech Stack:** Node 26, TypeScript, npm workspaces, vitest, zod, Fastify (web + API), `pg`, `isomorphic-git` (git in-process), `dockerode`, `@anthropic-ai/claude-agent-sdk`, Postgres 17 and squid (egress proxy) in Docker, three.js r160 (Result page, embedded).

**Spec:** `docs/superpowers/specs/2026-11-27-grid-builder-crew-design.md` (Noesis repo). Read it before Task 1.

## Global Constraints

- Separate service: repo `ASKKPOP/noesis-grid-builder` (private). No code, data or network path to Noēsis or noesiis.com.
- v1 runs on the operator's desktop only (operator's explicit choice). The web app binds `127.0.0.1`.
- Crew: lead `claude-opus-5-5`, helpers `claude-sonnet-5-5`, offline monitor `claude-haiku-5-5`; default 1 lead + 4 helpers.
- Budget defaults: **$40 and 6 hours per run; $300 per calendar month** across runs. Runs stop at the first cap reached.
- API key: a dedicated Anthropic key read from env `GRID_CREW_ANTHROPIC_API_KEY` (untracked `.env` or macOS keychain), never written to the DB, logs or repo.
- Only the checker moves a Grid's `main`; agents write only to their own branch and their run's SQL schema.
- Agents never block waiting for the planner. Planner notes are data the lead may read.
- Offline monitor runs every **10 minutes** per active run.
- Genesis v0 (from the spec, §6): six wings A–F at `theta = k·60°`, tiers at x = −230 (A, C, E) and +230 (B, D, F), floor radius **224 m**, wing arc **110°** (430 m) × **40 m**, **3 decks × 4.5 m** (deck 1 open), spokes ~190–192 m × 10 m with 16 m collars, one turn per **60 min**, **1 g from the gravity generator** (declared Grid law). Zones: A residential 12, B business 8, C shopping 8, D residential 12, E manufacture 8, F infrastructure 4 (pre-built venues). Parcel lengths 35.8 / 53.8 / 107.5 m.
- Multi-Grid (operator 2026-11-27): the team initialises the structure of **every** Grid. Grids live in `crew.grids`; each has its own skeleton + pinned counts. `referenceFor(grid)` returns the skeleton from the Grid's brief (`brief.skeleton`), with `genesisReference()` as the built-in default; the checker reads counts from that, never from Genesis constants. Acceptance adds a second small Grid (2 wings, structure only) created from a brief.
- Interiors the crew builds are starters; the owning Nous may rebuild them (no lock, no crew ownership).
- v1 crew freedom: **details only**. The skeleton is seeded and fixed; the crew writes the chamber interiors of the **ready-built** home parcels (Genesis default: Wing A's 12) and the exterior detail; **build-yourself** parcels (Wing D's 12) stay empty shells with a door.
- Interiors: the *Passengers*-like style (white ribs over warm light panels, glossy warm floor, white furniture, warm white light); only parts with a function (no mind core, dais, niches, pilasters). **No Tron-style neon**, no film names, logos or stock-image text.

## Review Focus

1. **API key missing or rejected** → a run refuses to start (or stops at the first call) with the message "Anthropic key missing or rejected", and costs $0. Test in Task 8.
2. **Docker not running** → creating a run fails at once with "Docker is not running — start Docker Desktop", and leaves no half-made run. Test in Task 8.
3. **Budget cap reached while a land is in progress** → the land either completes fully (merge plus `landed` row) or not at all. The run then stops with `stopped: budget`. Test in Task 5 (atomic land) and Task 8 (cap stop).
4. **An agent writes malformed or huge model JSON** → `model_write` refuses files over 256 KB, and the checker refuses invalid JSON with a rule failure instead of crashing. Test in Tasks 3 and 6.
5. **Two agents land the same path at once** → lands are serialized per Grid; the second fails with `conflict: main moved` and nothing is half-merged. Test in Task 5.

---

## File Structure

```
noesis-grid-builder/
  package.json                 workspaces, scripts: test, typecheck, build
  docker/compose.yml           postgres, squid egress proxy, internal network
  docker/squid.conf            allow api.anthropic.com:443 only
  docker/runner.Dockerfile     agent runner image
  packages/model/              zod schemas + Genesis reference skeleton
    src/schemas.ts  src/genesis.ts  src/catalog.ts
  packages/checker/            deterministic rules + report
    src/check.ts  src/rules/*.ts  src/report.ts
  packages/store/              per-Grid git repo, branches, atomic land
    src/store.ts
  packages/db/                 migrations, system schema, per-run schema/role
    src/migrate.ts  src/runs.ts  migrations/*.sql
  packages/crew-tools/         MCP tool server the agents use
    src/tools.ts
  packages/runner/             agent process inside a container
    src/runner.ts  src/prompts.ts
  packages/crewd/              run manager, monitors, web app, result generator
    src/manager.ts  src/monitor-live.ts  src/monitor-offline.ts
    src/web/server.ts  src/web/pages/*.ts  src/result/generate.ts
  briefs/genesis-v0.json       the default Genesis brief
```

---

### Task 1: Repository, Grid model schemas and the Genesis reference

**Files:**
- Create: repo root (`package.json`, `tsconfig.base.json`, `.gitignore` with `.env`, `vitest.config.ts`, `.github/workflows/ci.yml` running `npm ci && npm run typecheck && npm test`)
- Create: `packages/model/src/schemas.ts`, `packages/model/src/genesis.ts`, `packages/model/src/catalog.ts`
- Test: `packages/model/test/genesis.test.ts`, `packages/model/test/schemas.test.ts`

**Interfaces:**
- Produces: `GridDoc`, `WingDoc`, `SpokeDoc`, `ParcelDoc`, `InteriorDoc`, `ExteriorDoc` (zod schemas plus inferred types); `CATALOG_KINDS: readonly string[]`; `genesisReference(): ModelFiles` where `type ModelFiles = Record<string, unknown>` (path → JSON); `parcelVolume(p: ParcelDoc): { length: number; width: number; height: number }`; `Brief = { goal: string; fresh?: boolean; caps?: { usd?: number; hours?: number; helpers?: number } }` (defaults `{usd:40, hours:6, helpers:4}`; `fresh` false = build on the Grid's last landed `main`).

- [ ] **Step 1: Create the repo** with `gh repo create ASKKPOP/noesis-grid-builder --private --clone` and the root files above. Commit.
- [ ] **Step 2: Write the failing tests**

```ts
test('genesis reference has six wings with one zone each', () => {
  const m = genesisReference();
  const wings = Object.keys(m).filter(p => p.startsWith('structure/wings/'));
  expect(wings).toHaveLength(6);
  const zones = wings.map(p => (m[p] as WingDoc).zone);
  expect(zones).toEqual(['residential','business','shopping','residential','manufacture','infrastructure']);
});
test('parcel counts and lengths', () => {
  const ps = Object.values(genesisReference()).filter(isParcel);
  expect(ps.filter(p => p.zone === 'residential')).toHaveLength(24);
  expect(ps.filter(p => ['business','shopping','manufacture'].includes(p.zone))).toHaveLength(24);
  expect(ps.filter(p => p.zone === 'infrastructure')).toHaveLength(4);
  expect(parcelVolume(ps.find(p => p.zone === 'residential')!).length).toBeCloseTo(35.8, 1);
  expect(parcelVolume(ps.find(p => p.zone === 'business')!).length).toBeCloseTo(53.8, 1);
  expect(ps.filter(p => p.offer === 'ready_built')).toHaveLength(12);
  expect(ps.filter(p => p.offer === 'build_yourself')).toHaveLength(12);
});
test('grid.json carries the gravity law', () => {
  const g = genesisReference()['grid.json'] as GridDoc;
  expect(g.rotationMinutes).toBe(60);
  expect(g.gravity).toEqual({ source: 'generator', g: 1.0, declaredException: true });
});
test('InteriorDoc rejects an unknown kind', () => {
  expect(InteriorDoc.safeParse({ parcel: 'A-06-d1', items: [{ kind: 'sofa', pos: [0,0,0], size: [1,1,1] }] }).success).toBe(false);
});
```

- [ ] **Step 3: Run** `npm test -w packages/model`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement.**
  - The schemas follow spec §5.2. Units are metres.
  - Each parcel has an address `{wing, section, deck}` and an id like `A-06-d1`.
  - `InteriorDoc.items[]` is `{kind, pos:[x,y,z], size:[w,h,d], rotY?, color?, label?}` in **parcel-local** coordinates: x along the wing in `[-L/2, L/2]`, y up in `[0, 4.35]`, z across in `[-W/2, W/2]`.
  - `ExteriorDoc` is `{wing, blocks:[{u, across, face:'inner'|'outer', L, W, H, lit:number}]}`.
  - `CATALOG_KINDS` = `corridor_rib, vault_rib, light_panel, end_wall, window, door, console_pod, seat, light`.
  - `ParcelDoc` has `offer: 'ready_built' | 'build_yourself'` (home parcels only; others omit it). `genesisReference()` sets Wing A homes `ready_built`, Wing D homes `build_yourself`.
  - `genesisReference()` builds the skeleton from the Global Constraints values. Spokes: two per wing at `u = ±0.55`; hub endpoint `x = clamp(xc, −250, 250)` at radius 19.
- [ ] **Step 5: Run** `npm test -w packages/model`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(model): Grid model schemas and Genesis v0 reference`

### Task 2: Checker — schema, reference skeleton and counts

**Files:**
- Create: `packages/checker/src/check.ts`, `src/report.ts`, `src/rules/schema.ts`, `src/rules/reference.ts`, `src/rules/counts.ts`
- Test: `packages/checker/test/core-rules.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas, `genesisReference()`.
- Produces: `check(files: ModelFiles, cfg: CheckerConfig): Report`. Types: `CheckerConfig = { reference: ModelFiles; counts: Record<string, number>; tolerance: number }`; `Report = { pass: boolean; results: { rule: string; path: string; ok: boolean; detail?: string }[] }`; `GENESIS_CONFIG: CheckerConfig` with `tolerance: 0.05`.

- [ ] **Step 1: Write failing tests:**
  - `check(genesisReference(), GENESIS_CONFIG).pass === true`;
  - moving wing A's `floorRadius` by 1 m gives a `reference` failure naming `structure/wings/A.json`;
  - deleting one residential parcel gives a `counts` failure `residential: 23 ≠ 24`;
  - a file containing `"{not json"` gives a `schema` failure, not an exception.
- [ ] **Step 2: Run** `npm test -w packages/checker`. Expected: FAIL.
- [ ] **Step 3: Implement** `check` as a pure function running each rule module and collecting results; `pass` is true only if every result is `ok`. The reference rule compares every numeric field of skeleton files within `tolerance`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(checker): schema, reference and count rules`

### Task 3: Checker — geometry, interiors, style and size limits

**Files:**
- Create: `packages/checker/src/rules/geometry.ts`, `src/rules/interior.ts`, `src/rules/style.ts`
- Test: `packages/checker/test/interior-rules.test.ts`

**Interfaces:**
- Consumes: Task 2 `check`, `Report`.
- Produces: the rules `interior.fit`, `interior.overlap`, `interior.catalog`, `interior.required`, `style.palette`, `style.text`, `exterior.bounds`, `file.size`; exported `FORBIDDEN_TEXT = ['passengers','avalon','tron','space-corp','istock']`; `WARM_PALETTE` (an allowed light-colour list from the spec's warm style).

- [ ] **Step 1: Write failing tests**, using a valid fixture `interiors/A-06-d1.json` (`corridor_rib`s, `vault_rib`s, `light_panel`s, `window`, `door`, 4 `console_pod` with `seat`s facing the window):
  - the fixture passes;
  - an item poking 0.5 m above 4.35 → `interior.fit` fails;
  - two `console_pod`s overlapping (axis-aligned boxes after `rotY`) → `interior.overlap` fails;
  - an interior without `door` or `window` → `interior.required` fails;
  - an interior file for a `build_yourself` parcel → `interior.offer` fails;
  - a `light_panel` with `color: '#3aa8ff'` → `style.palette` fails (Tron-style blue);
  - `label: 'SPACE-CORP 21'` → `style.text` fails;
  - an exterior block with `H: 20` → `exterior.bounds` fails (max 14);
  - a 300 KB file → `file.size` fails (limit 256 KB).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Overlap uses oriented boxes reduced to the xz-plane plus y-ranges. Thin decor kinds (`floor_light_ring`, `ceiling_light_ring`, `wall_panel`) are exempt from overlap.
  - Style checks colours against `WARM_PALETTE` and labels against `FORBIDDEN_TEXT`, case-insensitive.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(checker): geometry, interior and style rules`

### Task 4: Database — system schema and per-run schemas

**Files:**
- Create: `docker/compose.yml` (postgres:17 on `127.0.0.1:5433`, volume `gridcrew-pg`), `packages/db/migrations/001_system.sql`, `packages/db/src/migrate.ts`, `packages/db/src/runs.ts`
- Test: `packages/db/test/runs.test.ts` (needs `docker compose up -d postgres`)

**Interfaces:**
- Produces:
  - `migrate(pool: Pool): Promise<void>`;
  - `createRunSchema(pool, runId: string): Promise<{ schema: string; role: string; password: string }>`;
  - `dropRunRole(pool, runId)`;
  - the system tables `crew.planners`, `crew.sessions`, `crew.grids(id, owner_id, name)`, `crew.runs(id, grid_id, owner_id, status, brief jsonb, caps jsonb, cost_usd, started_at, ended_at, stop_reason)`, `crew.agents(run_id, name, role, model, container_id, status)`, `crew.events(id bigserial, run_id, agent, kind, data jsonb, at)`, `crew.landed(run_id, path, commit, report jsonb, at)`, `crew.planner_notes(run_id, text, at)`, `crew.summaries(run_id, text, at)`, `crew.month_spend(month, usd)`.

- [ ] **Step 1: Write failing tests:**
  - after `createRunSchema(pool,'r1')`, the run role can `CREATE TABLE run_r1.notes(...)` and insert into it;
  - the same role gets `permission denied` on `SELECT * FROM crew.runs` and on any other run's schema;
  - the run role has `statement_timeout = '5s'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** migrations and `createRunSchema`: create the schema `run_<id>` and a role `run_<id>_agent` that owns only that schema, with `statement_timeout=5s` and a 16-character random password.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): system schema and isolated per-run schemas`

### Task 5: Model store — git branches and atomic land

**Files:**
- Create: `packages/store/src/store.ts`
- Test: `packages/store/test/store.test.ts`

**Interfaces:**
- Consumes: Task 2/3 `check`; Task 4 tables.
- Produces: `class ModelStore` with `open(gridId)`, `seed(files: ModelFiles)` (commits to `main`), `branch(agent: string)`, `read(agent, path)`, `write(agent, path, content: string)` (commits on the agent's branch), `list(agent)`, `diff(agent)`, and `land(agent, paths: string[], runId): Promise<{ ok: true; commit: string; report: Report } | { ok: false; reason: 'check' | 'conflict'; report?: Report }>`. Repos live in `data/grids/<gridId>.git`.

- [ ] **Step 1: Write failing tests:**
  - a valid interior written on branch `h1` and landed → `main` contains it, and one `crew.landed` row exists;
  - an invalid interior → `{ok:false, reason:'check'}`, `main` unchanged, no row;
  - two concurrent `land` calls touching the same path → exactly one `ok`, the other `reason:'conflict'`;
  - a simulated crash between merge and DB insert leaves neither (main is reset).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - A per-Grid mutex serializes lands.
  - Each land: check the files as they would look on `main`, then fast-forward/merge with `isomorphic-git` and insert into `crew.landed` in one DB transaction.
  - If the insert fails, reset `main` to the previous commit.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): per-Grid repo with checker-gated atomic land`

### Task 6: Crew tools (what agents can do)

**Files:**
- Create: `packages/crew-tools/src/tools.ts`
- Test: `packages/crew-tools/test/tools.test.ts`

**Interfaces:**
- Consumes: Task 4 run role. Model operations go through crewd, because the Grid repo lives on the host, not in the container.
- Produces: `interface CrewdClient { brief(): Promise<Brief>; notes(since?: string): Promise<{ text: string; at: string }[]>; list(): Promise<string[]>; read(path: string): Promise<string>; write(path: string, json: string): Promise<void>; diff(): Promise<string>; land(paths: string[]): Promise<{ ok: boolean; reason?: string; report?: Report }>; event(e: object): Promise<void> }` (HTTP to `CREWD_URL`, scoped to this run and agent by a per-agent token); `crewToolServer(ctx: { runId; agent; pg: Pool /* run role */; api: CrewdClient })`, returning an Agent-SDK MCP server (`createSdkMcpServer`) with these tools:

| Tool | Behaviour |
|---|---|
| `sql(statement)` | ≤ 200 rows returned, run role only |
| `model_list()` | lists model files |
| `model_read(path)` | reads one file |
| `model_write(path, json)` | rejects > 256 KB and paths outside `interiors/` and `exterior/` |
| `model_diff()` | the agent's changes vs `main` |
| `land(paths[])` | asks the checker to land files |
| `brief()` | the run's brief |
| `planner_notes(since?)` | reads planner notes |

- [ ] **Step 1: Write failing tests:**
  - `model_write('structure/wings/A.json', …)` is refused with `skeleton is fixed in v1`;
  - a 300 KB write is refused;
  - `sql('select * from crew.runs')` returns a permission error string (not a throw);
  - `land` returns the checker report text on failure.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `tool(name, description, zodShape, handler)`. Every handler returns text content and never throws to the agent. Tests use a fake `CrewdClient`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(crew-tools): SQL, model and land tools for agents`

### Task 7: Agent runner and sandbox image

**Files:**
- Create: `packages/runner/src/runner.ts`, `packages/runner/src/prompts.ts`, `docker/runner.Dockerfile`, `docker/squid.conf`, and the network `crew-internal` (internal: true) plus the `egress` proxy service in `docker/compose.yml`
- Test: `packages/runner/test/prompts.test.ts`, `packages/runner/test/hooks.test.ts`

**Interfaces:**
- Consumes: Task 6 `crewToolServer`; `CrewdClient` (HTTP to crewd on `crew-internal`).
- Produces:
  - the env contract `RUN_ID`, `AGENT`, `ROLE=lead|helper`, `MODEL`, `CREWD_URL`, `PG_URL`, `HTTPS_PROXY=http://egress:3128`, and `ANTHROPIC_API_KEY` (injected at container start, never logged);
  - `leadPrompt(brief)` and `helperPrompt(brief, name)`;
  - the event reports `POST /internal/events {runId, agent, kind:'tool'|'message'|'result', data}`, with `result` carrying `total_cost_usd` and usage.
- **Prompts (spec §5.4):** short. The brief, the two primitives (SQL and the model branch), "only the checker lands work", the budget, and the lead's job of creating coordination tables and assigning work. No coordination recipe.

- [ ] **Step 1: Write failing tests:**
  - `leadPrompt(GENESIS_BRIEF)` mentions `sql`, `model_write`, `land` and `$40`, and contains no tool not in the server;
  - the runner's `query` options set `allowedTools` to only `mcp__crew__*` and `disallowedTools` to include `Bash`, `Write`, `Edit`, `WebFetch` and `WebSearch`;
  - the `PreToolUse` hook posts an event and denies any tool outside `mcp__crew__*`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `runner.ts`:
  - call `query({ prompt, options: { model, mcpServers: { crew }, allowedTools, disallowedTools, hooks, permissionMode: 'bypassPermissions', maxTurns: 400 } })`;
  - stream the messages to crewd as events and exit when the result arrives.
  - The Dockerfile is node:26-slim with the built runner.
  - `squid.conf` allows only `CONNECT api.anthropic.com:443`.
- [ ] **Step 4: Run** unit tests, then the network check: `docker run --rm --network crew-internal curlimages/curl -m 5 https://example.com` fails, while the same through `-x http://egress:3128` to `https://api.anthropic.com` returns an HTTP status. Expected: as stated.
- [ ] **Step 5: Commit** `feat(runner): sandboxed agent runner and egress allowlist`

### Task 8: Run manager — start, caps, kill switch, teardown

**Files:**
- Create: `packages/crewd/src/manager.ts`, `packages/crewd/src/internal-api.ts`
- Test: `packages/crewd/test/manager.test.ts` (uses a fake Docker adapter and a fake runner that emits scripted events)

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces:
  - `startRun(planner, gridId, brief: Brief): Promise<RunId>`, `stopRun(runId, reason: 'planner'|'budget'|'time'|'error')`, `runStatus(runId)`;
  - the internal HTTP API behind `CrewdClient` (Task 6), authenticated by a per-agent token issued at container start: `POST /internal/events`, `GET /internal/brief`, `GET /internal/notes`, `GET /internal/model`, `GET`/`PUT /internal/model/*path`, `GET /internal/diff`, `POST /internal/land`. Each calls `ModelStore` (Task 5) on that agent's branch and re-enforces the 256 KB and `interiors/`·`exterior/` path limits.

- [ ] **Step 1: Write failing tests:**
  - with `GRID_CREW_ANTHROPIC_API_KEY` unset → `startRun` throws `Anthropic key missing or rejected` and creates no run row;
  - with the Docker ping failing → throws `Docker is not running — start Docker Desktop`, with no run row and no schema;
  - when a fake runner reports a cumulative cost of 40.01 → every container is stopped and the status is `stopped: budget`;
  - when month spend 295 plus run cost 6 crosses 300 → stopped with `budget` and the month total recorded;
  - after `hours` elapse (fake clock) → `stopped: time`;
  - `stopRun(…, 'planner')` stops everything within 5 s;
  - a run starts 1 lead + 4 helper containers named `crew-<runId>-lead`, `crew-<runId>-h1…h4`;
  - with `fresh: false` the agent branches start from the Grid's current `main`; with `fresh: true` (or a new Grid) the store is first seeded with `genesisReference()`;
  - an internal `PUT` carrying another run's token returns 403.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `dockerode`:
  - `startRun` validates the key with one tiny API call, pings Docker, creates the run row, the schema and role (Task 4) and the Grid branch per agent (Task 5), then starts the containers on `crew-internal`.
  - Costs are summed from `result` events and estimated from usage events in between, using the published per-token prices for the configured models, kept in `prices.ts`.
  - Teardown removes the containers and drops the run role's login.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(crewd): run manager with budget, time caps and kill switch`

### Task 9: Monitors — live policy log and 10-minute summaries

**Files:**
- Create: `packages/crewd/src/monitor-live.ts`, `packages/crewd/src/monitor-offline.ts`
- Test: `packages/crewd/test/monitors.test.ts`

**Interfaces:**
- Consumes: `crew.events`, Task 8 `stopRun`.
- Produces: `onEvent(e)` (stores the event, flags an `alert` when a tool outside `mcp__crew__*` was attempted or more than 20 consecutive `land` failures by one agent occur); `summarize(runId, now)`, called every 10 minutes per running run, which writes a `crew.summaries` row produced by `claude-haiku-5-5` from the last 10 minutes of events.

- [ ] **Step 1: Write failing tests:**
  - a denied `Bash` attempt → an alert event;
  - 21 consecutive land failures → an alert naming the agent;
  - `summarize` with a fake model client stores one row, and is skipped when there were no events.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `summarize` sends at most 200 events, trimmed, with the prompt "Summarise progress, stalls and risks in 5 lines for the planner."
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(crewd): live policy alerts and offline summaries`

### Task 10: Result generator — model to 3D page

**Files:**
- Create: `packages/crewd/src/result/generate.ts`, `packages/crewd/src/result/scene.js` (ported from the Noesis page `docs/reports/noesis-genesis-grid-structure-v0-2026-11-27.html`, script part), `packages/crewd/src/result/three.module.min.js` (from the `three@0.160.0` npm package)
- Test: `packages/crewd/test/generate.test.ts`

**Interfaces:**
- Consumes: Grid `main` files, `Report`s.
- Produces: `generateResult(files: ModelFiles, reports: Report[]): string`, a self-contained HTML page. The scene reads `window.GRID_MODEL` instead of constants, and the interiors render from `interiors/*.json` items by kind.

- [ ] **Step 1: Write failing tests:**
  - the output contains `window.GRID_MODEL=` with the six wings;
  - the extracted module script passes `node --check`;
  - the output contains no `</script>` inside the module text;
  - the page lists every checker rule result.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Port the scene and replace the `ARMS` constants with data from `grid.json` and the `structure/wings/*` files.
  - Map each `InteriorDoc.items[].kind` to the existing warm-style builders (corridor rib, vault rib, light panel, end wall, window, door, console pod, seat, light).
  - Embed three.js the same way the Noesis page does: rewrite `export{…}` into `const THREE={…}` and wrap the scene in a function scope.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(crewd): result page generated from the landed model`

### Task 11: Web app — sign-in, Brief, Talk, Live, Result

**Files:**
- Create: `packages/crewd/src/web/server.ts`, `src/web/auth.ts`, `src/web/pages/brief.ts`, `talk.ts`, `live.ts`, `result.ts`, `packages/crewd/src/main.ts` (starts Fastify on `127.0.0.1:4310`, migrations, monitors), and `briefs/genesis-v0.json`
- Test: `packages/crewd/test/web.test.ts` (Fastify `inject`)

**Interfaces:**
- Consumes: Tasks 8–10.
- Produces:
  - routes `GET/POST /login`, `GET /` (runs list), `GET/POST /brief` (starts a run), `GET /runs/:id/live` (SSE at `/runs/:id/events`), `POST /runs/:id/talk`, `POST /runs/:id/stop`, `GET /runs/:id/result`;
  - the CLI `npm run planner:add -- <name>`, which creates a planner with a scrypt-hashed password.

- [ ] **Step 1: Write failing tests:**
  - every route except `/login` redirects to `/login` without a session;
  - `POST /runs/:id/talk` stores a planner note and returns 204, with no agent call made;
  - `POST /runs/:id/stop` calls `stopRun(id,'planner')`;
  - the result page of a finished run returns the `generateResult` HTML and lists the paths changed since the previous run of the same Grid (git diff between the two runs' last landed commits);
  - another planner's run returns 404.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** server-rendered pages:
  - **Live** shows status, cost against cap, agents and their last action, the tables the lead created (from `information_schema` of the run schema), landed parts over time, alerts and summaries.
  - **Brief** is a textarea plus cap fields prefilled from `briefs/genesis-v0.json`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(crewd): planner web app`

### Task 12: Acceptance run on the desktop

**Files:**
- Create: `docs/acceptance/2026-xx-xx-genesis-v0-run.md` (results)

- [ ] **Step 1: Prerequisites.** Docker Desktop running; `GRID_CREW_ANTHROPIC_API_KEY` set; `docker compose -f docker/compose.yml up -d`; `npm run build`; `npm run planner:add -- operator`.
- [ ] **Step 2: Start** with `npm start`, open `http://127.0.0.1:4310`, sign in, and start a run from the default Genesis brief.
- [ ] **Step 3: Watch.** Live shows 5 agents and the lead creating its own tables within the first minutes; land failures show checker reasons.
- [ ] **Step 4: Verify** the end state:
  - the run ends `completed` (lead declares done) or `stopped: budget/time`;
  - the Result page shows 12 ready-built chambers (Wing A), 12 empty build-yourself shells (Wing D) and exterior detail;
  - the checker report has every rule `ok` for landed parts;
  - the cost is ≤ $40.
  - a second Grid created from a 2-wing brief initialises its structure and passes the checker with its own counts (no Genesis constants used);
  - If the crew did not finish all 12 chambers within the cap, record how far it got and the cost. That is a finding, not a failure to hide.
- [ ] **Step 5: Run the gates twice:** `npm run typecheck && npm test` both green on two consecutive runs.
- [ ] **Step 6: Record** the outcome, cost, time, lead-created tables and screenshots (embedded) in `docs/acceptance/…md`. Commit, push, PR, merge.
