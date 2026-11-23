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
import { TEMPLATE_ZONES, parcelZoneKind, zoneColor, zoneSign, type GridZoneView } from './zone-view';
import { fitDistance } from './grid-focus';
import { drawNeonSign } from './neon-sign';
import { INCL, RING_R, layoutParcels, outerRadius, renderStatus } from './orbital-layout';

/** An economy-built orbital object (L4 feed: GET /api/v1/orbital/objects). The same
 * built world the Nous now perceives — rendered so the map shows it too. */
export interface OrbitalObjectEntry {
    object_id: string;
    function_type?: string;
    zone?: string;
    status?: string;
    output_rate?: string;
    physics_spec?: { altitude_km?: number } | null;
}

export interface OrbitalHandle {
    setParcels(parcels: ParcelFeedEntry[]): void;
    /** The Grid's current zone set (D-V3-40) — labels, kinds, and zones its Polis added or removed. */
    setZones(zones: readonly GridZoneView[]): void;
    setObjects(objects: OrbitalObjectEntry[]): void;
    focusGrid(name: string): void;
    /** Something happened: send one packet to that lot (to the core when no lot is known). */
    pulse(parcelId?: string): void;
    dispose(): void;
}

export interface MountOpts {
    onPick(parcel: ParcelFeedEntry | null): void;
    onFocusLabel?(label: string): void;
    /** A Grid was clicked in the scene and the camera is zooming to it. */
    onFocusGrid?(name: string): void;
}

const R = RING_R;

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

    // `radius` = what must be in view for the Grid to fill it (full zoom).
    const GRID_FOCUS: Record<string, { pos: THREE.Vector3; radius: number; label: string }> = {
        Genesis: { pos: new THREE.Vector3(0, 2, 0), radius: R[3] + 8, label: 'Genesis · near Earth' },
    };

    // ── lights ──
    scene.add(new THREE.AmbientLight(0x2a3a52, 0.85));
    const coreLight = new THREE.PointLight(0xda7a4e, 1.8, 320); scene.add(coreLight);
    const sun = new THREE.DirectionalLight(0xbfd9ff, 1.0); sun.position.set(180, 140, 90); scene.add(sun);

    const station = new THREE.Group(); scene.add(station);
    const meshes: THREE.Object3D[] = [];

    function neonSign(text: string, hex: number): THREE.Sprite {
        const t = new THREE.CanvasTexture(drawNeonSign(text, hex));
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
    // ── zone signs — one per zone, re-lettered when the Polis relabels it, hidden when removed ──
    let zones: readonly GridZoneView[] = TEMPLATE_ZONES;
    const zoneSigns = new Map<string, { sprite: THREE.Sprite; hex: number; text: string }>();
    function zoneSignAt(zoneId: string, hex: number, parent: THREE.Object3D, x: number, y: number, z: number): void {
        const zone = zones.find((v) => v.zone_id === zoneId);
        const text = zone ? zoneSign(zone) : zoneId.replace(/_/g, ' ').toUpperCase();
        const sprite = neonSign(text, hex); sprite.position.set(x, y, z); sprite.visible = !!zone; parent.add(sprite);
        zoneSigns.set(zoneId, { sprite, hex, text });
    }
    function refreshZoneSigns(): void {
        for (const [zoneId, s] of zoneSigns) {
            const zone = zones.find((v) => v.zone_id === zoneId);
            s.sprite.visible = !!zone;
            if (!zone || zoneSign(zone) === s.text) continue;
            const next = neonSign(zoneSign(zone), s.hex); next.position.copy(s.sprite.position);
            const parent = s.sprite.parent; if (parent) { parent.remove(s.sprite); parent.add(next); }
            s.sprite.material.map?.dispose(); s.sprite.material.dispose();
            zoneSigns.set(zoneId, { sprite: next, hex: s.hex, text: zoneSign(zone) });
        }
    }
    zoneSignAt('government_quarter', 0x9aa6c0, station, 0, 24, 0);

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
        const col = zoneColor(p.zone); const status = renderStatus(p, zones); const ghost = status === 'unsold';
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
        // ── #2 presence — a figure stands on a lot only while someone is inside it
        // (the Grid's occupant count). Owning a lot is shown by the lot itself.
        if ((p.occupant_count ?? 0) > 0 && status === 'owned') {
            const av = new THREE.Group();
            const head = new THREE.Mesh(new THREE.SphereGeometry(Rr * 0.34, 14, 12),
                new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0x6fd4ff, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.4 }));
            head.position.y = Rr * 0.5; av.add(head); // decorative — the module body is the pickable hit
            const torso = new THREE.Mesh(new THREE.ConeGeometry(Rr * 0.34, Rr * 0.7, 12),
                new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x3fa6bd, emissiveIntensity: 0.4, metalness: 0.2, roughness: 0.5 }));
            torso.position.y = -Rr * 0.05; av.add(torso);
            const glow = new THREE.Mesh(new THREE.SphereGeometry(Rr * 0.9, 16, 12),
                new THREE.MeshBasicMaterial({ color: 0x6fd4ff, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending }));
            av.add(glow);
            av.position.set(0, L / 2 + Rr * 1.6, 0); // stand on the outward end of the capsule
            grp.add(av);
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
        zoneSignAt('infrastructure', 0x9fb0c4, station, R[1] * 0.7, 14, R[1] * 0.7);
        for (const p of seed.filter((p) => p.ring === 2)) {
            const th = p.sector * Math.PI / 180; const lift = Math.round(p.sector) % 2 ? 6 : -6;
            const pos = new THREE.Vector3(Math.cos(th) * R[2], lift, Math.sin(th) * R[2]);
            truss(new THREE.Vector3(Math.cos(th) * R[2], 0, Math.sin(th) * R[2]), pos, zoneColor(p.zone), 0.5);
        }
        for (const [zoneId, deg] of [['business', 60], ['shopping', 180], ['manufacture', 300]] as [string, number][]) {
            const th = deg * Math.PI / 180; zoneSignAt(zoneId, zoneColor(zoneId), station, Math.cos(th) * (R[2] + 2), 17, Math.sin(th) * (R[2] + 2));
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
        zoneSignAt('residential', zoneColor('residential'), r3tilt, 0, 20, R[3]);
    }

    // ── dynamic modules — re-render from seed OR live data ──
    let scaffoldDone = false;
    let parcelBodies: THREE.Mesh[] = [];
    let outerExtras: THREE.Object3D[] = [];   // shells of rings a Polis opened beyond the Genesis Core
    let lastParcels: ParcelFeedEntry[] = [];
    function clearModules(): void {
        for (const b of parcelBodies) { const grp = b.parent; if (grp && grp.parent) grp.parent.remove(grp); const i = meshes.indexOf(b); if (i >= 0) meshes.splice(i, 1); }
        parcelBodies = [];
        for (const o of outerExtras) { o.parent?.remove(o); }
        outerExtras = [];
    }
    function renderParcelModules(parcels: ParcelFeedEntry[]): void {
        clearModules();
        const placed = layoutParcels(parcels);
        for (const { parcel: p, place } of placed) {
            if (place.parent === 'shell') continue;
            parcelBodies.push(modMesh(p, place.size, place.parent === 'r3spin' ? r3spin : station, new THREE.Vector3(...place.pos)));
        }
        // Rings a Polis opened by law (ring 4+): each is its own shell, tilted the other way
        // from its neighbour (the gyroscope look), in the colour of the zone it was opened in.
        const outer = new Map<number, { parcel: ParcelFeedEntry; pos: [number, number, number] }[]>();
        for (const { parcel, place } of placed) { if (place.parent === 'shell') outer.set(place.ring, [...(outer.get(place.ring) ?? []), { parcel, pos: place.pos }]); }
        for (const [ring, mods] of outer) {
            const rad = outerRadius(ring); const land = mods.map((m) => m.parcel); const first = land[0];
            const shell = new THREE.Group(); shell.rotation.x = (ring % 2 ? 1 : -1) * INCL * 0.6; station.add(shell); outerExtras.push(shell);
            const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.45, 10, 220), new THREE.MeshBasicMaterial({ color: zoneColor(first.zone), transparent: true, opacity: 0.28 }));
            t.rotation.x = Math.PI / 2; shell.add(t);
            for (const m of mods) parcelBodies.push(modMesh(m.parcel, 3.0, shell, new THREE.Vector3(...m.pos)));
            const signed = new Set<string>();
            for (const p of land) {
                if (signed.has(p.zone)) continue; signed.add(p.zone);
                const zone = zones.find((v) => v.zone_id === p.zone);
                const th = p.sector * Math.PI / 180;
                const s = neonSign(zone ? zoneSign(zone) : (p.zone_label ?? p.zone).replace(/_/g, ' ').toUpperCase(), zoneColor(p.zone));
                s.position.set(Math.cos(th) * rad, 18, Math.sin(th) * rad); shell.add(s);
            }
        }
    }

    // ── Moon & Mars — SEPARATE forming Grids on their own bodies ──
    const previewGrids: THREE.Group[] = [];   // empty 6-zone skeletons (spin at gridPos)
    const previewBodies: THREE.Group[] = [];  // forming planet bodies (spin on their own axis)
    function buildPreviewGrid(o: { name: string; gridPos: THREE.Vector3; bodyOffset: THREE.Vector3; bodyR: number; bodyColor: number; bodyEmissive: number; atmoColor?: number; atmoOpacity?: number; sign: number }): void {
        const grp = new THREE.Group(); grp.position.copy(o.gridPos); scene.add(grp);
        // the forming planet body spins on its OWN axis (its own group), so the land-shell
        // stays wrapped on it — separate from the grid skeleton's spin around gridPos.
        const bodyGrp = new THREE.Group(); bodyGrp.position.copy(o.gridPos).add(o.bodyOffset); scene.add(bodyGrp); previewBodies.push(bodyGrp);
        const body = new THREE.Mesh(new THREE.SphereGeometry(o.bodyR, 64, 64), new THREE.MeshStandardMaterial({ color: o.bodyColor, emissive: o.bodyEmissive, emissiveIntensity: 0.5, roughness: 1, metalness: 0 }));
        bodyGrp.add(body);
        if (o.atmoColor) { const a = new THREE.Mesh(new THREE.SphereGeometry(o.bodyR * 1.04, 40, 40), new THREE.MeshBasicMaterial({ color: o.atmoColor, transparent: true, opacity: o.atmoOpacity, side: THREE.BackSide, blending: THREE.AdditiveBlending })); bodyGrp.add(a); }
        // ── HYBRID (user-chosen): the FORMING land-shell body (the style we made
        //    last time) + the empty 6-zone grid skeleton hovering ABOVE it. The world
        //    is condensing (land), and its 6-zone city is DEFINED but EMPTY — it fills
        //    only when the Nous + their humans charter it (D-NH-13). APPEARS by default;
        //    NOT focused/developed.
        // forming land-shell wrapping the body (deformed wireframe = land condensing)
        const land = new THREE.SphereGeometry(o.bodyR * 1.08, 26, 18);
        { const lp = land.attributes.position; const lv = new THREE.Vector3();
          for (let i = 0; i < lp.count; i++) { lv.fromBufferAttribute(lp, i); const nn = Math.sin(lv.x * 0.21) + Math.cos(lv.y * 0.17) * 1.3 + Math.sin(lv.z * 0.23) * 1.1; lv.multiplyScalar(1 + nn * 0.05); lp.setXYZ(i, lv.x, lv.y, lv.z); } }
        bodyGrp.add(new THREE.LineSegments(new THREE.WireframeGeometry(land), new THREE.LineBasicMaterial({ color: o.sign, transparent: true, opacity: 0.42 })));
        bodyGrp.add(new THREE.Points(land, new THREE.PointsMaterial({ color: o.sign, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.7 })));
        // empty 6-zone grid skeleton hovering ABOVE the forming body
        const PR: Record<number, number> = { 1: 9, 2: 16, 3: 23 };
        grp.add(new THREE.Mesh(new THREE.SphereGeometry(3.4, 22, 16),
            new THREE.MeshStandardMaterial({ color: 0x2b333b, emissive: o.sign, emissiveIntensity: 0.16, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.55 })));
        grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 2), new THREE.MeshBasicMaterial({ color: o.sign, wireframe: true, transparent: true, opacity: 0.28 })));
        for (const rr of [PR[1], PR[2]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.26, 8, 100), new THREE.MeshBasicMaterial({ color: o.sign, transparent: true, opacity: 0.34 })); t.rotation.x = Math.PI / 2; grp.add(t); }
        { const tilt = new THREE.Group(); tilt.rotation.x = INCL; const t = new THREE.Mesh(new THREE.TorusGeometry(PR[3], 0.26, 8, 100), new THREE.MeshBasicMaterial({ color: 0x5a84c4, transparent: true, opacity: 0.32 })); t.rotation.x = Math.PI / 2; tilt.add(t); grp.add(tilt); }
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const dot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: o.sign, transparent: true, opacity: 0.45 })); dot.position.set(Math.cos(a) * PR[2], 0, Math.sin(a) * PR[2]); grp.add(dot); }
        const meta = { id: o.name.toLowerCase() + ':grid:empty', name: o.name + ' Grid', body: o.name, zone: 'frontier_grid', ring: -1, sector: 0, level: 0, status: 'empty', price_bios: 0, owner_civic_did_hash: null, structure: null, occupant_count: 0, future: true } as unknown as ParcelFeedEntry;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(55, 12, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, o.bodyOffset.y / 2, 0); hit.userData = meta; grp.add(hit); meshes.push(hit);
        const s1 = neonSign(o.name.toUpperCase() + ' GRID', o.sign); s1.position.set(0, 44, 0); grp.add(s1);
        const s2 = neonSign('EMPTY · AWAITING CHARTER', 0x6a7686); s2.position.set(0, 35, 0); s2.scale.set(20, 5, 1); grp.add(s2);
        previewGrids.push(grp);
        GRID_FOCUS[o.name] = { pos: o.gridPos.clone(), radius: 58, label: o.name + ' Grid · empty · awaiting charter' };
    }
    // Positioned in the camera's default forward field (−x/−z, beyond Genesis) so
    // they APPEAR in the world map without focusing — the journey receding into space.
    buildPreviewGrid({ name: 'Moon', gridPos: new THREE.Vector3(-300, 72, -210), bodyOffset: new THREE.Vector3(-14, -62, -24), bodyR: 30, bodyColor: 0x8f8f93, bodyEmissive: 0x33352f, sign: 0x9aa6c0 });
    buildPreviewGrid({ name: 'Mars', gridPos: new THREE.Vector3(-540, 106, -415), bodyOffset: new THREE.Vector3(-18, -66, -28), bodyR: 26, bodyColor: 0x9c4a2f, bodyEmissive: 0x3a1c12, atmoColor: 0xc78a5a, atmoOpacity: 0.12, sign: 0xc88a5a });

    // ── built orbital objects — the real, economy-built world (L4 feed). Rendered as
    //    glowing satellites in an outer shell so the map shows what the Nous perceives. ──
    const objectsGroup = new THREE.Group(); scene.add(objectsGroup);
    const OBJCOL: Record<string, number> = { energy: 0xe7c878, compute: 0x6fd4ff, comms: 0x9a7ad8, sensing: 0x7fe0a0, manufacture: 0x9a5a44 };
    let objectMeshes: THREE.Object3D[] = [];
    function renderObjects(objects: OrbitalObjectEntry[]): void {
        for (const m of objectMeshes) { objectsGroup.remove(m); const i = meshes.indexOf(m as THREE.Mesh); if (i >= 0) meshes.splice(i, 1); }
        objectMeshes = [];
        const n = Math.max(objects.length, 1);
        objects.forEach((o, k) => {
            const col = OBJCOL[o.function_type ?? ''] ?? 0x3fa6bd;
            const th = (k / n) * Math.PI * 2 + 0.3;
            const alt = o.physics_spec?.altitude_km;
            const rad = 100 + (k % 3) * 9 + (typeof alt === 'number' ? Math.min(alt, 800) / 40 : 0);
            const y = 12 + (k % 2 ? 7 : -7);
            const sat = new THREE.Group();
            const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.1, 0),
                new THREE.MeshStandardMaterial({ color: 0xeef4ff, emissive: col, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.35 }));
            sat.add(core);
            sat.add(new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending })));
            // little solar wings
            for (const sgn of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.5), new THREE.MeshStandardMaterial({ color: 0x2b3a52, emissive: col, emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.4 })); w.position.x = sgn * 3.0; sat.add(w); }
            sat.position.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
            sat.userData = { ...o, id: o.object_id, zone: o.zone ?? 'orbital', status: o.status ?? 'active', isObject: true } as unknown as ParcelFeedEntry;
            objectsGroup.add(sat); objectMeshes.push(sat); meshes.push(core);
            core.userData = sat.userData;
        });
    }

    // ── events ── a packet travels from the core to the place an event happened, once,
    // and only when the Grid's scene feed reports one. Nothing moves on its own.
    const pulses: { m: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; born: number }[] = [];
    const PULSE_FRAMES = 150;
    function pulse(parcelId?: string): void {
        const target = new THREE.Vector3(0, 2, 0);
        const hit = parcelId ? meshes.find((m) => (m.userData as { id?: string }).id === parcelId) : undefined;
        if (hit) hit.getWorldPosition(target);
        const from = hit ? new THREE.Vector3(0, 2, 0) : new THREE.Vector3(0, 30, 0); // no place known: it lands on the core
        const curve = new THREE.CatmullRomCurve3([from, new THREE.Vector3((from.x + target.x) * 0.5, Math.max(from.y, target.y) + 16, (from.z + target.z) * 0.5), target]);
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
        scene.add(m); pulses.push({ m, curve, born: t });
    }
    // survey corridor Genesis → Moon → Mars (a marked route; nothing travels it yet)
    { const corridor = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2, 0), new THREE.Vector3(-150, 34, -105), GRID_FOCUS.Moon.pos.clone(), new THREE.Vector3(-410, 74, -300), GRID_FOCUS.Mars.pos.clone()]);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(corridor.getPoints(96)), new THREE.LineDashedMaterial({ color: 0x3fa6bd, transparent: true, opacity: 0.30, dashSize: 3, gapSize: 4 }));
        line.computeLineDistances(); scene.add(line);
    }

    // ── camera (hand-rolled, focus-based) ──
    // Default = a wide "world map" overview angled at the −x/−z journey so Genesis
    // (near Earth) AND the empty Moon/Mars grids are all in frame at load. The Genesis
    // Focusing a Grid (its picker button, or a click on it) zooms in until it fills the view.
    let rx = 0.42, ry = 0.92, dist = 235;
    const focus = new THREE.Vector3(0, 2, 0), focusGoal = focus.clone(); let distGoal = 235;
    let drag = false, px = 0, py = 0;
    function place(): void {
        cam.position.set(focus.x + Math.sin(ry) * Math.cos(rx) * dist, focus.y + Math.sin(rx) * dist + 6, focus.z + Math.cos(ry) * Math.cos(rx) * dist);
        cam.lookAt(focus);
    }
    let focused: string | null = null;   // null = the opening overview
    function focusGrid(name: string): void {
        const key = name in GRID_FOCUS ? name : 'Genesis';
        const f = GRID_FOCUS[key]; focused = key;
        focusGoal.copy(f.pos); distGoal = fitDistance(f.radius, cam.fov, cam.aspect);
        opts.onFocusLabel?.(f.label);
    }
    let downX = 0, downY = 0;
    const onDown = (e: PointerEvent) => { drag = true; px = downX = e.clientX; py = downY = e.clientY; };
    const onUp = () => { drag = false; };
    const onMove = (e: PointerEvent) => { if (!drag) return; ry -= (e.clientX - px) * 0.006; rx = Math.max(-0.5, Math.min(1.45, rx + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; place(); };
    const onWheel = (e: WheelEvent) => { dist = Math.max(70, Math.min(680, dist + e.deltaY * 0.14)); distGoal = dist; place(); };
    canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('pointermove', onMove); addEventListener('wheel', onWheel, { passive: true });

    // ── raycast pick ──
    const ray = new THREE.Raycaster(); const pv = new THREE.Vector2();
    const genesisBounds = new THREE.Sphere(GRID_FOCUS.Genesis.pos, GRID_FOCUS.Genesis.radius);
    const onClick = (e: MouseEvent) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;   // that was an orbit drag, not a click
        pv.x = (e.clientX / innerWidth) * 2 - 1; pv.y = -(e.clientY / innerHeight) * 2 + 1;
        ray.setFromCamera(pv, cam); const hit = ray.intersectObjects(meshes, false)[0];
        opts.onPick(hit ? (hit.object.userData as ParcelFeedEntry) : null);
        // A click on a Grid the camera is not on zooms in to it. On the Grid already in
        // focus the camera stays put, so picking its modules does not undo your own zoom.
        const data = hit?.object.userData as { future?: boolean; body?: string } | undefined;
        const grid = hit ? (data?.future && data.body ? data.body : 'Genesis') : ray.ray.intersectsSphere(genesisBounds) ? 'Genesis' : null;
        if (grid && grid !== focused) { focusGrid(grid); opts.onFocusGrid?.(grid); }
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
        for (const pb of previewBodies) { pb.rotation.y += 0.0016; }
        objectsGroup.rotation.y += 0.0007;  // built objects slowly orbit Genesis
        focus.lerp(focusGoal, 0.07); dist += (distGoal - dist) * 0.07; place();
        planet.rotation.y += 0.00035;
        r3spin.rotation.z += 0.0009;
        councilRing.rotation.y -= 0.0028;
        const bp = 0.4 + Math.abs(Math.sin(t * 0.045)) * 0.35; (beacon.material as THREE.Material & { opacity: number }).opacity = bp; beaconLight.intensity = 0.55 + bp * 0.8;
        coreLight.intensity = 1.6 + Math.sin(t * 0.02) * 0.3;
        for (let i = pulses.length - 1; i >= 0; i--) {
            const p = pulses[i]; const u = (t - p.born) / PULSE_FRAMES;
            if (u >= 1) { scene.remove(p.m); p.m.geometry.dispose(); (p.m.material as THREE.Material).dispose(); pulses.splice(i, 1); continue; }
            p.m.position.copy(p.curve.getPoint(u)); p.m.scale.setScalar(u > 0.85 ? 1 + (u - 0.85) * 20 : 1);
            (p.m.material as THREE.Material & { opacity: number }).opacity = u < 0.08 ? u / 0.08 : u > 0.85 ? (1 - u) / 0.15 : 0.95;
        }
        renderer.render(scene, cam);
        raf = requestAnimationFrame(loop);
    })();

    return {
        setParcels(parcels: ParcelFeedEntry[]) { lastParcels = parcels; scaffoldDone || (scaffold(parcels), scaffoldDone = true); renderParcelModules(parcels); },
        setZones(next: readonly GridZoneView[]) { zones = next; refreshZoneSigns(); if (scaffoldDone) renderParcelModules(lastParcels); },
        setObjects(objects: OrbitalObjectEntry[]) { renderObjects(objects); },
        pulse,
        focusGrid,
        dispose() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('pointermove', onMove); removeEventListener('wheel', onWheel); canvas.removeEventListener('click', onClick); removeEventListener('resize', onResize);
            renderer.dispose();
        },
    };
    // scaffold is built once on the first setParcels (positions are canonical)
}
