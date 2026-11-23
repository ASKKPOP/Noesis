/**
 * district-scene — the district level of the Grid Station View (D-V3-44): one zone
 * drawn as a city along the inside of its ring. Framework-agnostic Three.js.
 *
 * The floor is the ring's outer wall and every building stands with its roof toward
 * the centre, where the government core hangs overhead. The street follows the
 * ring's curve, so it rises ahead and behind. Shapes are drawn by code (no art
 * assets); what stands on each lot comes from the Grid's lot feed, and nothing
 * moves unless the Grid reports an event.
 */
import * as THREE from 'three';
import { FLOOR_RADIUS as R, ROW_OFFSET, districtSpan, type DistrictLot } from './district-layout';
import { drawLabel } from './neon-sign';

/** A Nous standing in this district. */
export interface DistrictNous { did: string; name: string; color: number; asleep: boolean }

export interface DistrictHandle {
    setLots(lots: readonly DistrictLot[]): void;
    /** Who is in this district now. A newcomer walks in from the end of the street; one who left walks out. */
    setNous(nous: readonly DistrictNous[]): void;
    /** This Nous just did something: show a sign above it for a moment. */
    act(did: string, sign: string): void;
    /** Something happened on this lot: flash it once. */
    pulse(lotId?: string): void;
    dispose(): void;
}

const STREET_HALF = 6;
const FLOOR_HALF = 34;
const BODY: Record<DistrictLot['condition'], number> = { maintained: 0xcfd6e4, worn: 0x8d9099, derelict: 0x4b4d55 };

/** A point on the floor at `angle` around the ring and `z` across the street, raised `up` toward the centre. */
const onFloor = (angle: number, z: number, up = 0): THREE.Vector3 =>
    new THREE.Vector3(Math.sin(angle) * (R - up), -Math.cos(angle) * (R - up), z);

/** A strip of the ring's inner surface between two angles. */
function strip(a0: number, a1: number, half: number, lift: number, color: number, opacity = 1): THREE.Mesh {
    const steps = Math.max(8, Math.ceil(((a1 - a0) * R) / 6));
    const pos: number[] = []; const idx: number[] = [];
    for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        for (const z of [-half, half]) { const p = onFloor(a, z, lift); pos.push(p.x, p.y, p.z); }
        if (i < steps) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide, transparent: opacity < 1, opacity }));
}

function building(lot: DistrictLot, accent: number): THREE.Group {
    const g = new THREE.Group();
    const lit = lot.condition !== 'derelict';
    const body = new THREE.MeshStandardMaterial({ color: BODY[lot.condition], roughness: 0.75, emissive: lit ? 0x141c2c : 0x000000 });
    const glow = (color: number, strength: number): THREE.MeshStandardMaterial =>
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.6 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, x = 0, z = 0): THREE.Mesh => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m;
    };
    // A band of windows: warm when someone is inside, cool when empty, dark when derelict.
    const windows = (w: number, d: number, y: number): void => {
        if (!lit) return;
        add(new THREE.BoxGeometry(w + 0.25, 1.1, d + 0.25), glow(lot.occupied ? 0xffd9a0 : 0x5f93b3, lot.occupied ? 1.5 : 0.5), y);
    };
    const pad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 1 }));
    pad.position.y = 0.25; g.add(pad);

    switch (lot.kind) {
        case 'empty': {
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(11.5, 0.6, 11.5)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.45 }));
            edges.position.y = 0.3; g.add(edges); break;
        }
        case 'owned': {
            for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) add(new THREE.CylinderGeometry(0.3, 0.3, 3, 6), glow(accent, 1.1), 2, x, z);
            break;
        }
        case 'home': {
            add(new THREE.BoxGeometry(7.5, 5.5, 7.5), body, 3.25); windows(7.5, 7.5, 3.4);
            const roof = add(new THREE.ConeGeometry(6.1, 3.6, 4), new THREE.MeshStandardMaterial({ color: lit ? 0x7a5a4a : 0x3a3536, roughness: 0.9 }), 7.8);
            roof.rotation.y = Math.PI / 4; break;
        }
        case 'shop': {
            add(new THREE.BoxGeometry(10, 5, 8), body, 3); windows(10, 8, 2.4);
            add(new THREE.BoxGeometry(8.5, 1.4, 0.5), lit ? glow(accent, 1.4) : body, 6.3, 0, 4); break;
        }
        case 'workshop': {
            add(new THREE.BoxGeometry(10, 7, 9), body, 4); windows(10, 9, 4.6);
            add(new THREE.CylinderGeometry(1, 1.2, 6, 10), body, 10.2, 3, -2.5);
            add(new THREE.BoxGeometry(4.5, 3.4, 9), body, 9.2, -2.5, 0); break;
        }
        case 'venue': {
            add(new THREE.CylinderGeometry(5.2, 5.6, 5.5, 20), body, 3.25);
            if (lit) add(new THREE.CylinderGeometry(5.55, 5.55, 1.1, 20), glow(lot.occupied ? 0xffd9a0 : 0x5f93b3, lot.occupied ? 1.5 : 0.5), 3.2);
            add(new THREE.SphereGeometry(5.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lit ? glow(accent, 0.55) : body, 6); break;
        }
        default: {
            add(new THREE.BoxGeometry(8, 8, 8), body, 4.5); windows(8, 8, 3.2); windows(8, 8, 6.2);
        }
    }
    return g;
}

export function mountDistrict(canvas: HTMLCanvasElement, accent: number): DistrictHandle {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020610);
    scene.fog = new THREE.Fog(0x020610, 260, 620);
    const cam = new THREE.PerspectiveCamera(46, 1, 1, 1400);

    scene.add(new THREE.AmbientLight(0x8fa6c8, 0.75));
    const coreLight = new THREE.PointLight(0xbf80ff, 1.6, 0, 0.25); scene.add(coreLight);

    // Stars, and the government core overhead: the centre every roof points to.
    { const pos: number[] = []; for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900); pos.push(v.x, v.y, v.z); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false }))); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(13, 28, 20), new THREE.MeshBasicMaterial({ color: 0xbf00ff, fog: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(21, 28, 20), new THREE.MeshBasicMaterial({ color: 0xbf00ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, fog: false }));
    scene.add(core, halo);
    // The rest of the ring, arching overhead: its two edges drawn all the way round.
    for (const z of [-FLOOR_HALF, FLOOR_HALF]) {
        const pts: THREE.Vector3[] = []; for (let i = 0; i <= 180; i++) pts.push(onFloor((i / 180) * Math.PI * 2, z));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.32, fog: false })));
    }

    const district = new THREE.Group(); scene.add(district);
    const places = new Map<string, THREE.Vector3>();
    let span = 0.1;

    function setLots(lots: readonly DistrictLot[]): void {
        for (const child of [...district.children]) {
            district.remove(child);
            child.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
        }
        places.clear();
        span = districtSpan(lots);
        const edge = span / 2 + 0.07;
        district.add(strip(-edge - 0.5, edge + 0.5, FLOOR_HALF, 0, 0x0d1524));           // the ring's floor, running on past the district
        district.add(strip(-edge, edge, STREET_HALF, 0.15, 0x26324a));                    // the street
        district.add(strip(-edge, edge, 0.35, 0.3, accent, 0.7));                         // its centre line, in the zone's colour
        for (const lot of lots) {
            const b = building(lot, accent);
            b.position.copy(onFloor(lot.angle, lot.side * ROW_OFFSET));
            b.rotation.z = lot.angle;                    // local "up" now points at the centre
            if (lot.side === -1) b.rotateY(Math.PI);     // fronts face the street
            district.add(b);
            places.set(lot.id, onFloor(lot.angle, lot.side * ROW_OFFSET, 9));
        }
        along = Math.max(-span / 2, Math.min(span / 2, along));
    }

    // ── the Nous ── each stands on the street in its own colour, under its name.
    interface Figure { g: THREE.Group; body: THREE.MeshStandardMaterial; angle: number; z: number; toAngle: number; toZ: number; leaving: boolean; asleep: boolean; sign: THREE.Sprite | null; signBorn: number }
    const figures = new Map<string, Figure>();
    function label(text: string, size: number, color: string): THREE.Sprite {
        const c = drawLabel(text, size, color);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, fog: false }));
        sprite.scale.set((c.width / c.height) * 2.6, 2.6, 1);
        return sprite;
    }
    function drop(o: THREE.Object3D): void {
        o.traverse((x) => { const m = x as THREE.Mesh & { material?: THREE.Material & { map?: THREE.Texture } }; m.geometry?.dispose(); m.material?.map?.dispose(); m.material?.dispose(); });
        o.removeFromParent();
    }
    const streetEnd = (did: string): number => (span / 2 + 0.09) * (did.charCodeAt(did.length - 1) % 2 ? 1 : -1);

    function setNous(list: readonly DistrictNous[]): void {
        const here = new Set(list.map((n) => n.did));
        for (const [did, f] of figures) if (!here.has(did) && !f.leaving) { f.leaving = true; f.toAngle = streetEnd(did); }
        list.forEach((n, i) => {
            let f = figures.get(n.did);
            if (!f) {
                const g = new THREE.Group();
                const body = new THREE.MeshStandardMaterial({ color: n.color, emissive: n.color, emissiveIntensity: 0.55, roughness: 0.5 });
                const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 2.0, 6, 12), body); torso.position.y = 2.1; g.add(torso);
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), body); head.position.y = 4.6; g.add(head);
                const name = label(n.name, 44, '#f5f0ea'); name.position.y = 7.4; g.add(name);
                scene.add(g);
                f = { g, body, angle: streetEnd(n.did), z: 0, toAngle: 0, toZ: 0, leaving: false, asleep: n.asleep, sign: null, signBorn: 0 };
                figures.set(n.did, f);
            }
            f.leaving = false; f.asleep = n.asleep;
            f.toAngle = ((i - (list.length - 1) / 2) * 8) / R;   // spread along the middle of the street
            f.toZ = (i % 2 ? 1 : -1) * 2.6;
            f.body.emissiveIntensity = n.asleep ? 0.08 : 0.55;
        });
    }

    function act(did: string, sign: string): void {
        const f = figures.get(did);
        if (!f) return;
        if (f.sign) drop(f.sign);
        f.sign = label(sign, 56, '#ffd9a0'); f.sign.position.y = 10.6; f.signBorn = frame; f.g.add(f.sign);
    }

    const flashes: { m: THREE.Mesh; born: number }[] = [];
    let frame = 0;
    function pulse(lotId?: string): void {
        const at = lotId ? places.get(lotId) : undefined;
        if (!at) return; // not in this district — the station view shows it
        const m = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.copy(at); scene.add(m); flashes.push({ m, born: frame });
    }

    // Camera: above the street and off to one side, looking down on the city. Drag
    // moves along the ring; the wheel moves closer or further.
    let along = 0; let zoom = 1; let dragging = false; let lastX = 0;
    function place(): void {
        const up = new THREE.Vector3(-Math.sin(along), Math.cos(along), 0); // toward the centre from here
        cam.position.copy(onFloor(along, 86 * zoom, 52 * zoom));
        cam.up.copy(up);
        cam.lookAt(onFloor(along, -4, 5));
    }
    const onDown = (e: PointerEvent): void => { dragging = true; lastX = e.clientX; };
    const onUp = (): void => { dragging = false; };
    const onMove = (e: PointerEvent): void => {
        if (!dragging) return;
        along = Math.max(-span / 2, Math.min(span / 2, along - (e.clientX - lastX) * 0.0016)); lastX = e.clientX;
    };
    const onWheel = (e: WheelEvent): void => { e.preventDefault(); zoom = Math.max(0.45, Math.min(2.2, zoom * (e.deltaY > 0 ? 1.08 : 0.93))); };
    const onResize = (): void => {
        const w = canvas.clientWidth || window.innerWidth; const h = canvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('pointermove', onMove);
    canvas.addEventListener('wheel', onWheel, { passive: false }); addEventListener('resize', onResize);
    onResize();

    let raf = 0;
    (function loop(): void {
        frame++;
        place();
        halo.scale.setScalar(1 + Math.sin(frame * 0.02) * 0.05);
        for (const [did, f] of figures) {
            f.angle += (f.toAngle - f.angle) * 0.03; f.z += (f.toZ - f.z) * 0.03;
            if (f.leaving && Math.abs(f.toAngle - f.angle) < 0.004) { drop(f.g); figures.delete(did); continue; }
            f.g.position.copy(onFloor(f.angle, f.z, 0.4)); f.g.rotation.z = f.angle;
            if (f.sign && frame - f.signBorn > 260) { drop(f.sign); f.sign = null; }
        }
        for (let i = flashes.length - 1; i >= 0; i--) {
            const f = flashes[i]; const u = (frame - f.born) / 110;
            if (u >= 1) { scene.remove(f.m); f.m.geometry.dispose(); (f.m.material as THREE.Material).dispose(); flashes.splice(i, 1); continue; }
            f.m.scale.setScalar(1 + u * 5); (f.m.material as THREE.Material & { opacity: number }).opacity = 0.9 * (1 - u);
        }
        renderer.render(scene, cam);
        raf = requestAnimationFrame(loop);
    })();

    return {
        setLots, setNous, act, pulse,
        dispose() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('pointermove', onMove);
            canvas.removeEventListener('wheel', onWheel); removeEventListener('resize', onResize);
            for (const f of figures.values()) drop(f.g);
            renderer.dispose();
        },
    };
}
