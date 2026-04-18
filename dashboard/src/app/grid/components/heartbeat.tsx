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
    live: 'bg-green-400',
    stale: 'bg-red-400 animate-pulse',
    unknown: 'bg-neutral-600',
};

export function Heartbeat(): React.ReactElement {
    const hb = useHeartbeat();

    if (hb.status === 'unknown' || hb.lastTick === null) {
        return (
            <section
                aria-label="Heartbeat"
                data-testid="heartbeat-status"
                data-status="unknown"
                className="border border-neutral-800 rounded-md bg-[#17181C] p-4 space-y-2"
            >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT.unknown}`} aria-hidden="true" />
                    Heartbeat
                </div>
                <div className="text-sm text-neutral-500">No data yet</div>
                <div className="text-xs text-neutral-600">
                    Waiting for first tick event from Grid.
                </div>
            </section>
        );
    }

    const secondsText =
        hb.secondsSinceLastEvent === null
            ? '—'
            : String(hb.secondsSinceLastEvent);
    const staleLineClass =
        hb.status === 'stale'
            ? 'font-mono text-xs text-red-400 animate-pulse'
            : 'font-mono text-xs text-neutral-400';

    return (
        <section
            aria-label="Heartbeat"
            data-testid="heartbeat-status"
            data-status={hb.status}
            className="border border-neutral-800 rounded-md bg-[#17181C] p-4 space-y-2"
        >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
                <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[hb.status]}`}
                    aria-hidden="true"
                />
                Heartbeat
            </div>
            <div
                className="font-mono text-[22px] font-semibold text-neutral-100 [font-variant-numeric:tabular-nums]"
                data-testid="heartbeat-tick"
            >
                Tick <span className="text-sky-300">{hb.lastTick}</span>
            </div>
            <div className={staleLineClass} data-testid="heartbeat-elapsed">
                last event {secondsText}s ago
                {hb.status === 'stale' && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide">
                        (no events for 2× tick rate)
                    </span>
                )}
            </div>
        </section>
    );
}
