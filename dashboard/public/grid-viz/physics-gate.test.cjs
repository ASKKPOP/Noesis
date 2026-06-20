/* Phase S1 — physics gate tests (node:test). Run: node --test physics-gate.test.cjs
 * The gate is the non-negotiable floor: an object that violates physical law is rejected. */
const test = require('node:test');
const assert = require('node:assert');
const { checkPhysics } = require('./physics-gate.js');

/* A physically valid functional object (one cycle). */
function valid(over = {}) {
  return Object.assign({
    fn: 'Energy', mass_kg: 1000,
    massIn_kg: 5, massOut_kg: 5,           // conservation
    energyIn_J: 1000, energyOut_J: 900,    // conservation (lossy ok)
    load_N: 200, yield_N: 500,             // structural
    dissipated_W: 50, radiated_W: 80,      // thermal
    generation_W: 120, consumption_W: 100, // power
    altitude_km: 420,                      // orbital
  }, over);
}

test('valid functional object passes all checks', () => {
  const r = checkPhysics(valid());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.violations, []);
});

test('rejects net creation of mass', () => {
  const r = checkPhysics(valid({ massOut_kg: 6 }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('mass'), 'expected mass violation');
});

test('rejects net creation of energy', () => {
  const r = checkPhysics(valid({ energyOut_J: 1001 }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('energy'));
});

test('rejects structural overload (load exceeds yield)', () => {
  const r = checkPhysics(valid({ load_N: 600 }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('structural'));
});

test('rejects thermal runaway (cannot shed heat)', () => {
  const r = checkPhysics(valid({ radiated_W: 40 })); // < dissipated 50
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('thermal'));
});

test('rejects power deficit (draws more than it makes)', () => {
  const r = checkPhysics(valid({ generation_W: 90 })); // < consumption 100
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('power'));
});

test('rejects impossible orbit (inside the body)', () => {
  const r = checkPhysics(valid({ altitude_km: -10 }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('orbital'));
});

test('rejects dimensional nonsense (NaN / non-finite)', () => {
  const r = checkPhysics(valid({ mass_kg: NaN }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('dimensional'));
});

test('collects multiple violations at once', () => {
  const r = checkPhysics(valid({ massOut_kg: 9, radiated_W: 1, generation_W: 1 }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('mass'));
  assert.ok(r.violations.includes('thermal'));
  assert.ok(r.violations.includes('power'));
});

test('a missing required field is a dimensional violation, never a silent pass', () => {
  const spec = valid(); delete spec.yield_N;
  const r = checkPhysics(spec);
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.includes('dimensional'));
});
