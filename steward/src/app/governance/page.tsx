'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface Law {
    id: string;
    text: string;
    rationale: string;
    status: string;
}

interface Proposal {
    id: string;
    description?: string;
    text?: string;
    status: string;
    votesYes?: number;
    votesNo?: number;
}

const inputStyle: React.CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 5,
    padding: '7px 10px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
};

const btnPrimary: React.CSSProperties = {
    background: 'var(--terracotta)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '7px 18px',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
    background: 'none',
    color: 'var(--muted)',
    border: '1px solid var(--rule)',
    borderRadius: 6,
    padding: '7px 18px',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    cursor: 'pointer',
};

function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n) + '…' : s;
}

function StatusBadgeText({ status }: { status: string }) {
    const colors: Record<string, { bg: string; color: string }> = {
        active: { bg: 'rgba(34,139,34,0.1)', color: '#2d7a2d' },
        repealed: { bg: 'rgba(138,132,121,0.1)', color: 'var(--muted)' },
        proposed: { bg: 'rgba(138,106,46,0.1)', color: 'var(--bronze)' },
        open: { bg: 'rgba(138,106,46,0.1)', color: 'var(--bronze)' },
        passed: { bg: 'rgba(34,139,34,0.1)', color: '#2d7a2d' },
        rejected: { bg: 'rgba(184,84,47,0.1)', color: 'var(--terracotta)' },
    };
    const c = colors[status] ?? { bg: 'rgba(138,132,121,0.1)', color: 'var(--muted)' };
    return (
        <span
            style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: c.bg,
                color: c.color,
                letterSpacing: '0.06em',
            }}
        >
            {status}
        </span>
    );
}

export default function GovernancePage() {
    const [laws, setLaws] = useState<Law[]>([]);
    const [lawsLoading, setLawsLoading] = useState(true);
    const [lawsError, setLawsError] = useState<string | null>(null);

    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [proposalsLoading, setProposalsLoading] = useState(true);
    const [proposalsError, setProposalsError] = useState<string | null>(null);

    // Add law form
    const [showAddLaw, setShowAddLaw] = useState(false);
    const [newLawText, setNewLawText] = useState('');
    const [newLawRationale, setNewLawRationale] = useState('');
    const [addLawStatus, setAddLawStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [addLawLoading, setAddLawLoading] = useState(false);

    // Amend form state
    const [amendingId, setAmendingId] = useState<string | null>(null);
    const [amendText, setAmendText] = useState('');
    const [amendStatus, setAmendStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [amendLoading, setAmendLoading] = useState(false);

    // Repeal confirm state
    const [repealingId, setRepealingId] = useState<string | null>(null);
    const [repealStatus, setRepealStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [repealLoading, setRepealLoading] = useState(false);

    async function fetchLaws() {
        setLawsLoading(true);
        setLawsError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/governance/laws`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setLaws(Array.isArray(data) ? data : data.laws ?? []);
        } catch (e) {
            setLawsError(e instanceof Error ? e.message : 'Failed to fetch laws');
        } finally {
            setLawsLoading(false);
        }
    }

    async function fetchProposals() {
        setProposalsLoading(true);
        setProposalsError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/governance/proposals`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setProposals(Array.isArray(data) ? data : data.proposals ?? []);
        } catch (e) {
            setProposalsError(e instanceof Error ? e.message : 'Failed to fetch proposals');
        } finally {
            setProposalsLoading(false);
        }
    }

    useEffect(() => {
        fetchLaws();
        fetchProposals();
    }, []);

    async function handleAddLaw(e: React.FormEvent) {
        e.preventDefault();
        setAddLawLoading(true);
        setAddLawStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/governance/laws`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newLawText, rationale: newLawRationale }),
            });
            if (res.ok) {
                setAddLawStatus({ type: 'success', msg: 'Law added successfully.' });
                setNewLawText('');
                setNewLawRationale('');
                setShowAddLaw(false);
                fetchLaws();
            } else {
                const d = await res.json().catch(() => ({}));
                setAddLawStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setAddLawStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setAddLawLoading(false);
        }
    }

    async function handleAmend(lawId: string, e: React.FormEvent) {
        e.preventDefault();
        setAmendLoading(true);
        setAmendStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/governance/laws/${lawId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: amendText }),
            });
            if (res.ok) {
                setAmendStatus({ type: 'success', msg: 'Law amended.' });
                setAmendingId(null);
                setAmendText('');
                fetchLaws();
            } else {
                const d = await res.json().catch(() => ({}));
                setAmendStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setAmendStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setAmendLoading(false);
        }
    }

    async function handleRepeal(lawId: string) {
        setRepealLoading(true);
        setRepealStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/governance/laws/${lawId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setRepealingId(null);
                fetchLaws();
            } else {
                const d = await res.json().catch(() => ({}));
                setRepealStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setRepealStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setRepealLoading(false);
        }
    }

    return (
        <StewardShell title="Governance" breadcrumb="Steward · Governance">
            {/* Laws section */}
            <div className="steward-card" style={{ marginBottom: 32 }}>
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--rule)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Laws
                    </h2>
                    <button onClick={() => setShowAddLaw(!showAddLaw)} style={btnPrimary}>
                        {showAddLaw ? 'Cancel' : '+ Add Law'}
                    </button>
                </div>

                {/* Add law inline form */}
                {showAddLaw && (
                    <form
                        onSubmit={handleAddLaw}
                        style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--rule)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            background: 'rgba(184,84,47,0.03)',
                        }}
                    >
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                                Law Text
                            </label>
                            <textarea
                                value={newLawText}
                                onChange={(e) => setNewLawText(e.target.value)}
                                required
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }}
                                placeholder="State the law…"
                            />
                        </div>
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                                Rationale
                            </label>
                            <textarea
                                value={newLawRationale}
                                onChange={(e) => setNewLawRationale(e.target.value)}
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                                placeholder="Why is this law needed…"
                            />
                        </div>
                        {addLawStatus && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: addLawStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)' }}>
                                {addLawStatus.msg}
                            </div>
                        )}
                        <div>
                            <button type="submit" style={btnPrimary} disabled={addLawLoading}>
                                {addLawLoading ? 'Adding…' : 'Add Law'}
                            </button>
                        </div>
                    </form>
                )}

                {lawsError ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Could not load laws: {lawsError}
                    </div>
                ) : lawsLoading ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Loading laws…
                    </div>
                ) : laws.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        No laws enacted yet.
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Text</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {laws.map((law) => (
                                <>
                                    <tr key={law.id}>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                            {law.id}
                                        </td>
                                        <td style={{ fontSize: 13, lineHeight: 1.4 }} title={law.text}>
                                            {truncate(law.text, 80)}
                                        </td>
                                        <td>
                                            <StatusBadgeText status={law.status} />
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    onClick={() => {
                                                        setAmendingId(amendingId === law.id ? null : law.id);
                                                        setAmendText(law.text);
                                                        setAmendStatus(null);
                                                    }}
                                                    style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}
                                                >
                                                    Amend
                                                </button>
                                                <button
                                                    onClick={() => setRepealingId(repealingId === law.id ? null : law.id)}
                                                    style={{
                                                        ...btnSecondary,
                                                        padding: '4px 10px',
                                                        fontSize: 11,
                                                        borderColor: 'rgba(184,84,47,0.3)',
                                                        color: 'var(--terracotta)',
                                                    }}
                                                >
                                                    Repeal
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Amend inline form */}
                                    {amendingId === law.id && (
                                        <tr key={`amend-${law.id}`}>
                                            <td colSpan={4} style={{ padding: '12px 16px', background: 'rgba(184,84,47,0.03)' }}>
                                                <form onSubmit={(e) => handleAmend(law.id, e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    <textarea
                                                        value={amendText}
                                                        onChange={(e) => setAmendText(e.target.value)}
                                                        required
                                                        style={{ ...inputStyle, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
                                                    />
                                                    {amendStatus && (
                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: amendStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)' }}>
                                                            {amendStatus.msg}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button type="submit" style={{ ...btnPrimary, padding: '5px 14px', fontSize: 11 }} disabled={amendLoading}>
                                                            {amendLoading ? 'Saving…' : 'Save Amendment'}
                                                        </button>
                                                        <button type="button" onClick={() => setAmendingId(null)} style={{ ...btnSecondary, padding: '5px 14px', fontSize: 11 }}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </form>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Repeal confirm */}
                                    {repealingId === law.id && (
                                        <tr key={`repeal-${law.id}`}>
                                            <td colSpan={4} style={{ padding: '12px 16px', background: 'rgba(184,84,47,0.03)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                        Repeal this law? This cannot be undone.
                                                    </span>
                                                    {repealStatus && (
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--terracotta)' }}>
                                                            {repealStatus.msg}
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => handleRepeal(law.id)}
                                                        style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11, borderColor: 'rgba(184,84,47,0.3)', color: 'var(--terracotta)' }}
                                                        disabled={repealLoading}
                                                    >
                                                        {repealLoading ? 'Repealing…' : 'Confirm Repeal'}
                                                    </button>
                                                    <button onClick={() => setRepealingId(null)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Proposals section */}
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Proposals
                    </h2>
                </div>

                {proposalsError ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Could not load proposals: {proposalsError}
                    </div>
                ) : proposalsLoading ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Loading proposals…
                    </div>
                ) : proposals.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        No proposals yet.
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Votes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map((p) => (
                                <tr key={p.id}>
                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                        {p.id}
                                    </td>
                                    <td style={{ fontSize: 13, lineHeight: 1.4 }} title={p.description ?? p.text}>
                                        {truncate(p.description ?? p.text ?? '', 80)}
                                    </td>
                                    <td>
                                        <StatusBadgeText status={p.status} />
                                    </td>
                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                        {p.votesYes !== undefined ? (
                                            <span>
                                                <span style={{ color: '#2d7a2d' }}>{p.votesYes} yes</span>
                                                {' / '}
                                                <span style={{ color: 'var(--terracotta)' }}>{p.votesNo ?? 0} no</span>
                                            </span>
                                        ) : (
                                            '—'
                                        )}
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
