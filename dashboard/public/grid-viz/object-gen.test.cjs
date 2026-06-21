/* Phase S2 — object generation tests (node:test). Run: node --test object-gen.test.cjs
 * The Nous "builds" a unique design from a physical spec; generate-once → atlas cache;
 * fal.ai is a stubbed hook, procedural is the always-working offline fallback. */
const test = require('node:test');
const assert = require('node:assert');
const Gen = require('./object-gen.js');

function spec(over = {}) {
  return Object.assign({
    fn: 'Energy', mass_kg: 1500, altitude_km: 420,
    generation_W: 400, consumption_W: 80, load_N: 260,
  }, over);
}

test('generate returns a complete design descriptor', () => {
  Gen._resetCache();
  const d = Gen.generate(spec());
  assert.strictEqual(typeof d.signature, 'string');
  assert.ok(d.signature.length > 0);
  assert.strictEqual(typeof d.source, 'string');
  assert.ok(Gen.GEO_BASES.includes(d.geoBase), 'geoBase is a known base');
  assert.strictEqual(typeof d.color, 'number');
  assert.strictEqual(typeof d.elongation, 'number');
  assert.strictEqual(Number.isInteger(d.detail), true);
  assert.strictEqual(Number.isInteger(d.secondary), true);
  assert.strictEqual(typeof d.antenna, 'boolean');
});

test('same spec is deterministic — identical design', () => {
  Gen._resetCache();
  const a = Gen.generate(spec());
  const b = Gen.generate(spec());
  assert.strictEqual(a.signature, b.signature);
  assert.strictEqual(a.geoBase, b.geoBase);
  assert.strictEqual(a.color, b.color);
});

test('different specs produce different signatures', () => {
  Gen._resetCache();
  const a = Gen.generate(spec({ fn: 'Energy', mass_kg: 1500 }));
  const b = Gen.generate(spec({ fn: 'Comms', mass_kg: 700 }));
  assert.notStrictEqual(a.signature, b.signature);
});

test('offline fallback: with fal disabled, source is procedural', () => {
  Gen._resetCache();
  Gen.setUseFal(false);
  const d = Gen.generate(spec());
  assert.strictEqual(d.source, 'procedural');
});

test('generate-once: second call for the same spec is a cache hit', () => {
  Gen._resetCache();
  Gen.generate(spec());
  const before = Gen.stats();
  const d = Gen.generate(spec());
  const after = Gen.stats();
  assert.strictEqual(d.cached, true);
  assert.strictEqual(after.cacheHits, before.cacheHits + 1);
  assert.strictEqual(after.generated, before.generated); // no new generation
});

test('buildPrompt includes the function and mass for the AI request', () => {
  const p = Gen.buildPrompt({ fn: 'Energy', mass_kg: 1500 });
  assert.match(p, /energy/i);
  assert.match(p, /1500/);
});

test('falGenerate returns null when disabled (offline-safe)', async () => {
  Gen.setUseFal(false);
  assert.strictEqual(await Gen.falGenerate({ fn: 'Energy', mass_kg: 1500 }), null);
});

test('falGenerate returns null when enabled but no key is set', async () => {
  Gen.setUseFal(true); Gen.setFalKey(null);
  assert.strictEqual(await Gen.falGenerate({ fn: 'Energy', mass_kg: 1500 }), null);
  Gen.setUseFal(false);
});

test('falGenerate returns a fal design when enabled with a key (mock fetch)', async () => {
  Gen.setUseFal(true); Gen.setFalKey('test-key');
  const mockFetch = async () => ({ json: async () => ({ images: [{ url: 'https://cdn/x.png' }] }) });
  const d = await Gen.falGenerate({ fn: 'Comms', mass_kg: 700 }, mockFetch);
  assert.strictEqual(d.source, 'fal');
  assert.strictEqual(d.spriteUrl, 'https://cdn/x.png');
  Gen.setUseFal(false); Gen.setFalKey(null);
});

test('design color belongs to the function family', () => {
  Gen._resetCache();
  const d = Gen.generate(spec({ fn: 'Energy' }));
  assert.strictEqual(typeof d.color, 'number');
  assert.ok(d.color >= 0 && d.color <= 0xffffff);
});
