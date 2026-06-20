/* Phase S4 — zone simulation tests (node:test). Run: node --test simulate.test.cjs
 * A zone's modules exchange energy for one tick; the sim conserves energy
 * (never serves more than is produced) and reports powered vs brownout. */
const test = require('node:test');
const assert = require('node:assert');
const { simulateZone } = require('./simulate.js');

const producer = (over = {}) => Object.assign({ fn: 'Energy', generation_W: 400, consumption_W: 80, dissipated_W: 120 }, over);
const consumer = (over = {}) => Object.assign({ fn: 'Compute', generation_W: 0, consumption_W: 200, dissipated_W: 90 }, over);

test('reports inflow, demand and surplus for a zone', () => {
  const r = simulateZone([producer(), consumer()]);
  assert.strictEqual(r.inflow, 400);
  assert.strictEqual(r.demand, 80 + 120 + 200 + 90); // consumption + dissipation of both
  assert.strictEqual(r.surplus, r.inflow - r.demand);
});

test('a well-supplied zone is powered', () => {
  const r = simulateZone([producer(), producer(), consumer()]);
  assert.ok(r.surplus >= 0);
  assert.strictEqual(r.status, 'powered');
});

test('an under-supplied zone browns out', () => {
  const r = simulateZone([producer({ generation_W: 100 }), consumer(), consumer()]);
  assert.ok(r.surplus < 0);
  assert.strictEqual(r.status, 'brownout');
});

test('conservation: served energy never exceeds produced energy', () => {
  const r = simulateZone([producer({ generation_W: 100 }), consumer(), consumer()]); // deficit
  assert.ok(r.served <= r.inflow + 1e-9, `served ${r.served} > inflow ${r.inflow}`);
  assert.strictEqual(r.conserved, true);
});

test('adding a generator increases inflow', () => {
  const base = simulateZone([producer(), consumer()]);
  const more = simulateZone([producer(), producer(), consumer()]);
  assert.ok(more.inflow > base.inflow);
});

test('an empty zone is trivially conserved and powered', () => {
  const r = simulateZone([]);
  assert.strictEqual(r.inflow, 0);
  assert.strictEqual(r.demand, 0);
  assert.strictEqual(r.conserved, true);
});
