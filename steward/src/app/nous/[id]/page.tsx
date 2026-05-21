'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    padding: '8px 20px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
    background: 'none',
    color: 'var(--muted)',
    border: '1px solid var(--rule)',
    borderRadius: 6,
    padding: '8px 20px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
};

export default function NousDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const did = decodeURIComponent(id);
    const router = useRouter();

    const [nousInfo, setNousInfo] = useState<NousEntry | null>(null);
    const [brainState, setBrainState] = useState<unknown>(null);
    const [brainError, setBrainError] = useState<string | null>(null);
    const [brainLoading, setBrainLoading] = useState(true);

    // Force telos form
    const [telosText, setTelosText] = useState('');
    const [telosReason, setTelosReason] = useState('');
    const [telosStatus, setTelosStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [telosSubmitting, setTelosSubmitting] = useState(false);

    // Delete form
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            // Fetch nous info from roster
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/nous`);
                if (res.ok) {
                    const data = await res.json();
                    const list: NousEntry[] = Array.isArray(data) ? data : data.nous ?? [];
                    const found = list.find((n) => n.did === did);
                    if (found) setNousInfo(found);
                }
            } catch {
                // ignore
            }

            // Fetch brain state
            setBrainLoading(true);
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/nous/${encodeURIComponent(did)}/state`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.error) {
                        setBrainError(data.error);
                    } else {
                        setBrainState(data);
                    }
                } else if (res.status === 503 || res.status === 404) {
                    setBrainError(`Nous state unavailable (${res.status})`);
                } else {
                    setBrainError(`HTTP ${res.status}`);
                }
            } catch (e) {
                setBrainError(e instanceof Error ? e.message : 'Network error');
            } finally {
                setBrainLoading(false);
            }
        }
        fetchData();
    }, [did]);

    async function handleForceTelos(e: React.FormEvent) {
        e.preventDefault();
        setTelosSubmitting(true);
        setTelosStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/telos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telos: telosText, reason: telosReason }),
            });
            if (res.ok) {
                setTelosStatus({ type: 'success', msg: 'Telos updated successfully.' });
                setTelosText('');
                setTelosReason('');
            } else {
                const d = await res.json().catch(() => ({}));
                setTelosStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setTelosStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setTelosSubmitting(false);
        }
    }

    async function handleDelete(e: React.FormEvent) {
        e.preventDefault();
        if (deleteConfirm !== (nousInfo?.name ?? did)) return;
        setDeleteSubmitting(true);
        setDeleteStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: deleteReason }),
            });
            if (res.ok) {
                router.push('/nous');
            } else {
                const d = await res.json().catch(() => ({}));
                setDeleteStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setDeleteStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setDeleteSubmitting(false);
        }
    }

    const name = nousInfo?.name ?? did;

    return (
        <StewardShell title={name} breadcrumb={`Steward · Nous · ${name}`}>
            {/* Navigation links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, marginTop: -12 }}>
                <Link
                    href="/nous"
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    ← Back to Roster
                </Link>
                <span style={{ color: 'var(--rule)' }}>|</span>
                <Link
                    href={`/nous/${id}/config`}
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--terracotta)',
                        textDecoration: 'none',
                    }}
                >
                    Configure →
                </Link>
            </div>

            {/* Brain State */}
            <div className="steward-card" style={{ marginBottom: 24 }}>
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--rule)',
                        fontFamily: 'var(--serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--ink)',
                    }}
                >
                    Brain State
                </div>
                <div style={{ padding: 20 }}>
                    {brainLoading ? (
                        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            Loading brain state…
                        </span>
                    ) : brainError ? (
                        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {brainError}
                        </span>
                    ) : (
                        <pre
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                color: 'var(--ink)',
                                background: 'var(--parchment)',
                                border: '1px solid var(--rule)',
                                borderRadius: 6,
                                padding: '14px 16px',
                                overflowX: 'auto',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {JSON.stringify(brainState, null, 2)}
                        </pre>
                    )}
                </div>
            </div>

            {/* Force Telos */}
            <div className="steward-card" style={{ marginBottom: 24 }}>
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--rule)',
                        fontFamily: 'var(--serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--ink)',
                    }}
                >
                    Force Telos
                </div>
                <form onSubmit={handleForceTelos} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            New Telos
                        </label>
                        <textarea
                            value={telosText}
                            onChange={(e) => setTelosText(e.target.value)}
                            required
                            placeholder="Describe the new purpose for this Nous…"
                            style={{
                                ...inputStyle,
                                resize: 'vertical',
                                minHeight: 90,
                                lineHeight: 1.5,
                            }}
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Reason
                        </label>
                        <input
                            type="text"
                            value={telosReason}
                            onChange={(e) => setTelosReason(e.target.value)}
                            required
                            placeholder="Operator rationale…"
                            style={inputStyle}
                        />
                    </div>
                    {telosStatus && (
                        <div
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                color: telosStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)',
                                padding: '8px 12px',
                                background:
                                    telosStatus.type === 'success'
                                        ? 'rgba(34,139,34,0.08)'
                                        : 'rgba(184,84,47,0.08)',
                                borderRadius: 5,
                                border: `1px solid ${telosStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}`,
                            }}
                        >
                            {telosStatus.msg}
                        </div>
                    )}
                    <div>
                        <button type="submit" style={btnPrimary} disabled={telosSubmitting}>
                            {telosSubmitting ? 'Sending…' : 'Force Telos'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Danger Zone */}
            <div
                className="steward-card"
                style={{
                    borderColor: 'rgba(184,84,47,0.3)',
                }}
            >
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(184,84,47,0.2)',
                        fontFamily: 'var(--serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--terracotta)',
                    }}
                >
                    Danger Zone
                </div>
                <form onSubmit={handleDelete} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                        Permanently delete this Nous from the grid. This action cannot be undone. Type{' '}
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
                            {nousInfo?.name ?? did}
                        </span>{' '}
                        to confirm.
                    </p>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Confirm Name
                        </label>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={nousInfo?.name ?? did}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Reason
                        </label>
                        <input
                            type="text"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            required
                            placeholder="Operator rationale for deletion…"
                            style={inputStyle}
                        />
                    </div>
                    {deleteStatus && (
                        <div
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                color: 'var(--terracotta)',
                                padding: '8px 12px',
                                background: 'rgba(184,84,47,0.08)',
                                borderRadius: 5,
                                border: '1px solid rgba(184,84,47,0.2)',
                            }}
                        >
                            {deleteStatus.msg}
                        </div>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={deleteConfirm !== (nousInfo?.name ?? did) || deleteSubmitting}
                            style={{
                                ...btnSecondary,
                                borderColor: 'rgba(184,84,47,0.4)',
                                color: 'var(--terracotta)',
                                opacity: deleteConfirm !== (nousInfo?.name ?? did) ? 0.5 : 1,
                            }}
                        >
                            {deleteSubmitting ? 'Deleting…' : 'Delete Nous'}
                        </button>
                    </div>
                </form>
            </div>
        </StewardShell>
    );
}
