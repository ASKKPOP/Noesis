'use client';

/**
 * GridCard — the full description of the Grid the map has zoomed to (see
 * grid-description.ts). It asks the Grid for its status, clock and identity profile
 * when it opens; the registry entry, zones and land come from the map.
 */
import { useEffect, useState } from 'react';
import { parseGridProfile, type GridProfile } from '@/lib/grid-profile';
import { describeGrid, parseGridClock, parseGridStatus, type GridClockView, type GridStatusView } from './grid-description';
import type { PortalGrid } from './grid-picker';

interface Live { status: GridStatusView | null; clock: GridClockView | null; profile: GridProfile | null; profileNeedsSignIn: boolean }
const NOTHING: Live = { status: null, clock: null, profile: null, profileNeedsSignIn: false };

export interface GridCardProps {
    origin: string;
    name: string;
    /** Registry entry; null for a frontier world. */
    grid: PortalGrid | null;
    registryLoaded: boolean;
    zoneLabels: readonly string[];
    land: { purchasable: number; civic: number };
    top: number;
    onClose(): void;
}

export default function GridCard({ origin, name, grid, registryLoaded, zoneLabels, land, top, onClose }: GridCardProps): React.ReactElement {
    const [live, setLive] = useState<Live>(NOTHING);
    // Status, clock, profile, zones and land are this server's own Grid; another Grid
    // in the registry is described by its registry entry alone.
    const [home, setHome] = useState(false);
    const open = !!grid && !grid.locked;

    useEffect(() => {
        setLive(NOTHING); setHome(false);
        if (!open) return;
        let cancelled = false;
        const get = async (path: string): Promise<{ status: number; body: unknown }> => {
            try {
                const res = await fetch(`${origin}${path}`, { cache: 'no-store', credentials: 'include' });
                return { status: res.status, body: res.ok ? await res.json() : null };
            } catch { return { status: 0, body: null }; }
        };
        (async () => {
            const status = parseGridStatus((await get('/api/v1/grid/status')).body);
            if (cancelled || !status || status.name.toLowerCase() !== name.toLowerCase()) return;
            const [clock, profile] = await Promise.all([get('/api/v1/grid/clock'), get('/api/v1/grid/profile')]);
            if (cancelled) return;
            setHome(true);
            setLive({ status, clock: parseGridClock(clock.body), profile: parseGridProfile(profile.body), profileNeedsSignIn: profile.status === 401 });
        })();
        return () => { cancelled = true; };
    }, [origin, name, open]);

    const d = describeGrid(name, { grid, registryLoaded, ...live, zoneLabels: home ? zoneLabels : [], land: home ? land : null }, Date.now());
    return (
        <div
            role="region" aria-label={`About ${d.title}`}
            style={{ position: 'fixed', zIndex: 10, top, left: 22, width: 300, maxHeight: `calc(100vh - ${top + 230}px)`, overflowY: 'auto', fontFamily: "'JetBrains Mono', ui-monospace, monospace", background: 'rgba(2,6,16,.86)', border: '1px solid rgba(0,212,255,.22)', borderRadius: 12, padding: '14px 16px', backdropFilter: 'blur(14px)', fontSize: 11.5, lineHeight: 1.6, color: '#8a93a6', pointerEvents: 'auto' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <div style={{ color: '#3fa6bd', fontSize: 14, textTransform: 'capitalize' }}>{d.title}</div>
                <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#8a93a6', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
            </div>
            {d.purpose && <div style={{ color: '#f5f0ea', margin: '8px 0 10px' }}>{d.purpose}</div>}
            {d.rows.map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid rgba(0,212,255,.10)', padding: '4px 0' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{r.label}</span>
                    <b style={{ color: '#f5f0ea', fontWeight: 500, textAlign: 'right' }}>{r.value}</b>
                </div>
            ))}
            {d.note && <div style={{ marginTop: 10, color: '#da7a4e', fontSize: 11 }}>{d.note}</div>}
        </div>
    );
}
