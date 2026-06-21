/* Phase S2 — object generation.
 *
 * The Nous "builds" a UNIQUE functional object from a physical spec (already passed the
 * §S1 physics gate). Each design is generated once and cached in an atlas (generate-once
 * → reuse forever). fal.ai is a stubbed hook; procedural is the always-working offline
 * fallback so the scene runs with no network and no key.
 *
 * Dual export: CommonJS (node tests) + browser global (orbital.html classic-script load).
 */

const GEO_BASES = ['icosa', 'box', 'octa', 'sphere', 'torusknot', 'tetra', 'dodeca', 'cyl'];

/* function → colour family + preferred base forms (the Nous's learned vocabulary) */
const FN = {
  Compute:   { color: 0x7c9eff, bases: ['icosa', 'dodeca'] },
  Memory:    { color: 0x34d399, bases: ['box', 'cyl'] },
  Energy:    { color: 0xfbbf24, bases: ['octa', 'icosa'] },
  Comms:     { color: 0x38bdf8, bases: ['sphere', 'tetra'] },
  Fabricate: { color: 0xef6c4a, bases: ['torusknot', 'box'] },
  Sense:     { color: 0xec4899, bases: ['tetra', 'octa'] },
  Govern:    { color: 0xf472b6, bases: ['dodeca', 'sphere'] },
  Store:     { color: 0xffb86c, bases: ['cyl', 'box'] },
};

/* ---- deterministic PRNG so a spec always yields the same design ---- */
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function shade(hex, amt) {
  let r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
  return (r << 16) | (g << 8) | b;
}

/* stable design fingerprint for a spec (the atlas key) */
function signature(spec) {
  const q = (x, s) => Math.round((Number(x) || 0) * s);
  return [spec.fn, q(spec.mass_kg, 1), q(spec.altitude_km, 1), q(spec.generation_W, 1), q(spec.load_N, 1)].join('|');
}

function proceduralDesign(spec) {
  const sig = signature(spec);
  const rnd = mulberry32(hashStr(sig));
  const fam = FN[spec.fn] || FN.Compute;
  const geoBase = fam.bases[Math.floor(rnd() * fam.bases.length)];
  const massN = Math.max(0, Math.min(1, (Number(spec.mass_kg) || 1000) / 2000));
  return {
    source: 'procedural', signature: sig, geoBase,
    color: shade(fam.color, Math.round((rnd() - 0.5) * 40)),
    detail: rnd() > 0.55 ? 2 : 1,
    elongation: 0.85 + massN * 0.7 + (rnd() - 0.5) * 0.2,
    roughness: 0.25 + rnd() * 0.4,
    metalness: 0.2 + rnd() * 0.5,
    secondary: rnd() > 0.6 ? (rnd() > 0.5 ? 2 : 1) : 0,
    antenna: rnd() > 0.68,
  };
}

/* ---- fal.ai hook (STUB) ----
 * Real impl: POST a prompt built from the spec to fal.ai, receive an isometric/ortho
 * sprite, return { source:'fal', signature, spriteUrl, ...visual params }. Until a key
 * is wired, returns null and we fall back to procedural — the scene stays fully working. */
let USE_FAL = false;
let FAL_KEY_OVERRIDE = null;

// Prompt sent to fal.ai, derived from the (physics-passed) spec.
function buildPrompt(spec) {
  return `isometric low-poly ${String(spec.fn).toLowerCase()} space module, functional orbital satellite, `
    + `${Math.round(spec.mass_kg)}kg, clean sci-fi, single centered object, transparent background`;
}
// The API key is NEVER hard-coded. It comes from the operator: setFalKey(), or localStorage
// ('noesis:fal-key'), or window.__FAL_KEY. No key → fal stays off and procedural runs.
function setFalKey(k) { FAL_KEY_OVERRIDE = k || null; }
function getFalKey() {
  if (FAL_KEY_OVERRIDE) return FAL_KEY_OVERRIDE;
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem('noesis:fal-key')) return localStorage.getItem('noesis:fal-key'); } catch (e) {}
  if (typeof window !== 'undefined' && window.__FAL_KEY) return window.__FAL_KEY;
  return null;
}
function falEnabled() { return USE_FAL && !!getFalKey(); }

// Async — asks fal.ai for a sprite for this spec. Returns { source, signature, spriteUrl } or null.
// Returns null (→ procedural fallback) whenever fal is off or no key is set, so the scene never breaks.
async function falGenerate(spec, fetchImpl) {
  if (!USE_FAL) return null;
  const key = getFalKey(); if (!key) return null;
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null); if (!f) return null;
  const model = (typeof window !== 'undefined' && window.__FAL_MODEL) || 'fal-ai/flux/schnell';
  try {
    const res = await f(`https://fal.run/${model}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildPrompt(spec), image_size: 'square' }),
    });
    const data = await res.json();
    const url = data && data.images && data.images[0] && data.images[0].url;
    if (!url) return null;
    return { source: 'fal', signature: signature(spec), spriteUrl: url };
  } catch (e) { return null; }
}

/* ---- atlas cache (generate-once → reuse) ---- */
const ATLAS_KEY = 'noesis:grid-viz:object-atlas:v1';
function loadAtlas() { try { return JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(ATLAS_KEY)) || '{}'); } catch (e) { return {}; } }
function saveAtlas(a) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(ATLAS_KEY, JSON.stringify(a)); } catch (e) {} }
let ATLAS = loadAtlas();
let generated = 0, cacheHits = 0;

function generate(spec) {
  const sig = signature(spec);
  if (ATLAS[sig]) { cacheHits++; return Object.assign({}, ATLAS[sig], { cached: true }); }
  const design = proceduralDesign(spec);   // sync path; fal is an async enhancement (see falGenerate)
  design.cached = false;
  ATLAS[sig] = design; saveAtlas(ATLAS); generated++;
  return design;
}

function _resetCache() { ATLAS = {}; saveAtlas(ATLAS); generated = 0; cacheHits = 0; }
function setUseFal(v) { USE_FAL = !!v; }
function stats() { return { generated, cacheHits, atlasSize: Object.keys(ATLAS).length }; }

const objectGenApi = { generate, signature, proceduralDesign, _resetCache, setUseFal, stats, GEO_BASES, buildPrompt, falGenerate, setFalKey, getFalKey, falEnabled };
if (typeof module !== 'undefined' && module.exports) module.exports = objectGenApi;
if (typeof window !== 'undefined') window.ObjectGen = objectGenApi;
