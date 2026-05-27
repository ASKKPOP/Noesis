'use client';

/**
 * Phase 39 — Steward Console /system/operators
 * Tier-2 Grid Manager surface (D-V3-36 / D-39-07).
 * Henry-only view: unowned Brain pool + per-operator quota + override edit controls.
 * Phase 41 SLEEP-02: Section 4 — Message Queue Depth per-operator.
 *
 * Data API: Grid Manager admin endpoints (Phase 39 wires read paths;
 * quota override write API wired to POST /api/v1/operator/me/quota/override — future).
 */
import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

interface UnownedBrain {
    brain_did: string;
    registered_at_ms: number;
}

interface OperatorRow {
    operator_did: string;
    brain_count: number;
    quota_limit: number;
    event_rate_per_did_per_min: number;
}

interface PresenceQueueRow {
    operator_did: string | null;
    civic_did: string;
    nous_name: string | null;
    presence_status: 'away' | 'absent' | 'presumed_departed';
    last_seen_at: string | null;
    queue_depth: number;
}

function formatRelative(iso: string): string {
    const elapsed = Date.now() - new Date(iso).getTime();
    const min = Math.round(elapsed / 60_000);
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(elapsed / 3_600_000);
    if (hr < 24) return `${hr} hr ago`;
    const days = Math.round(elapsed / 86_400_000);
    return `${days} days ago`;
}

export default function OperatorsPage() {
    const [unowned, setUnowned] = useState<UnownedBrain[]>([]);
    const [operators, setOperators] = useState<OperatorRow[]>([]);
    const [presenceSummary, setPresenceSummary] = useState<PresenceQueueRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                // Grid Manager admin endpoint — returns {unowned_brains, operators}
                const res = await fetch('/api/v1/grid-manager/operator-overview', {
                    credentials: 'include',
                });
                if (!res.ok) {
                    setError(`Grid API returned ${res.status}`);
                    return;
                }
                const data = await res.json() as {
                    unowned_brains: UnownedBrain[];
                    operators: OperatorRow[];
                };
                setUnowned(data.unowned_brains ?? []);
                setOperators(data.operators ?? []);
            } catch (e) {
                setError(String(e));
            } finally {
                setLoading(false);
            }

            // Phase 41 SLEEP-02 — Section 4: Message Queue Depth
            try {
                const presenceRes = await fetch('/api/v1/grid-manager/presence-overview', {
                    credentials: 'include',
                });
                if (presenceRes.ok) {
                    const presenceData = await presenceRes.json() as { presence_summary: PresenceQueueRow[] };
                    setPresenceSummary(presenceData.presence_summary);
                }
            } catch { /* silent — Section 4 shows empty state */ }
        }
        void load();
    }, []);

    return (
        <StewardShell title="Operator Management" breadcrumb="System / Operators">
            <div className="p-6 max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-1">Operator Management</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Tier-2 Grid Manager surface (D-V3-36) — Henry-only view.
                    Shows unowned Brain pool, per-operator quota usage, and override controls.
                </p>

                {loading && <p className="text-gray-400">Loading operator data…</p>}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
                        Error loading operator overview: {error}
                    </div>
                )}

                {/* Section 1: Unowned Brains (D-39-02) */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-2">Unowned Brains</h2>
                    <p className="text-xs text-gray-400 mb-3">
                        Brains registered in Phase 38 but not yet claimed via /operator/me/brains.
                        These are functional but not counted against any operator quota.
                    </p>
                    {!loading && unowned.length === 0 && (
                        <p className="text-gray-400 text-sm">No unowned Brains.</p>
                    )}
                    {unowned.length > 0 && (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left border-b border-gray-200">
                                    <th className="py-2 pr-4 font-medium">Brain DID</th>
                                    <th className="py-2 font-medium">Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unowned.map((b) => (
                                    <tr key={b.brain_did} className="border-b border-gray-100">
                                        <td className="py-2 pr-4 font-mono text-xs text-gray-700">{b.brain_did}</td>
                                        <td className="py-2 text-gray-500">
                                            {new Date(b.registered_at_ms).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                {/* Section 2: Per-Operator Quota (D-39-07) */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-2">Per-Operator Quota</h2>
                    <p className="text-xs text-gray-400 mb-3">
                        Current Brain process usage and limits. Default: 3 Brain processes per operator.
                        Edit controls below set per-operator overrides stored in operator_quota_overrides.
                    </p>
                    {!loading && operators.length === 0 && (
                        <p className="text-gray-400 text-sm">No claimed operators yet.</p>
                    )}
                    {operators.length > 0 && (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left border-b border-gray-200">
                                    <th className="py-2 pr-4 font-medium">Operator DID</th>
                                    <th className="py-2 pr-4 font-medium">Active Brains</th>
                                    <th className="py-2 pr-4 font-medium">Limit</th>
                                    <th className="py-2 font-medium">Event Rate (req/min)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operators.map((op) => (
                                    <tr key={op.operator_did} className="border-b border-gray-100">
                                        <td className="py-2 pr-4 font-mono text-xs text-gray-700">{op.operator_did}</td>
                                        <td className="py-2 pr-4">{op.brain_count}</td>
                                        <td className="py-2 pr-4">{op.quota_limit}</td>
                                        <td className="py-2">{op.event_rate_per_did_per_min}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                {/* Section 3: Quota Override Controls (D-39-07) */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-2">Quota Override Controls</h2>
                    <p className="text-xs text-gray-400">
                        Per-operator limit overrides stored in operator_quota_overrides table.
                        Runtime changes — no Grid restart required (D-39-07).
                        Write API endpoint: Grid Manager admin route (wired in Grid Manager phase).
                    </p>
                    <div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                        Edit controls will be activated when the Grid Manager admin write API is wired.
                        Data reads are live above.
                    </div>
                </section>

                {/* Section 4: Message Queue Depth (Phase 41 SLEEP-02) */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-2">Message Queue Depth</h2>
                    <p className="text-xs text-gray-400 mb-3">
                        Per-operator queued direct messages for away Nous. Delivered automatically on reconnect.
                    </p>
                    {presenceSummary.length === 0 && (
                        <p className="text-gray-400 text-sm">All Nous are currently awake. No queued messages.</p>
                    )}
                    {presenceSummary.length > 0 && (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                                    <th className="py-2 px-2 font-medium">Operator DID</th>
                                    <th className="py-2 px-2 font-medium">Nous</th>
                                    <th className="py-2 px-2 font-medium">Status</th>
                                    <th className="py-2 px-2 font-medium">Last Seen</th>
                                    <th className="py-2 px-2 font-medium">Queued Messages</th>
                                </tr>
                            </thead>
                            <tbody>
                                {presenceSummary.map(row => {
                                    const queueBgClass =
                                        row.queue_depth >= 50 ? 'bg-red-50' :
                                        row.queue_depth >= 10 ? 'bg-amber-50' : '';
                                    const queueTextClass =
                                        row.queue_depth >= 50 ? 'text-red-700' :
                                        row.queue_depth >= 10 ? 'text-amber-700' : 'text-gray-700';
                                    const statusPillClass =
                                        row.presence_status === 'away' ? 'bg-amber-100 text-amber-700' :
                                        row.presence_status === 'absent' ? 'bg-orange-100 text-orange-700' :
                                        'bg-red-100 text-red-700';
                                    return (
                                        <tr key={row.civic_did} className={`border-b border-gray-100 ${queueBgClass}`}>
                                            <td className="py-2 px-2 font-mono text-xs text-gray-700">
                                                {row.operator_did ?? '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-xs">
                                                {row.nous_name ?? row.civic_did.slice(0, 24) + '…'}
                                            </td>
                                            <td className="py-2 px-2">
                                                <span className={`text-[11px] font-mono font-medium px-2 py-1 rounded ${statusPillClass}`}>
                                                    {row.presence_status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 font-mono text-xs text-gray-500">
                                                {row.last_seen_at ? formatRelative(row.last_seen_at) : '—'}
                                            </td>
                                            <td className={`py-2 px-2 font-mono text-xs font-medium ${queueTextClass}`}>
                                                {row.queue_depth}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </StewardShell>
    );
}
