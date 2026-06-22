import { describe, it, expect } from 'vitest';
import { checkObjectPhysics } from '../../src/economy/object-physics.js';
import { EARTH_ORBIT, GRID_ENVIRONMENTS } from '../../src/registry/grid-environments.js';

function valid(over: Record<string, number> = {}) {
    return { mass_kg: 1000, massIn_kg: 5, massOut_kg: 5, energyIn_J: 1000, energyOut_J: 900,
        load_N: 200, yield_N: 500, dissipated_W: 50, radiated_W: 80, generation_W: 120, consumption_W: 100, altitude_km: 420, ...over };
}

describe('checkObjectPhysics (server-side)', () => {
    it('a valid spec passes (default Earth-orbit), reports env', () => {
        const r = checkObjectPhysics(valid());
        expect(r.ok).toBe(true);
        expect(r.violations).toEqual([]);
        expect(r.env).toBe('Earth-orbit');
    });
    it('rejects net mass creation', () => { expect(checkObjectPhysics(valid({ massOut_kg: 6 })).violations).toContain('mass'); });
    it('rejects net energy creation', () => { expect(checkObjectPhysics(valid({ energyOut_J: 1001 })).violations).toContain('energy'); });
    it('rejects structural overload', () => { expect(checkObjectPhysics(valid({ load_N: 600 })).violations).toContain('structural'); });
    it('rejects thermal runaway', () => { expect(checkObjectPhysics(valid({ radiated_W: 40 })).violations).toContain('thermal'); });
    it('rejects power deficit', () => { expect(checkObjectPhysics(valid({ generation_W: 90 })).violations).toContain('power'); });
    it('rejects an orbit below the Earth floor (160) and at/below surface', () => {
        expect(checkObjectPhysics(valid({ altitude_km: 50 })).violations).toContain('orbital');
        expect(checkObjectPhysics(valid({ altitude_km: 0 })).violations).toContain('orbital');
    });
    it('the same low orbit holds on the Moon (floor 15)', () => {
        const r = checkObjectPhysics(valid({ altitude_km: 50 }), GRID_ENVIRONMENTS['Moon']);
        expect(r.ok).toBe(true);
        expect(r.env).toBe('Moon');
    });
    it('rejects dimensional nonsense (missing / NaN field)', () => {
        expect(checkObjectPhysics(valid({ mass_kg: NaN })).violations).toContain('dimensional');
        const spec = valid(); delete (spec as Record<string, number>).yield_N;
        expect(checkObjectPhysics(spec).violations).toContain('dimensional');
    });
});
