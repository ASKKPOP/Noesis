'use client';

/**
 * Phase 58 HOUSE-1 · Wave 5 (R-58-11 / D-58-09, D-NH-01/11/12) — OrbitalGenesisMap.
 *
 * The canonical orbital Genesis Core view, ported from docs/noesis-genesis-core-map.html
 * into a live React/SVG component (the .html port is a Three.js canvas; this DOM/SVG
 * rendering keeps the same orbital language — radial shells, Earth below, the
 * Government Core monument, ghost vs lit modules — while staying inspectable and
 * testable). Makes the land VISIBLE (D-NH-01).
 *
 * Data:
 *   - Live-fetches GET /api/v1/civic/parcels (the public map feed: ring/sector/level,
 *     owner_civic_did_hash HEX64, occupant_count) and falls back to the embedded
 *     53-parcel GENESIS_SEED when the fetch fails (offline/dev/CI render).
 *   - Ghost frames flip to a LIT SOLID module when owner_civic_did_hash is present;
 *     unowned parcels stay ghost (data-owned reflects this for tests + styling).
 *   - Occupancy lights are driven by occupant_count from the feed.
 *
 * Privacy (D-58-08): a raw owner DID is NEVER rendered — only owner_civic_did_hash.
 *
 * Display boundary (D-NH-11): the NY clock (Date / NY-calendar conversion) lives ONLY
 * here, at the dashboard display boundary. The wallclock CI gate scopes grid/audit/
 * consensus + the replay viewer — NOT this map (see scripts/check-wallclock-forbidden.mjs).
 *
 * Additive (D-58-09): rendered at /worldmap/orbital, beside the kept /worldmap city view.
 */

import { useEffect, useMemo, useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// ── Feed shape (matches grid/src/api/routes/civic-parcels.ts publicView) ───────
export interface ParcelFeedEntry {
    id: string;
    zone: string;
    ring: number;
    sector: number;
    level: number;
    status: string; // 'available' | 'owned'
    price_bios: number;
    owner_civic_did_hash: string | null; // HEX64 or null — NEVER a raw DID
    structure: { type: string; visibility: string } | null;
    occupant_count: number;
    // Phase 59 HOUSE-2 (D-59-08): the public feed exposes the upkeep condition.
    // exterior + condition only; the interior tree is NEVER on this feed.
    condition?: 'maintained' | 'worn' | 'derelict';
}

// ── Interior tree shape (matches GET :id/interior in civic-parcels.ts) ──────────
// Served ONLY via the entry-policy-gated GET route; never on the public feed.
interface InteriorObject {
    kind: string;
    class: 'mirror' | 'functional';
    state?: string;
}
interface InteriorArea {
    name: string;
    objects: InteriorObject[];
}
interface InteriorView {
    parcel_id: string;
    condition: 'maintained' | 'worn' | 'derelict';
    interior: { areas: InteriorArea[] };
}

// ── Zone colours (mirror docs/noesis-genesis-core-map.html ZCOL) ───────────────
const ZONE_COLOR: Record<string, string> = {
    government_quarter: '#8e54b8',
    infrastructure: '#8a98ac',
    business: '#c2a878',
    shopping: '#3fa6bd',
    manufacture: '#9a5a44',
    residential: '#5a84c4',
};

// Orbital shell pixel radii (ported scale; ring 0 sits at the centre).
const RING_RADIUS: Record<number, number> = { 0: 0, 1: 90, 2: 165, 3: 240 };

// ── Embedded 53-parcel Genesis seed (D-NH-09 fallback) ─────────────────────────
// Mirrors the seed in docs/noesis-genesis-core-map.html: ring 0 government_quarter ×1,
// ring 1 infrastructure ×4, ring 2 business/shopping/manufacture 8+8+8, ring 3
// residential ×24. 48 purchasable + 5 civic = 53.
function buildSeed(): ParcelFeedEntry[] {
    const seed: ParcelFeedEntry[] = [];
    const civic = (
        id: string,
        zone: string,
        ring: number,
        sector: number,
    ): ParcelFeedEntry => ({
        id,
        zone,
        ring,
        sector,
        level: 0,
        status: 'civic',
        price_bios: 0,
        owner_civic_did_hash: null,
        structure: ring === 1 ? { type: 'venue', visibility: 'open' } : null,
        occupant_count: 0,
    });
    const buy = (
        id: string,
        zone: string,
        ring: number,
        sector: number,
        price: number,
    ): ParcelFeedEntry => ({
        id,
        zone,
        ring,
        sector,
        level: 0,
        status: 'available',
        price_bios: price,
        owner_civic_did_hash: null,
        structure: null,
        occupant_count: 0,
    });

    const n4 = (n: number) => String(n).padStart(4, '0');

    // ring 0 — government quarter (1)
    seed.push(civic('genesis:government_quarter:0001', 'government_quarter', 0, 180));
    // ring 1 — infrastructure commons (4) — pre-built venues, open
    for (let i = 0; i < 4; i++) {
        seed.push(civic(`genesis:infrastructure:${n4(i + 1)}`, 'infrastructure', 1, 45 + i * 90));
    }
    // ring 2 — business ×8, shopping ×8, manufacture ×8 (price 900)
    const ring2: [string, number][] = [
        ['business', 8],
        ['shopping', 8],
        ['manufacture', 8],
    ];
    let r2sector = 7.5;
    for (const [zone, count] of ring2) {
        for (let i = 0; i < count; i++) {
            seed.push(buy(`genesis:${zone}:${n4(i + 1)}`, zone, 2, r2sector, 900));
            r2sector += 15;
        }
    }
    // ring 3 — residential ×24 (price 400)
    for (let i = 0; i < 24; i++) {
        seed.push(buy(`genesis:residential:${n4(i + 1)}`, 'residential', 3, 7.5 + i * 15, 400));
    }
    return seed;
}

export const GENESIS_SEED: ParcelFeedEntry[] = buildSeed();

// ── NY clock (D-NH-11) — Genesis Epoch NY 1 · DAY 1 = 2026-06-01 00:00 PT (UTC-7).
// Date usage is permitted ONLY here, at the dashboard display boundary.
const NY_EPOCH = Date.UTC(2026, 5, 1, 7);
function noesisNow(): string {
    const days = Math.floor((Date.now() - NY_EPOCH) / 86_400_000);
    return `NY ${Math.floor(days / 365) + 1} · DAY ${(days % 365) + 1}`;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────
const CX = 320;
const CY = 300;

function parcelXY(p: ParcelFeedEntry): { x: number; y: number } {
    const r = RING_RADIUS[p.ring] ?? 240;
    const th = (p.sector * Math.PI) / 180;
    return { x: CX + Math.cos(th) * r, y: CY + Math.sin(th) * r };
}

function isOwned(p: ParcelFeedEntry): boolean {
    return p.owner_civic_did_hash !== null && p.owner_civic_did_hash !== undefined;
}

// ── Condition styling (D-59-11): maintained normal / worn faded / derelict closed.
// Applied additively to the exterior module fill — the Phase 58 ghost-vs-lit
// language is preserved; condition only tints the OWNED (lit) modules.
function conditionOpacity(condition?: string): number {
    if (condition === 'derelict') return 0.4; // boarded / dimmed
    if (condition === 'worn') return 0.6; // faded / cracked
    return 0.92; // maintained — full Phase 58 lit opacity
}

// A structure is browsable (humans can enter) only when it is OPEN and NOT
// derelict (D-NH-07 + D-59-07). Derelict structures are CLOSED to all visitors.
function isBrowsable(p: ParcelFeedEntry): boolean {
    return (
        p.structure !== null &&
        p.structure.visibility === 'open' &&
        p.condition !== 'derelict'
    );
}

// ── Component ───────────────────────────────────────────────────────────────────
export function OrbitalGenesisMap(): React.ReactElement {
    const [parcels, setParcels] = useState<ParcelFeedEntry[]>(GENESIS_SEED);
    const [source, setSource] = useState<'live' | 'seed'>('seed');
    const [clock, setClock] = useState<string>(noesisNow);
    // Phase 59 (D-59-11): click-to-enter interior overlay state (additive).
    // `interior` holds the fetched tree; `closed` marks a derelict/closed click.
    const [interior, setInterior] = useState<InteriorView | null>(null);
    const [closed, setClosed] = useState<string | null>(null);

    // Click-to-enter: fetch GET :id/interior for a browsable (open, non-derelict)
    // structure; a derelict/closed structure shows the "closed" state and does
    // NOT open. Capability-gated read — never opens a private interior to humans.
    async function enterInterior(p: ParcelFeedEntry): Promise<void> {
        if (!isBrowsable(p)) {
            // Derelict or non-open structure → closed; do not open the interior.
            setInterior(null);
            setClosed(p.id);
            return;
        }
        setClosed(null);
        try {
            const res = await fetch(
                `${GRID_ORIGIN}/api/v1/civic/parcels/${p.id}/interior`,
                { cache: 'no-store' },
            );
            if (!res.ok) {
                // Entry-policy refused (403) or no structure (404) → closed.
                setInterior(null);
                setClosed(p.id);
                return;
            }
            const view = (await res.json()) as InteriorView;
            setInterior(view);
        } catch {
            setInterior(null);
            setClosed(p.id);
        }
    }

    // Live fetch with embedded-seed fallback.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/civic/parcels`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error(`feed ${res.status}`);
                const payload = (await res.json()) as { parcels?: ParcelFeedEntry[] };
                if (cancelled) return;
                if (Array.isArray(payload.parcels) && payload.parcels.length > 0) {
                    setParcels(payload.parcels);
                    setSource('live');
                }
            } catch {
                // Fetch failed — keep the embedded 53-parcel seed (graceful fallback).
                if (!cancelled) setSource('seed');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // NY clock tick (display only; the wallclock gate does not scope this path).
    useEffect(() => {
        const id = setInterval(() => setClock(noesisNow()), 60_000);
        return () => clearInterval(id);
    }, []);

    const gov = useMemo(() => parcels.find((p) => p.ring === 0) ?? null, [parcels]);
    const orbitals = useMemo(() => parcels.filter((p) => p.ring !== 0), [parcels]);
    const purchasable = useMemo(
        () => parcels.filter((p) => p.ring === 2 || p.ring === 3).length,
        [parcels],
    );

    return (
        <div
            data-testid="orbital-genesis-map"
            data-source={source}
            style={{
                position: 'relative',
                height: '100%',
                width: '100%',
                minHeight: 560,
                overflow: 'hidden',
                background: 'radial-gradient(circle at 50% 32%, #061427 0%, #020610 70%)',
                color: '#f5f0ea',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
        >
            {/* ── HUD: title + NY clock (D-NH-11 display boundary) ── */}
            <div style={{ position: 'absolute', top: 18, left: 22, zIndex: 10, pointerEvents: 'none' }}>
                <div
                    style={{
                        fontFamily: '"Orbitron", monospace',
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: '0.16em',
                        color: 'rgba(4,12,20,0.85)',
                        WebkitTextStroke: '1.4px #4fd2f2',
                        textShadow: '0 0 8px rgba(63,209,255,0.8), 0 0 22px rgba(27,180,230,0.5)',
                    }}
                >
                    NOĒSIS
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.16em', color: '#da7a4e', textTransform: 'uppercase' }}>
                    Genesis Core · Orbital Station
                </div>
                <div data-testid="ny-clock" style={{ marginTop: 8, fontSize: 11, color: '#8a93a6' }}>
                    {clock} · Genesis Epoch 2026-06-01 PT
                </div>
                <div style={{ fontSize: 10.5, color: '#8a93a6', marginTop: 2 }}>
                    {purchasable} purchasable slots · 5 civic · {source === 'live' ? 'live feed' : 'seed'}
                </div>
            </div>

            {/* ── Orbital station + Earth below ── */}
            <svg
                viewBox="0 0 640 600"
                width="100%"
                height="100%"
                role="img"
                aria-label="Genesis Core orbital map"
                style={{ display: 'block' }}
            >
                {/* Earth below (D-NH-12) — the human world the Genesis Core orbits. */}
                <defs>
                    <radialGradient id="earth-marble" cx="42%" cy="38%" r="75%">
                        <stop offset="0%" stopColor="#3a8bd5" />
                        <stop offset="55%" stopColor="#123a5c" />
                        <stop offset="100%" stopColor="#061427" />
                    </radialGradient>
                    <radialGradient id="earth-atmo" cx="50%" cy="50%" r="50%">
                        <stop offset="80%" stopColor="rgba(58,139,213,0)" />
                        <stop offset="100%" stopColor="rgba(58,139,213,0.35)" />
                    </radialGradient>
                </defs>
                <circle cx="360" cy="760" r="360" fill="url(#earth-atmo)" />
                <circle data-testid="earth-below" cx="360" cy="770" r="320" fill="url(#earth-marble)" />

                {/* Orbital shell guides (rings 1-3). */}
                {[1, 2, 3].map((ring) => (
                    <circle
                        key={`guide-${ring}`}
                        data-testid="orbit-guide"
                        cx={CX}
                        cy={CY}
                        r={RING_RADIUS[ring]}
                        fill="none"
                        stroke={ring === 3 ? '#5a84c4' : ring === 2 ? '#3fa6bd' : '#8a98ac'}
                        strokeOpacity={0.28}
                        strokeWidth={1.2}
                    />
                ))}

                {/* Orbital parcel modules (ghost vs lit). */}
                {orbitals.map((p) => {
                    const { x, y } = parcelXY(p);
                    const owned = isOwned(p);
                    const color = ZONE_COLOR[p.zone] ?? '#8a98ac';
                    const size = p.ring === 1 ? 11 : p.ring === 2 ? 8 : 6.5;
                    const browsable = isBrowsable(p);
                    return (
                        <g
                            key={p.id}
                            data-testid="parcel-module"
                            data-parcel-id={p.id}
                            data-zone={p.zone}
                            data-ring={p.ring}
                            data-owned={owned ? 'true' : 'false'}
                            data-occupants={p.occupant_count}
                            data-owner-hash={p.owner_civic_did_hash ?? ''}
                            data-condition={p.condition ?? 'maintained'}
                            data-browsable={browsable ? 'true' : 'false'}
                            onClick={() => void enterInterior(p)}
                            style={{ cursor: browsable ? 'pointer' : 'not-allowed' }}
                        >
                            {/* spoke from the shell anchor */}
                            <line
                                x1={CX + Math.cos((p.sector * Math.PI) / 180) * (RING_RADIUS[p.ring] ?? 240)}
                                y1={CY + Math.sin((p.sector * Math.PI) / 180) * (RING_RADIUS[p.ring] ?? 240)}
                                x2={x}
                                y2={y}
                                stroke={color}
                                strokeOpacity={0.25}
                                strokeWidth={0.8}
                            />
                            {/* module body: owned = SOLID lit; unowned = ghost frame */}
                            <rect
                                x={x - size}
                                y={y - size}
                                width={size * 2}
                                height={size * 2}
                                rx={size * 0.45}
                                fill={owned ? color : 'none'}
                                fillOpacity={owned ? conditionOpacity(p.condition) : 0.12}
                                stroke={color}
                                strokeOpacity={owned ? 1 : 0.45}
                                strokeWidth={owned ? 1.6 : 1}
                                strokeDasharray={owned ? undefined : '3 2'}
                                style={
                                    owned
                                        ? { filter: `drop-shadow(0 0 6px ${color})` }
                                        : undefined
                                }
                            />
                            {/* occupancy lights (one per occupant) */}
                            {Array.from({ length: Math.min(p.occupant_count, 6) }).map((_, i) => (
                                <circle
                                    key={i}
                                    data-testid="occupancy-light"
                                    cx={x - size + 2 + i * 3}
                                    cy={y + size - 2}
                                    r={1.3}
                                    fill="#7fe0a0"
                                    style={{ filter: 'drop-shadow(0 0 3px #7fe0a0)' }}
                                />
                            ))}
                        </g>
                    );
                })}

                {/* Government Core monument at ring 0 (gravity centre). */}
                {gov && (
                    <g
                        data-testid="government-core"
                        data-parcel-id={gov.id}
                        data-zone={gov.zone}
                        data-ring={0}
                    >
                        <circle cx={CX} cy={CY} r={26} fill={ZONE_COLOR.government_quarter} fillOpacity={0.18} />
                        <circle
                            cx={CX}
                            cy={CY}
                            r={16}
                            fill={ZONE_COLOR.government_quarter}
                            fillOpacity={0.55}
                            stroke="#bac4ce"
                            strokeOpacity={0.6}
                            strokeWidth={1.4}
                            style={{ filter: `drop-shadow(0 0 10px ${ZONE_COLOR.government_quarter})` }}
                        />
                        <circle cx={CX} cy={CY - 26} r={2.6} fill="#cdd6df" />
                    </g>
                )}
            </svg>

            {/* ── Legend ── */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 18,
                    left: 22,
                    fontSize: 11,
                    lineHeight: 1.9,
                    color: '#8a93a6',
                    pointerEvents: 'none',
                }}
            >
                {(
                    [
                        ['Government Core', 'government_quarter'],
                        ['Infrastructure', 'infrastructure'],
                        ['Business', 'business'],
                        ['Shopping', 'shopping'],
                        ['Manufacture', 'manufacture'],
                        ['Residential', 'residential'],
                    ] as [string, string][]
                ).map(([label, zone]) => (
                    <div key={zone}>
                        <span
                            style={{
                                display: 'inline-block',
                                width: 9,
                                height: 9,
                                borderRadius: 2,
                                marginRight: 7,
                                verticalAlign: 'middle',
                                background: ZONE_COLOR[zone],
                            }}
                        />
                        {label}
                    </div>
                ))}
            </div>

            {/* ── Interior viewer overlay (D-59-11) — click-to-enter, additive. ── */}
            {closed && (
                <div
                    data-testid="interior-closed"
                    onClick={() => setClosed(null)}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(2,6,16,0.82)',
                        zIndex: 30,
                        cursor: 'pointer',
                    }}
                >
                    <div
                        style={{
                            border: '1.4px dashed #9a5a44',
                            borderRadius: 8,
                            padding: '20px 28px',
                            color: '#da7a4e',
                            fontSize: 13,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            background: 'repeating-linear-gradient(45deg, rgba(154,90,68,0.12) 0 8px, transparent 8px 16px)',
                        }}
                    >
                        Closed · structure boarded up
                    </div>
                </div>
            )}

            {interior && (
                <div
                    data-testid="interior-viewer"
                    data-condition={interior.condition}
                    onClick={() => setInterior(null)}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(2,6,16,0.9)',
                        zIndex: 30,
                        overflowY: 'auto',
                        padding: 28,
                        cursor: 'pointer',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 520, margin: '0 auto', cursor: 'default' }}
                    >
                        <div style={{ fontSize: 11, color: '#8a93a6', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                            Interior · {interior.condition}
                        </div>
                        {interior.interior.areas.map((area) => (
                            <div key={area.name} data-testid="interior-area" style={{ marginTop: 16 }}>
                                <div style={{ fontSize: 12, color: '#cdd6df', marginBottom: 8 }}>
                                    {area.name}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {area.objects.map((obj) => {
                                        const highlighted = obj.class === 'functional';
                                        return (
                                            <div
                                                key={`${area.name}:${obj.kind}`}
                                                data-testid={`interior-object-${obj.kind}`}
                                                data-furniture-class={obj.class}
                                                data-highlighted={highlighted ? 'true' : 'false'}
                                                style={{
                                                    // Functional = HIGHLIGHTED (affordance-carrying);
                                                    // mirror = STATIC mesh (render-only, dimmed).
                                                    border: highlighted
                                                        ? '1.6px solid #4fd2f2'
                                                        : '1px solid rgba(138,147,166,0.4)',
                                                    borderRadius: 6,
                                                    padding: '8px 12px',
                                                    fontSize: 12,
                                                    color: highlighted ? '#4fd2f2' : '#8a93a6',
                                                    background: highlighted
                                                        ? 'rgba(63,209,255,0.12)'
                                                        : 'rgba(138,147,166,0.06)',
                                                    boxShadow: highlighted
                                                        ? '0 0 8px rgba(63,209,255,0.4)'
                                                        : 'none',
                                                }}
                                            >
                                                {obj.kind}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrbitalGenesisMap;
