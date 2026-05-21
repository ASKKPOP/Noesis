'use client';

import { useEffect, useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface GridStatus {
    tick?: number;
    status?: string;
}

interface NousEntry {
    id: string;
    name: string;
    role: string;
    did: string;
    region: string;
    status: 'active' | 'sleeping' | 'voting';
    last_tick: number | null;
}

interface Proposal {
    id: string;
    status: string;
}

interface Stats {
    tick: number | null;
    activeNous: number | null;
    coinSupply: number | null;
    openProposals: number | null;
}

function Dot({ color }: { color: string }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
            }}
        />
    );
}

function NavSection({ title }: { title: string }) {
    return (
        <div
            style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#5a554e',
                padding: '16px 16px 6px',
            }}
        >
            {title}
        </div>
    );
}

function NavLink({
    label,
    active,
    dot,
}: {
    label: string;
    active?: boolean;
    dot?: string;
}) {
    return (
        <div className={`steward-nav-link${active ? ' active' : ''}`}>
            {dot && <Dot color={dot} />}
            {label}
        </div>
    );
}

function StatusBadge({ status }: { status: 'active' | 'sleeping' | 'voting' }) {
    const map = {
        active: { label: 'Active', cls: 'badge-active', dot: '#2d7a2d' },
        sleeping: { label: 'Sleeping', cls: 'badge-sleeping', dot: '#8a8479' },
        voting: { label: 'Voting', cls: 'badge-voting', dot: '#8a6a2e' },
    };
    const { label, cls, dot } = map[status];
    return (
        <span className={`badge ${cls}`}>
            <Dot color={dot} />
            {label}
        </span>
    );
}

function truncateDid(did: string): string {
    if (did.length <= 20) return did;
    return did.slice(0, 10) + '…' + did.slice(-8);
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({
        tick: null,
        activeNous: null,
        coinSupply: null,
        openProposals: null,
    });
    const [nousList, setNousList] = useState<NousEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAll() {
            try {
                const [statusRes, nousRes, proposalsRes] = await Promise.allSettled([
                    fetch(`${GRID_ORIGIN}/api/v1/grid/status`),
                    fetch(`${GRID_ORIGIN}/api/v1/grid/nous`),
                    fetch(`${GRID_ORIGIN}/api/v1/governance/proposals`),
                ]);

                let tick: number | null = null;
                let coinSupply: number | null = null;
                if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
                    const data: GridStatus = await statusRes.value.json();
                    tick = data.tick ?? null;
                }

                let activeNous: number | null = null;
                let fetchedNous: NousEntry[] = [];
                if (nousRes.status === 'fulfilled' && nousRes.value.ok) {
                    const data = await nousRes.value.json();
                    fetchedNous = Array.isArray(data) ? data : data.nous ?? [];
                    activeNous = fetchedNous.filter((n) => n.status === 'active').length;
                    setNousList(fetchedNous);
                }

                let openProposals: number | null = null;
                if (proposalsRes.status === 'fulfilled' && proposalsRes.value.ok) {
                    const data = await proposalsRes.value.json();
                    const proposals: Proposal[] = Array.isArray(data) ? data : data.proposals ?? [];
                    openProposals = proposals.filter((p) => p.status === 'open').length;
                }

                setStats({ tick, activeNous, coinSupply, openProposals });
            } catch {
                // Grid offline — leave as null
            } finally {
                setLoading(false);
            }
        }

        fetchAll();
    }, []);

    const fmt = (v: number | null) => (v === null ? '—' : v.toLocaleString());

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <aside className="steward-sidebar">
                {/* Logo */}
                <div style={{ padding: '24px 16px 20px' }}>
                    <div
                        style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 22,
                            fontWeight: 400,
                            color: '#e8e4dc',
                            letterSpacing: '0.02em',
                            lineHeight: 1,
                        }}
                    >
                        Noēsis
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 9,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: '#5a554e',
                            marginTop: 4,
                        }}
                    >
                        Steward Console
                    </div>
                </div>

                <div
                    style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }}
                />

                {/* Operator section */}
                <NavSection title="Operator" />
                <NavLink label="Dashboard" active dot="#b8542f" />
                <NavLink label="Nous Roster" dot="#5a554e" />
                <NavLink label="Economy" dot="#5a554e" />
                <NavLink label="Governance" dot="#5a554e" />
                <NavLink label="Lore" dot="#5a554e" />

                {/* Grid section */}
                <NavSection title="Grid" />
                <NavLink label="System" dot="#5a554e" />
                <NavLink label="Settings" dot="#5a554e" />

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Version footer */}
                <div
                    style={{
                        padding: '16px',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        color: '#3a3630',
                        letterSpacing: '0.1em',
                    }}
                >
                    v2.5 · Genesis Grid
                </div>
            </aside>

            {/* Main area */}
            <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Top header */}
                <header
                    style={{
                        height: 52,
                        background: 'var(--parchment)',
                        borderBottom: '1px solid var(--rule)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 32px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 50,
                    }}
                >
                    <span
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            letterSpacing: '0.14em',
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                        }}
                    >
                        STEWARD / Dashboard
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                color: 'var(--muted)',
                                background: 'var(--vellum)',
                                border: '1px solid var(--rule)',
                                borderRadius: 4,
                                padding: '3px 8px',
                            }}
                        >
                            {GRID_ORIGIN}
                        </span>
                        <span className="badge badge-online">
                            <Dot color="#2d7a2d" />
                            Grid Online
                        </span>
                    </div>
                </header>

                {/* Scrollable content */}
                <main style={{ flex: 1, padding: '32px 32px 48px', overflowY: 'auto' }}>
                    {/* Page title */}
                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--muted)',
                            marginBottom: 6,
                        }}
                    >
                        Steward · Overview
                    </div>
                    <h1
                        style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 34,
                            fontWeight: 400,
                            color: 'var(--ink)',
                            marginBottom: 28,
                            lineHeight: 1.1,
                        }}
                    >
                        Dashboard
                    </h1>

                    {/* Stat strip */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 16,
                            marginBottom: 32,
                        }}
                    >
                        {[
                            { label: 'Grid Tick', value: fmt(stats.tick) },
                            { label: 'Active Nous', value: fmt(stats.activeNous) },
                            { label: 'Cyber Coin Supply', value: fmt(stats.coinSupply) },
                            { label: 'Open Proposals', value: fmt(stats.openProposals) },
                        ].map(({ label, value }) => (
                            <div key={label} className="steward-stat-card">
                                <div style={{ padding: '16px 20px 20px' }}>
                                    <div
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 9,
                                            letterSpacing: '0.14em',
                                            textTransform: 'uppercase',
                                            color: 'var(--muted)',
                                            marginBottom: 8,
                                        }}
                                    >
                                        {label}
                                    </div>
                                    <div
                                        style={{
                                            fontFamily: 'var(--serif)',
                                            fontSize: 36,
                                            fontWeight: 400,
                                            color: value === '—' ? 'var(--muted)' : 'var(--ink)',
                                            lineHeight: 1,
                                        }}
                                    >
                                        {loading ? '…' : value}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Nous Roster table */}
                    <div className="steward-card" style={{ marginBottom: 24 }}>
                        <div
                            style={{
                                padding: '18px 20px 14px',
                                borderBottom: '1px solid var(--rule)',
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 12,
                            }}
                        >
                            <h2
                                style={{
                                    fontFamily: 'var(--serif)',
                                    fontSize: 20,
                                    fontWeight: 400,
                                    color: 'var(--ink)',
                                }}
                            >
                                Nous Roster
                            </h2>
                            <span
                                style={{
                                    fontFamily: 'var(--mono)',
                                    fontSize: 10,
                                    color: 'var(--muted)',
                                }}
                            >
                                {nousList.length} nodes
                            </span>
                        </div>

                        {nousList.length === 0 ? (
                            <div
                                style={{
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    color: 'var(--muted)',
                                    fontFamily: 'var(--mono)',
                                    fontSize: 12,
                                }}
                            >
                                {loading ? 'Fetching nodes from grid…' : 'No Nous nodes registered yet.'}
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>DID</th>
                                        <th>Region</th>
                                        <th>Status</th>
                                        <th>Last Tick</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nousList.map((n) => (
                                        <tr key={n.id}>
                                            <td style={{ fontWeight: 500 }}>{n.name}</td>
                                            <td
                                                style={{
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                }}
                                            >
                                                {n.role}
                                            </td>
                                            <td
                                                style={{
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 11,
                                                    color: 'var(--muted)',
                                                }}
                                                title={n.did}
                                            >
                                                {truncateDid(n.did)}
                                            </td>
                                            <td>{n.region}</td>
                                            <td>
                                                <StatusBadge status={n.status} />
                                            </td>
                                            <td
                                                style={{
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                }}
                                            >
                                                {n.last_tick ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Recent Events */}
                    <div className="steward-card">
                        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--rule)' }}>
                            <h2
                                style={{
                                    fontFamily: 'var(--serif)',
                                    fontSize: 20,
                                    fontWeight: 400,
                                    color: 'var(--ink)',
                                }}
                            >
                                Recent Events
                            </h2>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p
                                style={{
                                    color: 'var(--muted)',
                                    fontSize: 13,
                                    marginBottom: 12,
                                }}
                            >
                                Live event stream available at{' '}
                                <span
                                    style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 12,
                                        background: 'var(--vellum)',
                                        padding: '1px 6px',
                                        borderRadius: 3,
                                        border: '1px solid var(--rule)',
                                    }}
                                >
                                    {GRID_ORIGIN}/api/v1/grid/events/stream
                                </span>
                            </p>
                            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                                Event log viewer coming in Phase 25.
                            </p>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer
                    style={{
                        borderTop: '1px solid var(--rule)',
                        padding: '12px 32px',
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        color: 'var(--muted)',
                        letterSpacing: '0.08em',
                    }}
                >
                    v2.5 · Steward Console · Genesis Grid
                </footer>
            </div>
        </div>
    );
}
