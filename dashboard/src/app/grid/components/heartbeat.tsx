'use client';
/**
 * Heartbeat — the tick + freshness widget.
 *
 * Subscribes to HeartbeatStore via useHeartbeat(). The hook polls Date.now()
 * once per second so the "last event N seconds ago" display keeps climbing
 * even between ingest frames.
 *
 * States (per 03-UI-SPEC §Heartbeat + §Copywriting):
 *   - unknown  → store has seen no ticks yet. Show "No data yet".
 *   - live     → elapsed ≤ 2 × tickRateMs. Green indicator. Mono tick count.
 *   - stale    → elapsed > 2 × tickRateMs. Red indicator, pulse animation,
 *                additional "(no events for 2× tick rate)" hint.
 *
 * Accessibility:
 *   - <section aria-label="Heartbeat"> lets assistive tech find the widget.
 *   - data-testid="heartbeat-status" + data-status attribute is the E2E
 *     selector convention (per Plan 02 / Plan 06 contracts).
 *   - The animated pulse respects prefers-reduced-motion globally (Tailwind
 *     emits a `@media (prefers-reduced-motion: reduce)` rule for animate-*).
 */

import { useHeartbeat } from '../hooks';

const STATUS_DOT: Record<'live' | 'stale' | 'unknown', string> = {
    live: 'bg-green-500',
    stale: 'bg-red-500 animate-pulse',
    unknown: 'bg-neutral-400',
};

export function Heartbeat(): React.ReactElement {
    const hb = useHeartbeat();

    const cardStyle: React.CSSProperties = {
        border: '1px solid var(--rule)',
        borderRadius: 6,
        background: 'var(--parchment)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    };

    const labelStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 10,
        fontFamily: 'var(--mono-portal)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
    };

    if (hb.status === 'unknown' || hb.lastTick === null) {
        return (
            <section
                aria-label="Heartbeat"
                data-testid="heartbeat-status"
                data-status="unknown"
                style={cardStyle}
            >
                <div style={labelStyle}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT.unknown}`} aria-hidden="true" />
                    Heartbeat
                </div>
                <div style={{ fontSize: 13, fontFamily: 'var(--sans-portal)', color: 'var(--muted)' }}>
                    No data yet
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--sans-portal)', color: 'var(--muted)', opacity: 0.7 }}>
                    Waiting for first tick event from Grid.
                </div>
            </section>
        );
    }

    const secondsText =
        hb.secondsSinceLastEvent === null
            ? '—'
            : String(hb.secondsSinceLastEvent);

    return (
        <section
            aria-label="Heartbeat"
            data-testid="heartbeat-status"
            data-status={hb.status}
            style={cardStyle}
        >
            <div style={labelStyle}>
                <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[hb.status]}`}
                    aria-hidden="true"
                />
                Heartbeat
            </div>
            <div
                data-testid="heartbeat-tick"
                style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                Tick <span style={{ color: 'var(--terracotta)' }}>{hb.lastTick}</span>
            </div>
            <div
                data-testid="heartbeat-elapsed"
                style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 11,
                    color: hb.status === 'stale' ? '#dc2626' : 'var(--muted)',
                }}
                className={hb.status === 'stale' ? 'animate-pulse' : ''}
            >
                last event {secondsText}s ago
                {hb.status === 'stale' && (
                    <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        (no events for 2× tick rate)
                    </span>
                )}
            </div>
        </section>
    );
}
