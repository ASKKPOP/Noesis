/* Noēsis Grid-Viz — ORBITAL scene.
 * Off-Earth: a central Grid core in orbit above Earth, 6 zones as orbital station-nodes,
 * and FUNCTIONAL objects the Nous learns to build (shape encodes function, not decoration).
 *
 * Zone IDs stay canonical (D-V3-32 frozen). Display labels are demo-only (Nous-defined later).
 */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const errEl = document.getElementById('loaderr');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true, alpha: true }); }
catch (e) { errEl.style.display = 'flex'; throw e; }

/* ---------------- zones (canonical id ↔ demo label) ---------------- */
const ZONES = [
  { id: 'business',           label: 'BUSINESS',        color: 0xf5a623, angle: 0 },
  { id: 'manufacture',        label: 'MANUFACTURE',     color: 0xef6c4a, angle: 60 },
  { id: 'government_quarter', label: 'GOVERNMENT CORE', color: 0xfbbf24, angle: 120 },
  { id: 'shopping',           label: 'SHOPPING',        color: 0xec4899, angle: 180 },
  { id: 'infrastructure',     label: 'COMMONS',         color: 0x38bdf8, angle: 240 }, // canonical: infrastructure
  { id: 'residential',        label: 'RESIDENTIAL',     color: 0x34d399, angle: 300 },
];

/* ---------------- functional object types (Nous builds these) ---------------- */
const FUNCTIONS = [
  { fn: 'Compute',   geo: 'icosa',     color: 0x7c9eff },
  { fn: 'Memory',    geo: 'box',       color: 0x34d399 },
  { fn: 'Energy',    geo: 'octa',      color: 0xfbbf24 },
  { fn: 'Comms',     geo: 'sphere',    color: 0x38bdf8 },
  { fn: 'Fabricate', geo: 'torusknot', color: 0xef6c4a },
  { fn: 'Sense',     geo: 'tetra',     color: 0xec4899 },
  { fn: 'Govern',    geo: 'dodeca',    color: 0xf472b6 },
  { fn: 'Store',     geo: 'cyl',       color: 0xffb86c },
];

/* Physical base spec per function (SI, one cycle). All pass the §S1 physics gate;
 * jittered per build so objects differ while staying physical. */
const FN_BASE = {
  Compute:   { gen: 140, con: 120, dis: 90,  rad: 130, load: 200, yld: 600, mass: 1200 },
  Memory:    { gen: 60,  con: 40,  dis: 30,  rad: 60,  load: 150, yld: 500, mass: 900 },
  Energy:    { gen: 400, con: 80,  dis: 120, rad: 200, load: 260, yld: 700, mass: 1500 },
  Comms:     { gen: 90,  con: 70,  dis: 50,  rad: 90,  load: 120, yld: 450, mass: 700 },
  Fabricate: { gen: 220, con: 200, dis: 160, rad: 240, load: 320, yld: 800, mass: 1800 },
  Sense:     { gen: 70,  con: 55,  dis: 35,  rad: 70,  load: 110, yld: 400, mass: 600 },
  Govern:    { gen: 110, con: 90,  dis: 60,  rad: 110, load: 180, yld: 520, mass: 1000 },
  Store:     { gen: 80,  con: 50,  dis: 40,  rad: 80,  load: 200, yld: 560, mass: 1100 },
};
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function makeSpec(type, rnd = Math.random) {
  const b = FN_BASE[type.fn] || FN_BASE.Compute;
  const j = (x, f) => x * (1 + (rnd() - 0.5) * f);
  return {
    fn: type.fn, mass_kg: j(b.mass, 0.3),
    massIn_kg: 10, massOut_kg: 10,
    energyIn_J: 1000, energyOut_J: j(900, 0.08),
    load_N: j(b.load, 0.18), yield_N: b.yld,
    dissipated_W: b.dis, radiated_W: j(b.rad, 0.06),
    generation_W: b.gen, consumption_W: j(b.con, 0.06),
    altitude_km: 380 + rnd() * 140,
  };
}

/* ---------------- scene / camera / controls ---------------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(6, 32, 162);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.target.set(0, 6, 0); controls.minDistance = 60; controls.maxDistance = 360;

scene.add(new THREE.AmbientLight(0x5566aa, 0.7));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.6); sun.position.set(80, 60, 120); scene.add(sun);
scene.add(new THREE.HemisphereLight(0x335577, 0x110a14, 0.5));

/* ---------------- starfield ---------------- */
(function stars() {
  const g = new THREE.BufferGeometry(), n = 1400, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = 700 + Math.random() * 600, t = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
    p[i*3] = r*Math.sin(ph)*Math.cos(t); p[i*3+1] = r*Math.sin(ph)*Math.sin(t); p[i*3+2] = r*Math.cos(ph); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb0d8, size: 1.1, sizeAttenuation: false })));
})();

/* ---------------- Earth (backdrop only) ---------------- */
(function earth() {
  const R = 78, c = new THREE.Vector3(8, -104, -30);
  const surf = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x10243f, roughness: 1, metalness: 0, emissive: 0x06121f, emissiveIntensity: 0.5 }));
  surf.position.copy(c); scene.add(surf);
  // atmosphere fresnel glow
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 64), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(0x4a86d6) } },
    vertexShader: `varying float i; void main(){ vec3 n=normalize(normalMatrix*normal); vec3 e=normalize(normalMatrix*vec3(0.,0.,1.));
      i=pow(1.0-abs(dot(n,e)),2.4); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float i; uniform vec3 c; void main(){ gl_FragColor=vec4(c, i*0.9); }`,
  }));
  atm.position.copy(c); scene.add(atm);
})();

/* ---------------- central Grid core (the seed) ---------------- */
const coreGroup = new THREE.Group(); scene.add(coreGroup);
(function core() {
  // inner glowing seed (egg)
  const seed = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x1c3a32, emissive: 0x2fd6a0, emissiveIntensity: 0.5, roughness: 0.4 }));
  seed.scale.set(1, 1.35, 1); seed.position.y = 6; coreGroup.add(seed);
  // geodesic wireframe shell
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(11, 2),
    new THREE.MeshBasicMaterial({ color: 0x6fe3c0, wireframe: true, transparent: true, opacity: 0.5 }));
  shell.scale.set(1, 1.35, 1); shell.position.y = 6; coreGroup.add(shell);
  // base platform
  const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x161821, metalness: 0.6, roughness: 0.5 }));
  base.position.y = -5; coreGroup.add(base);
  coreGroup.userData = { kind: 'core', title: 'Genesis Grid Core', rows: [['type', 'civic seed'], ['polis', 'Genesis Polis']] };
})();

/* ---------------- orbital rings ---------------- */
function ring(radius, color, rotX, rotZ, op) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 8, 160),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op }));
  m.rotation.x = Math.PI / 2 + rotX; m.rotation.z = rotZ; m.position.y = 6; scene.add(m); return m;
}
ring(46, 0x2f8f86, 0, 0, 0.55);
ring(60, 0x3a6ea8, 0.5, 0.25, 0.4);
ring(60, 0x8a5a3a, -0.45, -0.5, 0.4);

/* ---------------- zone nodes + labels ---------------- */
const RZ = 46, interactive = [];
const labelsEl = document.getElementById('labels');
const zoneGroup = new THREE.Group(); zoneGroup.position.y = 6; scene.add(zoneGroup);

ZONES.forEach(z => {
  const a = z.angle * Math.PI / 180;
  const pos = new THREE.Vector3(Math.cos(a) * RZ, 0, Math.sin(a) * RZ);
  const node = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1),
    new THREE.MeshStandardMaterial({ color: z.color, emissive: z.color, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }));
  node.position.copy(pos); zoneGroup.add(node);
  // little spoke to core
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, RZ, 6),
    new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.3 }));
  spoke.position.copy(pos.clone().multiplyScalar(0.5));
  spoke.lookAt(0, 0, 0); spoke.rotateX(Math.PI / 2); zoneGroup.add(spoke);

  const el = document.createElement('div'); el.className = 'zone-label'; el.textContent = z.label;
  const hex = '#' + z.color.toString(16).padStart(6, '0');
  el.style.borderColor = hex; el.style.color = hex; el.style.boxShadow = `0 0 16px ${hex}55`;
  labelsEl.appendChild(el);
  node.userData = { kind: 'zone', title: z.label, el, color: z.color, zoneId: z.id,
    rows: [['canonical id', z.id], ['role', 'orbital station-node'], ['governance', 'Genesis Polis']] };
  interactive.push(node);
  z._node = node; z._el = el;
});

/* ---------------- functional objects (Nous-built) ---------------- */
const ringDefs = [
  { R: 46, rx: 0, rz: 0 }, { R: 60, rx: 0.5, rz: 0.25 }, { R: 60, rx: -0.45, rz: -0.5 },
];
const orbiters = [];
const objCountEl = document.getElementById('obj-count');
const rejCountEl = document.getElementById('rej-count');
let rejectedCount = 0;

// Build the mesh from a Nous-generated DESIGN (Phase S2) — geometry, colour, elongation,
// secondary modules and antenna all come from the generated descriptor, so each is unique.
function makeShape(design) {
  const c = design.color, d = design.detail;
  let geo;
  switch (design.geoBase) {
    case 'box': geo = new THREE.BoxGeometry(2.4, 2.4, 2.4); break;
    case 'octa': geo = new THREE.OctahedronGeometry(1.7, Math.max(0, d - 1)); break;
    case 'sphere': geo = new THREE.SphereGeometry(1.6, 10 + d * 4, 10 + d * 4); break;
    case 'torusknot': geo = new THREE.TorusKnotGeometry(1.1, 0.4, 64, 8); break;
    case 'tetra': geo = new THREE.TetrahedronGeometry(1.9); break;
    case 'dodeca': geo = new THREE.DodecahedronGeometry(1.7, Math.max(0, d - 1)); break;
    case 'cyl': geo = new THREE.CylinderGeometry(1.2, 1.2, 2.6, 10); break;
    default: geo = new THREE.IcosahedronGeometry(1.7, d);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: c, emissive: c, emissiveIntensity: 0.25, roughness: design.roughness, metalness: design.metalness }));
  mesh.scale.y = design.elongation;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.5, 10, 10),
    new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.32 }));
  const g = new THREE.Group(); g.add(mesh); g.add(halo);
  for (let i = 0; i < design.secondary; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.2, roughness: design.roughness, metalness: design.metalness }));
    s.position.set((i ? 1 : -1) * 1.9, 1.3, 0); g.add(s);
  }
  if (design.antenna) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), new THREE.MeshBasicMaterial({ color: 0xcfcfd6 }));
    ant.position.y = 2.3; g.add(ant);
  }
  addFunctionDetail(g, design.fn, design.color);
  return { g, mesh };
}

// Function-specific adornments — richer, recognisable module silhouettes.
function addFunctionDetail(g, fn, c) {
  const mat = (col, opts) => new THREE.MeshStandardMaterial(Object.assign({ color: col, emissive: col, emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.4 }, opts || {}));
  if (fn === 'Energy') {                          // solar panels on arms
    [-1, 1].forEach(s => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.6), mat(0x1b3a6b, { emissive: 0x2b5fb0, emissiveIntensity: 0.5 }));
      panel.position.set(s * 3.0, 0, 0); g.add(panel);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), new THREE.MeshBasicMaterial({ color: 0x8899aa }));
      arm.rotation.z = Math.PI / 2; arm.position.set(s * 1.6, 0, 0); g.add(arm);
    });
  } else if (fn === 'Comms') {                    // dish + stem
    const dish = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 20, 1, true), mat(0xcfd8e6, { side: THREE.DoubleSide, emissiveIntensity: 0.1 }));
    dish.position.y = 2.5; dish.rotation.x = Math.PI; g.add(dish);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xaab4c4 }));
    stem.position.y = 1.8; g.add(stem);
  } else if (fn === 'Sense') {                    // sensor spikes
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.5, 6), mat(c));
      spike.position.set(Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9);
      spike.rotation.z = -Math.cos(a) * 0.7; spike.rotation.x = Math.sin(a) * 0.7; g.add(spike);
    }
  } else if (fn === 'Fabricate') {                // assembly ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 32), mat(c, { emissiveIntensity: 0.45 }));
    ring.rotation.x = Math.PI / 2.4; g.add(ring);
  } else if (fn === 'Store' || fn === 'Memory') { // banded tanks / banks
    [-0.9, 0.9].forEach(y => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 8, 24), mat(c, { emissiveIntensity: 0.3 }));
      band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band);
    });
  }
}

const cacheCountEl = document.getElementById('cache-count');
const genCountEl = document.getElementById('gen-count');
const bestFitEl = document.getElementById('best-fit');
const orbiterMeshes = new Set();   // tracks which interactive entries are functional objects
// Functional zoning: producers (Energy) cluster in infrastructure, consumers (Compute/Fabricate)
// in their districts — so zones specialize and genuinely TRADE energy (surplus → deficit flows).
const FN_ZONE = {
  Energy: 'infrastructure', Comms: 'infrastructure',
  Compute: 'government_quarter', Govern: 'government_quarter',
  Fabricate: 'manufacture', Store: 'shopping', Memory: 'business', Sense: 'residential',
};

// ── §S2+ fal.ai sprite enhancement (dormant unless ObjectGen.falEnabled()) ──
// Procedural mesh shows instantly; if fal is on + keyed, an AI sprite swaps in when ready.
const texLoader = new THREE.TextureLoader();
function applySprite(o, url) {
  if (!o || !url) return;
  texLoader.load(url, (tex) => {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(6, 6, 1);
    o.mesh.visible = false;          // hide the procedural body, keep halo for glow
    o.g.add(spr); o.sprite = spr;
  });
}
function maybeEnhance(o) {
  if (!o || !window.ObjectGen.falEnabled()) return;   // off by default → no network, no key
  window.ObjectGen.falGenerate(o.spec).then(d => { if (d && d.spriteUrl) applySprite(o, d.spriteUrl); }).catch(() => {});
}

// Place an object FROM A GIVEN SPEC (gate → generate design → mesh). Returns the orbiter or null.
function placeObject(spec, type, ringIdx, angle, rnd = Math.random, generation = 0) {
  // ── §S1 PHYSICS GATE ── no object is ever shown ungated.
  const gate = window.PhysicsGate.checkPhysics(spec);
  if (!gate.ok) { rejectedCount++; rejCountEl.textContent = rejectedCount; return null; }
  // ── §S2 NOUS BUILDS THE DESIGN ── generate-once, atlas-cached.
  const design = window.ObjectGen.generate(spec);
  design.fn = type.fn;                              // for function-specific adornments
  const rd = ringDefs[ringIdx];
  const { g, mesh } = makeShape(design);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6),
    new THREE.MeshBasicMaterial({ color: design.color, transparent: true, opacity: 0.5 }));
  stalk.position.y = -3.5; g.add(stalk);

  const holder = new THREE.Group();
  holder.rotation.x = Math.PI / 2 + rd.rx; holder.rotation.z = rd.rz; holder.position.y = 6;
  scene.add(holder);
  const o = { holder, g, mesh, type, spec, generation, ringIdx, R: rd.R, angle,
    zoneId: FN_ZONE[type.fn] || ZONES[orbiters.length % ZONES.length].id,
    spin: 0.003 + rnd() * 0.01, orbit: 0.0012 + rnd() * 0.0016, born: orbiters.length };
  g.userData = { kind: 'obj', title: `${type.fn} module · gen ${generation}`, color: design.color,
    rows: [['function', type.fn], ['form', design.geoBase],
           ['generation', `${generation}`],
           ['fitness', window.Learn.fitness(spec).toFixed(1)],
           ['mass', `${Math.round(spec.mass_kg)} kg`],
           ['altitude', `${Math.round(spec.altitude_km)} km`],
           ['physics', `✓ passed (${window.PhysicsGate.REQUIRED.length} checks)`],
           ['design', `${design.source}${design.cached ? ' · cached' : ' · new'}`],
           ['built by', 'Nous']] };
  holder.add(g);
  orbiters.push(o); interactive.push(mesh); orbiterMeshes.add(mesh);
  objCountEl.textContent = orbiters.length;
  cacheCountEl.textContent = window.ObjectGen.stats().cacheHits;
  maybeEnhance(o);                 // fal.ai sprite swap-in (no-op unless enabled + keyed)
  return o;
}

function buildObject(type, ringIdx, angle, rnd = Math.random) {
  type = type || FUNCTIONS[Math.floor(rnd() * FUNCTIONS.length)];
  ringIdx = ringIdx ?? Math.floor(rnd() * ringDefs.length);
  angle = angle ?? rnd() * Math.PI * 2;
  return placeObject(makeSpec(type, rnd), type, ringIdx, angle, rnd, 0);
}

// seed the scene with a DETERMINISTIC fleet — so a reload hits the atlas cache (generate-once).
for (let i = 0; i < 22; i++) {
  buildObject(FUNCTIONS[i % FUNCTIONS.length], i % ringDefs.length, (i / 22) * Math.PI * 2, mulberry32(4100 + i));
}

// ── §S3 LEARNING LOOP ── evaluate fitness, keep the fittest, breed specialized (gated) variants.
function refreshBestFit() {
  if (orbiters.length) bestFitEl.textContent = Math.max(...orbiters.map(o => window.Learn.fitness(o.spec))).toFixed(1);
}
refreshBestFit();

// ── §S4+ ANIMATED RESOURCE FLOWS ── pulses travel from surplus zones to deficit zones.
const flowGroup = new THREE.Group(); scene.add(flowGroup);
let flowPulses = [];
function zoneWorldPos(zoneId) {
  const z = ZONES.find(zz => zz.id === zoneId); if (!z) return null;
  const v = new THREE.Vector3(); z._node.getWorldPosition(v); return v;
}
function rebuildFlows() {
  while (flowGroup.children.length) flowGroup.remove(flowGroup.children[0]);
  flowPulses = [];
  const states = ZONES.map(z => ({
    zoneId: z.id,
    surplus: window.Simulate.simulateZone(orbiters.filter(o => o.zoneId === z.id).map(o => o.spec)).surplus,
  }));
  window.Simulate.computeFlows(states).forEach(e => {
    const from = zoneWorldPos(e.from), to = zoneWorldPos(e.to); if (!from || !to) return;
    const col = (ZONES.find(z => z.id === e.from) || {}).color || 0xffffff;
    flowGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]),
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.16 })));
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
    flowGroup.add(pulse);
    flowPulses.push({ from, to, mesh: pulse, t: Math.random(), speed: 0.004 + Math.random() * 0.004 });
  });
}
rebuildFlows();

function evolveGeneration() {
  if (!window.Learn || !orbiters.length) return;
  const pop = orbiters.map(o => ({ spec: o.spec, generation: o.generation, fitness: window.Learn.fitness(o.spec) }));
  const result = window.Learn.evolve(pop, { niche: true, keep: Math.ceil(pop.length / 2), size: pop.length, rnd: Math.random });
  // tear down the current fleet (scene + interactive)
  orbiters.forEach(o => scene.remove(o.holder));
  for (let i = interactive.length - 1; i >= 0; i--) if (orbiterMeshes.has(interactive[i])) interactive.splice(i, 1);
  orbiterMeshes.clear(); orbiters.length = 0;
  // rebuild from the evolved population
  result.population.forEach((ind, i) => {
    const t = FUNCTIONS.find(f => f.fn === ind.spec.fn) || FUNCTIONS[0];
    placeObject(ind.spec, t, i % ringDefs.length, (i / result.population.length) * Math.PI * 2, Math.random, ind.generation);
  });
  genCountEl.textContent = result.generation;
  bestFitEl.textContent = result.best.toFixed(1);
  rebuildFlows();
}

// ── §S5 TEACHING / TRANSFER ── export the learned population, seed a NEW Grid from it.
let gridSeq = 1;
function teachNewGrid() {
  if (!window.Teaching || !orbiters.length) return;
  const pack = window.Teaching.exportPopulation(
    orbiters.map(o => ({ spec: o.spec, generation: o.generation, fitness: window.Learn.fitness(o.spec) })),
    { grid: 'genesis' });
  try { localStorage.setItem('noesis:grid-viz:knowledge-pack', JSON.stringify(pack)); } catch (e) {}
  const imp = window.Teaching.importPopulation(pack);     // re-gated on import
  // tear down the current fleet
  orbiters.forEach(o => scene.remove(o.holder));
  for (let i = interactive.length - 1; i >= 0; i--) if (orbiterMeshes.has(interactive[i])) interactive.splice(i, 1);
  orbiterMeshes.clear(); orbiters.length = 0;
  // seed the NEW Grid from the learned population (not from zero)
  gridSeq++;
  imp.accepted.forEach((ind, i) => {
    const t = FUNCTIONS.find(f => f.fn === ind.spec.fn) || FUNCTIONS[0];
    placeObject(ind.spec, t, i % ringDefs.length, (i / imp.accepted.length) * Math.PI * 2, Math.random, ind.generation);
  });
  genCountEl.textContent = imp.generation; refreshBestFit(); rebuildFlows();
  const sub = document.querySelector('header .sub');
  if (sub) sub.textContent = `Grid-0${gridSeq} (taught) · seeded from Genesis · Noēsis-space`;
  const s = window.Teaching.summary(pack);
  showInfo({ title: `Taught → Grid-0${gridSeq}`, kind: 'obj', rows: [
    ['seeded from', `Genesis · gen ${imp.generation}`],
    ['modules', `${imp.accepted.length}`],
    ['functions', `${s.functions}`],
    ['best fitness', `${(s.best || 0).toFixed(1)}`],
    ['rejected', `${imp.rejected.length} unphysical`],
    ['result', 'starts from learned knowledge, not zero'],
  ] });
}

/* ---------------- legend ---------------- */
const legendEl = document.getElementById('legend');
FUNCTIONS.forEach(f => {
  const li = document.createElement('div'); li.className = 'li';
  li.innerHTML = `<span class="dot" style="background:#${f.color.toString(16).padStart(6,'0')}"></span>${f.fn}`;
  legendEl.appendChild(li);
});

/* ---------------- "Nous builds object" button ---------------- */
document.getElementById('build-btn').addEventListener('click', () => {
  const o = buildObject();
  if (!o) { showInfo({ title: 'Rejected by physics gate', kind: 'obj',
    rows: [['result', '✗ violated physical law'], ['action', 'not built']] }); return; }
  // brief flash
  let t = 0; const base = o.mesh.material.emissiveIntensity;
  const id = setInterval(() => { o.mesh.material.emissiveIntensity = base + Math.sin(t) * 0.6; t += 0.5; if (t > 6) { clearInterval(id); o.mesh.material.emissiveIntensity = base; } }, 30);
  rebuildFlows();
  showInfo(o.g.userData);
});

document.getElementById('evolve-btn').addEventListener('click', () => {
  evolveGeneration();
  showInfo({ title: `Evolved → generation ${genCountEl.textContent}`, kind: 'obj',
    rows: [['best fitness', bestFitEl.textContent], ['population', String(orbiters.length)],
           ['method', 'elitism + specialize'], ['gated', 'unphysical variants dropped']] });
});

document.getElementById('teach-btn').addEventListener('click', teachNewGrid);

/* ---------------- interaction (hover / click) ---------------- */
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
let hovered = null;
function setPointer(e){ pointer.x = (e.clientX/innerWidth)*2-1; pointer.y = -(e.clientY/innerHeight)*2+1; }
function pick(){ ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects(interactive, false)[0];
  return hit ? hit.object : null; }
renderer.domElement.addEventListener('pointermove', e => {
  setPointer(e); const m = pick();
  document.body.style.cursor = m ? 'pointer' : 'default';
  if (hovered && hovered !== m) hovered.scale.setScalar(1);
  hovered = m; if (m) m.scale.setScalar(1.25);
});
renderer.domElement.addEventListener('click', e => {
  setPointer(e); const m = pick();
  if (!m) { clearZoneFocus(); showInfo(coreGroup.userData); return; }
  const ud = m.userData.kind ? m.userData : m.parent.userData;
  if (ud.kind === 'zone') { enterZone(ud); return; }   // §S4 drill-in
  clearZoneFocus(); showInfo(ud);
});

// ── §S4 ZONE DRILL-IN + SIMULATION ── focus a zone's modules and run its energy ledger.
function clearZoneFocus() {
  orbiters.forEach(o => { o.mesh.material.emissiveIntensity = 0.25; });
}
function enterZone(zoneUd) {
  const mods = orbiters.filter(o => o.zoneId === zoneUd.zoneId);
  // highlight this zone's modules, dim the rest
  orbiters.forEach(o => { o.mesh.material.emissiveIntensity = (o.zoneId === zoneUd.zoneId) ? 0.85 : 0.05; });
  const sim = window.Simulate.simulateZone(mods.map(o => o.spec));
  const fns = {}; mods.forEach(o => { fns[o.type.fn] = (fns[o.type.fn] || 0) + 1; });
  showInfo({ title: `${zoneUd.title} · zone sim`, kind: 'zone',
    rows: [
      ['modules', `${sim.modules}`],
      ['mix', Object.entries(fns).map(([k, n]) => `${k}×${n}`).join(' ') || '—'],
      ['inflow', `${Math.round(sim.inflow)} W`],
      ['demand', `${Math.round(sim.demand)} W`],
      ['surplus', `${Math.round(sim.surplus)} W`],
      ['status', sim.status === 'powered' ? '✓ powered' : '⚠ brownout'],
      ['energy', sim.conserved ? '✓ conserved' : '✗ violated'],
    ] });
}
function showInfo(ud){
  document.getElementById('info-title').textContent = ud.title;
  const body = document.getElementById('info-body');
  body.innerHTML = (ud.rows || []).map(r => `<div class="row"><span>${r[0]}</span><code>${r[1]}</code></div>`).join('')
    + (ud.kind === 'obj' ? '<div class="hint">A functional module — its <b>shape encodes its function</b>. Built by the Nous.</div>' : '');
}

/* ---------------- label projection + animation ---------------- */
const v = new THREE.Vector3();
function projectLabels(){
  ZONES.forEach(z => {
    z._node.getWorldPosition(v); v.y += 6; v.project(camera);
    const behind = v.z > 1;
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight - 26;
    z._el.style.opacity = behind ? 0 : 1;
    z._el.style.left = x + 'px'; z._el.style.top = y + 'px';
  });
}
function animate(){
  requestAnimationFrame(animate);
  coreGroup.rotation.y += 0.0025;
  coreGroup.children[0].material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.002) * 0.25;
  orbiters.forEach(o => { o.angle += o.orbit; const x = Math.cos(o.angle) * o.R, z = Math.sin(o.angle) * o.R;
    o.g.position.set(x, 0, z); o.g.rotation.y += o.spin; o.g.rotation.x += o.spin * 0.5; });
  flowPulses.forEach(p => { p.t += p.speed; if (p.t > 1) p.t -= 1; p.mesh.position.lerpVectors(p.from, p.to, p.t); p.mesh.position.y += Math.sin(p.t * Math.PI) * 6; });
  controls.update(); projectLabels(); renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// expose for quick debugging in the preview
window.__noesis = { buildObject, orbiters, scene, enterZone, evolveGeneration, teachNewGrid, applySprite, ZONES };
