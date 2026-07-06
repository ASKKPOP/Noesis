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
    DidIssuanceResponse,
    DidIssuanceRow,
    AuditChainResponse,
} from '../../../lib/api/portal-manager';

export interface PortalManagerViewProps {
    data: RegistrationsResponse | null;
    /** Set when the fetch failed (e.g. the operator gate rejected the request). */
    error?: PortalManagerErrorKind;
    loading?: boolean;
    /** DID-issuance tracker slice. */
    didIssuance?: DidIssuanceResponse | null;
    didError?: PortalManagerErrorKind;
    /** Audit-chain viewer slice. */
    audit?: AuditChainResponse | null;
    auditError?: PortalManagerErrorKind;
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

/** Truncate a long PUBLIC value (civic_did) in the middle; full value in title. */
function truncMid(v: string): string {
    return v.length > 30 ? `${v.slice(0, 20)}…${v.slice(-8)}` : v;
}

/** Shared error copy — identical wording to the registrations section states. */
function errorCopy(kind: PortalManagerErrorKind, subject: string): string {
    switch (kind) {
        case 'unauthorized':
            return `Operator authorization required. This is a Tier-3 Henry-side surface — supply operator credentials to view ${subject}.`;
        case 'console_disabled':
            return `This console is disabled in this environment (GRID_PORTAL_MANAGER_ENABLED is off). Enable the Portal Manager console flag to view ${subject}.`;
        case 'db_unavailable':
            return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} is currently unavailable.`;
        default:
            return `Could not load ${subject}. Check the Grid connection and retry.`;
    }
}

function ErrorNote({ kind, subject }: { kind: PortalManagerErrorKind; subject: string }) {
    return (
        <div style={{
            background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.20)',
            borderRadius: 6, padding: '16px 20px', fontFamily: sans, fontSize: 13,
            color: 'var(--ink)',
        }}>
            {errorCopy(kind, subject)}
        </div>
    );
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

export default function PortalManagerView({
    data, error, loading, didIssuance, didError, audit, auditError,
}: PortalManagerViewProps) {
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
                        : error === 'console_disabled'
                        ? 'This console is disabled in this environment (GRID_PORTAL_MANAGER_ENABLED is off). Enable the Portal Manager console flag to view the registration log.'
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

            {/* ── DID Issuance ─────────────────────────────────────────────── */}
            <div style={{ marginTop: 40 }}>
                <Eyebrow>DID Issuance</Eyebrow>
                {loading ? (
                    <div style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)' }}>
                        Loading DID issuance…
                    </div>
                ) : didError ? (
                    <ErrorNote kind={didError} subject="the DID issuance log" />
                ) : didIssuance ? (
                    <>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                            <SummaryCard label="Active" value={didIssuance.counts.active} />
                            <SummaryCard label="Revoked" value={didIssuance.counts.revoked} />
                            <SummaryCard label="Total" value={didIssuance.counts.total} />
                            <SummaryCard label="Nous Active" value={didIssuance.counts.nous_active} />
                        </div>
                        <div style={{
                            background: 'var(--parchment)', border: '1px solid var(--rule)',
                            borderRadius: 6, overflow: 'hidden',
                        }}>
                            {didIssuance.issued.length === 0 ? (
                                <div style={{
                                    padding: 20, textAlign: 'center', fontFamily: sans, fontSize: 13,
                                    color: 'var(--muted)',
                                }}>
                                    No Civic-DIDs issued on record.
                                </div>
                            ) : (
                                didIssuance.issued.map((row, i) => (
                                    <DidRowItem key={row.civic_did} row={row} last={i === didIssuance.issued.length - 1} />
                                ))
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            {/* ── Audit Chain ──────────────────────────────────────────────── */}
            <div style={{ marginTop: 40 }}>
                <Eyebrow>Audit Chain</Eyebrow>
                {loading ? (
                    <div style={{ fontFamily: sans, fontSize: 13, color: 'var(--muted)' }}>
                        Loading audit chain…
                    </div>
                ) : auditError ? (
                    <ErrorNote kind={auditError} subject="the audit chain" />
                ) : audit ? (
                    <>
                        <IntegrityStrip integrity={audit.integrity} />
                        <div style={{
                            background: 'var(--parchment)', border: '1px solid var(--rule)',
                            borderRadius: 6, overflow: 'hidden', marginTop: 16,
                        }}>
                            {audit.recent.length === 0 ? (
                                <div style={{
                                    padding: 20, textAlign: 'center', fontFamily: sans, fontSize: 13,
                                    color: 'var(--muted)',
                                }}>
                                    No recent civic audit events.
                                </div>
                            ) : (
                                audit.recent.map((ev, i) => (
                                    <AuditRowItem key={`${ev.event_type}-${ev.tick}-${i}`} event={ev} last={i === audit.recent.length - 1} />
                                ))
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function IntegrityStrip({ integrity }: { integrity: AuditChainResponse['integrity'] }) {
    const cell = (label: string, value: number | null) => (
        <div style={{
            flex: 1, background: 'var(--parchment)', border: '1px solid var(--rule)',
            borderRadius: 6, padding: '12px 16px',
        }}>
            <div style={{
                fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4,
            }}>
                {label}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>
                {value === null ? '—' : value}
            </div>
        </div>
    );
    const healthyColor = integrity.healthy ? '#4ade80' : '#f87171';
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            {cell('In-Memory', integrity.in_memory_length)}
            {cell('Persisted Max', integrity.persisted_max_id)}
            {cell('Divergence', integrity.divergence)}
            {cell('Threshold', integrity.divergence_threshold)}
            <div style={{
                flex: 1, background: 'var(--parchment)', border: '1px solid var(--rule)',
                borderRadius: 6, padding: '12px 16px', display: 'flex', flexDirection: 'column',
                justifyContent: 'center',
            }}>
                <div style={{
                    fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6,
                }}>
                    Integrity
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        width: 9, height: 9, borderRadius: '50%', background: healthyColor, flexShrink: 0,
                    }} />
                    <span style={{
                        fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                        textTransform: 'uppercase', color: healthyColor,
                    }}>
                        {integrity.healthy ? 'Healthy' : 'Diverged'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function DidRowItem({ row, last }: { row: DidIssuanceRow; last: boolean }) {
    const dotColor = row.status === 'active' ? '#4ade80' : '#f87171';
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
            borderBottom: last ? 'none' : '1px solid var(--rule)',
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--ink)', flex: 1 }} title={row.civic_did}>
                {truncMid(row.civic_did)}
            </span>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>
                tick {row.issued_at_tick}
            </span>
            <span style={{
                fontFamily: mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: dotColor,
            }}>
                {row.status}
            </span>
        </div>
    );
}

function AuditRowItem({ event, last }: { event: { event_type: string; tick: number }; last: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
            borderBottom: last ? 'none' : '1px solid var(--rule)',
        }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--ink)', flex: 1 }}>
                {event.event_type}
            </span>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>
                tick {event.tick}
            </span>
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
