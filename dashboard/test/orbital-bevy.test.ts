/**
 * Option C: the orbital map tries the Bevy/WASM scene first and falls back to three.js.
 * A fake WASM module stands in for viz-rs (jsdom has no WebGL2 and no /viz/ bundle).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __testing, mountOrbitalBevy, READY_TIMEOUT_MS, rendererChoice, type VizModule } from '@/components/worldmap/orbital-bevy';

type Callbacks = { onReady(): void; onFatal(why: string): void; onPick(p: unknown): void };

function fakeModule() {
    const calls: string[] = [];
    const cbs: Callbacks[] = [];
    const mod: VizModule = {
        default: async () => undefined,
        start: (_sel, c) => { calls.push('start'); cbs.push(c as Callbacks); },
        set_parcels: (j) => calls.push(`parcels:${JSON.parse(j).length}`),
        set_zones: () => calls.push('zones'),
        set_objects: () => calls.push('objects'),
        focus_grid: (n) => calls.push(`focus:${n}`),
        pulse: (id) => calls.push(`pulse:${id ?? ''}`),
        set_earth: () => calls.push('earth'),
        set_paused: (p) => calls.push(`paused:${p}`),
        stats: () => '{}',
    };
    return { mod, calls, cbs, last: () => cbs[cbs.length - 1] };
}

function page() {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    document.body.appendChild(host);
    const bevyShown = (): boolean => !!document.getElementById('noesis-bevy-canvas') && host.contains(document.getElementById('noesis-bevy-canvas'));
    return { host, canvas, bevyShown };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const opts = { onPick: () => {} };

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

describe('orbital renderer choice', () => {
    it('is Bevy by default and three.js only when asked', () => {
        expect(rendererChoice('')).toBe('bevy');
        expect(rendererChoice('?renderer=bevy')).toBe('bevy');
        expect(rendererChoice('?lang=ko&renderer=three')).toBe('three');
        expect(rendererChoice('?renderer=THREE')).toBe('bevy');
    });
});

describe('mountOrbitalBevy', () => {
    it('rejects without WebGL2 and leaves the page as it was', async () => {
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: false });
        const { host, canvas } = page();
        await expect(mountOrbitalBevy(canvas, opts)).rejects.toThrow(/webgl2/);
        expect(host.children.length).toBe(1);
        expect(canvas.style.display).toBe('');
        expect(f.calls).toEqual([]);
    });

    it('rejects when the bundle does not load', async () => {
        __testing.use({ module: async () => { throw new Error('404'); }, webgl2: true });
        const { host, canvas } = page();
        await expect(mountOrbitalBevy(canvas, opts)).rejects.toThrow(/404/);
        expect(host.children.length).toBe(1);
    });

    it('shows Bevy once it draws, and forwards the handle calls', async () => {
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: true });
        const { canvas, bevyShown } = page();
        const pending = mountOrbitalBevy(canvas, opts);
        await flush();
        f.last().onReady();
        const h = await pending;
        expect(bevyShown()).toBe(true);
        expect(canvas.style.display).toBe('none');
        h.setParcels([{ id: 'a' } as never, { id: 'b' } as never]);
        h.focusGrid('Moon');
        h.pulse();
        expect(f.calls).toEqual(['start', 'parcels:2', 'focus:Moon', 'pulse:']);
        h.dispose();
        expect(bevyShown()).toBe(false);
        expect(canvas.style.display).toBe('block');
        expect(f.calls.at(-1)).toBe('paused:true');
    });

    it('falls back when no frame comes in time, and pauses the app', async () => {
        vi.useFakeTimers();
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: true });
        const { canvas, bevyShown } = page();
        const pending = mountOrbitalBevy(canvas, opts);
        const seen = expect(pending).rejects.toThrow(/no frame/);
        await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS + 1);
        await seen;
        expect(bevyShown()).toBe(false);
        expect(f.calls).toContain('paused:true');
    });

    it('a double mount (React StrictMode) leaves the newer mount showing', async () => {
        vi.useFakeTimers();
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: true });
        const { canvas, bevyShown } = page();
        const first = mountOrbitalBevy(canvas, opts);
        const firstSeen = expect(first).rejects.toThrow(/superseded/);
        const second = mountOrbitalBevy(canvas, opts);
        await vi.advanceTimersByTimeAsync(0);
        f.last().onReady();
        const h = await second;
        await firstSeen;
        // The bug this guards: the older mount's timeout used to pause the app and remove the canvas.
        await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS * 2);
        expect(bevyShown()).toBe(true);
        expect(f.calls.filter((c) => c === 'paused:true')).toEqual([]);
        h.dispose();
        expect(bevyShown()).toBe(false);
    });

    it('a remount while the first mount waits for its frame leaves the newer one showing', async () => {
        vi.useFakeTimers();
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: true });
        const { canvas, bevyShown } = page();
        const first = mountOrbitalBevy(canvas, opts);
        const firstSeen = expect(first).rejects.toThrow(/superseded/);
        await vi.advanceTimersByTimeAsync(0);
        expect(f.calls).toEqual(['start']); // the first mount is waiting for a frame
        const second = mountOrbitalBevy(canvas, opts);
        await vi.advanceTimersByTimeAsync(0);
        f.last().onReady();
        await second;
        await firstSeen;
        await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS * 2);
        expect(bevyShown()).toBe(true);
        expect(canvas.style.display).toBe('none');
        expect(f.calls.filter((c) => c === 'paused:true')).toEqual([]);
    });

    it('a stale handle disposes nothing of the newer mount', async () => {
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: true });
        const { canvas, bevyShown } = page();
        const p1 = mountOrbitalBevy(canvas, opts); await flush(); f.last().onReady();
        const h1 = await p1;
        h1.dispose();
        const p2 = mountOrbitalBevy(canvas, opts); await flush(); f.last().onReady();
        await p2;
        h1.dispose();
        expect(bevyShown()).toBe(true);
        expect(canvas.style.display).toBe('none');
    });

    it('a panic before the first frame rejects; after it, onFatal hands back to three.js', async () => {
        const f = fakeModule();
        __testing.use({ module: async () => f.mod, webgl2: true });
        const { canvas, bevyShown } = page();
        const p1 = mountOrbitalBevy(canvas, opts); await flush();
        f.last().onFatal('boom');
        await expect(p1).rejects.toThrow(/boom/);
        expect(bevyShown()).toBe(false);

        const onFatal = vi.fn();
        const p2 = mountOrbitalBevy(canvas, opts, onFatal); await flush(); f.last().onReady();
        await p2;
        f.last().onFatal('later');
        expect(onFatal).toHaveBeenCalledWith('later');
        expect(bevyShown()).toBe(false);
        expect(canvas.style.display).toBe('block');
    });
});
