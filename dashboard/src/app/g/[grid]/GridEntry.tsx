'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { PortalGrid } from '@/components/worldmap/grid-picker';
import { gridEntryState } from '@/lib/grid-host';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
/** The Portal's origin when the Grid is served from its own host; same origin otherwise. */
const PORTAL = process.env.NEXT_PUBLIC_PORTAL_ORIGIN ?? '';

const OrbitalStation3D = dynamic(
    () => import('@/components/worldmap/OrbitalStation3D'),
    { ssr: false },
);

const shell: React.CSSProperties = {
    position: 'fixed', inset: 0, background: '#020610', color: '#f5f0ea', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
    textAlign: 'center', fontFamily: "'JetBrains Mono', ui-monospace, monospace",
};
const link = (primary: boolean): React.CSSProperties => ({
    fontSize: 12, borderRadius: 999, padding: '7px 16px', textDecoration: 'none',
    border: primary ? '1px solid #da7a4e' : '1px solid rgba(255,255,255,.16)',
    background: primary ? '#da7a4e' : 'rgba(255,255,255,.04)', color: primary ? '#0b1220' : '#f5f0ea',
});

export default function GridEntry({ gridId }: { gridId: string }): React.ReactElement {
    // undefined = loading, null = the Grid registry could not be reached.
    const [grids, setGrids] = useState<PortalGrid[] | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/grids`, { cache: 'no-store', credentials: 'include' });
                if (!res.ok) throw new Error(`grids ${res.status}`);
                const payload = (await res.json()) as { grids?: PortalGrid[] };
                if (!cancelled) setGrids(Array.isArray(payload.grids) ? payload.grids : null);
            } catch { if (!cancelled) setGrids(null); }
        })();
        return () => { cancelled = true; };
    }, []);

    const state = gridEntryState(grids, gridId);

    if (state.kind === 'open') {
        return (
            <div style={{ height: '100vh', width: '100vw' }}>
                <OrbitalStation3D backHref={`${PORTAL}/`} />
            </div>
        );
    }

    return (
        <div style={shell}>
            {state.kind === 'loading' && <div style={{ color: '#8a93a6', fontSize: 12 }}>opening Grid…</div>}
            {state.kind === 'unreachable' && (
                <>
                    <div style={{ fontSize: 18 }}>The Grid is not answering</div>
                    <div style={{ color: '#8a93a6', fontSize: 12 }}>Its registry could not be reached. Nothing is shown rather than guessed.</div>
                </>
            )}
            {state.kind === 'unknown' && (
                <>
                    <div style={{ fontSize: 18 }}>No Grid named “{gridId}”</div>
                    <div style={{ color: '#8a93a6', fontSize: 12 }}>The Portal map lists every Grid that exists.</div>
                </>
            )}
            {state.kind === 'members_only' && (
                <>
                    <div style={{ fontSize: 30 }}>🔒</div>
                    <div style={{ fontSize: 18 }}>{state.grid.name} is a private Grid</div>
                    <div style={{ color: '#8a93a6', fontSize: 12, maxWidth: 420, lineHeight: 1.7 }}>
                        Members only. A member is someone who holds citizenship in {state.grid.name}. Sign in if you are one, or apply for citizenship.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a href={`${PORTAL}/portal/auth`} style={link(true)}>Sign in</a>
                        <a href={`${PORTAL}/apply/${state.grid.grid_id}`} style={link(false)}>Apply for citizenship</a>
                    </div>
                </>
            )}
            {state.kind !== 'loading' && <a href={`${PORTAL}/`} style={link(false)}>← Portal map</a>}
        </div>
    );
}
