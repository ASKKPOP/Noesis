'use client';

/**
 * OrbitalStation3D — the rich 3D Genesis Core orbital station, as a native React
 * client component. THIS is "our world map": the user's preview rendered from the
 * SAME live parcel feed the Nous act on (/api/v1/civic/parcels), with the embedded
 * 53-parcel seed as the offline fallback. Genesis stays near Earth (Earth never
 * transforms); Moon & Mars are SEPARATE forming Grids you fly the camera to.
 *
 * The heavy Three.js lives in ./orbital-station-scene (framework-agnostic); this
 * wrapper owns the HUD / legend / Grid-focus picker / DID-gated info panel and the
 * live fetch. Mounted ssr:false (WebGL is client-only).
 */
import { useEffect, useRef, useState } from 'react';
import { GENESIS_SEED, type ParcelFeedEntry } from './OrbitalGenesisMap';
import { mountOrbitalStation, type OrbitalHandle, type OrbitalObjectEntry } from './orbital-station-scene';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const LEGEND: [string, string][] = [
    ['#8e54b8', 'Government Core · gravity center'],
    ['#8a98ac', 'Infrastructure · commons shell'],
    ['#c2a878', 'Business · equatorial ring'],
    ['#3fa6bd', 'Shopping · equatorial ring'],
    ['#9a5a44', 'Manufacture · equatorial ring'],
    ['#5a84c4', 'Residential · inclined orbit'],
    ['#e7c878', 'Orbital objects · economy-built (what the Nous perceives)'],
    ['#9aa6c0', 'Moon · Mars · empty base Grids — defined, awaiting charter'],
];

function nyClock(): string {
    const days = Math.floor((Date.now() - Date.UTC(2026, 5, 1, 7)) / 86400000);
    return `NY ${Math.floor(days / 365) + 1} · DAY ${(days % 365) + 1}`;
}

export function OrbitalStation3D(): React.ReactElement {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handleRef = useRef<OrbitalHandle | null>(null);
    const [parcels, setParcels] = useState<ParcelFeedEntry[]>(GENESIS_SEED);
    const [objects, setObjects] = useState<OrbitalObjectEntry[]>([]);
    const [source, setSource] = useState<'seed' | 'live'>('seed');
    const [picked, setPicked] = useState<ParcelFeedEntry | null>(null);
    const [focusLabel, setFocusLabel] = useState('Genesis · near Earth');
    const [activeGrid, setActiveGrid] = useState('Genesis');
    const [clock, setClock] = useState(nyClock);

    // Mount the Three.js scene once (WebGL — client only).
    useEffect(() => {
        if (!canvasRef.current) return;
        const h = mountOrbitalStation(canvasRef.current, { onPick: setPicked, onFocusLabel: setFocusLabel });
        handleRef.current = h;
        h.setParcels(GENESIS_SEED);
        if (typeof window !== 'undefined') (window as unknown as { __forestScene?: OrbitalHandle }).__forestScene = h;
        return () => { h.dispose(); handleRef.current = null; };
    }, []);

    // Live parcels — the same source of truth the Nous act on. Seed = offline fallback.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/civic/parcels`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`feed ${res.status}`);
                const payload = (await res.json()) as { parcels?: ParcelFeedEntry[] };
                if (cancelled) return;
                if (Array.isArray(payload.parcels) && payload.parcels.length > 0) {
                    setParcels(payload.parcels); setSource('live');
                }
            } catch { if (!cancelled) setSource('seed'); }
        })();
        return () => { cancelled = true; };
    }, []);

    // Built orbital objects — the economy-built world the Nous now perceives too.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/orbital/objects`, { cache: 'no-store' });
                if (!res.ok) return;
                const payload = (await res.json()) as { objects?: OrbitalObjectEntry[] };
                if (!cancelled && Array.isArray(payload.objects)) setObjects(payload.objects);
            } catch { /* objects are optional — map still renders without them */ }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { handleRef.current?.setParcels(parcels); }, [parcels]);
    useEffect(() => { handleRef.current?.setObjects(objects); }, [objects]);
    useEffect(() => { const id = setInterval(() => setClock(nyClock()), 60000); return () => clearInterval(id); }, []);

    const focus = (name: string): void => { handleRef.current?.focusGrid(name); setActiveGrid(name); };

    const isFuture = (p: ParcelFeedEntry | null): boolean => !!p && (p as unknown as { future?: boolean }).future === true;
    const purchasable = parcels.filter((p) => !['government_quarter', 'infrastructure'].includes(p.zone)).length;

    const hud: React.CSSProperties = { position: 'fixed', zIndex: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", pointerEvents: 'none', color: '#f5f0ea' };
    const btn = (on: boolean): React.CSSProperties => ({ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, border: on ? '1px solid #da7a4e' : '1px solid rgba(255,255,255,.16)', cursor: 'pointer', borderRadius: 999, padding: '5px 12px', background: on ? '#da7a4e' : 'rgba(255,255,255,.04)', color: on ? '#0b1220' : '#f5f0ea', pointerEvents: 'auto' });

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#020610', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, display: 'block' }} />

            {/* title + clock */}
            <div style={{ ...hud, top: 18, left: 22 }}>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900, letterSpacing: '.16em', color: 'rgba(4,12,20,.85)', WebkitTextStroke: '1.3px #4fd2f2', textShadow: '0 0 8px rgba(63,209,255,.8)' }}>NOĒSIS</div>
                <div style={{ fontSize: 10, letterSpacing: '.16em', color: '#da7a4e', textTransform: 'uppercase', marginTop: 2 }}>Genesis Core · Orbital Station</div>
                <div style={{ fontSize: 10.5, color: '#8a93a6', marginTop: 8, lineHeight: 1.8 }}>
                    <b style={{ color: '#da7a4e' }}>{clock}</b> · Genesis Epoch 2026-06-01 PT<br />
                    <b style={{ color: '#da7a4e' }}>{purchasable}</b> purchasable slots · <b style={{ color: '#da7a4e' }}>5</b> civic · <b style={{ color: '#e7c878' }}>{objects.length}</b> built objects · <span style={{ color: source === 'live' ? '#7fe0a0' : '#3fa6bd' }}>{source === 'live' ? `live · ${parcels.length} parcels` : 'founding seed'}</span>
                </div>
            </div>

            {/* legend */}
            <div style={{ ...hud, bottom: 18, left: 22, fontSize: 11, lineHeight: 1.9, color: '#8a93a6' }}>
                {LEGEND.map(([c, label]) => (
                    <div key={label}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 7, verticalAlign: 'middle', background: c }} />{label}</div>
                ))}
            </div>

            {/* Grid-focus picker — Genesis stays near Earth; Moon/Mars are separate Grids */}
            <div style={{ ...hud, bottom: 60, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(2,6,16,.82)', border: '1px solid rgba(0,212,255,.22)', borderRadius: 999, padding: '6px 8px 6px 14px', backdropFilter: 'blur(14px)', pointerEvents: 'auto' }}>
                <span style={{ fontSize: 10, color: '#3fa6bd', letterSpacing: '.04em', marginRight: 4, whiteSpace: 'nowrap' }}>FOCUS · {focusLabel}</span>
                {['Genesis', 'Moon', 'Mars'].map((g) => (
                    <button key={g} style={btn(activeGrid === g)} onClick={() => focus(g)}>{g === 'Genesis' ? 'Genesis' : `${g} Grid`}</button>
                ))}
            </div>

            {/* DID-gated info panel */}
            {picked && (
                <div style={{ ...hud, top: 18, right: 18, width: 250, background: 'rgba(2,6,16,.82)', border: '1px solid rgba(0,212,255,.22)', borderRadius: 12, padding: '16px 18px', backdropFilter: 'blur(14px)', fontSize: 11.5, lineHeight: 1.7, color: '#8a93a6', pointerEvents: 'auto' }}>
                    {(picked as unknown as { isObject?: boolean }).isObject ? (
                        <>
                            <div style={{ color: '#e7c878', fontSize: 13, marginBottom: 8 }}>{(picked as unknown as { function_type?: string }).function_type ?? 'orbital object'} · built</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>status</span><b style={{ color: '#f5f0ea' }}>{picked.status}</b></div>
                            {(picked as unknown as { output_rate?: string }).output_rate && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>output</span><b style={{ color: '#f5f0ea' }}>{(picked as unknown as { output_rate?: string }).output_rate}</b></div>
                            )}
                            <div style={{ marginTop: 11, color: '#da7a4e', fontSize: 11, borderTop: '1px solid rgba(0,212,255,.16)', paddingTop: 10 }}>A real, economy-built orbital object — funded by the Polis treasury, built by a Nous, physics-gated. The same built world the Nous perceives.</div>
                        </>
                    ) : isFuture(picked) ? (
                        <>
                            <div style={{ color: '#3fa6bd', fontSize: 13, marginBottom: 8 }}>{(picked as unknown as { name?: string }).name ?? 'Frontier Grid'} · empty</div>
                            <div style={{ color: '#da7a4e', fontSize: 11, lineHeight: 1.6 }}>The defined EMPTY base Grid on its own world — the 6-zone design is set, but it stays empty until the Nous and their humans charter it (D-NH-13). Genesis stays near Earth; a separate world on the Earth→Moon→Mars journey, not Genesis relocated.</div>
                        </>
                    ) : (
                        <>
                            <div style={{ color: '#3fa6bd', fontSize: 13, marginBottom: 8 }}>{picked.zone.replace(/_/g, ' ')} · district</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>shell</span><b style={{ color: '#f5f0ea' }}>{picked.ring === 0 ? 'core' : `ring ${picked.ring}`}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>status</span><b style={{ color: '#f5f0ea' }}>{picked.status}</b></div>
                            <div style={{ marginTop: 11, color: '#da7a4e', fontSize: 11, borderTop: '1px solid rgba(0,212,255,.16)', paddingTop: 10 }}>🔒 Detail of this space is private. Register and sign in with your Civic DID — it opens only within the space&apos;s entry policy &amp; rules.</div>
                        </>
                    )}
                </div>
            )}

            <div style={{ ...hud, bottom: 18, right: 22, fontSize: 10.5, color: '#8a93a6', textAlign: 'right' }}>drag = orbit · scroll = zoom · click a module<br />exteriors public · per-space detail needs a signed-in DID</div>
        </div>
    );
}

export default OrbitalStation3D;
