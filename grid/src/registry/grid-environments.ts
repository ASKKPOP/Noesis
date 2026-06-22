/**
 * GridEnvironment (grid-side) — where a Grid physically is.
 *
 * The authoritative server-side copy of the celestial-environment data. Mirrors
 * the browser module `dashboard/public/grid-viz/grid-environments.js` (a different
 * runtime with no shared module system); the values MUST stay in sync. Genesis
 * ships as Earth-orbit; Moon and Mars are configs here, not rewrites.
 *
 * Fields (SI unless noted):
 *   name                   config key / human label
 *   gravity_ms2            surface gravity
 *   solar_constant_wm2     mean solar irradiance at the body's distance
 *   orbital_ref_radius_km  radius of the reference body (altitude measured above its surface)
 *   light_delay_ms         one-way signal delay to Earth (cross-grid state is eventually-consistent)
 *   min_stable_altitude_km lowest altitude that can hold an orbit (atmospheric-decay / terrain floor)
 */
export interface GridEnvironment {
    readonly name: string;
    readonly gravity_ms2: number;
    readonly solar_constant_wm2: number;
    readonly orbital_ref_radius_km: number;
    readonly light_delay_ms: number;
    readonly min_stable_altitude_km: number;
}

export const GRID_ENVIRONMENTS: Readonly<Record<string, GridEnvironment>> = Object.freeze({
    'Earth-orbit': Object.freeze({
        name: 'Earth-orbit', gravity_ms2: 9.81, solar_constant_wm2: 1361,
        orbital_ref_radius_km: 6371, light_delay_ms: 0, min_stable_altitude_km: 160,
    }),
    'Moon': Object.freeze({
        name: 'Moon', gravity_ms2: 1.62, solar_constant_wm2: 1361,
        orbital_ref_radius_km: 1737, light_delay_ms: 1282, min_stable_altitude_km: 15,
    }),
    'Mars': Object.freeze({
        name: 'Mars', gravity_ms2: 3.71, solar_constant_wm2: 586,
        orbital_ref_radius_km: 3390, light_delay_ms: 180000, min_stable_altitude_km: 100,
    }),
});

/** Genesis Grid ships in Earth-orbit. */
export const EARTH_ORBIT: GridEnvironment = GRID_ENVIRONMENTS['Earth-orbit'];

/** Resolve an environment by name; unknown / missing names fall back to Genesis. */
export function getEnvironment(name: string | undefined): GridEnvironment {
    return (name !== undefined && GRID_ENVIRONMENTS[name]) || EARTH_ORBIT;
}
