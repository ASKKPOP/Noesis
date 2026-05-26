'use client';

import { useState } from 'react';
import StewardShell from '@/components/StewardShell';
import { useHealthDetailed } from '@/lib/use-health-detailed';
import { getNotifications, usePolling, type NotificationsResponse } from '@/lib/admin-api';

const PANEL: React.CSSProperties = { padding: 18, background: '#faf9f5', border: '1px solid #dbd8cc', borderRadius: 6, marginBottom: 14 };
const PANEL_TITLE: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5a554e', marginBottom: 12 };

const LEVEL_OPTIONS: { label: string; value: number }[] = [
    { label: 'All', value: 10 },
    { label: 'Debug+', value: 20 },
    { label: 'Info+', value: 30 },
    { label: 'Warn+', value: 40 },
    { label: 'Error+', value: 50 },
];

export default function AdminAuditPage() {
    const { data: health } = useHealthDetailed();
    const [minLevel, setMinLevel] = useState(30);
    const [prefix, setPrefix] = useState('');
    const [limit, setLimit] = useState(50);

    const { result: notifsResult } = usePolling<NotificationsResponse>(
        () => getNotifications({ eventPrefix: prefix || undefined, minLevel, limit }),
        3000,
    );

    if (notifsResult?.ok === false && notifsResult.status === 503) {
        return (
            <StewardShell title="Monitoring" breadcrumb="Steward · Local Admin · Monitoring">
                <div style={{ ...PANEL, borderLeft: '3px solid #b8542f' }}>
                    <div style={{ ...PANEL_TITLE, color: '#b8542f' }}>Admin API disabled</div>
                    <p style={{ fontSize: 13 }}>Set <code>GRID_ADMIN_ENABLED=true</code> and restart Grid.</p>
                </div>
            </StewardShell>
        );
    }

    const events = notifsResult?.data?.events ?? [];
    const ringSize = notifsResult?.data?.ring_size ?? 0;
    const ringCap = notifsResult?.data?.ring_capacity ?? 200;

    return (
        <StewardShell title="Monitoring" breadcrumb="Steward · Local Admin · Monitoring">
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', marginBottom: 18 }}>
                Live Pino log ring buffer + audit pipeline + firehose health. Notifications poll every 3s.
            </p>

            {/* Pipeline summary */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Audit pipeline (live from /health/detailed)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, fontSize: 13, fontFamily: 'var(--mono)' }}>
                    <div><span style={{ color: '#8a8479' }}>status</span> <strong style={{ color: health?.status === 'ok' ? '#2d7a2d' : '#b88a2f' }}>{health?.status ?? '—'}</strong></div>
                    <div><span style={{ color: '#8a8479' }}>tick</span> <strong>{health?.clock.tick ?? '—'}</strong></div>
                    <div><span style={{ color: '#8a8479' }}>in_mem</span> <strong>{health?.audit.in_memory_length ?? '—'}</strong></div>
                    <div><span style={{ color: '#8a8479' }}>persisted</span> <strong>{health?.audit.persisted_max_id ?? '—'}</strong></div>
                    <div><span style={{ color: '#8a8479' }}>div</span> <strong>{health?.audit.divergence ?? '—'}</strong></div>
                    <div><span style={{ color: '#8a8479' }}>fh_clients</span> <strong>{health?.firehose.client_count ?? '—'}</strong></div>
                </div>
                {health?.reasons && health.reasons.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--mono)' }}>
                        <span style={{ color: '#b88a2f' }}>reasons:</span> {health.reasons.map((r) => <code key={r} style={{ marginRight: 6 }}>{r}</code>)}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Filter notifications</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                        <label style={{ fontSize: 11, color: '#8a8479', fontFamily: 'var(--mono)', display: 'block', marginBottom: 3 }}>Min level</label>
                        <select value={minLevel} onChange={(e) => setMinLevel(parseInt(e.target.value))} style={{ width: '100%', padding: '5px 8px', border: '1px solid #dbd8cc', fontSize: 12, fontFamily: 'var(--mono)' }}>
                            {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: '#8a8479', fontFamily: 'var(--mono)', display: 'block', marginBottom: 3 }}>Event prefix (e.g. audit_)</label>
                        <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="(any)" style={{ width: '100%', padding: '5px 8px', border: '1px solid #dbd8cc', fontSize: 12, fontFamily: 'var(--mono)', background: 'white' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: '#8a8479', fontFamily: 'var(--mono)', display: 'block', marginBottom: 3 }}>Limit ({events.length}/{ringSize}, cap {ringCap})</label>
                        <input type="number" min="10" max="200" value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 50)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #dbd8cc', fontSize: 12, fontFamily: 'var(--mono)', background: 'white' }} />
                    </div>
                </div>
            </div>

            {/* Notifications stream */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Notification stream</div>
                {events.length === 0 && <div style={{ fontSize: 13, color: '#8a8479' }}>No events match filter. (Ring may be empty if Grid just started.)</div>}
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                    {events.map((e, i) => (
                        <div key={i} style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 60px 140px 1fr',
                            gap: 10,
                            padding: '5px 6px',
                            borderBottom: '1px solid #ebe8de',
                            fontSize: 12,
                            fontFamily: 'var(--mono)',
                            borderLeft: `3px solid ${e.level >= 50 ? '#b8542f' : e.level >= 40 ? '#b88a2f' : e.level >= 30 ? '#5eead4' : '#dbd8cc'}`,
                            paddingLeft: 8,
                        }}>
                            <span style={{ color: '#8a8479' }}>{new Date(e.ts).toLocaleTimeString()}</span>
                            <span style={{ color: e.level >= 50 ? '#b8542f' : e.level >= 40 ? '#b88a2f' : '#5a554e', textTransform: 'uppercase', fontSize: 10, fontWeight: 600 }}>{e.level_name}</span>
                            <span style={{ color: '#3a7a5a' }}>{e.module}</span>
                            <span style={{ color: '#1a1714' }}>
                                {e.event && <code style={{ marginRight: 6, fontSize: 11 }}>{e.event}</code>}
                                {e.msg}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...PANEL, fontSize: 12, fontFamily: 'var(--mono)', color: '#8a8479' }}>
                See also: <a href="/system" style={{ color: '#4a7a6a' }}>/system</a> (Phase 34 cards), <a href="/firehose" style={{ color: '#4a7a6a' }}>/firehose</a> (live event stream), <a href="/audit" style={{ color: '#4a7a6a' }}>/audit</a> (queryable trail).
            </div>
        </StewardShell>
    );
}
