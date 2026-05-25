'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

// Hardcoded allowlist from grid/src/audit/broadcast-allowlist.ts ALLOWLIST_MEMBERS (56 events as of Phase 33)
const ALLOWLIST_STATIC: Array<{ position: number; eventType: string; producer: string }> = [
    { position: 1,  eventType: 'nous.spawned',                 producer: 'grid/src/nous/' },
    { position: 2,  eventType: 'nous.moved',                   producer: 'grid/src/nous/' },
    { position: 3,  eventType: 'nous.spoke',                   producer: 'grid/src/nous/' },
    { position: 4,  eventType: 'nous.direct_message',          producer: 'grid/src/nous/' },
    { position: 5,  eventType: 'trade.proposed',               producer: 'grid/src/trade/' },
    { position: 6,  eventType: 'trade.reviewed',               producer: 'grid/src/trade/' },
    { position: 7,  eventType: 'trade.settled',                producer: 'grid/src/trade/' },
    { position: 8,  eventType: 'law.triggered',                producer: 'grid/src/law/' },
    { position: 9,  eventType: 'tick',                         producer: 'grid/src/clock/' },
    { position: 10, eventType: 'grid.started',                 producer: 'grid/src/index' },
    { position: 11, eventType: 'grid.stopped',                 producer: 'grid/src/index' },
    { position: 12, eventType: 'operator.inspected',           producer: 'grid/src/api/operator/' },
    { position: 13, eventType: 'operator.paused',              producer: 'grid/src/api/operator/' },
    { position: 14, eventType: 'operator.resumed',             producer: 'grid/src/api/operator/' },
    { position: 15, eventType: 'operator.law_changed',         producer: 'grid/src/api/operator/' },
    { position: 16, eventType: 'operator.telos_forced',        producer: 'grid/src/api/operator/' },
    { position: 17, eventType: 'telos.refined',                producer: 'grid/src/audit/append-telos-refined.ts' },
    { position: 18, eventType: 'operator.nous_deleted',        producer: 'grid/src/audit/append-nous-deleted.ts' },
    { position: 19, eventType: 'ananke.drive_crossed',         producer: 'grid/src/ananke/append-drive-crossed.ts' },
    { position: 20, eventType: 'bios.birth',                   producer: 'grid/src/bios/appendBiosBirth.ts' },
    { position: 21, eventType: 'bios.death',                   producer: 'grid/src/bios/appendBiosDeath.ts' },
    { position: 22, eventType: 'nous.whispered',               producer: 'grid/src/whisper/appendNousWhispered.ts' },
    { position: 23, eventType: 'proposal.opened',              producer: 'grid/src/governance/appendProposalOpened.ts' },
    { position: 24, eventType: 'ballot.committed',             producer: 'grid/src/governance/appendBallotCommitted.ts' },
    { position: 25, eventType: 'ballot.revealed',              producer: 'grid/src/governance/appendBallotRevealed.ts' },
    { position: 26, eventType: 'proposal.tallied',             producer: 'grid/src/governance/appendProposalTallied.ts' },
    { position: 27, eventType: 'operator.exported',            producer: 'grid/src/audit/append-operator-exported.ts' },
    { position: 28, eventType: 'nous.reflection_authored',     producer: 'grid/src/reflexion/' },
    { position: 29, eventType: 'nous.self_model_revised',      producer: 'grid/src/reflexion/' },
    { position: 30, eventType: 'nous.creed_violation',         producer: 'grid/src/reflexion/' },
    { position: 31, eventType: 'nous.sleep.entered',           producer: 'grid/src/sleep/appendNousSleepEntered.ts' },
    { position: 32, eventType: 'nous.sleep.completed',         producer: 'grid/src/sleep/appendNousSleepCompleted.ts' },
    { position: 33, eventType: 'iris.belief_revised',          producer: 'grid/src/iris/appendIrisBeliefRevised.ts' },
    { position: 34, eventType: 'iris.context_invoked',         producer: 'grid/src/iris/appendIrisContextInvoked.ts' },
    { position: 35, eventType: 'iris.contradiction_detected',  producer: 'grid/src/iris/appendIrisContradiction.ts' },
    { position: 36, eventType: 'iris.prior_seeded',            producer: 'grid/src/iris/appendIrisPriorSeeded.ts' },
    { position: 37, eventType: 'skill.taught',                 producer: 'grid/src/skills/appendSkillTaught.ts' },
    { position: 38, eventType: 'skill.inferred',               producer: 'grid/src/skills/appendSkillInferred.ts' },
    { position: 39, eventType: 'skill.rejected',               producer: 'grid/src/skills/appendSkillRejected.ts' },
    { position: 40, eventType: 'norm.candidate',               producer: 'grid/src/norms/appendNormCandidate.ts' },
    { position: 41, eventType: 'norm.crystallized',            producer: 'grid/src/norms/appendNormCrystallized.ts' },
    { position: 42, eventType: 'lore.contributed',             producer: 'grid/src/lore/appendLoreContributed.ts' },
    { position: 43, eventType: 'lore.cited',                   producer: 'grid/src/lore/appendLoreCited.ts' },
    { position: 44, eventType: 'human.joined',                 producer: 'grid/src/audit/append-human-joined.ts' },
    { position: 45, eventType: 'human.transferred',            producer: 'grid/src/audit/append-human-transferred.ts' },
    { position: 46, eventType: 'operator.muted',               producer: 'grid/src/audit/append-operator-muted.ts' },
    { position: 47, eventType: 'operator.slashed',             producer: 'grid/src/audit/append-operator-slashed.ts' },
    { position: 48, eventType: 'operator.quarantined',         producer: 'grid/src/audit/append-operator-quarantined.ts' },
    { position: 49, eventType: 'operator.forced_sleep',        producer: 'grid/src/audit/append-operator-forced-sleep.ts' },
    { position: 50, eventType: 'operator.human_banned',        producer: 'grid/src/audit/append-operator-human-banned.ts' },
    { position: 51, eventType: 'operator.human_frozen',        producer: 'grid/src/audit/append-operator-human-frozen.ts' },
    { position: 52, eventType: 'human.spoke',                  producer: 'grid/src/audit/append-human-spoke.ts' },
    { position: 53, eventType: 'nous.spawned_by_human',        producer: 'grid/src/audit/append-nous-spawned-by-human.ts' },
    { position: 54, eventType: 'portal.auth.login',            producer: 'grid/src/audit/append-portal-auth-login.ts' },
    { position: 55, eventType: 'portal.auth.register',         producer: 'grid/src/audit/append-portal-auth-register.ts' },
    { position: 56, eventType: 'human.identified',             producer: 'grid/src/audit/append-human-identified.ts' },
];

interface DriftAlert {
    event_type: string;
    actor_did?: string;
    tick?: number;
    detected_at: string;
}

function truncateDriftDid(did: string): string {
    if (!did || did.length <= 16) return did ?? '—';
    return did.slice(0, 8) + '…' + did.slice(-6);
}

function relativeTimeDrift(ts: string): string {
    try {
        const diff = Date.now() - new Date(ts).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        return `${Math.floor(m / 60)}h ago`;
    } catch {
        return ts;
    }
}

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

    // Allowlist Monitor — drift alerts
    const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
    const [driftLastUpdated, setDriftLastUpdated] = useState<number>(Date.now());
    const [driftSecondsAgo, setDriftSecondsAgo] = useState(0);
    const [driftError, setDriftError] = useState<string | null>(null);

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

    async function fetchDriftAlerts() {
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/drift-alerts`);
            if (!res.ok) {
                if (res.status === 503) {
                    setDriftError('Drift endpoint unavailable.');
                } else {
                    setDriftError(`HTTP ${res.status}`);
                }
                return;
            }
            const data = await res.json();
            setDriftAlerts(Array.isArray(data.alerts) ? data.alerts : []);
            setDriftLastUpdated(Date.now());
            setDriftSecondsAgo(0);
            setDriftError(null);
        } catch {
            setDriftError('Drift endpoint unavailable.');
        }
    }

    useEffect(() => {
        fetchStatus();
        fetchClock();
        fetchRegions();
        fetchDriftAlerts();

        // Poll drift alerts every 5s
        const driftInterval = setInterval(fetchDriftAlerts, 5000);

        // Update "last updated Xs ago" every second
        const secondsInterval = setInterval(() => {
            setDriftSecondsAgo(Math.round((Date.now() - driftLastUpdated) / 1000));
        }, 1000);

        return () => {
            clearInterval(driftInterval);
            clearInterval(secondsInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

            {/* Allowlist Monitor */}
            <div style={{ marginTop: 28 }}>
                {/* Section eyebrow + heading */}
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                    Allowlist Monitor
                </div>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--ink)', marginBottom: 16 }}>
                    Allowlist Monitor
                </h2>

                {/* Drift Alert Panel — ABOVE static reference per UI-SPEC */}
                <div
                    role="alert"
                    style={{
                        background: driftAlerts.length === 0
                            ? 'rgba(34,139,34,0.06)'
                            : 'rgba(184,84,47,0.08)',
                        border: driftAlerts.length === 0
                            ? '1px solid rgba(34,139,34,0.3)'
                            : '1px solid rgba(184,84,47,0.4)',
                        borderLeft: driftAlerts.length === 0
                            ? '1px solid rgba(34,139,34,0.3)'
                            : '4px solid var(--terracotta)',
                        borderRadius: 10,
                        padding: '16px 20px',
                        marginBottom: 16,
                    }}
                >
                    {/* Panel header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {driftAlerts.length > 0 && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--terracotta)' }}>!</span>
                        )}
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, color: driftAlerts.length > 0 ? 'var(--terracotta)' : '#2d7a2d' }}>
                            Drift Alerts
                        </span>
                        <span
                            aria-live="polite"
                            className="badge"
                            style={{
                                background: driftAlerts.length > 0 ? 'rgba(184,84,47,0.12)' : 'rgba(34,139,34,0.10)',
                                color: driftAlerts.length > 0 ? 'var(--terracotta)' : '#2d7a2d',
                                border: driftAlerts.length > 0 ? '1px solid rgba(184,84,47,0.2)' : '1px solid rgba(34,139,34,0.2)',
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                padding: '2px 7px',
                                borderRadius: 10,
                            }}
                        >
                            {driftAlerts.length}
                        </span>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
                        {driftAlerts.length > 0
                            ? `Non-allowlisted events detected at runtime · last updated ${driftSecondsAgo}s ago`
                            : `last updated ${driftSecondsAgo}s ago`}
                    </div>

                    {/* Panel body */}
                    {driftError ? (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                            Drift endpoint unavailable.
                        </div>
                    ) : driftAlerts.length === 0 ? (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#2d7a2d' }}>
                            No drift detected. All runtime emissions are allowlisted.
                        </div>
                    ) : (
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'left', paddingBottom: 6, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Event Type</th>
                                    <th style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'left', paddingBottom: 6, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Actor DID</th>
                                    <th style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'left', paddingBottom: 6, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tick</th>
                                    <th style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'left', paddingBottom: 6, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Detected At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {driftAlerts.map((alert, i) => (
                                    <tr
                                        key={i}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(184,84,47,0.04)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                                    >
                                        <td style={{ paddingBlock: 6 }}>
                                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'rgba(184,84,47,0.10)', color: 'var(--terracotta)', borderRadius: 3, padding: '2px 6px' }}>
                                                {alert.event_type}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', paddingBlock: 6 }}>
                                            {truncateDriftDid(alert.actor_did ?? '')}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', paddingBlock: 6 }}>
                                            {alert.tick ?? '—'}
                                        </td>
                                        <td
                                            style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', paddingBlock: 6 }}
                                            title={new Date(alert.detected_at).toLocaleString()}
                                        >
                                            {relativeTimeDrift(alert.detected_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Static Reference Table */}
                <div className="steward-card">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                            Allowlisted Events
                        </h2>
                        <span className="badge" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                            {ALLOWLIST_STATIC.length} events
                        </span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th>Event Type</th>
                                <th>Producer File</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ALLOWLIST_STATIC.map((entry) => (
                                <tr key={entry.position}>
                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', width: 40 }}>
                                        {entry.position}
                                    </td>
                                    <td>
                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--vellum)', border: '1px solid var(--rule)', borderRadius: 3, padding: '2px 6px' }}>
                                            {entry.eventType}
                                        </span>
                                    </td>
                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {entry.producer}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </StewardShell>
    );
}
