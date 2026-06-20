/* Phase S1 — physics gate.
 *
 * The non-negotiable floor of the Nous learning loop: a functional object that
 * violates physical / structural law is REJECTED before it can ever be shown.
 * "Physics wins" (PHILOSOPHY) enforced in code, not prose.
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.js classic-script load).
 *
 * A FunctionalObject spec (one operating cycle), all SI:
 *   mass_kg, massIn_kg, massOut_kg, energyIn_J, energyOut_J,
 *   load_N, yield_N, dissipated_W, radiated_W, generation_W, consumption_W, altitude_km
 */

const REQUIRED = [
  'mass_kg', 'massIn_kg', 'massOut_kg', 'energyIn_J', 'energyOut_J',
  'load_N', 'yield_N', 'dissipated_W', 'radiated_W',
  'generation_W', 'consumption_W', 'altitude_km',
];

function finiteNonNeg(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }

function checkPhysics(spec) {
  const v = [];

  // 6. Dimensional sanity — every required field present, finite, non-negative.
  //    (altitude may be negative to express "below the surface" — checked separately.)
  for (const k of REQUIRED) {
    if (spec[k] === undefined) { v.push('dimensional'); continue; }
    if (k === 'altitude_km') { if (typeof spec[k] !== 'number' || !Number.isFinite(spec[k])) v.push('dimensional'); }
    else if (!finiteNonNeg(spec[k])) v.push('dimensional');
  }

  // 1. Conservation of mass / energy — outputs cannot exceed inputs over a cycle.
  if (finiteNonNeg(spec.massOut_kg) && finiteNonNeg(spec.massIn_kg) && spec.massOut_kg > spec.massIn_kg) v.push('mass');
  if (finiteNonNeg(spec.energyOut_J) && finiteNonNeg(spec.energyIn_J) && spec.energyOut_J > spec.energyIn_J) v.push('energy');

  // 2. Structural integrity — load must stay within material yield.
  if (finiteNonNeg(spec.load_N) && finiteNonNeg(spec.yield_N) && spec.load_N > spec.yield_N) v.push('structural');

  // 3. Thermal balance — must radiate at least what it dissipates.
  if (finiteNonNeg(spec.radiated_W) && finiteNonNeg(spec.dissipated_W) && spec.radiated_W < spec.dissipated_W) v.push('thermal');

  // 4. Power budget — generation must cover consumption.
  if (finiteNonNeg(spec.generation_W) && finiteNonNeg(spec.consumption_W) && spec.generation_W < spec.consumption_W) v.push('power');

  // 5. Orbital mechanics — cannot orbit inside the body it orbits.
  if (typeof spec.altitude_km === 'number' && Number.isFinite(spec.altitude_km) && spec.altitude_km <= 0) v.push('orbital');

  const violations = Array.from(new Set(v));
  return { ok: violations.length === 0, violations };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { checkPhysics, REQUIRED };
if (typeof window !== 'undefined') window.PhysicsGate = { checkPhysics, REQUIRED };
