/* Noēsis Grid-Viz — building factory.
 *
 * This is the "most objects differ" + "Nous builds with AI" core.
 *  - Procedural generation gives every parcel a UNIQUE building descriptor today (offline, free).
 *  - falGenerate() is the STUB hook for real AI sprite generation (fal.ai). Flip USE_FAL on
 *    and fill in your key to make each building an AI-made isometric sprite.
 *  - Every result is cached in an atlas (localStorage) keyed by parcel → generate-once, reuse forever.
 */

/* ----- toggle this on once you wire fal.ai (see falGenerate below) ----- */
const USE_FAL = false;

/* ---------- deterministic PRNG so a parcel always looks the same ---------- */
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- atlas cache (generate-once → reuse) ---------- */
const ATLAS_KEY = 'noesis:grid-viz:atlas:v1';
function loadAtlas() { try { return JSON.parse(localStorage.getItem(ATLAS_KEY) || '{}'); } catch (e) { return {}; } }
function saveAtlas(a) { try { localStorage.setItem(ATLAS_KEY, JSON.stringify(a)); } catch (e) { /* file:// may block; in-memory only */ } }
let ATLAS = loadAtlas();

/* ---------- colour helpers ---------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ---------- procedural descriptor: the variety engine ---------- */
function proceduralBuilding(zone, key) {
  const rnd = mulberry32(hashStr(key));
  const heightMul = 0.6 + rnd() * 1.4;               // wide spread → most differ
  const roof = shade(zone.color, Math.round((rnd() - 0.5) * 36)); // hue/levelity jitter
  return {
    source: 'procedural',
    height: zone.baseHeight * heightMul,
    inset: 0.62 + rnd() * 0.22,
    roof,
    body: shade(roof, -46),
    bodyDark: shade(roof, -78),
    antenna: rnd() > 0.72,
    setback: rnd() > 0.55 ? 0.55 + rnd() * 0.25 : 0,  // optional second stacked box
    setbackH: 0.3 + rnd() * 0.5,
  };
}

/* ---------- AI hook (STUB) ----------
 * Real implementation: POST a prompt built from the zone + style seed to fal.ai,
 * receive an isometric sprite PNG, store its dataURL on the descriptor, cache it.
 * Until then this returns null and we fall back to procedural — the app stays fully working.
 */
async function falGenerate(zone, key, styleSeed) {
  if (!USE_FAL) return null;
  // const prompt = `${styleSeed}, isometric ${zone.name.toLowerCase()} building, game sprite, transparent bg`;
  // const res = await fetch('https://fal.run/fal-ai/<model>', {
  //   method: 'POST',
  //   headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ prompt }),
  // });
  // const { images } = await res.json();
  // return { source: 'fal', spriteUrl: images[0].url };
  return null;
}

/* ---------- public API ---------- */
const Buildings = {
  styleSeed: 'clean low-poly civic architecture, soft daylight',

  /* Returns a building descriptor for a parcel, from cache or freshly generated. */
  async get(zone, key) {
    if (ATLAS[key]) return ATLAS[key];
    let desc = await falGenerate(zone, key, this.styleSeed);
    if (!desc) desc = proceduralBuilding(zone, key);   // graceful fallback
    ATLAS[key] = desc;
    saveAtlas(ATLAS);
    return desc;
  },

  /* Synchronous read for the render loop (descriptors are tiny + cached). */
  getSync(zone, key) {
    if (!ATLAS[key]) { ATLAS[key] = proceduralBuilding(zone, key); }
    return ATLAS[key];
  },

  catalogSize() { return Object.keys(ATLAS).length; },
  reset() { ATLAS = {}; saveAtlas(ATLAS); },
};
