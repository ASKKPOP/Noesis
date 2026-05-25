'use client';

/**
 * Phase 34 D-34-A3: two-row CSS-div bar sparkline rendering frame counter deltas.
 * Top row = frames_sent deltas (neutral palette).
 * Bottom row = frames_dropped deltas (warning palette, terracotta color per D-34-A3).
 *
 * Cadence: 12 buckets × 5s = 1-minute window (REQ OBS-12).
 * Primitive: CSS div bars — deliberate exception to the v2.4 raw-SVG invariant
 * because a single-signal bar shape does not need SVG paths (CONTEXT.md D-34-A1).
 *
 * Width-fixed bars; height encodes delta (max within the visible ring scales to 100%).
 * Empty buckets (no data yet during cold-start) render as 0-height placeholders so
 * the row remains visible.
 */

interface FrameCounterSparklineProps {
    readonly sentDeltas: readonly number[];     // up to 12 entries, newest = last
    readonly droppedDeltas: readonly number[];  // up to 12 entries, newest = last
}

const BAR_WIDTH = 16; // px
const BAR_GAP = 2;    // px
const BAR_ROW_HEIGHT = 18; // px
const RING_CAPACITY = 12;

function scaleBar(value: number, maxInRing: number): number {
    if (maxInRing <= 0) return 0;
    // Minimum 1px so empty buckets next to non-empty stay visible.
    return Math.max(value === 0 ? 0 : 1, Math.round((value / maxInRing) * BAR_ROW_HEIGHT));
}

function padRing(deltas: readonly number[]): number[] {
    const padding = Math.max(0, RING_CAPACITY - deltas.length);
    return [...Array(padding).fill(0), ...deltas];
}

export function FrameCounterSparkline({ sentDeltas, droppedDeltas }: FrameCounterSparklineProps) {
    const sent = padRing(sentDeltas);
    const dropped = padRing(droppedDeltas);
    const sentMax = Math.max(1, ...sent);
    const droppedMax = Math.max(1, ...dropped);

    const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: BAR_GAP, height: BAR_ROW_HEIGHT };
    const labelStyle: React.CSSProperties = {
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Sent row (neutral, --ink at 40% opacity for restful but visible) */}
            <div>
                <div style={labelStyle}>Frames sent (per 5s)</div>
                <div style={rowStyle} role="img" aria-label={`Frames sent per 5s, last ${sent.length} buckets`}>
                    {sent.map((v, i) => (
                        <div
                            key={`sent-${i}`}
                            style={{
                                width: BAR_WIDTH,
                                height: scaleBar(v, sentMax),
                                background: 'var(--ink)',
                                opacity: 0.4,
                            }}
                            title={`${v} frame${v === 1 ? '' : 's'} (bucket ${i - sent.length + 1})`}
                        />
                    ))}
                </div>
            </div>

            {/* Dropped row (warning palette per D-34-A3) */}
            <div>
                <div style={labelStyle}>Frames dropped (per 5s)</div>
                <div style={rowStyle} role="img" aria-label={`Frames dropped per 5s, last ${dropped.length} buckets`}>
                    {dropped.map((v, i) => (
                        <div
                            key={`dropped-${i}`}
                            style={{
                                width: BAR_WIDTH,
                                height: scaleBar(v, droppedMax),
                                background: 'var(--terracotta)',
                            }}
                            title={`${v} drop${v === 1 ? '' : 's'} (bucket ${i - dropped.length + 1})`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
