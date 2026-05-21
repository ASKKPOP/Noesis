'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface NousEntry {
    did: string;
    name: string;
    region: string;
    ousia: number;
    lifecyclePhase: string;
    reputation: number;
    status: string;
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

export default function NousRosterPage() {
    const [nousList, setNousList] = useState<NousEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function fetchNous() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/nous`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list: NousEntry[] = Array.isArray(data) ? data : data.nous ?? [];
            setNousList(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchNous();
    }, []);

    return (
        <StewardShell title="Nous Roster" breadcrumb="Steward · Nous">
            {/* Toolbar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 20,
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        background: 'var(--vellum)',
                        border: '1px solid var(--rule)',
                        borderRadius: 4,
                        padding: '4px 10px',
                    }}
                >
                    {loading ? '…' : `${nousList.length} nodes`}
                </span>
                <button
                    onClick={fetchNous}
                    style={{
                        background: 'none',
                        border: '1px solid var(--rule)',
                        borderRadius: 5,
                        padding: '5px 14px',
                        fontFamily: 'var(--sans)',
                        fontSize: 12,
                        color: 'var(--muted)',
                        cursor: 'pointer',
                    }}
                >
                    Refresh
                </button>
            </div>

            <div className="steward-card">
                {error ? (
                    <div
                        style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                        }}
                    >
                        Could not reach grid: {error}
                    </div>
                ) : loading ? (
                    <div
                        style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                        }}
                    >
                        Fetching nodes from grid…
                    </div>
                ) : nousList.length === 0 ? (
                    <div
                        style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            color: 'var(--muted)',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                        }}
                    >
                        No Nous nodes registered yet.
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>DID</th>
                                <th>Region</th>
                                <th>Phase</th>
                                <th>Status</th>
                                <th>Ousia</th>
                                <th>Reputation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nousList.map((n) => (
                                <tr key={n.did}>
                                    <td style={{ fontWeight: 500 }}>
                                        <Link
                                            href={`/nous/${encodeURIComponent(n.did)}`}
                                            style={{
                                                color: 'var(--terracotta)',
                                                textDecoration: 'none',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {n.name}
                                        </Link>
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
                                    <td
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 12,
                                            color: 'var(--muted)',
                                        }}
                                    >
                                        {n.lifecyclePhase}
                                    </td>
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
                                    <td
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 12,
                                            color: 'var(--muted)',
                                        }}
                                    >
                                        {n.reputation.toLocaleString()}
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
