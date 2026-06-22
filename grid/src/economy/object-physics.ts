/**
 * L3 — server-side physics gate. The grid-side port of the F0 browser gate
 * (dashboard/public/grid-viz/physics-gate.js): an object spec that violates
 * physical / structural law is REJECTED before it can ever be persisted as a
 * real orbital_object. "Physics wins" (PHILOSOPHY) enforced on the server.
 *
 * Reads the grid-side GridEnvironment (F0b) so the orbital floor is body-specific.
 * Keep in sync with the browser gate.
 */
import { type GridEnvironment, EARTH_ORBIT } from '../registry/grid-environments.js';

const REQUIRED = [
    'mass_kg', 'massIn_kg', 'massOut_kg', 'energyIn_J', 'energyOut_J',
    'load_N', 'yield_N', 'dissipated_W', 'radiated_W',
    'generation_W', 'consumption_W', 'altitude_km',
] as const;

export type ObjectPhysicsSpec = Partial<Record<(typeof REQUIRED)[number], number>>;

function finiteNonNeg(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }

export function checkObjectPhysics(spec: ObjectPhysicsSpec, env: GridEnvironment = EARTH_ORBIT): { ok: boolean; violations: string[]; env: string } {
    const v: string[] = [];

    // 6. Dimensional sanity — every required field present, finite, non-negative (altitude may be negative → checked in law 5).
    for (const k of REQUIRED) {
        const val = spec[k];
        if (val === undefined) { v.push('dimensional'); continue; }
        if (k === 'altitude_km') { if (typeof val !== 'number' || !Number.isFinite(val)) v.push('dimensional'); }
        else if (!finiteNonNeg(val)) v.push('dimensional');
    }
    // 1. Conservation of mass / energy.
    if (finiteNonNeg(spec.massOut_kg) && finiteNonNeg(spec.massIn_kg) && spec.massOut_kg > spec.massIn_kg) v.push('mass');
    if (finiteNonNeg(spec.energyOut_J) && finiteNonNeg(spec.energyIn_J) && spec.energyOut_J > spec.energyIn_J) v.push('energy');
    // 2. Structural integrity.
    if (finiteNonNeg(spec.load_N) && finiteNonNeg(spec.yield_N) && spec.load_N > spec.yield_N) v.push('structural');
    // 3. Thermal balance.
    if (finiteNonNeg(spec.radiated_W) && finiteNonNeg(spec.dissipated_W) && spec.radiated_W < spec.dissipated_W) v.push('thermal');
    // 4. Power budget.
    if (finiteNonNeg(spec.generation_W) && finiteNonNeg(spec.consumption_W) && spec.generation_W < spec.consumption_W) v.push('power');
    // 5. Orbital mechanics — inside the body (≤0, universal) or below this body's stable floor.
    const floor = (env && Number.isFinite(env.min_stable_altitude_km)) ? env.min_stable_altitude_km : 0;
    if (typeof spec.altitude_km === 'number' && Number.isFinite(spec.altitude_km)
        && (spec.altitude_km <= 0 || spec.altitude_km < floor)) v.push('orbital');

    const violations = Array.from(new Set(v));
    return { ok: violations.length === 0, violations, env: (env && env.name) || 'Earth-orbit' };
}
