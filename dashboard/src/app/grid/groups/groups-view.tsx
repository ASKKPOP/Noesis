'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchGroups, fetchGroupDetail, type GroupDetail, type GroupSummary } from '@/lib/api/groups';

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

const label: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)', fontSize: 11, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--muted)',
};
const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--rule)', textAlign: 'left', fontSize: 14 };

export function GroupsView(): React.ReactElement {
    const router = useRouter();
    const selectedId = useSearchParams().get('id');
    const [groups, setGroups] = useState<Load<GroupSummary[]>>({ state: 'loading' });
    const [detail, setDetail] = useState<Load<GroupDetail> | null>(null);

    useEffect(() => {
        const ac = new AbortController();
        fetchGroups(ac.signal)
            .then((r) => setGroups(r.ok ? { state: 'ready', data: r.data } : { state: 'error' }))
            .catch(() => undefined);
        return () => ac.abort();
    }, []);

    useEffect(() => {
        if (!selectedId) { setDetail(null); return; }
        const ac = new AbortController();
        setDetail({ state: 'loading' });
        fetchGroupDetail(selectedId, ac.signal)
            .then((r) => setDetail(r.ok ? { state: 'ready', data: r.data } : { state: 'error' }))
            .catch(() => undefined);
        return () => ac.abort();
    }, [selectedId]);

    if (groups.state === 'loading') return <p style={{ color: 'var(--muted)' }}>Loading Groups…</p>;
    if (groups.state === 'error') return <p role="alert" style={{ color: 'var(--terracotta)' }}>The Grid did not answer. Reload to try again.</p>;
    if (groups.data.length === 0) return <p style={{ color: 'var(--muted)' }}>No Groups have been founded on this Grid yet.</p>;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
            <ul aria-label="Groups" style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.data.map((g) => {
                    const active = g.group_id === selectedId;
                    return (
                        <li key={g.group_id}>
                            <button
                                type="button"
                                aria-pressed={active}
                                onClick={() => router.replace(`/grid/groups?id=${encodeURIComponent(g.group_id)}`, { scroll: false })}
                                style={{
                                    width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 14px',
                                    background: active ? 'var(--parchment)' : 'transparent',
                                    border: `1px solid ${active ? 'var(--terracotta)' : 'var(--rule)'}`,
                                    borderRadius: 6, color: 'var(--ink)', font: 'inherit',
                                }}
                            >
                                <span className="serif" style={{ fontSize: 22, display: 'block' }}>{g.display_name}</span>
                                <span style={label}>{g.domain.replace(/_/g, ' ')} · ring {g.ring} · {g.sector_deg}°</span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            <section aria-live="polite" style={{ flex: '2 1 420px', minWidth: 0 }}>
                {!detail && <p style={{ color: 'var(--muted)' }}>Choose a Group to see its members and projects.</p>}
                {detail?.state === 'loading' && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
                {detail?.state === 'error' && <p role="alert" style={{ color: 'var(--terracotta)' }}>That Group could not be loaded.</p>}
                {detail?.state === 'ready' && <GroupDetailPanel d={detail.data} />}
            </section>
        </div>
    );
}

function GroupDetailPanel({ d }: { d: GroupDetail }): React.ReactElement {
    const completed = d.projects.filter((p) => p.status === 'completed').length;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
                <h2 style={{ fontSize: 30, margin: 0, color: 'var(--ink)' }}>{d.group.display_name}</h2>
                <p style={{ ...label, margin: '4px 0 0' }}>
                    {d.group.kind} · {d.group.domain.replace(/_/g, ' ')} · {d.group.status}
                </p>
            </div>

            <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 32px', margin: 0 }}>
                {[
                    ['Members', d.member_count],
                    ['Projects', d.projects.length],
                    ['Blueprints produced', completed],
                ].map(([k, v]) => (
                    <div key={k as string}>
                        <dt style={label}>{k}</dt>
                        <dd className="serif" style={{ margin: 0, fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>{v}</dd>
                    </div>
                ))}
            </dl>

            <div>
                <h3 style={{ ...label, margin: '0 0 6px' }}>Members</h3>
                {d.members.length === 0 ? (
                    <p style={{ color: 'var(--muted)', margin: 0 }}>No Nous has joined yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead><tr><th style={{ ...cell, ...label }}>Member</th><th style={{ ...cell, ...label }}>Role</th><th style={{ ...cell, ...label }}>Joined at tick</th></tr></thead>
                            <tbody>
                                {d.members.map((m) => (
                                    <tr key={m.member_hash}>
                                        <td style={{ ...cell, fontFamily: 'var(--mono-portal)', fontSize: 12.5 }} title={m.member_hash}>{m.member_hash.slice(0, 12)}…</td>
                                        <td style={cell}>{m.role}</td>
                                        <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{m.joined_at_tick.toLocaleString('en-US')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div>
                <h3 style={{ ...label, margin: '0 0 6px' }}>Research projects</h3>
                {d.projects.length === 0 ? (
                    <p style={{ color: 'var(--muted)', margin: 0 }}>No project has been started yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead><tr><th style={{ ...cell, ...label }}>Project</th><th style={{ ...cell, ...label }}>Status</th><th style={{ ...cell, ...label }}>Started</th><th style={{ ...cell, ...label }}>Blueprint</th></tr></thead>
                            <tbody>
                                {d.projects.map((p) => (
                                    <tr key={p.project_id}>
                                        <td style={cell}>{p.title}</td>
                                        <td style={cell}>{p.status}</td>
                                        <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>tick {p.started_at_tick.toLocaleString('en-US')}</td>
                                        <td style={{ ...cell, fontFamily: 'var(--mono-portal)', fontSize: 12.5 }} title={p.produced_blueprint_hash ?? undefined}>
                                            {p.produced_blueprint_hash ? `${p.produced_blueprint_hash.slice(0, 12)}…` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
