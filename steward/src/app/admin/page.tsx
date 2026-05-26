'use client';

import StewardShell from '@/components/StewardShell';
import { useHealthDetailed } from '@/lib/use-health-detailed';
import { getConfig, getNotifications, usePolling, type ConfigResponse, type NotificationsResponse } from '@/lib/admin-api';

const PANEL: React.CSSProperties = {
    padding: 18,
    background: '#faf9f5',
    border: '1px solid #dbd8cc',
    borderRadius: 6,
    marginBottom: 14,
};
const PANEL_TITLE: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#5a554e',
    marginBottom: 12,
};
const STAT_GRID: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
};
const STAT: React.CSSProperties = {
    background: 'white',
    border: '1px solid #dbd8cc',
    borderRadius: 4,
    padding: '12px 14px',
};
const STAT_LABEL: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: '#8a8479',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
};
const STAT_VALUE: React.CSSProperties = {
    fontFamily: 'var(--serif)',
    fontSize: 22,
    fontWeight: 600,
    color: '#1a1714',
    marginTop: 4,
};

export default function AdminOverviewPage() {
    const { data: health } = useHealthDetailed();
    const { result: configResult } = usePolling<ConfigResponse>(getConfig, 30_000);
    const { result: notifsResult } = usePolling<NotificationsResponse>(
        () => getNotifications({ minLevel: 30, limit: 8 }),
        5_000,
    );

    const adminEnabled = configResult?.ok ?? null;
    const cfg = configResult?.data?.config ?? {};
    const llmProvider = cfg.LLM_PROVIDER?.value ?? '—';
    const llmModel = cfg.LLM_MODEL?.value ?? '—';
    const tickRateMs = cfg.GRID_TICK_RATE_MS?.value ?? '—';
    const gridOrigin = cfg.NEXT_PUBLIC_GRID_ORIGIN?.value ?? '—';

    return (
        <StewardShell title="Local Admin" breadcrumb="Steward · Local Admin · Overview">
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', marginBottom: 24 }}>
                Local management console for the Noēsis stack. Edit configuration, monitor health, restart services, and chat with Nous — all from one place.
            </p>

            {adminEnabled === false && configResult?.status === 503 && (
                <div style={{ ...PANEL, borderLeft: '3px solid #b8542f', background: '#fdf4ef' }}>
                    <div style={{ ...PANEL_TITLE, color: '#b8542f' }}>Admin API disabled</div>
                    <p style={{ fontSize: 13, color: '#1a1714', margin: 0 }}>
                        Set <code>GRID_ADMIN_ENABLED=true</code> in <code>.env</code> and rebuild Grid:
                        <br />
                        <code style={{ fontSize: 12 }}>docker compose build grid &amp;&amp; docker compose up -d grid</code>
                    </p>
                </div>
            )}

            {/* Stack summary */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Stack at a glance</div>
                <div style={STAT_GRID}>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Status</div>
                        <div style={{ ...STAT_VALUE, color: health?.status === 'ok' ? '#2d7a2d' : health?.status === 'degraded' ? '#b88a2f' : '#b8542f' }}>
                            {health?.status ?? '—'}
                        </div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Tick</div>
                        <div style={STAT_VALUE}>{health?.clock.tick ?? '—'}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>In-memory entries</div>
                        <div style={STAT_VALUE}>{health?.audit.in_memory_length ?? '—'}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Persisted</div>
                        <div style={STAT_VALUE}>{health?.audit.persisted_max_id ?? '—'}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Divergence</div>
                        <div style={STAT_VALUE}>{health?.audit.divergence ?? '—'}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Firehose clients</div>
                        <div style={STAT_VALUE}>{health?.firehose.client_count ?? '—'}</div>
                    </div>
                </div>
            </div>

            {/* LLM + Grid config */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Current configuration</div>
                <div style={STAT_GRID}>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>LLM Provider</div>
                        <div style={STAT_VALUE}>{llmProvider}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>LLM Model</div>
                        <div style={STAT_VALUE}>{llmModel}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Tick rate (ms)</div>
                        <div style={STAT_VALUE}>{tickRateMs}</div>
                    </div>
                    <div style={STAT}>
                        <div style={STAT_LABEL}>Grid origin</div>
                        <div style={{ ...STAT_VALUE, fontSize: 14, fontFamily: 'var(--mono)' }}>{gridOrigin}</div>
                    </div>
                </div>
                <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479' }}>
                    Edit on <a href="/admin/setup" style={{ color: '#4a7a6a' }}>/admin/setup</a> · polls every 30s
                </div>
            </div>

            {/* Recent notifications */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Recent events (last 8 · info+)</div>
                {notifsResult?.ok && notifsResult.data?.events.length === 0 && (
                    <div style={{ fontSize: 13, color: '#8a8479' }}>No recent events.</div>
                )}
                {notifsResult?.ok && notifsResult.data?.events.map((e, i) => (
                    <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 60px 120px 1fr',
                        gap: 12,
                        padding: '6px 8px',
                        borderBottom: '1px solid #ebe8de',
                        fontSize: 13,
                        fontFamily: 'var(--mono)',
                    }}>
                        <span style={{ color: '#8a8479' }}>{new Date(e.ts).toLocaleTimeString()}</span>
                        <span style={{
                            color: e.level >= 50 ? '#b8542f' : e.level >= 40 ? '#b88a2f' : '#5a554e',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: 11,
                        }}>{e.level_name}</span>
                        <span style={{ color: '#3a7a5a' }}>{e.module}</span>
                        <span style={{ color: '#1a1714' }}>{e.event ?? ''} {e.msg && `· ${e.msg}`}</span>
                    </div>
                ))}
                <div style={{ marginTop: 8 }}>
                    <a href="/admin/audit" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#4a7a6a' }}>
                        Full monitoring →
                    </a>
                </div>
            </div>
        </StewardShell>
    );
}
