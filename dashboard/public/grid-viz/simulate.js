/* Phase S4 — zone simulation.
 *
 * One tick of a zone's energy ledger. Modules produce (generation_W) and draw
 * (consumption_W) + shed heat (dissipated_W). The sim CONSERVES energy: it can never
 * serve more than is produced + imported, and reports whether the zone is powered or
 * browns out. This is role (b) — simulation — under the §S1 physics contract.
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.html classic-script load).
 */
function simulateZone(modules, opts = {}) {
  modules = modules || [];
  const importW = opts.importW || 0; // power imported from other zones (optional)
  const inflow = modules.reduce((a, m) => a + Math.max(0, m.generation_W || 0), 0) + importW;
  const demand = modules.reduce((a, m) => a + (m.consumption_W || 0) + (m.dissipated_W || 0), 0);
  const surplus = inflow - demand;
  // conservation: you can never serve more energy than you have produced/imported.
  const served = Math.min(demand, inflow);
  const conserved = served <= inflow + 1e-9;
  return {
    inflow, demand, surplus, served,
    status: surplus >= 0 ? 'powered' : 'brownout',
    conserved, modules: modules.length,
  };
}
const simApi = { simulateZone };
if (typeof module !== 'undefined' && module.exports) module.exports = simApi;
if (typeof window !== 'undefined') window.Simulate = simApi;
