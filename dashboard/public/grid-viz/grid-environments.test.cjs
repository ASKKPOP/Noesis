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
  assert.strictEqual(getEnvironment('Mars').name, 'Mars');
  assert.strictEqual(getEnvironment('Nowhere'), EARTH_ORBIT);
  assert.strictEqual(getEnvironment(undefined), EARTH_ORBIT);
});
