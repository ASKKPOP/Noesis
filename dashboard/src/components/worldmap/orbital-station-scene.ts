/**
 * orbital-station-scene.ts — the rich 3D Genesis Core orbital station (Three.js),
 * ported from the canonical docs/noesis-genesis-core-map.html so the React world
 * map renders the SAME view: Genesis Core above EARTH (never a flat plane, D-NH-08/12),
 * orbital shells of parcel modules, Moon & Mars as SEPARATE forming Grids, and a
 * camera-focus picker (Genesis stays near Earth — Earth never transforms).
 *
 * Framework-agnostic: mount(canvas, opts) builds the scene and returns a handle to
 * push live parcels (setParcels), focus a Grid, and dispose. The React wrapper owns
 * the HUD / legend / picker / info-panel as DOM overlays and the live parcel fetch.
 */
import * as THREE from 'three';
import type { ParcelFeedEntry } from './OrbitalGenesisMap';

export interface OrbitalHandle {
    setParcels(parcels: ParcelFeedEntry[]): void;
    focusGrid(name: string): void;
    dispose(): void;
}

export interface MountOpts {
    onPick(parcel: ParcelFeedEntry | null): void;
    onFocusLabel?(label: string): void;
}

const ZCOL: Record<string, number> = {
    government_quarter: 0x8e54b8, infrastructure: 0x8a98ac, business: 0xc2a878,
    shopping: 0x3fa6bd, manufacture: 0x9a5a44, residential: 0x5a84c4,
};
const R: Record<number, number> = { 1: 30, 2: 56, 3: 84 };
const INCL = 0.42;

/** Map a live feed parcel to the canonical render status (zone + ownership). */
function renderStatus(p: ParcelFeedEntry): string {
    if (p.zone === 'government_quarter') return 'civic';
    if (p.zone === 'infrastructure') return 'commons';
    return p.status === 'owned' || p.owner_civic_did_hash ? 'owned' : 'unsold';
}

export function mountOrbitalStation(canvas: HTMLCanvasElement, opts: MountOpts): OrbitalHandle {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010409);
    const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);

    // ── stars ──
    {
        const n = 1800, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const r = 650 + Math.random() * 650, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph); pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb8d8, size: 1.1, sizeAttenuation: true })));
    }

    // ── Earth below (D-NH-12) — Genesis stays near Earth; Earth never transforms ──
    const planet = new THREE.Mesh(new THREE.SphereGeometry(340, 96, 96),
        new THREE.MeshStandardMaterial({ color: 0x123a5c, emissive: 0x0a1c30, emissiveIntensity: 0.6, roughness: 1, metalness: 0 }));
    planet.position.set(80, -450, -150); planet.rotation.z = 0.41; scene.add(planet);
    new THREE.TextureLoader().setCrossOrigin('anonymous').load(
        'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
        (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            planet.material = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x223a55, emissiveIntensity: 0.22, roughness: 1, metalness: 0 });
            planet.material.needsUpdate = true;
        });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(354, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x3a8bd5, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    atmo.position.copy(planet.position); scene.add(atmo);

    const GRID_FOCUS: Record<string, { pos: THREE.Vector3; dist: number; label: string }> = {
        Genesis: { pos: new THREE.Vector3(0, 2, 0), dist: 185, label: 'Genesis · near Earth' },
    };

    // ── lights ──
    scene.add(new THREE.AmbientLight(0x2a3a52, 0.85));
    const coreLight = new THREE.PointLight(0xda7a4e, 1.8, 320); scene.add(coreLight);
    const sun = new THREE.DirectionalLight(0xbfd9ff, 1.0); sun.position.set(180, 140, 90); scene.add(sun);

    const station = new THREE.Group(); scene.add(station);
    const meshes: THREE.Object3D[] = [];

    function neonSign(text: string, hex: number): THREE.Sprite {
        const c = document.createElement('canvas'); c.width = 512; c.height = 128;
        const x = c.getContext('2d')!; const col = '#' + hex.toString(16).padStart(6, '0');
        x.shadowColor = col; x.shadowBlur = 26; x.strokeStyle = col; x.lineWidth = 5;
        x.beginPath(); (x as CanvasRenderingContext2D).roundRect(14, 18, 484, 92, 18); x.stroke();
        x.font = 'bold 52px "JetBrains Mono",Menlo,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = col; x.fillText(text, 256, 66);
        const t = new THREE.CanvasTexture(c);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
        s.scale.set(30, 7.5, 1); return s;
    }
    function truss(a: THREE.Vector3, b: THREE.Vector3, hex: number, op: number): void {
        const d = new THREE.Vector3().subVectors(b, a), len = d.length();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, len, 6), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op }));
        m.position.copy(a).add(d.multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
        station.add(m);
    }

    // ── Government Core — glass egg + lattice + sail + podium town ──
    const coreGroup = new THREE.Group(); station.add(coreGroup);
    const OV = 1.16;
    const egg = new THREE.Mesh(new THREE.SphereGeometry(9, 44, 32),
        new THREE.MeshStandardMaterial({ color: 0x29373a, emissive: 0x5d6e52, emissiveIntensity: 0.14, metalness: 0.4, roughness: 0.22, transparent: true, opacity: 0.5 }));
    egg.scale.set(1, OV, 1); coreGroup.add(egg); meshes.push(egg);
    const coreUserData = { id: 'genesis:government_quarter:0001', zone: 'government_quarter', ring: 0, sector: 0, level: 0, status: 'civic', price_bios: 0, owner_civic_did_hash: null, structure: null, occupant_count: 0 } as ParcelFeedEntry;
    egg.userData = coreUserData;
    {
        const lat = new THREE.Mesh(new THREE.IcosahedronGeometry(9.18, 3), new THREE.MeshBasicMaterial({ color: 0xbac4ce, wireframe: true, transparent: true, opacity: 0.30 }));
        lat.scale.set(1, OV, 1); coreGroup.add(lat);
    }
    { const glow = new THREE.Mesh(new THREE.SphereGeometry(7.3, 24, 18), new THREE.MeshBasicMaterial({ color: 0xc2a878, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending })); glow.scale.set(1, OV, 1); coreGroup.add(glow); }
    { const halo = new THREE.Mesh(new THREE.SphereGeometry(11, 28, 24), new THREE.MeshBasicMaterial({ color: 0x4a5a52, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending })); coreGroup.add(halo); }
    { // podium + government-quarter town ring
        const baseY = -9 * OV - 1;
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 14, 2.2, 44), new THREE.MeshStandardMaterial({ color: 0x2b323b, emissive: 0x3b4a5a, emissiveIntensity: 0.08, metalness: 0.6, roughness: 0.5 }));
        pod.position.y = baseY; coreGroup.add(pod);
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2, h = 1.6 + (i % 4) * 1.0;
            const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), new THREE.MeshStandardMaterial({ color: 0x39434f, emissive: 0x4a5e72, emissiveIntensity: 0.14, metalness: 0.5, roughness: 0.5 }));
            b.position.set(Math.cos(a) * 11.6, baseY + 1.1 + h / 2, Math.sin(a) * 11.6); b.lookAt(0, baseY, 0); coreGroup.add(b);
        }
    }
    { const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 6, 8), new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.8, roughness: 0.3 })); mast.position.y = 9 * OV + 3; coreGroup.add(mast); }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), new THREE.MeshBasicMaterial({ color: 0xcdd6df, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    beacon.position.y = 9 * OV + 6; coreGroup.add(beacon);
    const beaconLight = new THREE.PointLight(0x9ab4c4, 1.0, 80); beaconLight.position.y = 9 * OV + 6; coreGroup.add(beaconLight);
    const councilRing = new THREE.Group(); coreGroup.add(councilRing);
    {
        const sailG = new THREE.Group(); const arc = Math.PI * 1.3;
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0xc6ced8, emissive: 0x5a6a7a, emissiveIntensity: 0.1, metalness: 0.85, roughness: 0.32 });
        sailG.add(new THREE.Mesh(new THREE.TorusGeometry(13.2, 0.5, 6, 72, arc), tubeMat));
        sailG.add(new THREE.Mesh(new THREE.TorusGeometry(10.8, 0.42, 6, 72, arc), tubeMat));
        sailG.add(new THREE.Mesh(new THREE.RingGeometry(10.8, 13.2, 54, 2, 0, arc), new THREE.MeshBasicMaterial({ color: 0xaab4c0, wireframe: true, transparent: true, opacity: 0.32, side: THREE.DoubleSide })));
        sailG.rotation.z = -0.5; sailG.rotation.x = 0.2; councilRing.add(sailG);
    }
    { const sign = neonSign('GOVERNMENT CORE', 0x9aa6c0); sign.position.set(0, 24, 0); station.add(sign); }

    // ── ring guides ──
    function guide(radius: number, hex: number, op: number): void {
        const t = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.45, 10, 160), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op }));
        t.rotation.x = Math.PI / 2; station.add(t);
    }
    guide(R[1], 0x8a98ac, 0.24); guide(R[2], 0x3fa6bd, 0.26);
    const r3tilt = new THREE.Group(); r3tilt.rotation.x = INCL; station.add(r3tilt);
    const r3spin = new THREE.Group(); r3tilt.add(r3spin);
    { const t = new THREE.Mesh(new THREE.TorusGeometry(R[3], 0.45, 10, 200), new THREE.MeshBasicMaterial({ color: 0x5a84c4, transparent: true, opacity: 0.28 })); t.rotation.x = Math.PI / 2; r3spin.add(t); }
    { const t = new THREE.Mesh(new THREE.TorusGeometry(42, 0.3, 8, 120), new THREE.MeshBasicMaterial({ color: 0xda7a4e, transparent: true, opacity: 0.22 })); t.rotation.y = Math.PI / 2; station.add(t); }

    // ── module (capsule) builder ──
    function modMesh(p: ParcelFeedEntry, size: number, parent: THREE.Object3D, pos: THREE.Vector3): THREE.Mesh {
        const col = ZCOL[p.zone] ?? 0x8a98ac; const status = renderStatus(p); const ghost = status === 'unsold';
        const grp = new THREE.Group(); const Rr = size * 0.58, L = size * 1.15;
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(Rr, L, 6, 18),
            ghost
                ? new THREE.MeshStandardMaterial({ color: 0x7a8696, emissive: col, emissiveIntensity: 0.06, transparent: true, opacity: 0.18, metalness: 0.3, roughness: 0.72 })
                : new THREE.MeshStandardMaterial({ color: 0xdde4ec, emissive: col, emissiveIntensity: 0.26, metalness: 0.45, roughness: 0.48 }));
        body.userData = p; grp.add(body); meshes.push(body);
        const strapMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: ghost ? 0.14 : 0.5, metalness: 0.35, roughness: 0.55, transparent: ghost, opacity: ghost ? 0.38 : 1 });
        for (const ty of [-L * 0.34, 0, L * 0.34]) { const t = new THREE.Mesh(new THREE.TorusGeometry(Rr * 1.04, Rr * 0.11, 8, 20), strapMat); t.rotation.x = Math.PI / 2; t.position.y = ty; grp.add(t); }
        if (ghost) {
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CapsuleGeometry(Rr, L, 3, 12)), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.4 })); body.add(e);
        } else {
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(Rr * 0.52, Rr * 0.52, Rr * 0.32, 16), new THREE.MeshStandardMaterial({ color: 0xe7c878, emissive: 0x8a6a3b, emissiveIntensity: 0.45, metalness: 0.8, roughness: 0.3 })); cap.position.y = -(L / 2 + Rr * 0.95); grp.add(cap);
        }
        const dir = pos.clone().normalize();
        if (dir.lengthSq() > 0) grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        grp.position.copy(pos); grp.userData = p; parent.add(grp); return body;
    }

    // ── static scaffold (canonical positions — built ONCE from the seed shape) ──
    function scaffold(seed: ParcelFeedEntry[]): void {
        for (const p of seed.filter((p) => p.ring === 1)) {
            const th = p.sector * Math.PI / 180;
            const pos = new THREE.Vector3(Math.cos(th) * R[1], ((p.sector / 90) % 2 ? 5 : -5), Math.sin(th) * R[1]);
            truss(new THREE.Vector3(0, 0, 0), pos, 0x7d8da1, 0.5);
        }
        { const s = neonSign('COMMONS', 0x9fb0c4); s.position.set(R[1] * 0.7, 14, R[1] * 0.7); station.add(s); }
        for (const p of seed.filter((p) => p.ring === 2)) {
            const th = p.sector * Math.PI / 180; const lift = Math.round(p.sector) % 2 ? 6 : -6;
            const pos = new THREE.Vector3(Math.cos(th) * R[2], lift, Math.sin(th) * R[2]);
            truss(new THREE.Vector3(Math.cos(th) * R[2], 0, Math.sin(th) * R[2]), pos, ZCOL[p.zone] ?? 0xc2a878, 0.5);
        }
        for (const [txt, hex, deg] of [['BUSINESS', 0xc2a878, 60], ['SHOPPING', 0x3fa6bd, 180], ['MANUFACTURE', 0x9a5a44, 300]] as [string, number, number][]) {
            const th = deg * Math.PI / 180; const s = neonSign(txt, hex); s.position.set(Math.cos(th) * (R[2] + 2), 17, Math.sin(th) * (R[2] + 2)); station.add(s);
        }
        for (const deg of [30, 120, 210, 300]) { const th = deg * Math.PI / 180; truss(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(th) * R[2], 0, Math.sin(th) * R[2]), 0x46e0d0, 0.30); }
        for (const p of seed.filter((p) => p.ring === 3)) {
            const th = p.sector * Math.PI / 180; const lift = Math.round(p.sector * 24 / 360) % 2 ? 4 : -4;
            const pos = new THREE.Vector3(Math.cos(th) * R[3], lift, Math.sin(th) * R[3]);
            const anchor = new THREE.Vector3(Math.cos(th) * R[3], 0, Math.sin(th) * R[3]);
            const d = new THREE.Vector3().subVectors(pos, anchor), len = Math.max(d.length(), 0.001);
            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, len, 6), new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.5 }));
            t.position.copy(anchor).add(d.multiplyScalar(0.5));
            t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(pos, anchor).normalize());
            r3spin.add(t);
        }
        { const s = neonSign('RESIDENTIAL', 0x5a84c4); s.position.set(0, 20, R[3]); r3tilt.add(s); }
    }

    // ── dynamic modules — re-render from seed OR live data ──
    let scaffoldDone = false;
    let parcelBodies: THREE.Mesh[] = [];
    function clearModules(): void {
        for (const b of parcelBodies) { const grp = b.parent; if (grp && grp.parent) grp.parent.remove(grp); const i = meshes.indexOf(b); if (i >= 0) meshes.splice(i, 1); }
        parcelBodies = [];
    }
    function renderParcelModules(parcels: ParcelFeedEntry[]): void {
        clearModules();
        for (const p of parcels.filter((p) => p.ring === 1)) {
            const th = p.sector * Math.PI / 180;
            parcelBodies.push(modMesh(p, 4.2, station, new THREE.Vector3(Math.cos(th) * R[1], ((p.sector / 90) % 2 ? 5 : -5), Math.sin(th) * R[1])));
        }
        for (const p of parcels.filter((p) => p.ring === 2)) {
            const th = p.sector * Math.PI / 180; const lift = Math.round(p.sector) % 2 ? 6 : -6;
            parcelBodies.push(modMesh(p, 3.6, station, new THREE.Vector3(Math.cos(th) * R[2], lift, Math.sin(th) * R[2])));
        }
        for (const p of parcels.filter((p) => p.ring === 3)) {
            const th = p.sector * Math.PI / 180; const lift = Math.round(p.sector * 24 / 360) % 2 ? 4 : -4;
            parcelBodies.push(modMesh(p, 3.0, r3spin, new THREE.Vector3(Math.cos(th) * R[3], lift, Math.sin(th) * R[3])));
        }
    }

    // ── Moon & Mars — SEPARATE forming Grids on their own bodies ──
    const previewGrids: THREE.Group[] = [];
    function buildPreviewGrid(o: { name: string; gridPos: THREE.Vector3; bodyOffset: THREE.Vector3; bodyR: number; bodyColor: number; bodyEmissive: number; atmoColor?: number; atmoOpacity?: number; sign: number; dist: number }): void {
        const grp = new THREE.Group(); grp.position.copy(o.gridPos); scene.add(grp);
        const body = new THREE.Mesh(new THREE.SphereGeometry(o.bodyR, 64, 64), new THREE.MeshStandardMaterial({ color: o.bodyColor, emissive: o.bodyEmissive, emissiveIntensity: 0.5, roughness: 1, metalness: 0 }));
        body.position.copy(o.gridPos).add(o.bodyOffset); scene.add(body);
        if (o.atmoColor) { const a = new THREE.Mesh(new THREE.SphereGeometry(o.bodyR * 1.04, 40, 40), new THREE.MeshBasicMaterial({ color: o.atmoColor, transparent: true, opacity: o.atmoOpacity, side: THREE.BackSide, blending: THREE.AdditiveBlending })); a.position.copy(body.position); scene.add(a); }
        const g = new THREE.SphereGeometry(26, 26, 18); const pos = g.attributes.position; const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const nn = Math.sin(v.x * 0.21) + Math.cos(v.y * 0.17) * 1.3 + Math.sin(v.z * 0.23) * 1.1; v.multiplyScalar(1 + nn * 0.06); pos.setXYZ(i, v.x, v.y, v.z); }
        grp.add(new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: o.sign, transparent: true, opacity: 0.45 })));
        grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: o.sign, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.85 })));
        grp.add(new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: o.sign, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending })));
        const meta = { id: o.name.toLowerCase() + ':grid:forming', name: o.name + ' Grid', body: o.name, zone: 'frontier_grid', ring: -1, sector: 0, level: 0, status: 'forming', price_bios: 0, owner_civic_did_hash: null, structure: null, occupant_count: 0, future: true } as unknown as ParcelFeedEntry;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(27, 12, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.userData = meta; grp.add(hit); meshes.push(hit);
        const s1 = neonSign(o.name.toUpperCase() + ' GRID', o.sign); s1.position.set(0, 42, 0); grp.add(s1);
        const s2 = neonSign('FORMING · H1', 0x6a7686); s2.position.set(0, 32, 0); s2.scale.set(16, 4, 1); grp.add(s2);
        previewGrids.push(grp);
        GRID_FOCUS[o.name] = { pos: o.gridPos.clone(), dist: o.dist, label: o.name + ' Grid · forming (' + o.name + ')' };
    }
    buildPreviewGrid({ name: 'Moon', gridPos: new THREE.Vector3(520, 40, -430), bodyOffset: new THREE.Vector3(50, -190, -60), bodyR: 120, bodyColor: 0x8f8f93, bodyEmissive: 0x33352f, sign: 0x9aa6c0, dist: 150 });
    buildPreviewGrid({ name: 'Mars', gridPos: new THREE.Vector3(980, 70, -880), bodyOffset: new THREE.Vector3(60, -200, -70), bodyR: 110, bodyColor: 0x9c4a2f, bodyEmissive: 0x3a1c12, atmoColor: 0xc78a5a, atmoOpacity: 0.12, sign: 0xc88a5a, dist: 150 });

    // ── data flows ──
    const flows: { m: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; off: number; spd: number }[] = [];
    function flow(target: THREE.Vector3, hex: number): void {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2, 0), new THREE.Vector3(target.x * 0.45, 14 + Math.random() * 8, target.z * 0.45), target.clone().setY(target.y + 2)]);
        for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })); scene.add(m); flows.push({ m, curve, off: Math.random(), spd: 0.0016 + Math.random() * 0.001 }); }
    }
    for (const deg of [20, 100, 140, 220, 260, 340]) { const th = deg * Math.PI / 180; const zone = deg < 120 ? 'business' : deg < 240 ? 'shopping' : 'manufacture'; flow(new THREE.Vector3(Math.cos(th) * R[2], (Math.round(deg) % 2 ? 6 : -6), Math.sin(th) * R[2]), ZCOL[zone]); }
    // survey corridor Genesis → Moon → Mars
    { const corridor = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2, 0), new THREE.Vector3(260, 40, -210), GRID_FOCUS.Moon.pos.clone(), new THREE.Vector3(740, 60, -650), GRID_FOCUS.Mars.pos.clone()]);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(corridor.getPoints(96)), new THREE.LineDashedMaterial({ color: 0x3fa6bd, transparent: true, opacity: 0.30, dashSize: 3, gapSize: 4 }));
        line.computeLineDistances(); scene.add(line);
        for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0x7fd4e8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })); scene.add(m); flows.push({ m, curve: corridor, off: k / 3, spd: 0.0006 }); }
    }

    // ── camera (hand-rolled, focus-based) ──
    let rx = 0.42, ry = 0.7, dist = 185;
    const focus = new THREE.Vector3(0, 2, 0), focusGoal = focus.clone(); let distGoal = 185;
    let drag = false, px = 0, py = 0;
    function place(): void {
        cam.position.set(focus.x + Math.sin(ry) * Math.cos(rx) * dist, focus.y + Math.sin(rx) * dist + 6, focus.z + Math.cos(ry) * Math.cos(rx) * dist);
        cam.lookAt(focus);
    }
    function focusGrid(name: string): void {
        const f = GRID_FOCUS[name] ?? GRID_FOCUS.Genesis; focusGoal.copy(f.pos); distGoal = f.dist;
        opts.onFocusLabel?.(f.label);
    }
    const onDown = (e: PointerEvent) => { drag = true; px = e.clientX; py = e.clientY; };
    const onUp = () => { drag = false; };
    const onMove = (e: PointerEvent) => { if (!drag) return; ry -= (e.clientX - px) * 0.006; rx = Math.max(-0.5, Math.min(1.45, rx + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; place(); };
    const onWheel = (e: WheelEvent) => { dist = Math.max(70, Math.min(680, dist + e.deltaY * 0.14)); distGoal = dist; place(); };
    canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('pointermove', onMove); addEventListener('wheel', onWheel, { passive: true });

    // ── raycast pick ──
    const ray = new THREE.Raycaster(); const pv = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
        pv.x = (e.clientX / innerWidth) * 2 - 1; pv.y = -(e.clientY / innerHeight) * 2 + 1;
        ray.setFromCamera(pv, cam); const hit = ray.intersectObjects(meshes, false)[0];
        opts.onPick(hit ? (hit.object.userData as ParcelFeedEntry) : null);
    };
    canvas.addEventListener('click', onClick);
    const onResize = () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
    addEventListener('resize', onResize);

    place();
    // ── animate ──
    let t = 0; let raf = 0;
    (function loop() {
        t += 1;
        station.rotation.y += 0.00055;
        for (const pg of previewGrids) { pg.rotation.y += 0.0012; pg.rotation.x += 0.0004; }
        focus.lerp(focusGoal, 0.07); dist += (distGoal - dist) * 0.07; place();
        planet.rotation.y += 0.00035;
        r3spin.rotation.z += 0.0009;
        councilRing.rotation.y -= 0.0028;
        const bp = 0.4 + Math.abs(Math.sin(t * 0.045)) * 0.35; (beacon.material as THREE.Material & { opacity: number }).opacity = bp; beaconLight.intensity = 0.55 + bp * 0.8;
        coreLight.intensity = 1.6 + Math.sin(t * 0.02) * 0.3;
        for (const f of flows) { const u = (t * f.spd + f.off) % 1; f.m.position.copy(f.curve.getPoint(u)); (f.m.material as THREE.Material & { opacity: number }).opacity = u < 0.08 ? u / 0.08 : u > 0.92 ? (1 - u) / 0.08 : 0.95; }
        renderer.render(scene, cam);
        raf = requestAnimationFrame(loop);
    })();

    return {
        setParcels(parcels: ParcelFeedEntry[]) { scaffoldDone || (scaffold(parcels), scaffoldDone = true); renderParcelModules(parcels); },
        focusGrid,
        dispose() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('pointermove', onMove); removeEventListener('wheel', onWheel); canvas.removeEventListener('click', onClick); removeEventListener('resize', onResize);
            renderer.dispose();
        },
    };
    // scaffold is built once on the first setParcels (positions are canonical)
}
