'use client';

/**
 * Phase 39 — Steward Console /system/operators
 * Tier-2 Grid Manager surface (D-V3-36 / D-39-07).
 * Henry-only view: unowned Brain pool + per-operator quota + override edit controls.
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

export default function OperatorsPage() {
    const [unowned, setUnowned] = useState<UnownedBrain[]>([]);
    const [operators, setOperators] = useState<OperatorRow[]>([]);
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
        }
        void load();
    }, []);

    return (
        <StewardShell>
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
                <section>
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
            </div>
        </StewardShell>
    );
}
