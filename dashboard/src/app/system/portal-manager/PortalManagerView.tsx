'use client';

/**
 * Portal Manager v1 — Tier-3 (Henry-side meta-ops) READ-ONLY console view.
 *
 * Renders the reviewer queue (pending / approved / rejected with per-status
 * counts) and a registration & Civic-DID activity summary, from data already
 * fetched by the page. OBSERVE-ONLY: there is NO approve/reject affordance
 * (D-V3-36 management != governance; VOTE-05 grants the operator no governance
 * power). Editorial styling mirrors src/app/portal/status/page.tsx.
 *
 * Pure/prop-driven for testability — the page owns the fetch + operator gate.
 */

import type {
    RegistrationsResponse,
    RegistrationRow,
    RegistrationStatus,
    PortalManagerErrorKind,
} from '../../../lib/api/portal-manager';

export interface PortalManagerViewProps {
    data: RegistrationsResponse | null;
    /** Set when the fetch failed (e.g. the operator gate rejected the request). */
    error?: PortalManagerErrorKind;
    loading?: boolean;
}

const STATUS_ORDER: RegistrationStatus[] = ['pending', 'approved', 'rejected'];

const STATUS_LABEL: Record<RegistrationStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
};

const STATUS_COLOR: Record<RegistrationStatus, string> = {
    pending: '#fbbf24',
    approved: '#4ade80',
    rejected: '#f87171',
};

const mono = 'var(--mono-portal)';
const sans = 'var(--sans-portal)';

function shortHash(h: string): string {
    return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10,
        }}>
            {children}
        </div>
    );
}

export default function PortalManagerView({ data, error, loading }: PortalManagerViewProps) {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 760 }}>
            <Eyebrow>System · Tier-3</Eyebrow>
            <h1 style={{
                fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 600,
                color: 'var(--ink)', letterSpacing: '0.01em', lineHeight: 1.15, marginBottom: 6,
            }}>
                Portal Manager
            </h1>
            <p style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
                Read-only monitoring of civic registration activity for the Genesis Grid.
                This console observes the registration log; it grants no approval power.
            </p>

            {loading && (
                <div style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)' }}>
                    Loading registration activity…
                </div>
            )}

            {!loading && error && (
                <div style={{
                    background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.20)',
                    borderRadius: 6, padding: '16px 20px', fontFamily: sans, fontSize: 13,
                    color: 'var(--ink)',
                }}>
                    {error === 'unauthorized'
                        ? 'Operator authorization required. This is a Tier-3 Henry-side surface — supply operator credentials to view the registration log.'
                        : error === 'db_unavailable'
                        ? 'Registration store is currently unavailable.'
                        : 'Could not load registration activity. Check the Grid connection and retry.'}
                </div>
            )}

            {!loading && !error && data && (
                <>
                    {/* Activity summary */}
                    <Eyebrow>Activity Summary</Eyebrow>
                    <div style={{
                        display: 'flex', gap: 12, marginBottom: 32,
                    }}>
                        <SummaryCard label="Registrations" value={data.activity.registrations_total} />
                        <SummaryCard label="Civic-DIDs Issued" value={data.activity.civic_dids_issued} />
                    </div>

                    {/* Per-status counts */}
                    <Eyebrow>Reviewer Queue</Eyebrow>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        {STATUS_ORDER.map((s) => (
                            <div key={s} style={{
                                flex: 1, background: 'var(--parchment)', border: '1px solid var(--rule)',
                                borderRadius: 6, padding: '12px 16px',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                                }}>
                                    <span style={{
                                        width: 7, height: 7, borderRadius: '50%',
                                        background: STATUS_COLOR[s], flexShrink: 0,
                                    }} />
                                    <span style={{
                                        fontFamily: mono, fontSize: 9, fontWeight: 600,
                                        letterSpacing: '0.10em', textTransform: 'uppercase',
                                        color: 'var(--muted)',
                                    }}>
                                        {STATUS_LABEL[s]}
                                    </span>
                                </div>
                                <div style={{
                                    fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600,
                                    color: 'var(--ink)',
                                }}>
                                    {data.counts[s]}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Queue table */}
                    <div style={{
                        background: 'var(--parchment)', border: '1px solid var(--rule)',
                        borderRadius: 6, overflow: 'hidden',
                    }}>
                        {data.applications.length === 0 ? (
                            <div style={{
                                padding: 20, textAlign: 'center', fontFamily: sans, fontSize: 13,
                                color: 'var(--muted)',
                            }}>
                                No registration applications on record.
                            </div>
                        ) : (
                            data.applications.map((row, i) => (
                                <QueueRowItem key={row.application_id} row={row} last={i === data.applications.length - 1} />
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div style={{
            flex: 1, background: 'var(--parchment)', border: '1px solid var(--rule)',
            borderRadius: 6, padding: '16px 20px',
        }}>
            <div style={{
                fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6,
            }}>
                {label}
            </div>
            <div style={{
                fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink)',
            }}>
                {value}
            </div>
        </div>
    );
}

function QueueRowItem({ row, last }: { row: RegistrationRow; last: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
            borderBottom: last ? 'none' : '1px solid var(--rule)',
        }}>
            <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: STATUS_COLOR[row.status], flexShrink: 0,
            }} />
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--ink)', flex: 1 }}
                  title={row.human_did_hash}>
                {shortHash(row.human_did_hash)}
            </span>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>
                tick {row.requested_at_tick}
            </span>
            {row.reason_code && (
                <span style={{
                    fontFamily: mono, fontSize: 9, color: 'var(--muted)',
                    background: 'rgba(11,18,32,0.04)', borderRadius: 2, padding: '2px 6px',
                }}>
                    {row.reason_code}
                </span>
            )}
            <span style={{
                fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: STATUS_COLOR[row.status],
            }}>
                {STATUS_LABEL[row.status]}
            </span>
        </div>
    );
}
