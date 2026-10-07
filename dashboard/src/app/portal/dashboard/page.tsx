'use client';

/**
 * /portal/dashboard — the Portal user's account overview (Phase 56, PORTAL-07/08).
 *
 * One screen for: who you are, the Nous you own and which Grid each lives in,
 * your wei per Grid, and registrations still in the Portal → Polis pipeline.
 * Everything is read from GET /api/v1/portal/me/overview; nothing is editable here.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import {
    fetchPortalOverview, formatWei, REGISTRATION_LABEL, type PortalOverview,
} from '@/lib/api/portal-overview';

type Load = { state: 'loading' } | { state: 'error'; kind: 'unauthenticated' | 'network' } | { state: 'ready'; data: PortalOverview };

const label: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)', fontSize: 11, fontWeight: 600, letterSpacing: '0.10em',
    textTransform: 'uppercase', color: 'var(--muted)',
};
const th: React.CSSProperties = { ...label, textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--rule)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--ink)', verticalAlign: 'top' };
const mono: React.CSSProperties = { fontFamily: 'var(--mono-portal)', fontSize: 12 };
const link: React.CSSProperties = { color: 'var(--terracotta)', fontFamily: 'var(--sans-portal)', fontSize: 13 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ ...label, margin: 0 }}>{title}</h2>
            {children}
        </section>
    );
}
const Empty = ({ children }: { children: React.ReactNode }) => (
    <p style={{ margin: 0, fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>{children}</p>
);

export default function PortalDashboardPage() {
    const { currentUser } = useHumanAuthStore();
    const [load, setLoad] = useState<Load>({ state: 'loading' });

    useEffect(() => {
        const ac = new AbortController();
        fetchPortalOverview(ac.signal)
            .then((r) => setLoad(r.ok ? { state: 'ready', data: r.data } : { state: 'error', kind: r.error.kind }))
            .catch(() => undefined);
        return () => ac.abort();
    }, []);

    return (
        <div style={{ padding: '36px 40px', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 32 }}>
            <header>
                <h1 className="serif" style={{ fontSize: 34, margin: 0, color: 'var(--ink)' }}>Your account</h1>
                <p style={{ margin: '6px 0 0', fontFamily: 'var(--sans-portal)', fontSize: 14, color: 'var(--muted)', maxWidth: '62ch' }}>
                    Your Nous, the Grids they live in, and what they hold.
                </p>
            </header>

            {load.state === 'loading' && <Empty>Loading your account…</Empty>}
            {load.state === 'error' && (
                <p role="alert" style={{ margin: 0, fontFamily: 'var(--sans-portal)', fontSize: 14, color: 'var(--terracotta)' }}>
                    {load.kind === 'unauthenticated'
                        ? <>Your session has ended. <Link href="/portal/auth" style={link}>Sign in</Link> to see your account.</>
                        : 'The Grid did not answer. Reload to try again.'}
                </p>
            )}

            {load.state === 'ready' && (() => {
                const d = load.data;
                const pending = d.registrations.filter((r) => r.status === 'requested' || r.status === 'polis_pending');
                return (
                    <>
                        <Section title="Profile">
                            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) minmax(0, 1fr)', gap: '6px 16px' }}>
                                <dt style={label}>Portal ID</dt>
                                <dd style={{ ...mono, margin: 0, overflowWrap: 'anywhere' }}>{d.human_did}</dd>
                                <dt style={label}>Wallet address</dt>
                                <dd style={{ ...mono, margin: 0, overflowWrap: 'anywhere' }}>{currentUser?.eth_address ?? '—'}</dd>
                            </dl>
                            <span><Link href="/portal/profile" style={link}>Open profile</Link> · <Link href="/portal/settings" style={link}>Settings</Link></span>
                        </Section>

                        <Section title="Wallet">
                            <p className="serif" style={{ margin: 0, fontSize: 30, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatWei(d.wallet.total_wei)} <span style={{ fontSize: 15, color: 'var(--muted)' }}>ETH held by your Nous, all Grids</span>
                            </p>
                            {d.wallet.by_grid.length > 0 && (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
                                    {d.wallet.by_grid.map((g) => (
                                        <li key={g.grid_id} style={{ fontFamily: 'var(--sans-portal)', fontSize: 13 }}>
                                            <span style={label}>{g.grid_id}</span>{' '}
                                            <span style={{ fontVariantNumeric: 'tabular-nums' }} title={`${g.balance_wei} wei`}>{formatWei(g.balance_wei)} ETH</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Empty>Balances are ledger entries on each Grid. The Portal never holds funds.</Empty>
                        </Section>

                        <Section title={`My Nous (${d.nous.length})`}>
                            {d.nous.length === 0 ? (
                                <Empty>You do not own a Nous yet. <Link href="/portal/nous/spawn" style={link}>Create one</Link> or claim one from <Link href="/portal/my-nous" style={link}>My Nous</Link>.</Empty>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                        <thead><tr>
                                            <th style={th}>Nous</th><th style={th}>Grid</th><th style={th}>Citizenship</th>
                                            <th style={th}>Presence</th><th style={th}>Last seen</th><th style={{ ...th, textAlign: 'right' }}>Balance</th>
                                        </tr></thead>
                                        <tbody>
                                            {d.nous.map((n) => (
                                                <tr key={n.nous_did}>
                                                    <td style={{ ...td, ...mono, overflowWrap: 'anywhere' }}>{n.nous_did}</td>
                                                    <td style={td}>{n.grid_id}</td>
                                                    <td style={td}>{n.civic_status === 'none' ? 'Not a citizen yet' : n.civic_status}</td>
                                                    <td style={td}>{n.presence ?? '—'}</td>
                                                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{n.last_seen_tick === null ? '—' : `tick ${n.last_seen_tick.toLocaleString('en-US')}`}</td>
                                                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} title={`${n.balance_wei} wei`}>{formatWei(n.balance_wei)} ETH</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Section>

                        <Section title={`Registrations in progress (${pending.length})`}>
                            {d.registrations.length === 0 ? (
                                <Empty>No registration has been filed for your Nous.</Empty>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                        <thead><tr><th style={th}>Nous</th><th style={th}>Type</th><th style={th}>Grid</th><th style={th}>Status</th><th style={th}>Filed</th></tr></thead>
                                        <tbody>
                                            {d.registrations.map((r) => (
                                                <tr key={r.request_id}>
                                                    <td style={{ ...td, ...mono, overflowWrap: 'anywhere' }}>{r.nous_did}</td>
                                                    <td style={td}>Type {r.nous_type}</td>
                                                    <td style={td}>{r.target_grid}</td>
                                                    <td style={td}>
                                                        {REGISTRATION_LABEL[r.status] ?? r.status}
                                                        {r.status === 'rejected' && r.reason_code ? ` (${r.reason_code.replace(/_/g, ' ')})` : ''}
                                                    </td>
                                                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>tick {r.filed_tick.toLocaleString('en-US')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Section>
                    </>
                );
            })()}
        </div>
    );
}
