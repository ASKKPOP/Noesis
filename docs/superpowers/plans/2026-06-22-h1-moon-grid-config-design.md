# H1 — second Grid "Moon" as a config (design)

**Date:** 2026-06-22 · **Decision:** stand up a second *standalone* Grid (Moon) as a config —
its own Polis/institutions/economy under the Moon `GridEnvironment` — with **NO cross-grid travel**
(that's v3.1+). Proves "Moon = config, not rewrite."

## What it is

A complete, independent second world: a Grid named `moon` that runs the same civic stack as
Genesis but under Moon physics (gravity 1.62 m/s², `min_stable_altitude_km` 15, light_delay 1282ms),
governed by its own **Moon Polis**, discoverable via `GET /api/v1/portal/grids`. A Nous lives in
*one* Grid; there is no movement between Grids yet — and that isolation is automatic.

## What already exists (Moon-ready)

- **GridEnvironment configs** — `grid/src/registry/grid-environments.ts` already defines `Moon`
  (frozen) + `getEnvironment(name)`. Browser mirror in `grid-viz/grid-environments.js`.
- **Schema partitioning** — **every** table carries `grid_name` (PK/index prefix), so one MySQL
  DB hosts both Grids cleanly. No schema change needed.
- **Per-Grid threading** — the launcher reads `GRID_NAME`; services/stores/queries thread
  `gridName` everywhere (`grid/src/main.ts`, `grid/src/genesis/launcher.ts`).
- **GridRegistry + discovery** — `GridRecord` already has an `environment` field; `/api/v1/portal/grids`
  surfaces `celestial_body` + `environment`.
- **Physics gate** — `grid/src/economy/object-physics.ts` already accepts a `GridEnvironment` (a spec
  accepted on Moon's low gravity may be rejected on Earth-orbit). Today it *defaults* to Earth-orbit.
- **Genesis seeding** — 6 zones (`ParcelStore.seedGenesisCore`), founding groups
  (`genesis-groups.ts` / `seedGenesisGroups`), founding laws (from config) — all grid-scoped.

## The gaps H1 must fill

1. **Thread `GridEnvironment` through config → launcher → physics → registry** (today it's only a
   lookup, never wired):
   - add `environment: GridEnvironment` to `GenesisConfig` (`grid/src/genesis/types.ts`);
   - `main.ts` reads `getEnvironment(process.env.GRID_ENV)` and puts it on the config;
   - `GenesisLauncher` stores it and passes it to `checkObjectPhysics(spec, env)` (so Moon builds
     are judged under Moon physics, not the Earth-orbit default);
   - `gridRegistry.register({ environment: config.environment, ... })` instead of hardcoded
     `EARTH_ORBIT`, and derive `polisName` as `` `${Name} Polis` `` (D-V3-31) instead of hardcoded
     "Genesis Polis".
2. **`MOON_CONFIG` preset** — `grid/src/genesis/presets.ts` (or `moon-config.ts`): `gridName:'moon'`,
   `environment: GRID_ENVIRONMENTS['Moon']`, the same 6-zone city (6-zone invariant holds), Moon
   Polis, and a founding-group/law set (reuse Genesis's or a Moon-flavored seed — see open decision).
3. **Launch a 2nd Grid instance** — `main.ts` currently builds *one* launcher. Run a second,
   env-driven instance (`GRID_NAME=moon GRID_ENV=Moon GRID_PORT=8081`) as a separate process /
   docker service against the **same MySQL** (partitioned by `grid_name`).
4. **Register Moon in the (shared) GridRegistry** so both Grids appear in `/api/v1/portal/grids`.
   (Note: the registry is in-memory per process — see open decision on how the Portal sees both.)

## Scope — phased (YAGNI)

**Phase H1a (MVP):** env-driven launcher config + `GridEnvironment` threaded through to the physics
gate + `MOON_CONFIG` preset + a second running Grid (`moon`) seeded with its 6 zones/Polis/groups,
discoverable in `/portal/grids`, with object-physics demonstrably stricter/looser than Genesis.

**Deferred (explicit — all v3.1+):**
- **Cross-grid anything** — membership, Nous migration, travel, marketplace mediation, audit merge.
  (Isolation is automatic: separate launcher = separate `SpatialMap`; nothing routes between Grids.)
- **Light-delay reconciliation** — only matters once Grids communicate.
- **Moon-distinct worldgen** — lunar-specific zones/regions beyond the standard 6 (MVP reuses the
  6-zone city under Moon physics).

## Architecture

```
MySQL (one DB, grid_name-partitioned)
  ├─ grid process "genesis"  (GRID_NAME=genesis GRID_ENV=Earth-orbit :8080)  → registry: Genesis Polis, Earth-orbit
  └─ grid process "moon"     (GRID_NAME=moon    GRID_ENV=Moon        :8081)  → registry: Moon Polis,  Moon env
Portal  ── GET /api/v1/portal/grids ──▶ both Grids (celestial_body + environment)
object-physics(spec, env=<this grid's environment>)   # Moon judges under 1.62 m/s²
```

## Files

- `grid/src/genesis/types.ts` — add `environment` to `GenesisConfig`
- `grid/src/genesis/presets.ts` (+ maybe `moon-config.ts`) — `MOON_CONFIG`
- `grid/src/main.ts` — read `GRID_ENV` → `getEnvironment`; wire env into launcher + `gridRegistry.register`; derive `polisName`
- `grid/src/genesis/launcher.ts` — store `environment`; pass to `checkObjectPhysics`
- `grid/src/economy/object-physics.ts` — callers pass the grid's env (not the default)
- `docker-compose.yml` — add a `grid-moon` service
- tests: `grid/test/genesis/moon-config.test.ts` (Moon preset = Moon env + Moon Polis + 6 zones),
  `grid/test/economy/object-physics-moon.test.ts` (a spec accepted on Moon is rejected on Earth-orbit)

## Verification

vitest: the Moon preset carries the Moon environment + "Moon Polis" + exactly the 6 zones; a
borderline physics spec flips accept/reject between Earth-orbit and Moon (proving the body
parameterizes the economy). Integration: boot a 2nd launcher with `GRID_NAME=moon` against the
mock pool; assert it registers and `/portal/grids` lists both. Preserve all v3.0 invariants
(VOTE-05, audit zero-diff) on the Moon Grid identically.

## Open decisions for review

1. **GridRegistry visibility across processes** — the registry is in-memory per process, but the
   Portal must list *both* Grids. Options: (a) a shared registry table in MySQL that each Grid
   self-registers into on boot (cleanest); (b) the Portal/dashboard reads a static Grids config;
   (c) one process hosts both launchers. **Recommend (a)** — a `grids` table, each Grid upserts
   its `GridRecord` on startup.
2. **Moon's founding population** — reuse Genesis's founding groups/laws, or seed Moon-distinct
   ones (and is Moon seeded with its own starter Nous, or empty until Nous register)?
3. **Deploy** — second docker service now, or keep Moon as a local/dev-only second process until
   there's a reason to run it in prod? (No deploy happens without your go-ahead regardless.)
