'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface AuditEntry {
    id: string;
    eventType: string;
    actorDid: string;
    payload: unknown;
    createdAt: string;
}

const LIMIT = 50;

function truncateDid(did: string): string {
    if (!did || did.length <= 20) return did ?? '';
    return did.slice(0, 10) + '…' + did.slice(-8);
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

function absoluteTime(ts: string): string {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return ts;
    }
}

function PayloadCell({ payload }: { payload: unknown }) {
    const [expanded, setExpanded] = useState(false);
    const text = JSON.stringify(payload, null, 2);
    const preview = JSON.stringify(payload).slice(0, 60);
    const isLong = text.length > 60;

    return (
        <td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', maxWidth: 300 }}>
            {!isLong ? (
                <span>{preview}</span>
            ) : expanded ? (
                <div>
                    <pre
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.5,
                            fontSize: 10,
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 4,
                            padding: '6px 8px',
                            marginBottom: 4,
                        }}
                    >
                        {text}
                    </pre>
                    <button
                        onClick={() => setExpanded(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--terracotta)',
                            fontSize: 10,
                            fontFamily: 'var(--mono)',
                            padding: 0,
                        }}
                    >
                        collapse
                    </button>
                </div>
            ) : (
                <div>
                    <span>{preview}…</span>{' '}
                    <button
                        onClick={() => setExpanded(true)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--terracotta)',
                            fontSize: 10,
                            fontFamily: 'var(--mono)',
                            padding: 0,
                        }}
                    >
                        expand
                    </button>
                </div>
            )}
        </td>
    );
}

export default function AuditPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [typeFilter, setTypeFilter] = useState('');
    const [actorFilter, setActorFilter] = useState('');
    const [appliedType, setAppliedType] = useState('');
    const [appliedActor, setAppliedActor] = useState('');

    const [chainValid, setChainValid] = useState<boolean | null>(null);
    const [chainEntries, setChainEntries] = useState<number | null>(null);

    async function fetchEntries(off: number, type: string, actor: string) {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('limit', String(LIMIT));
            params.set('offset', String(off));
            if (type) params.set('type', type);
            if (actor) params.set('actor', actor);
            const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/trail?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setEntries(Array.isArray(data) ? data : data.entries ?? []);
            setTotal(data.total ?? 0);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch audit trail');
        } finally {
            setLoading(false);
        }
    }

    async function fetchChainStatus() {
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/verify`);
            if (res.ok) {
                const data = await res.json();
                setChainValid(data.valid ?? false);
                setChainEntries(data.entries ?? null);
            }
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        fetchEntries(0, '', '');
        fetchChainStatus();
    }, []);

    function handleApply() {
        setAppliedType(typeFilter);
        setAppliedActor(actorFilter);
        setOffset(0);
        fetchEntries(0, typeFilter, actorFilter);
    }

    function goToPage(newOffset: number) {
        setOffset(newOffset);
        fetchEntries(newOffset, appliedType, appliedActor);
    }

    return (
        <StewardShell title="Audit Log" breadcrumb="Steward · Audit">
            {/* Integrity badge + filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                {/* Filter bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                        type="text"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                        placeholder="Event type…"
                        style={{
                            background: 'var(--vellum)',
                            border: '1px solid var(--rule)',
                            borderRadius: 5,
                            padding: '6px 10px',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            color: 'var(--ink)',
                            outline: 'none',
                            width: 180,
                        }}
                    />
                    <input
                        type="text"
                        value={actorFilter}
                        onChange={(e) => setActorFilter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                        placeholder="Actor DID…"
                        style={{
                            background: 'var(--vellum)',
                            border: '1px solid var(--rule)',
                            borderRadius: 5,
                            padding: '6px 10px',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            color: 'var(--ink)',
                            outline: 'none',
                            width: 220,
                        }}
                    />
                    <button
                        onClick={handleApply}
                        style={{
                            background: 'var(--terracotta)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 5,
                            padding: '6px 16px',
                            fontFamily: 'var(--sans)',
                            fontSize: 12,
                            cursor: 'pointer',
                        }}
                    >
                        Apply
                    </button>
                </div>

                {/* Chain integrity */}
                {chainValid !== null && (
                    <span
                        className="badge"
                        style={{
                            background: chainValid ? 'rgba(34,139,34,0.1)' : 'rgba(184,84,47,0.1)',
                            color: chainValid ? '#2d7a2d' : 'var(--terracotta)',
                            border: `1px solid ${chainValid ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}`,
                        }}
                    >
                        {chainValid ? `Chain Verified ✓` : `Chain Invalid ✗`}
                        {chainEntries !== null && (
                            <span style={{ marginLeft: 6, opacity: 0.7 }}>({chainEntries} entries)</span>
                        )}
                    </span>
                )}
            </div>

            <div className="steward-card">
                {error ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Could not load audit trail: {error}
                    </div>
                ) : loading ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Loading audit trail…
                    </div>
                ) : entries.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        No audit entries found.
                    </div>
                ) : (
                    <>
                        <table>
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Event Type</th>
                                    <th>Actor DID</th>
                                    <th>Payload</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td
                                            style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}
                                            title={absoluteTime(entry.createdAt)}
                                        >
                                            {relativeTime(entry.createdAt)}
                                        </td>
                                        <td>
                                            <span
                                                style={{
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 10,
                                                    background: 'var(--vellum)',
                                                    border: '1px solid var(--rule)',
                                                    borderRadius: 3,
                                                    padding: '2px 6px',
                                                    letterSpacing: '0.04em',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {entry.eventType}
                                            </span>
                                        </td>
                                        <td
                                            style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
                                            title={entry.actorDid}
                                        >
                                            {truncateDid(entry.actorDid)}
                                        </td>
                                        <PayloadCell payload={entry.payload} />
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div
                            style={{
                                padding: '12px 20px',
                                borderTop: '1px solid var(--rule)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <button
                                onClick={() => goToPage(Math.max(0, offset - LIMIT))}
                                disabled={offset === 0}
                                style={{
                                    background: 'none',
                                    border: '1px solid var(--rule)',
                                    borderRadius: 4,
                                    padding: '4px 12px',
                                    fontFamily: 'var(--sans)',
                                    fontSize: 12,
                                    color: offset === 0 ? 'var(--rule)' : 'var(--muted)',
                                    cursor: offset === 0 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                ← Prev
                            </button>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
                            </span>
                            <button
                                onClick={() => goToPage(offset + LIMIT)}
                                disabled={offset + LIMIT >= total}
                                style={{
                                    background: 'none',
                                    border: '1px solid var(--rule)',
                                    borderRadius: 4,
                                    padding: '4px 12px',
                                    fontFamily: 'var(--sans)',
                                    fontSize: 12,
                                    color: offset + LIMIT >= total ? 'var(--rule)' : 'var(--muted)',
                                    cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    </>
                )}
            </div>
        </StewardShell>
    );
}
