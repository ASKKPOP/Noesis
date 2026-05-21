'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface GridStatus {
    name?: string;
    tick?: number;
    epoch?: number;
    nousCount?: number;
    regionCount?: number;
    activeLaws?: number;
    auditEntries?: number;
    uptime?: number;
}

interface GridClock {
    tick?: number;
    epoch?: number;
    phase?: string;
    tickMs?: number;
}

interface Region {
    id: string;
    name: string;
    description: string;
    capacity: number;
}

interface RegionsResponse {
    regions: Region[];
    connections: { from: string; to: string }[];
}

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

const inputStyle: React.CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 5,
    padding: '7px 10px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
};

const btnPrimary: React.CSSProperties = {
    background: 'var(--terracotta)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '7px 18px',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
    background: 'none',
    color: 'var(--muted)',
    border: '1px solid var(--rule)',
    borderRadius: 6,
    padding: '7px 18px',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    cursor: 'pointer',
};

export default function SystemPage() {
    const [status, setStatus] = useState<GridStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);

    const [clock, setClock] = useState<GridClock | null>(null);
    const [clockLoading, setClockLoading] = useState(true);

    const [regions, setRegions] = useState<Region[]>([]);
    const [connections, setConnections] = useState<{ from: string; to: string }[]>([]);
    const [regionsLoading, setRegionsLoading] = useState(true);
    const [regionsError, setRegionsError] = useState<string | null>(null);

    // Clock control
    const [pauseReason, setPauseReason] = useState('');
    const [resumeReason, setResumeReason] = useState('');
    const [clockOpStatus, setClockOpStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [clockOpLoading, setClockOpLoading] = useState(false);

    async function fetchStatus() {
        setStatusLoading(true);
        setStatusError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/status`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setStatus(await res.json());
        } catch (e) {
            setStatusError(e instanceof Error ? e.message : 'Failed to fetch status');
        } finally {
            setStatusLoading(false);
        }
    }

    async function fetchClock() {
        setClockLoading(true);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/clock`);
            if (res.ok) setClock(await res.json());
        } catch {
            // ignore
        } finally {
            setClockLoading(false);
        }
    }

    async function fetchRegions() {
        setRegionsLoading(true);
        setRegionsError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/regions`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: RegionsResponse = await res.json();
            setRegions(data.regions ?? []);
            setConnections(data.connections ?? []);
        } catch (e) {
            setRegionsError(e instanceof Error ? e.message : 'Failed to fetch regions');
        } finally {
            setRegionsLoading(false);
        }
    }

    useEffect(() => {
        fetchStatus();
        fetchClock();
        fetchRegions();
    }, []);

    async function handleClockOp(action: 'pause' | 'resume', reason: string) {
        setClockOpLoading(true);
        setClockOpStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/clock/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            if (res.ok) {
                setClockOpStatus({ type: 'success', msg: `Clock ${action}d successfully.` });
                if (action === 'pause') setPauseReason('');
                else setResumeReason('');
                fetchClock();
            } else {
                const d = await res.json().catch(() => ({}));
                setClockOpStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setClockOpStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setClockOpLoading(false);
        }
    }

    const statItems = status
        ? [
              { label: 'Tick', value: status.tick?.toLocaleString() ?? '—' },
              { label: 'Epoch', value: status.epoch?.toLocaleString() ?? '—' },
              { label: 'Nous Count', value: status.nousCount?.toLocaleString() ?? '—' },
              { label: 'Region Count', value: status.regionCount?.toLocaleString() ?? '—' },
              { label: 'Active Laws', value: status.activeLaws?.toLocaleString() ?? '—' },
              { label: 'Audit Entries', value: status.auditEntries?.toLocaleString() ?? '—' },
          ]
        : [];

    return (
        <StewardShell title="System" breadcrumb="Steward · System">
            {/* Grid Status */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                        Grid Status
                    </h2>
                    {status?.uptime !== undefined && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                            Uptime: {formatUptime(status.uptime)}
                        </span>
                    )}
                    <button onClick={fetchStatus} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 11 }}>
                        Refresh
                    </button>
                </div>

                {statusError ? (
                    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Could not load status: {statusError}
                    </div>
                ) : statusLoading ? (
                    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {statItems.map(({ label, value }) => (
                            <div key={label} className="steward-stat-card">
                                <div style={{ padding: '14px 18px 18px' }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                                        {label}
                                    </div>
                                    <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: value === '—' ? 'var(--muted)' : 'var(--ink)', lineHeight: 1 }}>
                                        {value}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Clock Control */}
            <div className="steward-card" style={{ marginBottom: 28 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Clock Control
                    </h2>
                </div>
                <div style={{ padding: '16px 20px' }}>
                    {/* Current clock state */}
                    {!clockLoading && clock && (
                        <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Tick', val: clock.tick?.toLocaleString() ?? '—' },
                                { label: 'Epoch', val: clock.epoch?.toLocaleString() ?? '—' },
                                { label: 'Phase', val: clock.phase ?? '—' },
                                { label: 'Tick Interval', val: clock.tickMs !== undefined ? `${clock.tickMs}ms` : '—' },
                            ].map(({ label, val }) => (
                                <div key={label}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>
                                        {label}
                                    </div>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink)' }}>{val}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {clockOpStatus && (
                        <div
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                color: clockOpStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)',
                                padding: '8px 12px',
                                background: clockOpStatus.type === 'success' ? 'rgba(34,139,34,0.08)' : 'rgba(184,84,47,0.08)',
                                borderRadius: 5,
                                border: `1px solid ${clockOpStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}`,
                                marginBottom: 16,
                            }}
                        >
                            {clockOpStatus.msg}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Pause */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                                Pause Reason
                            </label>
                            <input
                                type="text"
                                value={pauseReason}
                                onChange={(e) => setPauseReason(e.target.value)}
                                placeholder="Reason for pausing clock…"
                                style={inputStyle}
                            />
                            <button
                                onClick={() => handleClockOp('pause', pauseReason)}
                                disabled={!pauseReason || clockOpLoading}
                                style={{ ...btnSecondary, opacity: !pauseReason ? 0.5 : 1 }}
                            >
                                Pause Clock
                            </button>
                        </div>

                        {/* Resume */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                                Resume Reason
                            </label>
                            <input
                                type="text"
                                value={resumeReason}
                                onChange={(e) => setResumeReason(e.target.value)}
                                placeholder="Reason for resuming clock…"
                                style={inputStyle}
                            />
                            <button
                                onClick={() => handleClockOp('resume', resumeReason)}
                                disabled={!resumeReason || clockOpLoading}
                                style={{ ...btnPrimary, opacity: !resumeReason ? 0.5 : 1 }}
                            >
                                Resume Clock
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Regions */}
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Regions
                    </h2>
                    {!regionsLoading && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                            {regions.length} regions · {connections.length} connections
                        </span>
                    )}
                </div>

                {regionsError ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Could not load regions: {regionsError}
                    </div>
                ) : regionsLoading ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Loading regions…
                    </div>
                ) : regions.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        No regions configured.
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Capacity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {regions.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                        {r.id}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.description}</td>
                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                        {r.capacity.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </StewardShell>
    );
}
