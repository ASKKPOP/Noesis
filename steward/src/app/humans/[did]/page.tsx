'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface HumanProfile {
    did: string;
    eth_address?: string;
    grid_name?: string;
    region?: string;
    created_at?: string;
    last_active?: string;
    nous_count?: number;
    transfer_count?: number;
}

interface HumanHistory {
    siwe_sessions?: HistoryEvent[];
    transfers?: HistoryEvent[];
    whispers_sent?: HistoryEvent[];
    regions_visited?: HistoryEvent[];
}

interface HistoryEvent {
    timestamp?: string;
    event_type?: string;
    tick?: number;
    asset?: string;
    to_did?: string;
    region?: string;
}

interface NousEntry {
    did: string;
    name: string;
    region: string;
    ousia: number;
    lifecyclePhase: string;
    status: string;
    humanOwner?: string;
}

type TabId = 'profile' | 'history' | 'nous';

function truncateDid(did: string): string {
    if (!did || did.length <= 20) return did ?? '';
    return did.slice(0, 8) + '…' + did.slice(-6);
}

function truncateWallet(addr: string): string {
    if (!addr || addr.length <= 12) return addr ?? '—';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function relativeTime(ts: string): string {
    try {
        const diff = Date.now() - new Date(ts).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    } catch {
        return ts;
    }
}

function formatDate(ts: string): string {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return ts;
    }
}

function formatDateShort(ts: string): string {
    try {
        return new Date(ts).toLocaleDateString();
    } catch {
        return ts;
    }
}

const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginBottom: 3,
};

const valueStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--ink)',
};

export default function HumanDetailPage() {
    const params = useParams();
    const did = decodeURIComponent(params.did as string);

    const [profile, setProfile] = useState<HumanProfile | null>(null);
    const [history, setHistory] = useState<HumanHistory | null>(null);
    const [nousList, setNousList] = useState<NousEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('profile');

    // Tab refs for keyboard navigation
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const TABS: { id: TabId; label: string }[] = [
        { id: 'profile', label: 'Profile' },
        { id: 'history', label: 'History' },
        { id: 'nous', label: 'Nous' },
    ];

    useEffect(() => {
        async function fetchAll() {
            setLoading(true);
            const encodedDid = encodeURIComponent(did);

            const [profileRes, historyRes, nousRes] = await Promise.allSettled([
                fetch(`${GRID_ORIGIN}/api/v1/humans/${encodedDid}`),
                fetch(`${GRID_ORIGIN}/api/v1/humans/${encodedDid}/history`),
                fetch(`${GRID_ORIGIN}/api/v1/grid/nous`),
            ]);

            // Profile
            if (profileRes.status === 'fulfilled') {
                if (profileRes.value.status === 404) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }
                if (profileRes.value.ok) {
                    const data = await profileRes.value.json();
                    setProfile(data as HumanProfile);
                }
            }

            // History
            if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
                const data = await historyRes.value.json();
                setHistory(data as HumanHistory);
            }

            // Nous roster filtered by humanOwner
            if (nousRes.status === 'fulfilled' && nousRes.value.ok) {
                const data = await nousRes.value.json();
                const list: NousEntry[] = Array.isArray(data) ? data : data.nous ?? [];
                setNousList(list.filter((n) => n.humanOwner === did));
            }

            setLoading(false);
        }
        fetchAll();
    }, [did]);

    function handleTabKeyDown(e: React.KeyboardEvent, index: number) {
        if (e.key === 'ArrowRight') {
            const next = (index + 1) % TABS.length;
            tabRefs.current[next]?.focus();
            setActiveTab(TABS[next].id);
        } else if (e.key === 'ArrowLeft') {
            const prev = (index - 1 + TABS.length) % TABS.length;
            tabRefs.current[prev]?.focus();
            setActiveTab(TABS[prev].id);
        }
    }

    const name = profile?.grid_name ?? truncateDid(did);

    if (!loading && notFound) {
        return (
            <StewardShell title="Human not found." breadcrumb="Steward · Users · Not Found">
                <div style={{ marginBottom: 16 }}>
                    <Link
                        href="/users"
                        style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}
                    >
                        ← Back to Users
                    </Link>
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 16 }}>
                    Human not found.
                </div>
                <Link href="/users" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--terracotta)', textDecoration: 'none' }}>
                    ← Back to Users
                </Link>
            </StewardShell>
        );
    }

    return (
        <StewardShell title={name} breadcrumb={`Steward · Users · ${name}`}>
            {/* Back link */}
            <div style={{ marginBottom: 20, marginTop: -12 }}>
                <Link
                    href="/users"
                    style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}
                >
                    ← Back to Users
                </Link>
            </div>

            {loading ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
            ) : (
                <>
                    {/* Header card */}
                    <div className="steward-card" style={{ marginBottom: 24 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                                {profile?.grid_name ?? '—'}
                            </h2>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }} title={did}>
                                {truncateDid(did)}
                            </span>
                        </div>
                        <div style={{ padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            {[
                                {
                                    label: 'Wallet',
                                    value: profile?.eth_address ? truncateWallet(profile.eth_address) : '—',
                                    title: profile?.eth_address,
                                },
                                {
                                    label: 'Joined',
                                    value: profile?.created_at ? formatDateShort(profile.created_at) : '—',
                                    title: profile?.created_at ? formatDate(profile.created_at) : undefined,
                                },
                                { label: 'Region', value: profile?.region ?? '—' },
                                {
                                    label: 'Last Active',
                                    value: profile?.last_active ? relativeTime(profile.last_active) : '—',
                                    title: profile?.last_active ? formatDate(profile.last_active) : undefined,
                                },
                                { label: 'Nous Count', value: String(profile?.nous_count ?? nousList.length) },
                                {
                                    label: 'Transfers',
                                    value: String(profile?.transfer_count ?? '—'),
                                    tooltip: 'On-chain balance not available — showing transfer event count.',
                                },
                            ].map(({ label, value, title, tooltip }) => (
                                <div key={label}>
                                    <div style={labelStyle}>
                                        {label}
                                        {tooltip && (
                                            <span title={tooltip} style={{ cursor: 'help', marginLeft: 4 }}>ⓘ</span>
                                        )}
                                    </div>
                                    <div style={valueStyle} title={title}>
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div
                        role="tablist"
                        style={{
                            display: 'flex',
                            borderBottom: '1px solid var(--rule)',
                            marginBottom: 24,
                        }}
                    >
                        {TABS.map(({ id, label }, index) => (
                            <button
                                key={id}
                                role="tab"
                                aria-selected={activeTab === id}
                                ref={(el) => { tabRefs.current[index] = el; }}
                                onClick={() => setActiveTab(id)}
                                onKeyDown={(e) => handleTabKeyDown(e, index)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === id ? '2px solid var(--terracotta)' : '2px solid transparent',
                                    padding: '10px 16px',
                                    fontFamily: 'var(--mono)',
                                    fontSize: 12,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.12em',
                                    color: activeTab === id ? 'var(--ink)' : 'var(--muted)',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    marginBottom: -1,
                                }}
                                onFocus={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.outline = '2px solid var(--terracotta)';
                                    (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px';
                                }}
                                onBlur={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.outline = 'none';
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)';
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tab panels */}
                    <div role="tabpanel">
                        {/* Tab 1: Profile */}
                        {activeTab === 'profile' && (
                            <div className="steward-card">
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, color: 'var(--ink)' }}>Profile</h3>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                    <div>
                                        <div style={labelStyle}>Wallet Address</div>
                                        <div style={{ ...valueStyle, fontFamily: 'var(--mono)', fontSize: 11, wordBreak: 'break-all' }}>
                                            {profile?.eth_address ?? '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={labelStyle}>Joined</div>
                                        <div style={valueStyle}>{profile?.created_at ? formatDate(profile.created_at) : '—'}</div>
                                    </div>
                                    <div>
                                        <div style={labelStyle}>Region</div>
                                        <div style={valueStyle}>{profile?.region ?? '—'}</div>
                                    </div>
                                    <div>
                                        <div style={labelStyle}>Last Active</div>
                                        <div style={valueStyle}>{profile?.last_active ? relativeTime(profile.last_active) : '—'}</div>
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <div style={labelStyle}>DID</div>
                                        <div style={{ ...valueStyle, fontFamily: 'var(--mono)', fontSize: 11, wordBreak: 'break-all' }}>
                                            {did}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: History */}
                        {activeTab === 'history' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* SIWE Sessions */}
                                <HistoryCard
                                    title="SIWE Sessions"
                                    rows={history?.siwe_sessions ?? []}
                                    emptyText="No SIWE sessions events found."
                                    columns={[
                                        { label: 'Timestamp', render: (e) => e.timestamp ? relativeTime(e.timestamp) : '—', title: (e) => e.timestamp ? formatDate(e.timestamp) : undefined },
                                        { label: 'Event Type', render: (e) => e.event_type ?? '—' },
                                    ]}
                                />

                                {/* Cyber Coin Transfers */}
                                <HistoryCard
                                    title="Cyber Coin Transfers"
                                    rows={history?.transfers ?? []}
                                    emptyText="No transfers events found."
                                    columns={[
                                        { label: 'Timestamp', render: (e) => e.timestamp ? relativeTime(e.timestamp) : '—', title: (e) => e.timestamp ? formatDate(e.timestamp) : undefined },
                                        { label: 'Tick', render: (e) => e.tick != null ? String(e.tick) : '—' },
                                        { label: 'Asset', render: (e) => e.asset ?? '—' },
                                    ]}
                                />

                                {/* Whispers Sent */}
                                <HistoryCard
                                    title="Whispers Sent"
                                    rows={history?.whispers_sent ?? []}
                                    emptyText="No whispers events found."
                                    columns={[
                                        { label: 'Timestamp', render: (e) => e.timestamp ? relativeTime(e.timestamp) : '—', title: (e) => e.timestamp ? formatDate(e.timestamp) : undefined },
                                        { label: 'Tick', render: (e) => e.tick != null ? String(e.tick) : '—' },
                                        { label: 'To DID', render: (e) => e.to_did ? truncateDid(e.to_did) : '—', title: (e) => e.to_did },
                                    ]}
                                />

                                {/* Regions Visited */}
                                <HistoryCard
                                    title="Regions Visited"
                                    rows={history?.regions_visited ?? []}
                                    emptyText="No regions visited events found."
                                    columns={[
                                        { label: 'Timestamp', render: (e) => e.timestamp ? relativeTime(e.timestamp) : '—', title: (e) => e.timestamp ? formatDate(e.timestamp) : undefined },
                                        { label: 'Region', render: (e) => e.region ?? '—' },
                                    ]}
                                />
                            </div>
                        )}

                        {/* Tab 3: Nous */}
                        {activeTab === 'nous' && (
                            <div className="steward-card">
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, color: 'var(--ink)' }}>Nous</h3>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                                        {nousList.length} Nous
                                    </span>
                                </div>
                                {nousList.length === 0 ? (
                                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                                        No Nous owned by this human.
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
                                                    <td>
                                                        <Link
                                                            href={`/nous/${encodeURIComponent(n.did)}`}
                                                            style={{ color: 'var(--terracotta)', textDecoration: 'none', fontFamily: 'var(--sans)', fontSize: 13 }}
                                                        >
                                                            {n.name}
                                                        </Link>
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{n.lifecyclePhase}</td>
                                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }} title={n.did}>{truncateDid(n.did)}</td>
                                                    <td style={{ fontSize: 13 }}>{n.region}</td>
                                                    <td>
                                                        <span className="badge">{n.status}</span>
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{n.ousia}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </StewardShell>
    );
}

interface HistoryColumn {
    label: string;
    render: (e: HistoryEvent) => string;
    title?: (e: HistoryEvent) => string | undefined;
}

function HistoryCard({ title, rows, emptyText, columns }: {
    title: string;
    rows: HistoryEvent[];
    emptyText: string;
    columns: HistoryColumn[];
}) {
    const displayed = rows.slice(0, 20);
    return (
        <div className="steward-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, color: 'var(--ink)' }}>{title}</h3>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{rows.length} events</span>
            </div>
            {rows.length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {emptyText}
                </div>
            ) : (
                <>
                    <table>
                        <thead>
                            <tr>
                                {columns.map((c) => <th key={c.label}>{c.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {displayed.map((e, i) => (
                                <tr key={i}>
                                    {columns.map((c) => (
                                        <td
                                            key={c.label}
                                            style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
                                            title={c.title ? c.title(e) : undefined}
                                        >
                                            {c.render(e)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length > 20 && (
                        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--rule)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                            Showing 20 of {rows.length} — full history via audit log.
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
