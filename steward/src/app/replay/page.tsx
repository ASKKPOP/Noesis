'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';
import { ReplayModal } from './replay-modal';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface OperatorExportedPayload {
    tier: string;
    operator_id: string;
    start_tick: number;
    end_tick: number;
    tarball_hash: string;
    requested_at: number;
}

interface ExportAuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: OperatorExportedPayload;
    createdAt: number;
    eventHash: string;
}

export default function ReplayPage() {
    const [exports, setExports] = useState<ExportAuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<ExportAuditEntry | null>(null);

    useEffect(() => {
        async function fetchExports() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `${GRID_ORIGIN}/api/v1/audit/trail?type=operator.exported&limit=200`,
                );
                if (res.ok) {
                    const data = await res.json();
                    const entries: ExportAuditEntry[] = Array.isArray(data) ? data : data.entries ?? [];
                    setExports(entries);
                } else {
                    setError('Could not load operator exports.');
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not reach Grid. Retry by reloading the page.');
            } finally {
                setLoading(false);
            }
        }
        fetchExports();
    }, []);

    return (
        <StewardShell title="Replay" breadcrumb="Steward · Observatory · Replay">
            <div
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginBottom: 24,
                }}
            >
                Operator exports — click a row to scrub through its tick range.
            </div>

            {error ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
                    {error}
                </div>
            ) : loading ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
                    Loading exports…
                </div>
            ) : (
                <div className="steward-card">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                            Operator Exports
                        </h2>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                            {exports.length} exports
                        </span>
                    </div>

                    {exports.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            No exports recorded yet. Exports appear here when an H5 operator runs `operator.exported`.
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Exported At</th>
                                    <th>Operator</th>
                                    <th>Tick Range</th>
                                    <th>Tarball Hash</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exports.map((entry) => (
                                    <tr
                                        key={entry.eventHash}
                                        style={{
                                            height: 36,
                                            cursor: 'pointer',
                                            borderLeft: '3px solid #b8542f',
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Open scrubber for export ${entry.payload.operator_id} ticks ${entry.payload.start_tick} to ${entry.payload.end_tick}`}
                                        onClick={() => setSelected(entry)}
                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(entry)}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(184,84,47,0.06)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                                    >
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', width: 160 }}>
                                            {new Date(entry.payload.requested_at * 1000).toISOString().replace('T', ' ').slice(0, 19)}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)' }}>
                                            {entry.payload.operator_id}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                                            {entry.payload.start_tick.toLocaleString()} → {entry.payload.end_tick.toLocaleString()}
                                        </td>
                                        <td
                                            style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', width: 140 }}
                                            title={entry.payload.tarball_hash}
                                        >
                                            {entry.payload.tarball_hash.slice(0, 12)}…
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {selected && (
                <ReplayModal entry={selected} onClose={() => setSelected(null)} operatorTier={selected.payload.tier} />
            )}
        </StewardShell>
    );
}
