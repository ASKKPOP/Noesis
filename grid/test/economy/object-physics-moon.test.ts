/**
 * H1 (first version) — the body parameterizes the economy.
 *
 * The SAME object spec is judged under each Grid's GridEnvironment. A low orbit
 * that is below Earth-orbit's stable floor (160 km) is fine on the Moon (floor
 * 15 km) — proving "Moon = different physics", not a rewrite.
 */
import { describe, it, expect } from 'vitest';
import { checkObjectPhysics, type ObjectPhysicsSpec } from '../../src/economy/object-physics.js';
import { GRID_ENVIRONMENTS, EARTH_ORBIT } from '../../src/registry/grid-environments.js';

// A fully law-abiding spec EXCEPT its altitude sits between the Moon floor (15)
// and the Earth-orbit floor (160).
const LOW_ORBIT: ObjectPhysicsSpec = {
    mass_kg: 1, massIn_kg: 1, massOut_kg: 1, energyIn_J: 1, energyOut_J: 1,
    load_N: 1, yield_N: 1, dissipated_W: 1, radiated_W: 1,
    generation_W: 1, consumption_W: 1, altitude_km: 100,
};

describe('object physics is body-specific (H1)', () => {
    it('rejects the 100 km orbit on Earth-orbit (below the 160 km floor)', () => {
        const res = checkObjectPhysics(LOW_ORBIT, EARTH_ORBIT);
        expect(res.ok).toBe(false);
        expect(res.violations).toContain('orbital');
        expect(res.env).toBe('Earth-orbit');
    });

    it('accepts the same 100 km orbit on the Moon (above the 15 km floor)', () => {
        const res = checkObjectPhysics(LOW_ORBIT, GRID_ENVIRONMENTS['Moon']);
        expect(res.ok).toBe(true);
        expect(res.violations).not.toContain('orbital');
        expect(res.env).toBe('Moon');
    });
});
