'use client';

/**
 * Project Status — Noēsis Genesis Grid.
 * Client component · editorial theme.
 *
 * Every value on this page is read live from the Grid's public endpoints and
 * re-polled every ~15s — nothing is hardcoded:
 *   - GET /health/detailed     → overall health, clock, audit persistence
 *   - GET /api/v1/grid/status  → Grid name, uptime, counts
 *   - GET /api/v1/system/map   → the four surfaces + eight civic institutions
 *   - GET /api/v1/grid/nous    → Nous roster, tallied by lifecycle phase
 * A read the Grid does not answer is shown as unanswered, never filled in.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { fetchRoster } from '@/lib/api/economy';
import {
    countByLifecyclePhase,
    fetchGridHealth,
    fetchGridStatus,
    type GridHealth,
    type GridStatus,
} from '@/lib/api/grid-health';
import { fetchSystemMap, type SystemMap } from '@/lib/api/system-map';

const POLL_MS = 15_000;

/** null = the Grid did not answer that read on the latest poll. */
interface Snapshot {
    health: GridHealth | null;
    status: GridStatus | null;
    map: SystemMap | null;
    phases: { phase: string; count: number }[] | null;
}

type Tone = 'good' | 'warn' | 'bad' | 'idle';

const toneColor: Record<Tone, string> = {
    good: '#4ade80',
    warn: '#fbbf24',
    bad:  '#f87171',
    idle: 'rgba(11,18,32,0.25)',
};

const toneRgb: Record<Tone, string> = {
    good: '74,222,128',
    warn: '251,191,36',
    bad:  '248,113,113',
    idle: '11,18,32',
};

// Surface ('up'…) and institution ('active'…) statuses, as the Grid reports them.
const statusTone: Record<string, Tone> = {
    up: 'good', active: 'good',
    degraded: 'warn', unknown: 'warn',
    down: 'bad',
    empty: 'idle',
};

const statusLabel: Record<string, string> = {
    up: 'Up', active: 'Active', degraded: 'Degraded',
    unknown: 'Unknown', down: 'Down', empty: 'Empty',
};

const eyebrow: CSSProperties = {
    fontFamily: 'var(--mono-portal)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
};

const card: CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 6,
    overflow: 'hidden',
};

const UNANSWERED = 'The Grid did not answer this read.';

function formatUptime(ms: number): string {
    const m = Math.floor(ms / 60_000);
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
}

const orUnreported = (v: number | null): string => (v === null ? 'not reported' : String(v));

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div style={{ marginBottom: 36 }}>
            <div style={{ ...eyebrow, marginBottom: 10 }}>{title}</div>
            <div style={card}>{children}</div>
        </div>
    );
}

function Note({ children }: { children: ReactNode }) {
    return (
        <div style={{
            padding: '20px',
            textAlign: 'center',
            fontFamily: 'var(--sans-portal)',
            fontSize: 13,
            color: 'var(--muted)',
        }}>
            {children}
        </div>
    );
}

function Row({ name, detail, tone, label, last }: {
    name: string; detail?: string; tone?: Tone; label?: string; last: boolean;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '11px 20px',
            borderBottom: last ? 'none' : '1px solid var(--rule)',
            opacity: tone === 'idle' ? 0.6 : 1,
        }}>
            {tone && (
                <span style={{
                    width: 7, height: 7,
                    borderRadius: '50%',
                    background: toneColor[tone],
                    flexShrink: 0,
                    marginRight: 12,
                    boxShadow: tone === 'good' ? '0 0 6px rgba(74,222,128,0.5)' : 'none',
                }} />
            )}
            <span style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                color: 'var(--ink)',
                flex: 1,
            }}>
                {name}
            </span>
            {detail && (
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 10,
                    color: 'var(--muted)',
                    marginRight: label ? 16 : 0,
                    textAlign: 'right',
                }}>
                    {detail}
                </span>
            )}
            {label && (
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: tone && tone !== 'idle' ? toneColor[tone] : 'var(--muted)',
                    width: 64,
                    textAlign: 'right',
                }}>
                    {label}
                </span>
            )}
        </div>
    );
}

function banner(snap: Snapshot | null): { tone: Tone; text: string } {
    if (!snap) return { tone: 'idle', text: 'Asking the Grid…' };
    if (snap.health) {
        if (snap.health.status === 'ok') return { tone: 'good', text: 'The Grid reports healthy' };
        if (snap.health.status === 'degraded') return { tone: 'warn', text: 'The Grid reports degraded' };
        return { tone: 'bad', text: 'The Grid reports critical' };
    }
    if (snap.status || snap.map || snap.phases) {
        return { tone: 'warn', text: 'The Grid is answering, but not its health check' };
    }
    return { tone: 'bad', text: 'The Grid is not answering' };
}

function serviceRows(map: SystemMap): { name: string; status: string; detail: string }[] {
    const s = map.surfaces;
    const i = map.institutions;
    return [
        { name: 'Grid',            ...s.grid },
        { name: 'Portal',          ...s.portal },
        { name: 'Steward Console', ...s.steward },
        // brain_tokens registrations — not a live Brain connection.
        { name: 'Local AI (Brain) tokens', ...s.brain },
        { name: 'DID Registry',    ...i.registry },
        { name: 'Polis',           ...i.polis },
        { name: 'Police',          ...i.police },
        { name: 'IRS / Treasury',  ...i.irs },
        { name: 'Marketplace',     ...i.marketplace },
        { name: 'Library',         ...i.library },
        { name: 'Communities',     ...i.communities },
        { name: 'P2P',             ...i.p2p },
    ].map(({ name, status, headline }) => ({ name, status, detail: headline }));
}

function vitalRows(health: GridHealth | null, status: GridStatus | null): { name: string; detail: string }[] {
    const rows: { name: string; detail: string }[] = [];
    if (health) {
        const a = health.audit;
        rows.push(
            { name: 'World clock', detail: `tick ${health.clock.tick} · ${health.clock.running ? 'running' : 'stopped'}` },
            { name: 'Audit chain entries (in memory)', detail: orUnreported(a.in_memory_length) },
            { name: 'Audit chain entries (persisted)', detail: orUnreported(a.persisted_max_id) },
            { name: 'Audit persistence lag', detail: `${orUnreported(a.divergence)} · threshold ${a.divergence_threshold}` },
            { name: 'Last audit persist error', detail: a.last_persist_error ? a.last_persist_error.code : 'none' },
            { name: 'Live feed subscribers', detail: String(health.firehose.client_count) },
        );
    }
    if (status) {
        rows.push(
            { name: 'Uptime', detail: formatUptime(status.uptime) },
            { name: 'Nous', detail: String(status.nousCount) },
            { name: 'Regions', detail: String(status.regionCount) },
            { name: 'Active laws', detail: String(status.activeLaws) },
        );
    }
    return rows;
}

export default function StatusPage() {
    const [snap, setSnap] = useState<Snapshot | null>(null);

    useEffect(() => {
        let cancelled = false;
        let controller: AbortController | undefined;

        const poll = async () => {
            controller = new AbortController();
            const { signal } = controller;
            // A rejected read (AbortError, or anything unexpected) is just "no answer".
            const settle = <T,>(p: Promise<{ ok: true; data: T } | { ok: false }>): Promise<T | null> =>
                p.then((r) => (r.ok ? r.data : null), () => null);

            const [health, status, map, roster] = await Promise.all([
                settle(fetchGridHealth(signal)),
                settle(fetchGridStatus(signal)),
                settle(fetchSystemMap(signal)),
                settle(fetchRoster(process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '', signal)),
            ]);
            if (cancelled) return;
            setSnap({
                health,
                status,
                map,
                phases: roster ? countByLifecyclePhase(roster.nous) : null,
            });
        };

        void poll();
        const id = setInterval(() => void poll(), POLL_MS);

        return () => {
            cancelled = true;
            controller?.abort();
            clearInterval(id);
        };
    }, []);

    const { tone, text } = banner(snap);
    const gridName = snap?.status?.name ?? snap?.map?.grid_name;
    const tick = snap?.health?.clock.tick ?? snap?.status?.tick ?? snap?.map?.tick;
    const services = snap?.map ? serviceRows(snap.map) : null;
    const vitals = snap ? vitalRows(snap.health, snap.status) : [];
    const loading = snap === null;

    return (
        <div style={{ padding: '36px 40px', maxWidth: 680 }}>
            {/* Header */}
            <div style={{ marginBottom: 8 }}>
                <span style={eyebrow}>System</span>
            </div>
            <h1 style={{
                fontFamily: 'var(--serif)',
                fontSize: 32,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '0.01em',
                lineHeight: 1.15,
                marginBottom: 6,
            }}>
                Project Status
            </h1>
            <p style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                color: 'var(--muted)',
                marginBottom: 32,
            }}>
                What the Grid reports about itself right now — read live, refreshed every {POLL_MS / 1000} seconds.
            </p>

            {/* Overall status banner */}
            <div
                data-testid="status-banner"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: `rgba(${toneRgb[tone]},0.06)`,
                    border: `1px solid rgba(${toneRgb[tone]},0.20)`,
                    borderRadius: 6,
                    padding: '14px 20px',
                    marginBottom: 32,
                }}
            >
                <span style={{
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: toneColor[tone],
                    boxShadow: tone === 'idle' ? 'none' : `0 0 8px ${toneColor[tone]}`,
                    flexShrink: 0,
                }} />
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink)',
                }}>
                    {text}
                </span>
                {(gridName || tick !== undefined) && (
                    <span style={{
                        marginLeft: 'auto',
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        color: 'var(--muted)',
                    }}>
                        {[gridName, tick !== undefined ? `tick ${tick}` : null].filter(Boolean).join(' · ')}
                    </span>
                )}
            </div>

            {/* Health conditions — the Grid's own reasons for a non-ok status */}
            <Section title="Current Conditions">
                {loading ? <Note>Asking the Grid…</Note>
                    : !snap.health ? <Note>{UNANSWERED}</Note>
                    : snap.health.reasons.length === 0 ? <Note>The Grid reports no active health conditions.</Note>
                    : snap.health.reasons.map((r, i, all) => (
                        <Row key={r} name={r} tone={tone} last={i === all.length - 1} />
                    ))}
            </Section>

            {/* Surfaces + institutions */}
            <Section title="Surfaces & Institutions">
                {loading ? <Note>Asking the Grid…</Note>
                    : !services ? <Note>{UNANSWERED}</Note>
                    : services.map((svc, i) => (
                        <Row
                            key={svc.name}
                            name={svc.name}
                            detail={svc.detail}
                            tone={statusTone[svc.status] ?? 'warn'}
                            label={statusLabel[svc.status] ?? svc.status}
                            last={i === services.length - 1}
                        />
                    ))}
            </Section>

            {/* Grid vitals */}
            <Section title="Grid Vitals">
                {loading ? <Note>Asking the Grid…</Note>
                    : vitals.length === 0 ? <Note>{UNANSWERED}</Note>
                    : vitals.map((v, i) => (
                        <Row key={v.name} name={v.name} detail={v.detail} last={i === vitals.length - 1} />
                    ))}
            </Section>

            {/* Nous by lifecycle phase */}
            <Section title="Nous by Lifecycle Phase">
                {loading ? <Note>Asking the Grid…</Note>
                    : !snap.phases ? <Note>{UNANSWERED}</Note>
                    : snap.phases.length === 0 ? <Note>No Nous are registered on this Grid.</Note>
                    : snap.phases.map((p, i, all) => (
                        <Row key={p.phase} name={p.phase} detail={String(p.count)} last={i === all.length - 1} />
                    ))}
            </Section>

            {/* Footer */}
            <div style={{
                marginTop: 32,
                borderTop: '1px solid var(--rule)',
                paddingTop: 20,
                fontFamily: 'var(--sans-portal)',
                fontSize: 12,
                color: 'var(--muted)',
            }}>
                Updates announced in the Genesis Grid Agora ·{' '}
                <a href="mailto:status@eklotho.com" style={{ color: 'var(--bronze)', textDecoration: 'none' }}>
                    status@eklotho.com
                </a>
            </div>
        </div>
    );
}
