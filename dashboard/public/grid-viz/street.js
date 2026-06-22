/* Noēsis Grid-Viz — O4 STREET-VIEW scene (first version).
 * A walkable 3D view of the Genesis 6-zone city: real parcels placed at their
 * (ring, sector, level) address, colored by zone, massed by structure type.
 * Renders standalone with a local demo; additively swaps in live parcels from
 * GET /api/v1/civic/parcels when a backend is reachable. Avatars / interiors /
 * live firehose updates are the deeper v2.
 *
 * Zone IDs are canonical (D-V3-32 frozen). Ring assignment mirrors civic-map.md.
 */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const { addressToWorld } = window.AddressToWorld;

const errEl = document.getElementById('loaderr');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true, alpha: true }); }
catch (e) { errEl.style.display = 'flex'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06070c, 120, 520);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(70, 60, 190);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.target.set(0, 4, 0); controls.minDistance = 12; controls.maxDistance = 420; controls.maxPolarAngle = Math.PI / 2.05;

scene.add(new THREE.AmbientLight(0x5566aa, 0.7));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.5); sun.position.set(120, 160, 80); scene.add(sun);
scene.add(new THREE.HemisphereLight(0x335577, 0x0a0a12, 0.6));

/* ---- ground + ring guides ---- */
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(240, 64),
  new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2; scene.add(ground);
for (let r = 1; r <= 5; r++) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 40 - 0.4, r * 40 + 0.4, 96),
    new THREE.MeshBasicMaterial({ color: 0x1c2333, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
}

/* ---- zones: canonical id → color + the ring band it occupies (civic-map.md) ---- */
const ZONES = {
  government_quarter: { color: 0xfbbf24, ring: 0 },
  infrastructure:     { color: 0x60a5fa, ring: 1 },
  business:           { color: 0xf5a623, ring: 2 },
  manufacture:        { color: 0xef6c4a, ring: 3 },
  shopping:           { color: 0xec4899, ring: 4 },
  residential:        { color: 0x34d399, ring: 5 },
};
/* structure type → massing (height, footprint) */
const STRUCTURE = {
  home:     { h: 8,  w: 9 }, shop: { h: 12, w: 11 }, workshop: { h: 10, w: 13 },
  venue:    { h: 16, w: 16 }, infrastructure: { h: 22, w: 10 }, government: { h: 26, w: 18 },
  default:  { h: 10, w: 10 },
};

const parcelGroup = new THREE.Group(); scene.add(parcelGroup);
const pickables = [];

function placeParcel(p) {
  const zone = ZONES[p.zone] || ZONES.residential;
  const pos = addressToWorld({ ring: p.ring, sector: p.sector, level: p.level });
  const stype = (p.structure && p.structure.type) || (p.zone === 'government_quarter' ? 'government' : 'default');
  const m = STRUCTURE[stype] || STRUCTURE.default;
  const empty = !p.structure;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(m.w, empty ? 0.6 : m.h, m.w),
    new THREE.MeshStandardMaterial({
      color: zone.color, roughness: 0.55, metalness: 0.1,
      transparent: empty, opacity: empty ? 0.25 : 1,
      emissive: zone.color, emissiveIntensity: empty ? 0 : 0.06,
    }),
  );
  mesh.position.set(pos.x, (empty ? 0.3 : m.h / 2), pos.z);
  mesh.userData.parcel = p;
  parcelGroup.add(mesh);
  pickables.push(mesh);
}

function clearParcels() { parcelGroup.clear(); pickables.length = 0; }

/* ---- local demo: a believable city until a backend answers ---- */
function demoParcels() {
  const out = [];
  let n = 0;
  const types = ['home', 'shop', 'workshop', 'venue'];
  for (const [zoneId, z] of Object.entries(ZONES)) {
    const count = zoneId === 'government_quarter' ? 4 : 10 + (z.ring * 2);
    for (let i = 0; i < count; i++) {
      const sector = Math.round((360 / count) * i);
      const stype = zoneId === 'government_quarter' ? 'government'
        : zoneId === 'infrastructure' ? 'infrastructure' : types[(i + z.ring) % types.length];
      const occupied = (i % 5) !== 0; // some empty lots
      out.push({
        id: `genesis:${zoneId}:${String(n++).padStart(4, '0')}`,
        zone: zoneId, ring: z.ring === 0 ? (i % 2) : z.ring, sector, level: 0,
        status: occupied ? 'owned' : 'unclaimed',
        structure: occupied ? { type: stype, visibility: 'public' } : null,
        owner_civic_did_hash: occupied ? 'demo'.repeat(16) : null, condition: 'maintained',
      });
    }
  }
  return out;
}

function render(parcels) {
  clearParcels();
  for (const p of parcels) placeParcel(p);
  document.getElementById('parcel-count').textContent = String(parcels.length);
}
render(demoParcels());

/* ---- click → inspect ---- */
const raycaster = new THREE.Raycaster();
const info = document.getElementById('info');
renderer.domElement.addEventListener('click', (ev) => {
  if (walking) return; // in walk mode, click is consumed by pointer-lock
  const ndc = new THREE.Vector2((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  if (!hit) { info.style.display = 'none'; return; }
  const p = hit.object.userData.parcel;
  info.style.display = 'block';
  info.innerHTML =
    `<h2>${p.id}</h2>` +
    `<div class="row">zone: <b>${p.zone}</b></div>` +
    `<div class="row">address: <b>ring ${p.ring} · ${p.sector}° · lvl ${p.level}</b></div>` +
    `<div class="row">status: <b>${p.status}</b></div>` +
    `<div class="row">structure: <b>${p.structure ? p.structure.type : '— (empty lot)'}</b></div>` +
    (p.owner_civic_did_hash ? `<div class="row">owner: <b>${String(p.owner_civic_did_hash).slice(0, 12)}…</b></div>` : '');
});

/* ---- first-person walk: minimal pointer-lock + WASD + mouse-look ---- */
let walking = false; let yaw = 0, pitch = 0;
const keys = Object.create(null);
const overviewState = { pos: camera.position.clone(), tgt: controls.target.clone() };
const canvas = renderer.domElement;

function enterWalk() {
  overviewState.pos.copy(camera.position); overviewState.tgt.copy(controls.target);
  walking = true; controls.enabled = false;
  camera.position.set(0, 6, 150); yaw = Math.PI; pitch = 0;
  canvas.requestPointerLock && canvas.requestPointerLock();
}
function exitWalk() {
  walking = false; controls.enabled = true;
  camera.position.copy(overviewState.pos); controls.target.copy(overviewState.tgt);
  document.pointerLockElement && document.exitPointerLock();
}
document.getElementById('walk').addEventListener('click', enterWalk);
document.getElementById('overview').addEventListener('click', exitWalk);
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && walking) exitWalk(); });
document.addEventListener('mousemove', (e) => {
  if (!walking) return;
  yaw -= e.movementX * 0.0025; pitch -= e.movementY * 0.0025;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
});
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function walkStep() {
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(camera.position.clone().add(dir));
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const speed = 1.6;
  if (keys['w']) camera.position.addScaledVector(fwd, speed);
  if (keys['s']) camera.position.addScaledVector(fwd, -speed);
  if (keys['a']) camera.position.addScaledVector(right, speed);
  if (keys['d']) camera.position.addScaledVector(right, -speed);
  camera.position.y = 6; // stay at eye level
}

/* ---- additive backend swap ---- */
async function tryLoadBackendParcels() {
  try {
    const res = await fetch('/api/v1/civic/parcels?grid=genesis', { cache: 'no-store' });
    if (!res.ok) return;
    const body = await res.json();
    const parcels = Array.isArray(body && body.parcels) ? body.parcels : null;
    if (!parcels || parcels.length === 0) return;
    render(parcels);
    document.getElementById('source').textContent = `backend: ${parcels.length} real`;
  } catch (_e) { /* static host / offline → keep demo, zero console noise */ }
}
tryLoadBackendParcels();

/* ---- loop ---- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
function animate() {
  requestAnimationFrame(animate);
  if (walking) walkStep(); else controls.update();
  renderer.render(scene, camera);
}
animate();

window.__noesis_street = { scene, camera, render, demoParcels, placeParcel, tryLoadBackendParcels, addressToWorld };
