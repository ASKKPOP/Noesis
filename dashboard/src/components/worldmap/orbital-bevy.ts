/**
 * orbital-bevy — the orbital map rendered by Bevy (option C): viz-rs/ compiled to WASM and
 * served from /viz/ (built into the dashboard image by docker/Dockerfile.dashboard, stage 0). It returns the
 * same OrbitalHandle as the three.js scene, so OrbitalStation3D can use either; three.js stays
 * as the fallback when WebGL2 is missing, the bundle does not load, or Bevy draws no frame in
 * time.
 *
 * winit can build its event loop only once per page, so the Bevy app is started once and owns
 * one canvas for the life of the page. Unmounting the map detaches that canvas and pauses the
 * app; mounting it again re-attaches the canvas and resumes.
 */
import type { MountOpts, OrbitalHandle, OrbitalObjectEntry } from './orbital-station-scene';
import type { ParcelFeedEntry } from './OrbitalGenesisMap';
import type { GridZoneView } from './zone-view';
import { drawLabel, drawNeonSign } from './neon-sign';
import type { DistrictHandle, DistrictNous } from './district-scene';
import type { DistrictLot } from './district-layout';

/** The wasm-bindgen exports of viz-rs/src/web.rs. */
export interface VizModule {
    default(input?: unknown): Promise<unknown>;
    start(selector: string, callbacks: object): void;
    set_parcels(json: string): void;
    set_zones(json: string): void;
    set_objects(json: string): void;
    focus_grid(name: string): void;
    pulse(parcelId?: string): void;
    set_earth(width: number, height: number, rgba: Uint8Array): void;
    set_paused(paused: boolean): void;
    /** `{ parcels, modules, pickables, frames }` as JSON — for checks. */
    stats(): string;
    district_open(accent: number): void;
    district_close(): void;
    district_lots(json: string): void;
    district_nous(json: string): void;
    district_act(did: string, sign: string): void;
    district_pulse(lotId?: string): void;
    /** `{ open, lots, nous }` as JSON — for checks. */
    district_stats(): string;
}

export type OrbitalRenderer = 'bevy' | 'three';

/** `?renderer=three` forces the three.js scene, `?renderer=bevy` the Bevy one; Bevy is the default. */
export function rendererChoice(search: string): OrbitalRenderer {
    return new URLSearchParams(search).get('renderer') === 'three' ? 'three' : 'bevy';
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const GLUE_URL = `${BASE}/viz/noesis_viz.js`;
const EARTH_URL = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';
/** How long Bevy may take to draw its first frames before the map falls back to three.js. */
export const READY_TIMEOUT_MS = 20000;
const CANVAS_ID = 'noesis-bevy-canvas';

let webgl2Available = (): boolean => {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
};
let importGlue = (): Promise<VizModule> => import(/* webpackIgnore: true */ GLUE_URL) as Promise<VizModule>;

/** Test seams: a fake WASM module and WebGL2 answer (jsdom has neither). */
export const __testing = {
    use(fake: { module: () => Promise<VizModule>; webgl2: boolean }): void {
        importGlue = fake.module; webgl2Available = () => fake.webgl2;
        modPromise = null; shell = null; earthSent = true; generation = 0; supersede = null; live = null;
    },
};

let modPromise: Promise<VizModule> | null = null;
let shell: HTMLDivElement | null = null;
let earthSent = false;

function loadModule(): Promise<VizModule> {
    modPromise ??= (async () => {
        const mod = await importGlue();
        await mod.default();
        // For inspection (like window.__forestScene): what the Bevy scene holds.
        (window as unknown as { __noesisViz?: { stats(): unknown; district(): unknown } }).__noesisViz = { stats: () => JSON.parse(mod.stats()), district: () => JSON.parse(mod.district_stats()) };
        return mod;
    })();
    modPromise.catch(() => { modPromise = null; });
    return modPromise;
}

/** The page-lifetime box + canvas Bevy renders into (it fits the canvas to this box). */
function bevyShell(): HTMLDivElement {
    if (shell) return shell;
    shell = document.createElement('div');
    shell.style.cssText = 'position:fixed;inset:0;display:block';
    shell.dataset.renderer = 'bevy';
    const c = document.createElement('canvas');
    c.id = CANVAS_ID;
    c.style.cssText = 'display:block;width:100%;height:100%;outline:none';
    shell.appendChild(c);
    return shell;
}

function pixels(c: HTMLCanvasElement): { width: number; height: number; data: Uint8Array } {
    const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    return { width: c.width, height: c.height, data: new Uint8Array(img.data.buffer) };
}

function signPixels(text: string, hex: number): { width: number; height: number; data: Uint8Array } {
    const c = drawNeonSign(text, hex);
    const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    return { width: c.width, height: c.height, data: new Uint8Array(img.data.buffer) };
}

/** Earth's texture, decoded by the browser (the WASM carries no JPEG decoder). */
function earthPixels(): Promise<{ width: number; height: number; data: Uint8Array }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
                const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
                const d = x.getImageData(0, 0, c.width, c.height);
                resolve({ width: c.width, height: c.height, data: new Uint8Array(d.data.buffer) });
            } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('earth texture'));
        img.src = EARTH_URL;
    });
}

/** Each mount's number. The canvas and the app are shared, so only the newest mount may
 *  show, hide or pause them: an older one (React StrictMode mounts twice; a quick remount)
 *  stops quietly instead of tearing down the newer one. */
let generation = 0;

/** The mounted Bevy scene, while there is one: the district level borrows its canvas. */
interface LiveBevy { mod: VizModule; box: HTMLDivElement; home: HTMLCanvasElement; lost: Set<() => void> }
let live: LiveBevy | null = null;
/** Ends the previous mount's wait for the first frame when a newer mount starts. */
let supersede: (() => void) | null = null;

/**
 * Mount the Bevy scene in place of `canvas` (the three.js canvas, hidden while Bevy shows).
 * Rejects — leaving the page as it was — when Bevy cannot run here; the caller then mounts three.js.
 * `onFatal` is called if the app stops after it has mounted (the caller then mounts three.js).
 */
export async function mountOrbitalBevy(canvas: HTMLCanvasElement, opts: MountOpts, onFatal?: (why: string) => void): Promise<OrbitalHandle> {
    if (!webgl2Available()) throw new Error('webgl2 unavailable');
    const gen = ++generation;
    supersede?.();
    const mod = await loadModule();
    const isLive = (): boolean => gen === generation;
    if (!isLive()) throw new Error('bevy: superseded');
    const box = bevyShell();
    canvas.parentElement?.insertBefore(box, canvas);
    let resolveReady!: () => void;
    let rejectReady!: (e: Error) => void;
    let mounted = false;
    const ready = new Promise<void>((res, rej) => { resolveReady = res; rejectReady = rej; });
    supersede = () => rejectReady(new Error('bevy: superseded'));
    // The app panicked: it will not draw again on this page. Before ready the mount fails;
    // after it, the caller puts the three.js scene back.
    const fatal = (why: string): void => {
        if (!isLive()) return;
        if (live) { for (const f of [...live.lost]) f(); live = null; }
        box.remove(); canvas.style.display = 'block';
        if (mounted) onFatal?.(why); else rejectReady(new Error(`bevy: ${why}`));
    };
    mod.start(`#${CANVAS_ID}`, {
        onPick: (p: ParcelFeedEntry | null) => opts.onPick(p),
        onFocusLabel: (l: string) => opts.onFocusLabel?.(l),
        onFocusGrid: (n: string) => opts.onFocusGrid?.(n),
        renderSign: signPixels,
        renderLabel: (text: string, size: number, color: string) => pixels(drawLabel(text, size, color)),
        onReady: () => resolveReady(),
        onFatal: fatal,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([ready, new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('bevy: no frame in time')), READY_TIMEOUT_MS); })]);
    } catch (e) {
        if (isLive()) { mod.set_paused(true); box.remove(); }
        throw e;
    } finally {
        clearTimeout(timer);
    }
    if (!isLive()) throw new Error('bevy: superseded');
    canvas.style.display = 'none';
    mounted = true;
    const me: LiveBevy = { mod, box, home: canvas, lost: new Set() };
    live = me;
    if (!earthSent) {
        earthSent = true;
        earthPixels().then(({ width, height, data }) => mod.set_earth(width, height, data))
            .catch(() => { earthSent = false; /* Earth stays the plain blue sphere */ });
    }
    return {
        setParcels: (parcels: ParcelFeedEntry[]) => mod.set_parcels(JSON.stringify(parcels)),
        setZones: (zones: readonly GridZoneView[]) => mod.set_zones(JSON.stringify(zones)),
        setObjects: (objects: OrbitalObjectEntry[]) => mod.set_objects(JSON.stringify(objects)),
        focusGrid: (name: string) => mod.focus_grid(name),
        pulse: (parcelId?: string) => mod.pulse(parcelId),
        dispose: () => {
            if (!isLive()) return;
            generation++; // nothing of this mount may act any more
            if (live === me) live = null;
            mod.set_paused(true); box.remove(); canvas.style.display = 'block';
        },
    };
}

/**
 * The district level in Bevy (D-V3-44, option C): the same app draws it with its own camera,
 * so the station's canvas moves into the district overlay (in front of `canvas`, the three.js
 * district canvas, hidden meanwhile) and goes back on close. Returns null when Bevy is not the
 * live renderer — the caller then mounts the three.js district. `onLost` is called if Bevy
 * stops while the district is open (the caller then mounts the three.js district).
 */
export function mountBevyDistrict(container: HTMLElement, canvas: HTMLCanvasElement, accent: number, onLost: () => void): DistrictHandle | null {
    const m = live;
    if (!m) return null;
    container.insertBefore(m.box, canvas);
    canvas.style.display = 'none';
    m.mod.district_open(accent);
    let closed = false;
    const lost = (): void => { closed = true; canvas.style.display = 'block'; onLost(); };
    m.lost.add(lost);
    return {
        setLots: (lots: readonly DistrictLot[]) => { if (!closed) m.mod.district_lots(JSON.stringify(lots)); },
        setNous: (nous: readonly DistrictNous[]) => { if (!closed) m.mod.district_nous(JSON.stringify(nous)); },
        act: (did: string, sign: string) => { if (!closed) m.mod.district_act(did, sign); },
        pulse: (lotId?: string) => { if (!closed) m.mod.district_pulse(lotId); },
        dispose: () => {
            if (closed) return;
            closed = true;
            m.lost.delete(lost);
            m.mod.district_close();
            canvas.style.display = 'block';
            // Back to the station, unless the station itself has gone meanwhile.
            if (live === m) m.home.parentElement?.insertBefore(m.box, m.home);
            else m.box.remove();
        },
    };
}
