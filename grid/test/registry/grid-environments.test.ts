import { describe, it, expect } from 'vitest';
import { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment } from '../../src/registry/grid-environments.js';

describe('GridEnvironment (grid-side)', () => {
    it('Genesis default is Earth-orbit with the expected params', () => {
        expect(EARTH_ORBIT.name).toBe('Earth-orbit');
        expect(EARTH_ORBIT).toBe(GRID_ENVIRONMENTS['Earth-orbit']);
        expect(EARTH_ORBIT.gravity_ms2).toBe(9.81);
        expect(EARTH_ORBIT.solar_constant_wm2).toBe(1361);
        expect(EARTH_ORBIT.orbital_ref_radius_km).toBe(6371);
        expect(EARTH_ORBIT.light_delay_ms).toBe(0);
        expect(EARTH_ORBIT.min_stable_altitude_km).toBe(160);
    });

    it('Moon and Mars are configs with distinct gravity and orbital floors', () => {
        expect(GRID_ENVIRONMENTS['Moon'].gravity_ms2).toBe(1.62);
        expect(GRID_ENVIRONMENTS['Moon'].min_stable_altitude_km).toBe(15);
        expect(GRID_ENVIRONMENTS['Mars'].gravity_ms2).toBe(3.71);
        expect(GRID_ENVIRONMENTS['Mars'].solar_constant_wm2).toBe(586);
        expect(GRID_ENVIRONMENTS['Mars'].light_delay_ms).toBeGreaterThan(0);
    });

    it('getEnvironment returns the named env, or Earth-orbit for unknown/undefined', () => {
        expect(getEnvironment('Moon').name).toBe('Moon');
        expect(getEnvironment('Nowhere')).toBe(EARTH_ORBIT);
        expect(getEnvironment(undefined)).toBe(EARTH_ORBIT);
    });

    it('environments are frozen (cannot be mutated by a consumer)', () => {
        expect(Object.isFrozen(EARTH_ORBIT)).toBe(true);
        expect(() => { (EARTH_ORBIT as unknown as { gravity_ms2: number }).gravity_ms2 = 0; }).toThrow();
    });
});
