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
// Route surplus energy from exporting zones to deficit zones (greedy, conserved:
// total routed never exceeds total available surplus). Returns [{from, to, amount}].
function computeFlows(zoneStates) {
  const exporters = (zoneStates || []).filter(z => z.surplus > 0)
    .map(z => ({ id: z.zoneId, avail: z.surplus })).sort((a, b) => b.avail - a.avail);
  const importers = (zoneStates || []).filter(z => z.surplus < 0)
    .map(z => ({ id: z.zoneId, need: -z.surplus })).sort((a, b) => b.need - a.need);
  const flows = [];
  let ei = 0;
  for (const imp of importers) {
    let need = imp.need;
    while (need > 1e-9 && ei < exporters.length) {
      const exp = exporters[ei];
      if (exp.avail <= 1e-9) { ei++; continue; }
      const amount = Math.min(need, exp.avail);
      flows.push({ from: exp.id, to: imp.id, amount });
      exp.avail -= amount; need -= amount;
      if (exp.avail <= 1e-9) ei++;
    }
  }
  return flows;
}

const simApi = { simulateZone, computeFlows };
if (typeof module !== 'undefined' && module.exports) module.exports = simApi;
if (typeof window !== 'undefined') window.Simulate = simApi;
