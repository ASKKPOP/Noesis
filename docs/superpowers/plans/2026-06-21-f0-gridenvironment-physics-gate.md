# F0 — GridEnvironment & Body-Parameterized Physics Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Grid a named celestial environment (body, gravity, solar constant, orbital reference radius, light-delay, stable-orbit floor) and make the physics gate judge object specs *relative to that body* — so Genesis ships as an `Earth-orbit` config and Moon/Mars become configs later, not rewrites.

**Architecture:** Add a new dual-export module `grid-environments.js` holding `GRID_ENVIRONMENTS` (Earth-orbit / Moon / Mars) and `EARTH_ORBIT` (Genesis default). Refactor `physics-gate.js` so `checkPhysics(spec, env = EARTH_ORBIT)` reads the orbital-decay floor from the environment, defaults to Earth-orbit (fully backward-compatible), and reports which environment judged the spec. Wire the new module into `orbital.html` before `physics-gate.js`. This is the first slice of the Economic Reality Loop program (`docs/superpowers/specs/2026-06-21-noesis-economic-reality-loop-design.md`, unit F0); the grid-side `grid_environments` DB record + store is the next plan (F0b).

**Tech Stack:** Plain ES5/ES2015 JavaScript, dual CommonJS + browser-global export (matches existing grid-viz modules). Tests: `node:test` + `node:assert`, run with `node --test` (CommonJS `.test.cjs` files). No build step, no DB.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `dashboard/public/grid-viz/grid-environments.js` | Celestial-environment data + `EARTH_ORBIT` default + `getEnvironment(name)` lookup. Dual export. | **Create** |
| `dashboard/public/grid-viz/grid-environments.test.cjs` | Unit tests for the environment data + lookup. | **Create** |
| `dashboard/public/grid-viz/physics-gate.js` | Add `env` parameter; orbital law reads `env.min_stable_altitude_km`; result reports `env`. | **Modify** (`:22`, `:46-47`, `:50`) |
| `dashboard/public/grid-viz/physics-gate.test.cjs` | Add env-parameterization tests (default, per-body, reported env). | **Modify** (append) |
| `dashboard/public/grid-viz/orbital.html` | Load `grid-environments.js` before `physics-gate.js`. | **Modify** (`:73`) |

All work happens in `dashboard/public/grid-viz/`. Run all commands from that directory:

```bash
cd /Users/desirey/Programming/src/Noesis/dashboard/public/grid-viz
```

---

## Task 1: GridEnvironment module

**Files:**
- Create: `dashboard/public/grid-viz/grid-environments.js`
- Test: `dashboard/public/grid-viz/grid-environments.test.cjs`

- [ ] **Step 1: Write the failing test**

Create `dashboard/public/grid-viz/grid-environments.test.cjs`:

```js
/* F0 — GridEnvironment tests (node:test). Run: node --test grid-environments.test.cjs
 * The environment is the foundation that keeps Noesis from being placeless. */
const test = require('node:test');
const assert = require('node:assert');
const { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment } = require('./grid-environments.js');

test('Genesis default is Earth-orbit', () => {
  assert.strictEqual(EARTH_ORBIT.name, 'Earth-orbit');
  assert.strictEqual(EARTH_ORBIT, GRID_ENVIRONMENTS['Earth-orbit']);
});

test('Earth-orbit carries the expected body parameters', () => {
  assert.strictEqual(EARTH_ORBIT.gravity_ms2, 9.81);
  assert.strictEqual(EARTH_ORBIT.solar_constant_wm2, 1361);
  assert.strictEqual(EARTH_ORBIT.orbital_ref_radius_km, 6371);
  assert.strictEqual(EARTH_ORBIT.light_delay_ms, 0);
  assert.strictEqual(EARTH_ORBIT.min_stable_altitude_km, 160);
});

test('Moon and Mars exist as configs with distinct gravity and orbital floors', () => {
  assert.strictEqual(GRID_ENVIRONMENTS['Moon'].gravity_ms2, 1.62);
  assert.strictEqual(GRID_ENVIRONMENTS['Moon'].min_stable_altitude_km, 15);
  assert.strictEqual(GRID_ENVIRONMENTS['Mars'].gravity_ms2, 3.71);
  assert.strictEqual(GRID_ENVIRONMENTS['Mars'].solar_constant_wm2, 586);
  assert.ok(GRID_ENVIRONMENTS['Mars'].light_delay_ms > 0, 'Mars has a non-zero light delay');
});

test('getEnvironment returns the named env, or Earth-orbit for an unknown name', () => {
  assert.strictEqual(getEnvironment('Moon').name, 'Moon');
  assert.strictEqual(getEnvironment('Nowhere'), EARTH_ORBIT);
  assert.strictEqual(getEnvironment(undefined), EARTH_ORBIT);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test grid-environments.test.cjs`
Expected: FAIL — `Cannot find module './grid-environments.js'`.

- [ ] **Step 3: Write the module**

Create `dashboard/public/grid-viz/grid-environments.js`:

```js
/* F0 — GridEnvironment: where a Grid physically is.
 *
 * The foundation that keeps Noesis from being placeless. Every Grid runs in a
 * named celestial environment; physics laws read these parameters so the same
 * object spec is judged by the body it lives on. Genesis ships as Earth-orbit;
 * Moon and Mars are configs here, not rewrites.
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.html classic script).
 *
 * Fields (SI unless noted):
 *   name                   config key / human label
 *   gravity_ms2            surface gravity
 *   solar_constant_wm2     mean solar irradiance at the body's distance
 *   orbital_ref_radius_km  radius of the reference body (altitude is measured above its surface)
 *   light_delay_ms         one-way signal delay to Earth (cross-grid state is eventually-consistent)
 *   min_stable_altitude_km lowest altitude that can hold an orbit (atmospheric-decay / terrain floor)
 */

const GRID_ENVIRONMENTS = {
  'Earth-orbit': {
    name: 'Earth-orbit',
    gravity_ms2: 9.81,
    solar_constant_wm2: 1361,
    orbital_ref_radius_km: 6371,
    light_delay_ms: 0,
    min_stable_altitude_km: 160,
  },
  'Moon': {
    name: 'Moon',
    gravity_ms2: 1.62,
    solar_constant_wm2: 1361,
    orbital_ref_radius_km: 1737,
    light_delay_ms: 1260,
    min_stable_altitude_km: 15,
  },
  'Mars': {
    name: 'Mars',
    gravity_ms2: 3.71,
    solar_constant_wm2: 586,
    orbital_ref_radius_km: 3390,
    light_delay_ms: 180000,
    min_stable_altitude_km: 90,
  },
};

/* Genesis Grid ships in Earth-orbit. */
const EARTH_ORBIT = GRID_ENVIRONMENTS['Earth-orbit'];

/* Resolve an environment by name; unknown / missing names fall back to Genesis. */
function getEnvironment(name) {
  return GRID_ENVIRONMENTS[name] || EARTH_ORBIT;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment };
if (typeof window !== 'undefined') window.GridEnvironments = { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test grid-environments.test.cjs`
Expected: PASS — 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add dashboard/public/grid-viz/grid-environments.js dashboard/public/grid-viz/grid-environments.test.cjs
git commit -m "feat(grid-viz): F0 GridEnvironment model (Earth-orbit/Moon/Mars configs)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Parameterize the physics gate by environment

**Files:**
- Modify: `dashboard/public/grid-viz/physics-gate.js` (`:22`, `:46-47`, `:50`)
- Test: `dashboard/public/grid-viz/physics-gate.test.cjs` (append)

The current orbital law hardcodes "below the surface" as `altitude_km <= 0`. We replace it with "below this body's stable-orbit floor" (`altitude_km < env.min_stable_altitude_km`). Earth-orbit's floor is 160 km, so the existing valid spec (altitude 420) still passes and the existing `-10` case still fails — fully backward-compatible.

- [ ] **Step 1: Write the failing tests**

Append to `dashboard/public/grid-viz/physics-gate.test.cjs` (after the last test, before EOF):

```js
const { GRID_ENVIRONMENTS, EARTH_ORBIT } = require('./grid-environments.js');

test('default environment is Earth-orbit and is reported on the result', () => {
  const r = checkPhysics(valid());
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.env, 'Earth-orbit');
});

test('a low orbit that decays on Earth can hold on the airless Moon', () => {
  const lowSpec = valid({ altitude_km: 50 });        // 50 km
  const earth = checkPhysics(lowSpec, EARTH_ORBIT);  // floor 160 → too low
  assert.strictEqual(earth.ok, false);
  assert.ok(earth.violations.includes('orbital'));

  const moon = checkPhysics(lowSpec, GRID_ENVIRONMENTS['Moon']); // floor 15 → ok
  assert.strictEqual(moon.ok, true);
  assert.strictEqual(moon.env, 'Moon');
});

test('an orbit below even the Moon floor is still rejected', () => {
  const r = checkPhysics(valid({ altitude_km: 5 }), GRID_ENVIRONMENTS['Moon']); // floor 15
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('orbital'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test physics-gate.test.cjs`
Expected: FAIL — new tests fail (`r.env` is `undefined`; `checkPhysics` ignores the env arg so the Moon low-orbit case is judged by the hardcoded `<= 0` rule and the env is not reported).

- [ ] **Step 3: Edit `physics-gate.js` — resolve the default environment**

In `dashboard/public/grid-viz/physics-gate.js`, immediately after the `REQUIRED` array block (after line 18) and before `function finiteNonNeg`, insert:

```js
/* Resolve the default environment (Earth-orbit) from grid-environments.js —
 * CommonJS require in node, browser global in the classic-script load. Falls
 * back to a permissive floor of 0 if the module is somehow absent. */
const _ENV = (typeof require === 'function')
  ? require('./grid-environments.js')
  : (typeof window !== 'undefined' && window.GridEnvironments ? window.GridEnvironments : null);
const EARTH_ORBIT = (_ENV && _ENV.EARTH_ORBIT) || { name: 'Earth-orbit', min_stable_altitude_km: 0 };
```

- [ ] **Step 4: Edit `physics-gate.js` — accept the env parameter**

Change the function signature on line 22 from:

```js
function checkPhysics(spec) {
```

to:

```js
function checkPhysics(spec, env = EARTH_ORBIT) {
```

- [ ] **Step 5: Edit `physics-gate.js` — orbital law reads the env floor**

Replace lines 46-47 (the orbital-mechanics check) from:

```js
  // 5. Orbital mechanics — cannot orbit inside the body it orbits.
  if (typeof spec.altitude_km === 'number' && Number.isFinite(spec.altitude_km) && spec.altitude_km <= 0) v.push('orbital');
```

with:

```js
  // 5. Orbital mechanics — cannot hold an orbit below this body's stable floor
  //    (atmospheric decay / terrain). The floor is body-specific via env.
  const floor = (env && Number.isFinite(env.min_stable_altitude_km)) ? env.min_stable_altitude_km : 0;
  if (typeof spec.altitude_km === 'number' && Number.isFinite(spec.altitude_km) && spec.altitude_km < floor) v.push('orbital');
```

- [ ] **Step 6: Edit `physics-gate.js` — report the env on the result**

Replace line 50 from:

```js
  return { ok: violations.length === 0, violations };
```

with:

```js
  return { ok: violations.length === 0, violations, env: (env && env.name) || 'Earth-orbit' };
```

- [ ] **Step 7: Run the full physics-gate suite to verify all pass**

Run: `node --test physics-gate.test.cjs`
Expected: PASS — all original tests (incl. `valid()` altitude 420, `altitude -10` orbital rejection) plus the 3 new env tests pass. 0 fail.

- [ ] **Step 8: Run the whole grid-viz suite to confirm no regressions**

Run: `node --test *.test.cjs`
Expected: PASS — every existing suite (object-gen, learning, simulate, teaching) stays green; `orbital.js`'s `checkPhysics(spec)` call (no env arg) now defaults to Earth-orbit and behaves exactly as before.

- [ ] **Step 9: Commit**

```bash
git add dashboard/public/grid-viz/physics-gate.js dashboard/public/grid-viz/physics-gate.test.cjs
git commit -m "feat(grid-viz): F0 parameterize physics gate by GridEnvironment

Orbital law reads env.min_stable_altitude_km; defaults to Earth-orbit
(backward-compatible); result reports which env judged the spec.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 3: Wire the environment module into the orbital scene

**Files:**
- Modify: `dashboard/public/grid-viz/orbital.html` (`:73`)

`physics-gate.js` reads `window.GridEnvironments` in the browser, so `grid-environments.js` must load first.

- [ ] **Step 1: Add the script tag before physics-gate.js**

In `dashboard/public/grid-viz/orbital.html`, change line 73 from:

```html
<script src="./physics-gate.js"></script>
```

to:

```html
<script src="./grid-environments.js"></script>
<script src="./physics-gate.js"></script>
```

- [ ] **Step 2: Verify the page loads and physics still gates (manual smoke check)**

Run a static server and open the scene:

```bash
# from repo root
python3 -m http.server 4188 --directory dashboard/public/grid-viz
```

Open `http://localhost:4188/orbital.html`. Expected: the orbital scene renders as before; the header stat line still shows the physics check count (`window.PhysicsGate.REQUIRED.length`); the browser console has no errors (`window.GridEnvironments` and `window.PhysicsGate` are both defined). Stop the server when done (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add dashboard/public/grid-viz/orbital.html
git commit -m "feat(grid-viz): F0 load grid-environments before physics-gate in orbital scene

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage (F0 unit of the design spec):**
- "Encode where a Grid is: celestial body, gravity, solar constant, orbital reference radius, light-delay" → Task 1 (`GRID_ENVIRONMENTS` with all five fields + `min_stable_altitude_km`). ✓
- "Genesis = Earth-orbit config" → Task 1 (`EARTH_ORBIT` default). ✓
- "`checkPhysics(spec)` → `checkPhysics(spec, env)` — orbital law reads the environment" → Task 2. ✓
- "Moon and Mars become configs, not rewrites" → Task 1 (Moon/Mars entries) + Task 2 (per-body orbital floor proven by test). ✓
- Out of scope for F0 (next plan F0b): grid-side `grid_environments` DB table, store, migration, and route. Noted in Architecture; no code references it here.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step shows the exact command and expected result. ✓

**3. Type/name consistency:** `GRID_ENVIRONMENTS`, `EARTH_ORBIT`, `getEnvironment`, field names (`gravity_ms2`, `solar_constant_wm2`, `orbital_ref_radius_km`, `light_delay_ms`, `min_stable_altitude_km`), and the result key `env` are used identically across Task 1, Task 2, and their tests. `checkPhysics(spec, env = EARTH_ORBIT)` matches the `EARTH_ORBIT` constant resolved at the top of the module. ✓

**4. Backward-compatibility check:** Existing `physics-gate.test.cjs` (`valid()` altitude 420 > 160 floor → passes; `altitude -10 < 160` → orbital violation) and `orbital.js:269` `checkPhysics(spec)` (no env → Earth-orbit default) are preserved. Result gains an `env` field that existing assertions (`r.ok`, `r.violations`) do not inspect. ✓
