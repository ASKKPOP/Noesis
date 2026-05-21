'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface GridStatus {
    tick?: number;
    status?: string;
}

interface NousEntry {
    did: string;
    name: string;
    region: string;
    ousia: number;
    lifecyclePhase: string;
    reputation: number;
    status: string;
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

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string; dot: string }> = {
        active: { label: 'Active', cls: 'badge-active', dot: '#2d7a2d' },
        sleeping: { label: 'Sleeping', cls: 'badge-sleeping', dot: '#8a8479' },
        voting: { label: 'Voting', cls: 'badge-voting', dot: '#8a6a2e' },
    };
    const { label, cls, dot } = map[status] ?? { label: status, cls: 'badge-sleeping', dot: '#8a8479' };
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

                setStats({ tick, activeNous, coinSupply: null, openProposals });
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
        <StewardShell title="Dashboard" breadcrumb="Steward · Overview">
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
                                <th>Phase</th>
                                <th>DID</th>
                                <th>Region</th>
                                <th>Status</th>
                                <th>Ousia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nousList.map((n) => (
                                <tr key={n.did}>
                                    <td style={{ fontWeight: 500 }}>{n.name}</td>
                                    <td
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 12,
                                            color: 'var(--muted)',
                                        }}
                                    >
                                        {n.lifecyclePhase}
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
                                        {n.ousia.toLocaleString()}
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
                        Full audit log available in the{' '}
                        <a href="/audit" style={{ color: 'var(--terracotta)', textDecoration: 'none' }}>
                            Audit Log
                        </a>{' '}
                        section.
                    </p>
                </div>
            </div>
        </StewardShell>
    );
}
