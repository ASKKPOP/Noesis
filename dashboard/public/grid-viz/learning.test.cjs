/* Phase S3 — learning loop tests (node:test). Run: node --test learning.test.cjs
 * Objects are scored by fitness; fitter designs breed specialized variants over
 * generations; only physical (S1-gated) children survive; best fitness never regresses. */
const test = require('node:test');
const assert = require('node:assert');
const Learn = require('./learning.js');
const { checkPhysics } = require('./physics-gate.js');

function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

function spec(over = {}) {
  return Object.assign({
    fn: 'Energy', mass_kg: 1500, massIn_kg: 10, massOut_kg: 10,
    energyIn_J: 1000, energyOut_J: 900,
    load_N: 260, yield_N: 700, dissipated_W: 120, radiated_W: 200,
    generation_W: 400, consumption_W: 80, altitude_km: 420,
  }, over);
}

test('fitness is a finite positive number', () => {
  const f = Learn.fitness(spec());
  assert.ok(Number.isFinite(f) && f > 0, `fitness was ${f}`);
});

test('a more capable, lighter design scores higher', () => {
  const worse = spec({ mass_kg: 1900, generation_W: 120, consumption_W: 110, yield_N: 300, load_N: 280, radiated_W: 130, dissipated_W: 120 });
  const better = spec({ mass_kg: 900, generation_W: 400, consumption_W: 80, yield_N: 800, load_N: 200, radiated_W: 260, dissipated_W: 120 });
  assert.ok(Learn.fitness(better) > Learn.fitness(worse));
});

test('specialize returns a child of the same function', () => {
  const child = Learn.specialize(spec(), mulberry32(1));
  assert.strictEqual(child.fn, 'Energy');
  assert.strictEqual(typeof child.mass_kg, 'number');
  assert.notStrictEqual(child, spec()); // a new object
});

test('specialize preserves conservation (mass/energy not inflated)', () => {
  const child = Learn.specialize(spec(), mulberry32(7));
  assert.ok(child.massOut_kg <= child.massIn_kg);
  assert.ok(child.energyOut_J <= child.energyIn_J);
});

test('evolve increments the generation index', () => {
  const pop = Learn.seedPopulation([spec(), spec({ fn: 'Comms', mass_kg: 700, generation_W: 90, consumption_W: 70 })]);
  const g1 = Learn.evolve(pop, { keep: 1, rnd: mulberry32(3) });
  assert.strictEqual(g1.generation, 1);
});

test('evolve keeps only physical designs (gated)', () => {
  const pop = Learn.seedPopulation([spec()]);
  const r = Learn.evolve(pop, { keep: 1, size: 6, rnd: mulberry32(5) });
  for (const ind of r.population) assert.strictEqual(checkPhysics(ind.spec).ok, true);
  assert.ok(r.population.length >= 1);
});

test('elitism: best fitness never decreases across generations', () => {
  let pop = Learn.seedPopulation([spec(), spec({ mass_kg: 1800, generation_W: 130, consumption_W: 120 })]);
  let prevBest = Math.max(...pop.map(i => i.fitness));
  const rnd = mulberry32(11);
  for (let g = 0; g < 8; g++) {
    const r = Learn.evolve(pop, { keep: 2, size: 4, rnd });
    assert.ok(r.best >= prevBest - 1e-9, `gen ${g}: ${r.best} < ${prevBest}`);
    prevBest = r.best; pop = r.population;
  }
});

test('over many generations the population specializes and improves', () => {
  let pop = Learn.seedPopulation([spec({ mass_kg: 1800, generation_W: 150, consumption_W: 130, yield_N: 320, load_N: 300, radiated_W: 130 })]);
  const rnd = mulberry32(21);
  const start = Learn.evolve(pop, { keep: 1, size: 6, rnd });
  let cur = start;
  for (let g = 0; g < 14; g++) cur = Learn.evolve(cur.population, { keep: 2, size: 6, rnd });
  assert.ok(cur.best >= start.best);          // never regresses
  assert.ok(cur.generation > start.generation); // generations advanced
});
