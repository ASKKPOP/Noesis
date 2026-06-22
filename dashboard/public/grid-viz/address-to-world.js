/* Noēsis Grid-Viz — O4 street-view: address → world position.
 *
 * The civic spatial address is (ring, sector, level) [D-NH-10]:
 *   ring   — concentric radius, 0 = Government core, larger = farther out
 *   sector — angular position in DEGREES [0, 360)
 *   level  — vertical level (0 = ground)
 *
 * This maps that address to a Three.js ground position (x, y, z). Convention
 * (locked here so the 3D city is internally consistent):
 *   - radius  = ring * RING_SPACING
 *   - sector 0° = NORTH (−z), 90° = EAST (+x), 180° = SOUTH (+z), 270° = WEST (−x)
 *   - x =  radius * sin(θ),  z = −radius * cos(θ),  y = level * FLOOR_HEIGHT
 * Ring 0 sits at the origin regardless of sector (the core).
 */
const RING_SPACING = 40;   // world units between concentric rings
const FLOOR_HEIGHT = 6;    // world units per vertical level

function addressToWorld(addr) {
  const ring = Number(addr && addr.ring) || 0;
  const sector = Number(addr && addr.sector) || 0;
  const level = Number(addr && addr.level) || 0;
  const radius = ring * RING_SPACING;
  const theta = (sector * Math.PI) / 180;
  return {
    x: radius * Math.sin(theta),
    y: level * FLOOR_HEIGHT,
    z: -radius * Math.cos(theta),
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { addressToWorld, RING_SPACING, FLOOR_HEIGHT };
if (typeof window !== 'undefined') window.AddressToWorld = { addressToWorld, RING_SPACING, FLOOR_HEIGHT };
