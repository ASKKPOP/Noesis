/* O4 — address→world mapping tests (node:test). Run: node --test address-to-world.test.cjs */
const test = require('node:test');
const assert = require('node:assert');
const { addressToWorld, RING_SPACING, FLOOR_HEIGHT } = require('./address-to-world.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test('ring 0 is the origin (the core), regardless of sector', () => {
  for (const sector of [0, 45, 90, 180, 270]) {
    const p = addressToWorld({ ring: 0, sector, level: 0 });
    near(p.x, 0); near(p.y, 0); near(p.z, 0);
  }
});

test('sector 0° is North (−z) at one ring out', () => {
  const p = addressToWorld({ ring: 1, sector: 0, level: 0 });
  near(p.x, 0); near(p.z, -RING_SPACING);
});

test('sector 90° is East (+x)', () => {
  const p = addressToWorld({ ring: 1, sector: 90, level: 0 });
  near(p.x, RING_SPACING); near(p.z, 0);
});

test('sector 180° is South (+z) and 270° is West (−x)', () => {
  const s = addressToWorld({ ring: 1, sector: 180, level: 0 });
  near(s.z, RING_SPACING); near(s.x, 0);
  const w = addressToWorld({ ring: 1, sector: 270, level: 0 });
  near(w.x, -RING_SPACING); near(w.z, 0);
});

test('radius scales with ring; level scales y', () => {
  const p = addressToWorld({ ring: 5, sector: 90, level: 2 });
  near(p.x, 5 * RING_SPACING);
  near(p.y, 2 * FLOOR_HEIGHT);
});

test('missing/garbage fields default to the origin (never NaN)', () => {
  const p = addressToWorld({});
  near(p.x, 0); near(p.y, 0); near(p.z, 0);
  const q = addressToWorld(null);
  near(q.x, 0); near(q.y, 0); near(q.z, 0);
});
