/* Phase S5 — teaching / transfer tests (node:test). Run: node --test teaching.test.cjs
 * A Nous exports its LEARNED population as a knowledge pack; importing it seeds a new Grid
 * from accumulated knowledge (not from zero). Import re-gates — teaching can't inject
 * unphysical designs (PHILOSOPHY: physics wins). */
const test = require('node:test');
const assert = require('node:assert');
const Teach = require('./teaching.js');
const { checkPhysics } = require('./physics-gate.js');

function spec(over = {}) {
  return Object.assign({
    fn: 'Energy', mass_kg: 1500, massIn_kg: 10, massOut_kg: 10,
    energyIn_J: 1000, energyOut_J: 900,
    load_N: 260, yield_N: 700, dissipated_W: 120, radiated_W: 200,
    generation_W: 400, consumption_W: 80, altitude_km: 420,
  }, over);
}
const comms = () => spec({ fn: 'Comms', mass_kg: 700, generation_W: 90, consumption_W: 70, yield_N: 450, load_N: 120, radiated_W: 90, dissipated_W: 50 });

test('exports a versioned knowledge pack carrying generation + best fitness', () => {
  const pack = Teach.exportPopulation([{ spec: spec(), generation: 5 }, { spec: comms(), generation: 5 }]);
  assert.strictEqual(typeof pack.version, 'string');
  assert.strictEqual(pack.generation, 5);
  assert.ok(pack.exportedFitness.best > 0);
  assert.strictEqual(pack.individuals.length, 2);
});

test('serialize → deserialize → import round-trips the population', () => {
  const pack = Teach.exportPopulation([{ spec: spec(), generation: 3 }]);
  const round = Teach.importPopulation(JSON.parse(JSON.stringify(pack)));
  assert.strictEqual(round.accepted.length, 1);
  assert.deepStrictEqual(round.accepted[0].spec, spec());
  assert.strictEqual(round.accepted[0].generation, 3);
});

test('a taught Grid starts from the learned generation, not zero', () => {
  const pack = Teach.exportPopulation([{ spec: spec(), generation: 7 }, { spec: comms(), generation: 7 }]);
  const imp = Teach.importPopulation(pack);
  assert.ok(imp.generation >= 7);
  assert.ok(imp.accepted.every(i => i.generation >= 1)); // inherited, not gen-0 generics
});

test('import re-gates: unphysical designs in a pack are rejected, physical kept', () => {
  const bad = spec({ load_N: 9999 }); // structural violation (load >> yield)
  const pack = Teach.exportPopulation([{ spec: spec(), generation: 4 }, { spec: bad, generation: 4 }]);
  const imp = Teach.importPopulation(pack);
  assert.strictEqual(imp.accepted.length, 1);
  assert.strictEqual(imp.rejected.length, 1);
  imp.accepted.forEach(i => assert.strictEqual(checkPhysics(i.spec).ok, true));
});

test('an invalid pack is refused', () => {
  assert.throws(() => Teach.importPopulation({ version: 'nope', individuals: [] }));
  assert.throws(() => Teach.importPopulation(null));
});

test('summary reports module count and function diversity', () => {
  const pack = Teach.exportPopulation([{ spec: spec(), generation: 2 }, { spec: comms(), generation: 2 }]);
  const s = Teach.summary(pack);
  assert.strictEqual(s.count, 2);
  assert.strictEqual(s.functions, 2);
});
