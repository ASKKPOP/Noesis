'use client';

/**
 * /system/portal-manager/nous-registrations — the Portal reviewer panel for Nous
 * registrations (Tier-3 Portal Manager, D-V3-36 / D-V3-39).
 *
 * An operator reviewer passes or rejects each filing at the Portal pre-screen.
 * A pass forwards the filing to the Genesis Polis, whose charter rules are then
 * applied automatically — the reviewer never decides for the Polis. Every
 * decision is recorded on the audit chain by the Grid.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    fetchReviewQueue, prescreenRegistration, refusalText,
    type RegistrationStatus, type ReviewRow,
} from '@/lib/api/nous-registration';

const mono = 'var(--mono-portal)';
const sans = 'var(--sans-portal)';

const STATUS_LABEL: Record<RegistrationStatus, string> = {
    requested: 'Waiting for pre-screen',
    polis_pending: 'Waiting for Polis review',
    approved: 'Approved',
    rejected: 'Rejected',
};

/** Pre-screen rejection reasons a reviewer may give (the Grid's closed set). */
const REJECT_REASONS = [
    ['prescreen_operator_invalid', 'Owner is not valid'],
    ['prescreen_sybil', 'Looks like a duplicate identity'],
    ['prescreen_oath_invalid', 'Oath is not valid'],
    ['other', 'Other'],
] as const;

type Load = { state: 'loading' } | { state: 'refused'; code: string } | { state: 'ready'; rows: ReviewRow[] };

const eyebrow: React.CSSProperties = {
    fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)',
};
const button: React.CSSProperties = {
    fontFamily: sans, fontSize: 13, fontWeight: 600, borderRadius: 6, padding: '6px 14px', cursor: 'pointer', minHeight: 32,
};

export default function NousRegistrationReviewPage() {
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

    const refresh = useCallback(async (signal?: AbortSignal) => {
        const res = await fetchReviewQueue(undefined, signal);
        setLoad(res.ok ? { state: 'ready', rows: res.data.registrations } : { state: 'refused', code: res.code });
    }, []);

    useEffect(() => {
        const ac = new AbortController();
        refresh(ac.signal).catch(() => undefined);
        return () => ac.abort();
    }, [refresh]);

    async function decide(row: ReviewRow, pass: boolean) {
        setBusy(row.request_id);
        setNotice(null);
        const res = await prescreenRegistration(row.request_id, pass, pass ? undefined : (reasons[row.request_id] ?? 'other'));
        setBusy(null);
        if (!res.ok) {
            setNotice({ tone: 'bad', text: refusalText(res.code) });
        } else if (res.data.status === 'approved') {
            setNotice({ tone: 'ok', text: `${row.nous_did} passed the pre-screen and the Polis charter rules approved it.` });
        } else if (pass) {
            setNotice({ tone: 'bad', text: `${row.nous_did} passed the pre-screen, but the Polis charter rules rejected it (${(res.data.reason_code ?? '').replace(/_/g, ' ')}).` });
        } else {
            setNotice({ tone: 'ok', text: `${row.nous_did} was rejected at the pre-screen.` });
        }
        await refresh();
    }

    return (
        <div style={{ padding: '36px 40px', maxWidth: 860 }}>
            <div style={{ marginBottom: 8 }}><span style={eyebrow}>Portal Manager · Reviewer panel</span></div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.15, margin: '0 0 6px' }}>
                Nous registrations
            </h1>
            <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)', margin: '0 0 28px', maxWidth: '64ch', lineHeight: 1.55 }}>
                You decide the Portal pre-screen. A pass forwards the filing to the Genesis Polis, whose charter
                rules then approve or reject it. <Link href="/system/portal-manager" style={{ color: 'var(--bronze)' }}>Back to Portal Manager</Link>
            </p>

            {notice && (
                <p role={notice.tone === 'bad' ? 'alert' : 'status'} style={{
                    fontFamily: sans, fontSize: 13, margin: '0 0 20px', padding: '10px 14px', borderRadius: 6,
                    color: 'var(--ink)', border: '1px solid var(--rule)',
                    background: notice.tone === 'bad' ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
                }}>{notice.text}</p>
            )}

            {load.state === 'loading' && <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)' }}>Reading the queue…</p>}
            {load.state === 'refused' && <p role="alert" style={{ fontFamily: sans, fontSize: 14, color: 'var(--terracotta)' }}>{refusalText(load.code)}</p>}
            {load.state === 'ready' && load.rows.length === 0 && (
                <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)' }}>No Nous registration has been filed on this Grid.</p>
            )}
            {load.state === 'ready' && load.rows.length > 0 && (
                <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
                    {load.rows.map((row, i) => (
                        <div key={row.request_id} data-testid={`review-${row.request_id}`} style={{
                            padding: '14px 20px', borderBottom: i < load.rows.length - 1 ? '1px solid var(--rule)' : 'none',
                            display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{row.nous_did}</span>
                                <span style={{ ...eyebrow, marginLeft: 'auto' }}>
                                    {STATUS_LABEL[row.status]}
                                    {row.status === 'rejected' && row.reason_code ? ` · ${row.reason_code.replace(/_/g, ' ')}` : ''}
                                </span>
                            </div>
                            <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>
                                Type {row.type} · filed tick {row.filed_tick.toLocaleString('en-US')} · owner {row.registrant_did_hash.slice(0, 12)}…
                                {' · '}{row.registrant_is_operator ? 'owner is a Grid operator' : 'owner is not a Grid operator'}
                                {row.founding_nous ? ' · founding Nous' : ''}
                            </div>
                            {row.status === 'requested' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                                    <button type="button" disabled={busy !== null} onClick={() => decide(row, true)}
                                        style={{ ...button, border: 'none', background: 'var(--terracotta-2)', color: '#fff' }}>
                                        Pass pre-screen
                                    </button>
                                    <button type="button" disabled={busy !== null} onClick={() => decide(row, false)}
                                        style={{ ...button, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}>
                                        Reject
                                    </button>
                                    <select aria-label="Rejection reason" value={reasons[row.request_id] ?? 'other'}
                                        onChange={(e) => setReasons((r) => ({ ...r, [row.request_id]: e.target.value }))}
                                        style={{ fontFamily: sans, fontSize: 12, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, padding: '6px 8px' }}>
                                        {REJECT_REASONS.map(([code, text]) => <option key={code} value={code}>{text}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
