# F0b — Grid-Side GridEnvironment (record + discovery feed) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Grid server an authoritative `GridEnvironment` (the same body/gravity/solar/light-delay/orbital-floor data F0 added browser-side), attach it to every `GridRecord`, seed Genesis as `Earth-orbit`, and surface it in the Portal discovery feed — so server-side services (F1/L1/L3) and the Portal read one source of truth for *where a Grid is*.

**Architecture:** `GridRegistry` is **in-memory** (no DB), so F0b needs no migration. Add a TS module `grid/src/registry/grid-environments.ts` (server-side mirror of `dashboard/public/grid-viz/grid-environments.js`; different runtimes, values kept in sync), make `environment` a **required** field on `GridRecord`, seed Genesis with `EARTH_ORBIT` in `main.ts`, and include it in `GET /api/v1/portal/grids`. This is unit **F0b** of the Economic Reality Loop program (`docs/superpowers/specs/2026-06-21-noesis-economic-reality-loop-design.md`). Next unit after this is **F1** (money rails).

**Tech Stack:** TypeScript (ESM, NodeNext — imports use `.js` extensions), Fastify, Vitest. Run tests with `npx vitest run <targets>` from `grid/` (per project rule: `vitest run` only — never watch, one process at a time, kill any running vitest first).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/registry/grid-environments.ts` | `GridEnvironment` type + `GRID_ENVIRONMENTS` (Earth-orbit/Moon/Mars, frozen) + `EARTH_ORBIT` + `getEnvironment`. Server-side source of truth. | **Create** |
| `grid/test/registry/grid-environments.test.ts` | Unit tests for the env data + lookup + frozen invariant. | **Create** |
| `grid/src/registry/grid-registry.ts` | Add required `environment: GridEnvironment` to `GridRecord`. | **Modify** (`:11-23`) |
| `grid/src/main.ts` | Seed Genesis `GridRecord` with `environment: EARTH_ORBIT`. | **Modify** (`:311-318`) |
| `grid/src/api/portal/grids.ts` | Include `celestial_body` + `environment` in the response. | **Modify** (`:31-38`) |
| `grid/test/portal/grids.test.ts` | Update fixtures to carry `environment`; assert env appears in the feed. | **Modify** |

---

## Task 1: Grid-side GridEnvironment module

**Files:**
- Create: `grid/src/registry/grid-environments.ts`
- Test: `grid/test/registry/grid-environments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `grid/test/registry/grid-environments.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment } from '../../src/registry/grid-environments.js';

describe('GridEnvironment (grid-side)', () => {
    it('Genesis default is Earth-orbit with the expected params', () => {
        expect(EARTH_ORBIT.name).toBe('Earth-orbit');
        expect(EARTH_ORBIT).toBe(GRID_ENVIRONMENTS['Earth-orbit']);
        expect(EARTH_ORBIT.gravity_ms2).toBe(9.81);
        expect(EARTH_ORBIT.solar_constant_wm2).toBe(1361);
        expect(EARTH_ORBIT.orbital_ref_radius_km).toBe(6371);
        expect(EARTH_ORBIT.light_delay_ms).toBe(0);
        expect(EARTH_ORBIT.min_stable_altitude_km).toBe(160);
    });

    it('Moon and Mars are configs with distinct gravity and orbital floors', () => {
        expect(GRID_ENVIRONMENTS['Moon'].gravity_ms2).toBe(1.62);
        expect(GRID_ENVIRONMENTS['Moon'].min_stable_altitude_km).toBe(15);
        expect(GRID_ENVIRONMENTS['Mars'].gravity_ms2).toBe(3.71);
        expect(GRID_ENVIRONMENTS['Mars'].solar_constant_wm2).toBe(586);
        expect(GRID_ENVIRONMENTS['Mars'].light_delay_ms).toBeGreaterThan(0);
    });

    it('getEnvironment returns the named env, or Earth-orbit for unknown/undefined', () => {
        expect(getEnvironment('Moon').name).toBe('Moon');
        expect(getEnvironment('Nowhere')).toBe(EARTH_ORBIT);
        expect(getEnvironment(undefined)).toBe(EARTH_ORBIT);
    });

    it('environments are frozen (cannot be mutated by a consumer)', () => {
        expect(Object.isFrozen(EARTH_ORBIT)).toBe(true);
        expect(() => { (EARTH_ORBIT as unknown as { gravity_ms2: number }).gravity_ms2 = 0; }).toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `grid/`): `npx vitest run test/registry/grid-environments.test.ts`
Expected: FAIL — cannot resolve `../../src/registry/grid-environments.js`.

- [ ] **Step 3: Write the module**

Create `grid/src/registry/grid-environments.ts`:

```ts
/**
 * GridEnvironment (grid-side) — where a Grid physically is.
 *
 * The authoritative server-side copy of the celestial-environment data. Mirrors
 * the browser module `dashboard/public/grid-viz/grid-environments.js` (a different
 * runtime with no shared module system); the values MUST stay in sync. Genesis
 * ships as Earth-orbit; Moon and Mars are configs here, not rewrites.
 *
 * Fields (SI unless noted):
 *   name                   config key / human label
 *   gravity_ms2            surface gravity
 *   solar_constant_wm2     mean solar irradiance at the body's distance
 *   orbital_ref_radius_km  radius of the reference body (altitude measured above its surface)
 *   light_delay_ms         one-way signal delay to Earth (cross-grid state is eventually-consistent)
 *   min_stable_altitude_km lowest altitude that can hold an orbit (atmospheric-decay / terrain floor)
 */
export interface GridEnvironment {
    readonly name: string;
    readonly gravity_ms2: number;
    readonly solar_constant_wm2: number;
    readonly orbital_ref_radius_km: number;
    readonly light_delay_ms: number;
    readonly min_stable_altitude_km: number;
}

export const GRID_ENVIRONMENTS: Readonly<Record<string, GridEnvironment>> = Object.freeze({
    'Earth-orbit': Object.freeze({
        name: 'Earth-orbit', gravity_ms2: 9.81, solar_constant_wm2: 1361,
        orbital_ref_radius_km: 6371, light_delay_ms: 0, min_stable_altitude_km: 160,
    }),
    'Moon': Object.freeze({
        name: 'Moon', gravity_ms2: 1.62, solar_constant_wm2: 1361,
        orbital_ref_radius_km: 1737, light_delay_ms: 1282, min_stable_altitude_km: 15,
    }),
    'Mars': Object.freeze({
        name: 'Mars', gravity_ms2: 3.71, solar_constant_wm2: 586,
        orbital_ref_radius_km: 3390, light_delay_ms: 180000, min_stable_altitude_km: 100,
    }),
});

/** Genesis Grid ships in Earth-orbit. */
export const EARTH_ORBIT: GridEnvironment = GRID_ENVIRONMENTS['Earth-orbit'];

/** Resolve an environment by name; unknown / missing names fall back to Genesis. */
export function getEnvironment(name: string | undefined): GridEnvironment {
    return (name !== undefined && GRID_ENVIRONMENTS[name]) || EARTH_ORBIT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `grid/`): `npx vitest run test/registry/grid-environments.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add grid/src/registry/grid-environments.ts grid/test/registry/grid-environments.test.ts
git commit -m "feat(grid): F0b grid-side GridEnvironment module (Earth-orbit/Moon/Mars)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Attach environment to GridRecord, seed Genesis, surface in the discovery feed

**Files:**
- Modify: `grid/src/registry/grid-registry.ts`, `grid/src/main.ts`, `grid/src/api/portal/grids.ts`
- Test: `grid/test/portal/grids.test.ts`

`environment` becomes a **required** field on `GridRecord`, so every `GridRegistry.register(...)` call site must supply it. The only call sites are `main.ts:311` and the fixtures in `grid/test/portal/grids.test.ts` (confirm with `grep -rn "\.register({" grid/src grid/test | grep -i grid`).

- [ ] **Step 1: Update the route test fixtures + add the env assertion (failing test)**

In `grid/test/portal/grids.test.ts`:

(a) add the import after the existing `GridRegistry` import (line 7):
```ts
import { EARTH_ORBIT, GRID_ENVIRONMENTS } from '../../src/registry/grid-environments.js';
```

(b) replace the `genesisRegistry()` helper (lines 14-21) with:
```ts
function genesisRegistry(): GridRegistry {
    const r = new GridRegistry();
    r.register({
        gridId: 'genesis', name: 'Genesis', gridDomain: 'genesis.noesis',
        polisName: 'Genesis Polis', description: 'The first Grid.', status: 'active',
        environment: EARTH_ORBIT,
    });
    return r;
}
```

(c) in the "excludes non-active grids" test, add `environment` to the `commerce` record (line 33):
```ts
        r.register({ gridId: 'commerce', name: 'Commerce', gridDomain: 'commerce.noesis', polisName: 'Commerce Polis', description: 'x', status: 'forming', environment: GRID_ENVIRONMENTS['Moon'] });
```

(d) in the "rejects a duplicate gridId" test, add `environment` to the dup record (line 40):
```ts
        expect(() => r.register({ gridId: 'genesis', name: 'Dup', gridDomain: 'x', polisName: 'y', description: 'z', status: 'active', environment: EARTH_ORBIT }))
```

(e) extend the "lists active Grids" assertion (after line 66) to require the environment in the feed:
```ts
        expect(body.grids[0].celestial_body).toBe('Earth-orbit');
        expect(body.grids[0].environment).toMatchObject({ name: 'Earth-orbit', gravity_ms2: 9.81, min_stable_altitude_km: 160 });
```

- [ ] **Step 2: Run to verify failure**

Run (from `grid/`): `npx vitest run test/portal/grids.test.ts`
Expected: FAIL — TypeScript: `environment` missing on the register fixtures, and the route assertion fails (`celestial_body`/`environment` not in the response).

- [ ] **Step 3: Add `environment` to `GridRecord`**

In `grid/src/registry/grid-registry.ts`, add the import at the top (after the file header comment, before `export interface GridRecord`):
```ts
import type { GridEnvironment } from './grid-environments.js';
```
and add the field to `GridRecord` (after the `status` line, inside the interface):
```ts
    /** Where this Grid physically is — body/gravity/solar/light-delay/orbital floor. */
    readonly environment: GridEnvironment;
```

- [ ] **Step 4: Seed Genesis with the environment**

In `grid/src/main.ts`, add the import alongside the other registry imports (find the existing `GridRegistry` import and add):
```ts
import { EARTH_ORBIT } from './registry/grid-environments.js';
```
(If `GridRegistry` is imported as `from './registry/grid-registry.js'`, place this import on the next line.)

Then in the `gridRegistry.register({ ... })` call (lines 311-318), add the field before the closing brace (after `status: 'active',`):
```ts
        environment: EARTH_ORBIT,
```

- [ ] **Step 5: Surface the environment in the discovery feed**

In `grid/src/api/portal/grids.ts`, in the `grids.map(...)` projection (lines 31-38), add two fields after `status: g.status,`:
```ts
                celestial_body: g.environment.name,
                environment: g.environment,
```

- [ ] **Step 6: Run the targeted suites to verify they pass**

Run (from `grid/`): `npx vitest run test/portal/grids.test.ts test/registry/grid-environments.test.ts`
Expected: PASS — all GridRegistry unit tests, the env unit tests, and the route tests (incl. the new `celestial_body`/`environment` assertions) pass.

- [ ] **Step 7: Typecheck to catch any other register call site**

Run the project's typecheck from `grid/` (use the script if present, else tsc):
```bash
npm run typecheck 2>/dev/null || npx tsc --noEmit
```
Expected: no NEW type errors about `environment` missing on a `GridRecord`. (If the project has pre-existing unrelated type errors, confirm none are newly introduced by this change — grep the output for `environment` and `GridRecord`.) If a register call site outside `main.ts`/the test is reported, add `environment: EARTH_ORBIT` (or the appropriate env) there too.

- [ ] **Step 8: Commit**

```bash
git add grid/src/registry/grid-registry.ts grid/src/main.ts grid/src/api/portal/grids.ts grid/test/portal/grids.test.ts
git commit -m "feat(grid): F0b attach GridEnvironment to GridRecord + Portal discovery feed

GridRecord now carries a required environment; Genesis seeded Earth-orbit;
GET /api/v1/portal/grids returns celestial_body + environment.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage (F0b unit):** server-side authoritative `GridEnvironment` (Task 1); attached to every Grid record (Task 2 Step 3); Genesis seeded Earth-orbit (Step 4); readable in the Portal feed (Step 5). ✓
**2. Placeholder scan:** none — every step has complete code and exact commands. ✓
**3. Type/name consistency:** `GridEnvironment`, `GRID_ENVIRONMENTS`, `EARTH_ORBIT`, `getEnvironment`, field names, and the response keys `celestial_body`/`environment` are consistent across module, record, seed, route, and tests. Values match the F0 browser module post-fix (Moon `light_delay_ms` 1282, Mars `min_stable_altitude_km` 100). ✓
**4. Required-field safety:** `environment` is required; all known `GridRegistry.register` call sites (main.ts + 3 test fixtures) are updated; Step 7 typecheck catches any missed site. ✓
**5. Invariants:** in-memory (no migration/DB); no audit events (read-only discovery feed, allowlist +0); frozen env objects prevent mutation. ✓
