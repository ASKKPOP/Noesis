'use client';

import { useEffect, useState } from 'react';
import { ACTIVITY_COLOR, driftLine, parseGridProfile, percent, type GridProfile } from '@/lib/grid-profile';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

/**
 * "What this Grid is right now" (D-V3-40). A Grid's identity is never assigned — this is
 * the live projection of its record. Renders nothing until the Grid answers, and says so
 * plainly when the record holds no actions yet.
 */
export default function GridIdentity({ gridName }: { gridName: string }): React.ReactElement | null {
    const [profile, setProfile] = useState<GridProfile | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/profile`, { cache: 'no-store', credentials: 'include' });
                if (!res.ok) return;
                const p = parseGridProfile(await res.json());
                if (!cancelled) setProfile(p);
            } catch { /* profile unreachable — show nothing rather than guess */ }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!profile) return null;
    const drift = driftLine(profile);

    return (
        <div
            data-testid="grid-identity"
            style={{
                position: 'fixed', zIndex: 10, top: 128, left: 22, width: 300, padding: '11px 13px', borderRadius: 10,
                background: 'rgba(2,6,16,.82)', border: '1px solid rgba(0,212,255,.22)', backdropFilter: 'blur(14px)',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: '#f5f0ea', fontSize: 11, lineHeight: 1.6,
            }}
        >
            <div style={{ color: '#3fa6bd', letterSpacing: '.04em', marginBottom: 6 }}>WHAT {gridName.toUpperCase()} IS RIGHT NOW</div>
            {profile.actions === 0 ? (
                <div style={{ color: '#8a93a6' }}>Nothing recorded yet. This Grid becomes whatever its Nous do; nobody assigns it.</div>
            ) : (
                <>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                        {profile.activities.map((a) => (
                            <i key={a.activity} title={`${a.activity} ${percent(a.share)}`} style={{ width: `${a.share * 100}%`, background: ACTIVITY_COLOR[a.activity] ?? '#8a93a6' }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 7 }}>
                        {profile.activities.map((a) => (
                            <span key={a.activity}>
                                <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 5, background: ACTIVITY_COLOR[a.activity] ?? '#8a93a6' }} />
                                {a.activity} {percent(a.share)}
                            </span>
                        ))}
                    </div>
                    <div style={{ color: '#8a93a6', marginTop: 6, fontSize: 10 }}>
                        from the record · last {profile.actions.toLocaleString('en-US')} actions{drift ? ` · ${drift}` : ''}
                    </div>
                </>
            )}
        </div>
    );
}
