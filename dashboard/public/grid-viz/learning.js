/* Phase S3 — learning loop.
 *
 * The Nous improves its designs over generations: every object is scored by FITNESS
 * (capability + efficiency per unit mass); the fittest are kept (elitism) and breed
 * SPECIALIZED variants; only physical (S1-gated) children survive. Best fitness never
 * regresses. This is the observe→…→EVALUATE→SPECIALIZE part of the loop.
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.html classic-script load).
 */

function PG() {
  if (typeof window !== 'undefined' && window.PhysicsGate) return window.PhysicsGate;
  return require('./physics-gate.js');
}

/* Higher = fitter. Rewards power/structural/thermal margins, energy efficiency, and
 * power-to-mass (lighter, more capable). All terms are positive for a physical spec. */
function fitness(s) {
  const pm = s.generation_W / Math.max(1, s.consumption_W);   // power margin (≥1)
  const sm = s.yield_N / Math.max(1, s.load_N);               // structural margin (≥1)
  const tm = s.radiated_W / Math.max(1, s.dissipated_W);      // thermal margin (≥1)
  const ee = s.energyOut_J / Math.max(1, s.energyIn_J);       // energy efficiency (0,1]
  const ptm = s.generation_W / Math.max(1, s.mass_kg);        // power-to-mass
  return 2 * Math.log(pm) + Math.log(sm) + Math.log(tm) + 1.5 * ee + 40 * ptm;
}

/* Mutate the margin/efficiency fields (biased toward improvement). Conservation pairs
 * (massIn/out, energyIn/out) are left untouched so children never break conservation. */
function specialize(spec, rnd = Math.random) {
  const m = (x, lo, hi) => x * (lo + rnd() * (hi - lo));
  const c = Object.assign({}, spec);
  c.mass_kg = m(spec.mass_kg, 0.85, 1.05);          // bias lighter
  c.generation_W = m(spec.generation_W, 0.96, 1.18); // bias more capable
  c.consumption_W = m(spec.consumption_W, 0.90, 1.05);
  c.load_N = m(spec.load_N, 0.90, 1.08);
  c.yield_N = m(spec.yield_N, 0.96, 1.12);
  c.dissipated_W = m(spec.dissipated_W, 0.90, 1.04);
  c.radiated_W = m(spec.radiated_W, 0.96, 1.16);
  c.altitude_km = m(spec.altitude_km, 0.97, 1.03);
  return c;
}

function seedPopulation(specs) {
  return specs.map(s => ({ spec: s, generation: 0, fitness: fitness(s) }));
}

function evolve(population, opts = {}) {
  const rnd = opts.rnd || Math.random;
  const target = opts.size || population.length;
  const keep = Math.max(1, Math.min(opts.keep != null ? opts.keep : Math.ceil(population.length / 2), population.length));

  const scored = population.map(ind => ({
    spec: ind.spec, generation: ind.generation || 0,
    fitness: ind.fitness != null ? ind.fitness : fitness(ind.spec),
  })).sort((a, b) => b.fitness - a.fitness);

  // Elitism. With { niche: true } we keep the best of EACH function family so selection
  // pressure improves designs without collapsing the population to a monoculture
  // (PHILOSOPHY: diversity over monoculture).
  let elites;
  if (opts.niche) {
    const bestByFn = new Map();
    for (const s of scored) if (!bestByFn.has(s.spec.fn)) bestByFn.set(s.spec.fn, s); // scored is fitness-desc
    elites = Array.from(bestByFn.values());
    for (const s of scored) { if (elites.length >= keep) break; if (!elites.includes(s)) elites.push(s); }
  } else {
    elites = scored.slice(0, keep);                           // carry the best forward unchanged
  }
  const nextGen = Math.max(0, ...scored.map(s => s.generation)) + 1;

  const children = [];
  let guard = 0;
  while (elites.length + children.length < target && guard < target * 30) {
    guard++;
    const parent = elites[Math.floor(rnd() * elites.length)] || scored[0];
    const childSpec = specialize(parent.spec, rnd);
    if (PG().checkPhysics(childSpec).ok) {                    // gated — unphysical children never persist
      children.push({ spec: childSpec, generation: nextGen, fitness: fitness(childSpec) });
    }
  }

  const pop = elites.concat(children);
  const best = Math.max(...pop.map(i => i.fitness));
  const mean = pop.reduce((a, i) => a + i.fitness, 0) / pop.length;
  return { generation: nextGen, population: pop, best, mean };
}

const learningApi = { fitness, specialize, seedPopulation, evolve };
if (typeof module !== 'undefined' && module.exports) module.exports = learningApi;
if (typeof window !== 'undefined') window.Learn = learningApi;
