/* Phase S5 — teaching / transfer.
 *
 * A Nous exports its LEARNED population (the evolved, specialized designs) as a portable
 * knowledge pack; importing it seeds a NEW Grid from accumulated knowledge instead of from
 * zero — the philosophy's "Settle New Grids" pillar at the visualization layer.
 *
 * Import RE-GATES every design through the §S1 physics contract: teaching can never inject
 * a law-breaking object into the new Grid (PHILOSOPHY: physics wins).
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.html classic-script load).
 */
const PACK_VERSION = 'noesis-knowledge-pack/1';

function PG() {
  if (typeof window !== 'undefined' && window.PhysicsGate) return window.PhysicsGate;
  return require('./physics-gate.js');
}
function LEARN() {
  if (typeof window !== 'undefined' && window.Learn) return window.Learn;
  return require('./learning.js');
}

function exportPopulation(individuals, meta = {}) {
  const fit = LEARN().fitness;
  const inds = (individuals || []).map(i => ({
    spec: i.spec, generation: i.generation || 0,
    fitness: i.fitness != null ? i.fitness : fit(i.spec),
  }));
  return {
    version: PACK_VERSION,
    grid: meta.grid || 'genesis',
    generation: Math.max(0, ...inds.map(i => i.generation)),
    exportedFitness: { best: inds.length ? Math.max(...inds.map(i => i.fitness)) : 0, count: inds.length },
    individuals: inds,
  };
}

function importPopulation(pack) {
  if (!pack || pack.version !== PACK_VERSION || !Array.isArray(pack.individuals)) {
    throw new Error('invalid knowledge pack');
  }
  const check = PG().checkPhysics;
  const accepted = [], rejected = [];
  for (const ind of pack.individuals) {
    if (ind && ind.spec && check(ind.spec).ok) {
      accepted.push({ spec: ind.spec, generation: ind.generation || 0, fitness: ind.fitness });
    } else {
      rejected.push(ind);
    }
  }
  return { accepted, rejected, fromGrid: pack.grid, generation: pack.generation };
}

function summary(pack) {
  const byFn = {};
  (pack.individuals || []).forEach(i => { byFn[i.spec.fn] = (byFn[i.spec.fn] || 0) + 1; });
  return {
    count: (pack.individuals || []).length,
    functions: Object.keys(byFn).length,
    byFn, best: pack.exportedFitness ? pack.exportedFitness.best : 0,
    generation: pack.generation || 0,
  };
}

const teachApi = { exportPopulation, importPopulation, summary, PACK_VERSION };
if (typeof module !== 'undefined' && module.exports) module.exports = teachApi;
if (typeof window !== 'undefined') window.Teaching = teachApi;
