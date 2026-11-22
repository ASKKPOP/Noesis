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
import { useCallback, useEffect, useRef, useState } from 'react';
import { GENESIS_SEED, type ParcelFeedEntry } from './OrbitalGenesisMap';
import { mountOrbitalStation, type OrbitalHandle, type OrbitalObjectEntry } from './orbital-station-scene';
import { pickerEntries, type PickerEntry, type PortalGrid } from './grid-picker';
import { gridEntryHref } from '@/lib/grid-host';
import GridCard from './GridCard';
import DistrictView from './DistrictView';
import type { DistrictHandle } from './district-scene';
import { LANGS, pickLang, translator, type Lang } from './map-i18n';
import { parseSceneEvents, refreshNeeded, sceneLine, type SceneEvent, type SceneKind } from './scene-events';
import { applySceneEvents, nousColor, parseRoster, placeOf, type NousView } from './nous-places';
import { TEMPLATE_ZONES, landCounts, parseZones, zoneColor, zoneLabel, zoneLegend, type GridZoneView } from './zone-view';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
/** The Grid's own host (e.g. grid.noesiis.com). Unset = enter on this origin. */
const GRID_HOST = process.env.NEXT_PUBLIC_GRID_HOST;

/** Where the chosen map language is remembered in this browser. */
const LANG_KEY = 'noesis.map.lang';
/** The scene's own worlds: their focus line is worded in the viewer's language. */
/** How often the map asks the Grid what has happened (the Grid ticks far slower). */
const FEED_EVERY_MS = 5000;
/** How many recent events the list keeps on screen. */
const FEED_LINES = 6;
/** The sign shown above a Nous for a moment when it does something. */
const ACT_SIGN: Partial<Record<SceneKind, string>> = { spoke: '…', traded: '⇄', proposed: '✎', used_tool: '⚙', slept: 'z z', woke: '☀', arrived: '✦' };
const FOCUS_KEYS = { Genesis: 'focusGenesis', Moon: 'focusMoon', Mars: 'focusMars' } as const;

function nyClock(): string {
    const days = Math.floor((Date.now() - Date.UTC(2026, 5, 1, 7)) / 86400000);
    return `NY ${Math.floor(days / 365) + 1} · DAY ${(days % 365) + 1}`;
}

/** `portal` = mounted as the Portal's public front page (D-V3-41): adds the Sign in /
 *  Join / About links and the "Enter <Grid>" link. `backHref` = mounted as a Grid's own
 *  entry page: adds a link back to the Portal. Scene, HUD, legend and picker are the same. */
export function OrbitalStation3D({ portal = false, backHref }: { portal?: boolean; backHref?: string } = {}): React.ReactElement {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handleRef = useRef<OrbitalHandle | null>(null);
    const [parcels, setParcels] = useState<ParcelFeedEntry[]>(GENESIS_SEED);
    const [objects, setObjects] = useState<OrbitalObjectEntry[]>([]);
    const [source, setSource] = useState<'seed' | 'live'>('seed');
    const [picked, setPicked] = useState<ParcelFeedEntry | null>(null);
    const [focusLabel, setFocusLabel] = useState('Genesis · near Earth');
    const [activeGrid, setActiveGrid] = useState('Genesis');
    // The Grid whose description is open: set when the map zooms to a Grid.
    const [described, setDescribed] = useState<string | null>(null);
    const [clock, setClock] = useState(nyClock);
    const [recMsg, setRecMsg] = useState<string | null>(null);
    const [grids, setGrids] = useState<PortalGrid[] | null>(null);
    // The Grid's zone set (D-V3-40). The six-zone template is the offline fallback.
    const [zones, setZones] = useState<readonly GridZoneView[]>(TEMPLATE_ZONES);
    // English until the browser is read (the page is prerendered in English).
    // The most recent scene events, newest first; null = the feed has not answered yet.
    const [happened, setHappened] = useState<SceneEvent[]>([]);
    const [feedLive, setFeedLive] = useState<boolean | null>(null);
    // The zone whose district is open (the second level of the Grid Station View).
    const [district, setDistrict] = useState<string | null>(null);
    const districtRef = useRef<DistrictHandle | null>(null);
    // The Grid's Nous: who they are and which region each is in (no balances).
    const [nous, setNous] = useState<NousView[]>([]);
    const nousRef = useRef<NousView[]>([]);
    useEffect(() => { nousRef.current = nous; }, [nous]);
    const [lang, setLang] = useState<Lang>('en');
    const t = translator(lang);

    useEffect(() => {
        let saved: string | null = null;
        try { saved = window.localStorage.getItem(LANG_KEY); } catch { /* storage blocked — use the browser's language */ }
        setLang(pickLang(saved, navigator.languages ?? []));
    }, []);
    const chooseLang = (next: Lang): void => {
        setLang(next);
        try { window.localStorage.setItem(LANG_KEY, next); } catch { /* storage blocked — the choice lasts for this visit */ }
    };

    // Mount the Three.js scene once (WebGL — client only).
    useEffect(() => {
        if (!canvasRef.current) return;
        const h = mountOrbitalStation(canvasRef.current, { onPick: setPicked, onFocusLabel: setFocusLabel, onFocusGrid: (name) => { setActiveGrid(name); setDescribed(name); } });
        handleRef.current = h;
        h.setParcels(GENESIS_SEED);
        if (typeof window !== 'undefined') (window as unknown as { __forestScene?: OrbitalHandle }).__forestScene = h;
        return () => { h.dispose(); handleRef.current = null; };
    }, []);

    // Live parcels — the same source of truth the Nous act on. Seed = offline fallback.
    const loadParcels = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/civic/parcels`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`feed ${res.status}`);
            const payload = (await res.json()) as { parcels?: ParcelFeedEntry[] };
            if (Array.isArray(payload.parcels) && payload.parcels.length > 0) { setParcels(payload.parcels); setSource('live'); }
        } catch { /* unreachable — the map keeps what it last had (the founding seed at first) */ }
    }, []);

    // The Grid's current zones — its Polis may have added, relabeled or removed some.
    const loadZones = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/zoning/zones`, { cache: 'no-store' });
            if (!res.ok) return;
            const live = parseZones(await res.json());
            if (live) setZones(live);
        } catch { /* zones unreachable — the map keeps what it last had */ }
    }, []);

    // Built orbital objects — the economy-built world the Nous now perceives too.
    const loadObjects = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/orbital/objects`, { cache: 'no-store' });
            if (!res.ok) return;
            const payload = (await res.json()) as { objects?: OrbitalObjectEntry[] };
            if (Array.isArray(payload.objects)) setObjects(payload.objects);
        } catch { /* objects are optional — map still renders without them */ }
    }, []);

    // The Grid's public list of Nous: names and where each one is.
    const loadNous = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/nous`, { cache: 'no-store' });
            const list = res.ok ? parseRoster(await res.json()) : null;
            // Sleep is known only from events, so keep what has been seen for a Nous still listed.
            if (list) setNous((was) => list.map((n) => ({ ...n, asleep: was.find((w) => w.did === n.did)?.asleep ?? false })));
        } catch { /* unreachable — the roster keeps what it last had */ }
    }, []);

    useEffect(() => { void loadParcels(); void loadZones(); void loadObjects(); void loadNous(); }, [loadParcels, loadZones, loadObjects, loadNous]);

    // The scene feed (D-V3-43): what has happened in the Grid, as it happens. Each new
    // event is listed, pulses the place it happened, and makes the map re-read whatever
    // it changed. The first answer is recent history: listed, but not replayed.
    useEffect(() => {
        let stopped = false;
        let cursor: number | null = null;
        const ask = async (): Promise<void> => {
            if (document.hidden) return;
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/scene/events${cursor === null ? '' : `?since=${cursor}`}`, { cache: 'no-store', credentials: 'include' });
                const page = res.ok ? parseSceneEvents(await res.json()) : null;
                if (stopped) return;
                if (!page) { setFeedLive(false); return; }
                const first = cursor === null;
                cursor = page.cursor;
                setFeedLive(true);
                if (page.events.length === 0) return;
                setHappened((was) => [...page.events].reverse().concat(was).slice(0, FEED_LINES));
                if (first) return;
                // Follow each Nous: where it moved, whether it sleeps; re-read the list for a newcomer.
                const followed = applySceneEvents(nousRef.current, page.events);
                setNous(followed.nous);
                if (followed.unknown) void loadNous();
                for (const e of page.events) { const sign = ACT_SIGN[e.kind]; if (sign && e.actor) districtRef.current?.act(e.actor.did, sign); }
                page.events.forEach((e, i) => setTimeout(() => { handleRef.current?.pulse(e.parcel_id); districtRef.current?.pulse(e.parcel_id); }, i * 400));
                const changed = refreshNeeded(page.events);
                if (changed.has('parcels')) void loadParcels();
                if (changed.has('objects')) void loadObjects();
                if (changed.has('zones')) void loadZones();
            } catch { if (!stopped) setFeedLive(false); }
        };
        void ask();
        const id = setInterval(() => { void ask(); }, FEED_EVERY_MS);
        return () => { stopped = true; clearInterval(id); };
    }, [loadParcels, loadObjects, loadZones, loadNous]);

    // The Grid registry — which Grids exist, and which are private / locked for this
    // viewer (D-V3-41). Session cookie included so a member sees their Grid unlocked.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/grids`, { cache: 'no-store', credentials: 'include' });
                if (!res.ok) return;
                const payload = (await res.json()) as { grids?: PortalGrid[] };
                if (!cancelled && Array.isArray(payload.grids)) setGrids(payload.grids);
            } catch { /* registry unreachable — the picker keeps the scene's own Grids */ }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { handleRef.current?.setParcels(parcels); }, [parcels]);
    useEffect(() => { handleRef.current?.setObjects(objects); }, [objects]);
    useEffect(() => { handleRef.current?.setZones(zones); }, [zones]);
    useEffect(() => { const id = setInterval(() => setClock(nyClock()), 60000); return () => clearInterval(id); }, []);

    const entries = pickerEntries(grids);
    const activeEntry = entries.find((e) => e.name === activeGrid);
    const focus = (e: PickerEntry): void => {
        handleRef.current?.focusGrid(e.name); setActiveGrid(e.name); setDescribed(e.name);
        if (e.locked) { setRecMsg(t('toastPrivate', { name: e.name })); setTimeout(() => setRecMsg(null), 4500); }
    };

    // Join-a-Grid S3 — a signed-in User recommends the focused Grid to their owned Nous.
    // Advisory: the Nous reads it and decides. Server resolves which Nous from the session.
    const recommend = async (): Promise<void> => {
        setRecMsg(t('recommending'));
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/grid-recommendations`, {
                method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ grid_id: activeGrid.toLowerCase() }),
            });
            const j = (await res.json().catch(() => ({}))) as { recommended_to?: number; error?: string };
            if (res.status === 401) setRecMsg(t('signInToRecommend'));
            else if (res.ok) setRecMsg(t('recommended', { name: activeGrid, n: j.recommended_to ?? 0 }));
            else if (j.error === 'no_owned_nous') setRecMsg(t('noOwnedNous'));
            else setRecMsg(t('couldNotRecommend'));
        } catch { setRecMsg(t('couldNotRecommend')); }
        setTimeout(() => setRecMsg(null), 4500);
    };

    const isFuture = (p: ParcelFeedEntry | null): boolean => !!p && (p as unknown as { future?: boolean }).future === true;
    const { purchasable, civic } = landCounts(parcels, zones);

    /** The zone an event happened in, by its Polis's label: from the event, else from its lot. */
    const zoneOf = (e: SceneEvent): string | undefined => {
        const id = e.zone_id ?? parcels.find((p) => p.id === e.parcel_id)?.zone;
        return id ? zones.find((z) => z.zone_id === id)?.label ?? id : undefined;
    };

    const hud: React.CSSProperties = { position: 'fixed', zIndex: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", pointerEvents: 'none', color: '#f5f0ea' };
    const btn = (on: boolean): React.CSSProperties => ({ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, border: on ? '1px solid #da7a4e' : '1px solid rgba(255,255,255,.16)', cursor: 'pointer', borderRadius: 999, padding: '5px 12px', background: on ? '#da7a4e' : 'rgba(255,255,255,.04)', color: on ? '#0b1220' : '#f5f0ea', pointerEvents: 'auto' });

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#020610', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, display: 'block' }} />

            {/* title + clock */}
            <div style={{ ...hud, top: 18, left: 22 }}>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900, letterSpacing: '.16em', color: 'rgba(4,12,20,.85)', WebkitTextStroke: '1.3px #4fd2f2', textShadow: '0 0 8px rgba(63,209,255,.8)' }}>NOĒSIS</div>
                <div style={{ fontSize: 10, letterSpacing: '.16em', color: '#da7a4e', textTransform: 'uppercase', marginTop: 2 }}>{t('subtitle')}</div>
                <div style={{ fontSize: 10.5, color: '#8a93a6', marginTop: 8, lineHeight: 1.8 }}>
                    <b style={{ color: '#da7a4e' }}>{clock}</b> · {t('epoch')}<br />
                    <b style={{ color: '#da7a4e' }}>{purchasable}</b> {t('purchasableSlots')} · <b style={{ color: '#da7a4e' }}>{civic}</b> {t('civic')} · <b style={{ color: '#e7c878' }}>{objects.length}</b> {t('builtObjects')} · <span style={{ color: source === 'live' ? '#7fe0a0' : '#3fa6bd' }}>{source === 'live' ? t('liveParcels', { n: parcels.length }) : t('foundingSeed')}</span>
                </div>
            </div>

            {/* full description of the Grid the map zoomed to */}
            {described && (
                <GridCard
                    origin={GRID_ORIGIN} name={described} top={112}
                    grid={(grids ?? []).find((g) => g.name.toLowerCase() === described.toLowerCase()) ?? null}
                    registryLoaded={grids !== null}
                    zoneLabels={zones.map((z) => z.label)} land={{ purchasable, civic }}
                    t={t} onClose={() => setDescribed(null)}
                />
            )}

            {/* legend */}
            <div style={{ ...hud, bottom: 18, left: 22, fontSize: 11, lineHeight: 1.9, color: '#8a93a6', pointerEvents: 'auto' }}>
                {zoneLegend(zones).map(([c, label], i) => (
                    <button
                        key={zones[i].zone_id} onClick={() => setDistrict(zones[i].zone_id)} title={t('legendOpen', { zone: zones[i].label })}
                        style={{ display: 'block', background: 'none', border: 'none', padding: 0, font: 'inherit', lineHeight: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                    ><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 7, verticalAlign: 'middle', background: c }} />{label} <span style={{ color: '#4fd2f2' }}>→</span></button>
                ))}
                {[['#e7c878', t('legendObjects')], ['#9aa6c0', t('legendFrontier')]].map(([c, label]) => (
                    <div key={label}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 7, verticalAlign: 'middle', background: c }} />{label}</div>
                ))}
            </div>

            {/* Grid-focus picker — Genesis stays near Earth; Moon/Mars are separate Grids */}
            <div style={{ ...hud, bottom: 60, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(2,6,16,.82)', border: '1px solid rgba(0,212,255,.22)', borderRadius: 999, padding: '6px 8px 6px 14px', backdropFilter: 'blur(14px)', pointerEvents: 'auto' }}>
                <span style={{ fontSize: 10, color: '#3fa6bd', letterSpacing: '.04em', marginRight: 4, whiteSpace: 'nowrap' }}>{t('focus')} · {activeGrid in FOCUS_KEYS ? t(FOCUS_KEYS[activeGrid as keyof typeof FOCUS_KEYS]) : focusLabel}</span>
                {entries.map((e) => (
                    <button
                        key={e.name}
                        title={e.locked ? t('tipPrivate') : e.registered ? (e.member ? t('tipMember') : t('tipPublic')) : e.name === 'Genesis' ? t('tipGenesis') : t('tipEmpty')}
                        style={{ ...btn(activeGrid === e.name), whiteSpace: 'nowrap', ...(e.locked && activeGrid !== e.name ? { border: '1px dashed #e7c878', color: '#e7c878' } : {}) }}
                        onClick={() => focus(e)}
                    >{e.label}</button>
                ))}
                {portal && activeEntry?.gridId && (
                    <a
                        href={gridEntryHref(activeEntry.gridId, GRID_HOST)}
                        title={activeEntry.locked ? t('tipPrivate') : t('enter', { name: activeEntry.name })}
                        style={{ ...btn(false), border: '1px solid rgba(0,212,255,.4)', color: '#4fd2f2', whiteSpace: 'nowrap', textDecoration: 'none' }}
                    >{t('enter', { name: activeEntry.name })} →</a>
                )}
                <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,.14)', margin: '0 2px' }} />
                <button
                    title={t('recommendTip')}
                    style={{ ...btn(false), border: '1px solid rgba(127,224,160,.4)', color: '#7fe0a0', whiteSpace: 'nowrap' }}
                    onClick={recommend}
                >{t('recommend')}</button>
            </div>

            {/* Join-a-Grid S3 — recommendation feedback toast */}
            {recMsg && (
                <div style={{ ...hud, bottom: 104, left: '50%', transform: 'translateX(-50%)', background: 'rgba(2,6,16,.9)', border: '1px solid rgba(127,224,160,.35)', borderRadius: 999, padding: '6px 14px', fontSize: 11, color: '#7fe0a0', backdropFilter: 'blur(14px)', whiteSpace: 'nowrap' }}>{recMsg}</div>
            )}

            {/* top right: the language switch, then the Portal entry links or the way back */}
            <div style={{ ...hud, top: 18, right: 124, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>{/* right: clears the global agency badge */}
                <select
                    aria-label={t('language')} title={t('language')} value={lang}
                    onChange={(e) => chooseLang(e.target.value as Lang)}
                    style={{ ...btn(false), background: 'rgba(2,6,16,.82)', appearance: 'auto' }}
                >
                    {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                {portal && (
                    <>
                        <a href="/about" style={{ ...btn(false), textDecoration: 'none' }}>{t('about')}</a>
                        <a href="/portal/auth" style={{ ...btn(false), textDecoration: 'none' }}>{t('signIn')}</a>
                        <a href="/portal/auth?tab=join" style={{ ...btn(true), textDecoration: 'none' }}>{t('join')}</a>
                    </>
                )}
                {backHref && <a href={backHref} style={{ ...btn(false), textDecoration: 'none' }}>{t('portalMap')}</a>}
            </div>

            {/* DID-gated info panel */}
            {picked && (
                <div style={{ ...hud, top: 60, right: 18, width: 250, background: 'rgba(2,6,16,.82)', border: '1px solid rgba(0,212,255,.22)', borderRadius: 12, padding: '16px 18px', backdropFilter: 'blur(14px)', fontSize: 11.5, lineHeight: 1.7, color: '#8a93a6', pointerEvents: 'auto' }}>
                    {(picked as unknown as { isObject?: boolean }).isObject ? (
                        <>
                            <div style={{ color: '#e7c878', fontSize: 13, marginBottom: 8 }}>{(picked as unknown as { function_type?: string }).function_type ?? t('orbitalObject')} · {t('built')}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('status')}</span><b style={{ color: '#f5f0ea' }}>{picked.status}</b></div>
                            {(picked as unknown as { output_rate?: string }).output_rate && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('output')}</span><b style={{ color: '#f5f0ea' }}>{(picked as unknown as { output_rate?: string }).output_rate}</b></div>
                            )}
                            <div style={{ marginTop: 11, color: '#da7a4e', fontSize: 11, borderTop: '1px solid rgba(0,212,255,.16)', paddingTop: 10 }}>{t('objectNote')}</div>
                        </>
                    ) : isFuture(picked) ? (
                        <>
                            <div style={{ color: '#3fa6bd', fontSize: 13, marginBottom: 8 }}>{(picked as unknown as { name?: string }).name ?? t('frontierGrid')} · {t('empty')}</div>
                            <div style={{ color: '#da7a4e', fontSize: 11, lineHeight: 1.6 }}>{t('frontierNote')}</div>
                        </>
                    ) : (
                        <>
                            <div style={{ color: '#3fa6bd', fontSize: 13, marginBottom: 8 }}>{zoneLabel(picked, zones)} · {t('district')}</div>
                            <button onClick={() => setDistrict(picked.zone)} style={{ ...btn(true), marginBottom: 10 }}>{t('openDistrict')} →</button>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('shell')}</span><b style={{ color: '#f5f0ea' }}>{picked.ring === 0 ? t('core') : t('ring', { n: picked.ring })}</b></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('status')}</span><b style={{ color: '#f5f0ea' }}>{picked.status}</b></div>
                            <div style={{ marginTop: 11, color: '#da7a4e', fontSize: 11, borderTop: '1px solid rgba(0,212,255,.16)', paddingTop: 10 }}>{t('privateNote')}</div>
                        </>
                    )}
                </div>
            )}

            {/* everyone at a glance: one tile per Nous — who, where, awake or asleep. Click to go there. */}
            {nous.length > 0 && (
                <div style={{ ...hud, zIndex: 12, top: 64, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '56vw', pointerEvents: 'auto' }}>
                    {nous.map((n) => {
                        const zone = placeOf(n, zones);
                        const where = zone ? zones.find((z) => z.zone_id === zone)?.label ?? zone : t('nousNoPlace');
                        return (
                            <button
                                key={n.did} disabled={!zone} onClick={() => zone && setDistrict(zone)} title={t('goToNous', { name: n.name })}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, textAlign: 'left', cursor: zone ? 'pointer' : 'default', borderRadius: 999, padding: '4px 12px 4px 5px', background: 'rgba(2,6,16,.82)', color: '#f5f0ea', border: zone && zone === district ? '1px solid #da7a4e' : '1px solid rgba(255,255,255,.16)', opacity: n.asleep ? 0.6 : 1 }}
                            >
                                <span style={{ width: 20, height: 20, borderRadius: '50%', background: `#${nousColor(n.did).toString(16).padStart(6, '0')}`, color: '#020610', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{n.name.slice(0, 1)}</span>
                                <span>{n.name}<span style={{ color: '#8a93a6' }}> · {where}{n.asleep ? ` · ${t('nousAsleep')}` : ''}</span></span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* the district level: one zone as a city along the inside of its ring */}
            {district && (
                <DistrictView
                    zoneId={district} zoneLabel={zones.find((z) => z.zone_id === district)?.label ?? district}
                    color={zoneColor(district)} parcels={parcels} t={t}
                    residents={nous.filter((n) => placeOf(n, zones) === district).map((n) => ({ did: n.did, name: n.name, color: nousColor(n.did), asleep: n.asleep }))}
                    onClose={() => setDistrict(null)} onHandle={(h) => { districtRef.current = h; }}
                />
            )}

            {/* happening now — the Grid's public scene feed, newest first */}
            {feedLive !== null && (
                <div role="log" aria-label={t('happening')} style={{ ...hud, zIndex: 12, bottom: 62, right: 22, width: 300, background: 'rgba(2,6,16,.82)', border: '1px solid rgba(0,212,255,.22)', borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(14px)', fontSize: 11.5, lineHeight: 1.6, color: '#c5cedd' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: feedLive ? '#7fe0a0' : '#e7c878', marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: feedLive ? '#7fe0a0' : '#e7c878' }} />{t('happening')}
                    </div>
                    {!feedLive && <div style={{ color: '#e7c878' }}>{t('feedOff')}</div>}
                    {feedLive && happened.length === 0 && <div style={{ color: '#8a93a6' }}>{t('nothingYet')}</div>}
                    {happened.map((e) => (
                        <div key={e.id} style={{ display: 'flex', gap: 8 }}>
                            <span style={{ color: '#8a93a6', whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>{sceneLine(e, t, zoneOf)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ ...hud, bottom: 18, right: 22, fontSize: 10.5, color: '#8a93a6', textAlign: 'right' }}>{t('hintControls')}<br />{t('hintPrivacy')}</div>
        </div>
    );
}

export default OrbitalStation3D;
