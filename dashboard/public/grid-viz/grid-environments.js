/* F0 — GridEnvironment: where a Grid physically is.
 *
 * The foundation that keeps Noesis from being placeless. Every Grid runs in a
 * named celestial environment; physics laws read these parameters so the same
 * object spec is judged by the body it lives on. Genesis ships as Earth-orbit;
 * Moon and Mars are configs here, not rewrites.
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.html classic script).
 *
 * Fields (SI unless noted):
 *   name                   config key / human label
 *   gravity_ms2            surface gravity
 *   solar_constant_wm2     mean solar irradiance at the body's distance
 *   orbital_ref_radius_km  radius of the reference body (altitude is measured above its surface)
 *   light_delay_ms         one-way signal delay to Earth (cross-grid state is eventually-consistent)
 *   min_stable_altitude_km lowest altitude that can hold an orbit (atmospheric-decay / terrain floor)
 */

const GRID_ENVIRONMENTS = {
  'Earth-orbit': {
    name: 'Earth-orbit',
    gravity_ms2: 9.81,
    solar_constant_wm2: 1361,
    orbital_ref_radius_km: 6371,
    light_delay_ms: 0,
    min_stable_altitude_km: 160,
  },
  'Moon': {
    name: 'Moon',
    gravity_ms2: 1.62,
    solar_constant_wm2: 1361,
    orbital_ref_radius_km: 1737,
    light_delay_ms: 1260,
    min_stable_altitude_km: 15,
  },
  'Mars': {
    name: 'Mars',
    gravity_ms2: 3.71,
    solar_constant_wm2: 586,
    orbital_ref_radius_km: 3390,
    light_delay_ms: 180000,
    min_stable_altitude_km: 90,
  },
};

/* Genesis Grid ships in Earth-orbit. */
const EARTH_ORBIT = GRID_ENVIRONMENTS['Earth-orbit'];

/* Resolve an environment by name; unknown / missing names fall back to Genesis. */
function getEnvironment(name) {
  return GRID_ENVIRONMENTS[name] || EARTH_ORBIT;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment };
if (typeof window !== 'undefined') window.GridEnvironments = { GRID_ENVIRONMENTS, EARTH_ORBIT, getEnvironment };
