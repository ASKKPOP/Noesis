'use client';

interface NormRecord {
    norm_id: string;
    fingerprint: string;
    crystallized_tick: number;
    participating_count: number;
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
}

interface Props {
    norms: NormRecord[];
}

const NORM_COLORS: Record<string, string> = {
    emergent: '#5a5a6a',
    coincidental: '#8a8479',
};

function normColor(convergenceType: string): string {
    return NORM_COLORS[convergenceType] ?? '#8a8479';
}

function scaleX(tick: number, minTick: number, maxTick: number): number {
    if (maxTick === minTick) return 80;
    return 80 + ((tick - minTick) / (maxTick - minTick)) * (720 - 80);
}

export function NormTimeline({ norms }: Props) {
    if (norms.length === 0) {
        return (
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                            Culture
                        </div>
                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                            Norm Timeline
                        </h2>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                        0 norms
                    </span>
                </div>
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    No crystallized norms yet.
                </div>
            </div>
        );
    }

    // Sort norms by crystallized_tick ascending (most recent at bottom)
    const sortedNorms = [...norms].sort((a, b) => a.crystallized_tick - b.crystallized_tick);

    // Use a reduce loop instead of Math.min/max(...spread) to avoid stack overflow
    // on large norm arrays (V8 caps function arguments at ~65 535).
    let minTick = Infinity;
    let maxTick = -Infinity;
    for (const n of sortedNorms) {
        if (n.evidence_tick_range[0] < minTick) minTick = n.evidence_tick_range[0];
        if (n.evidence_tick_range[1] < minTick) minTick = n.evidence_tick_range[1];
        if (n.crystallized_tick < minTick) minTick = n.crystallized_tick;
        if (n.evidence_tick_range[0] > maxTick) maxTick = n.evidence_tick_range[0];
        if (n.evidence_tick_range[1] > maxTick) maxTick = n.evidence_tick_range[1];
        if (n.crystallized_tick > maxTick) maxTick = n.crystallized_tick;
    }

    // Compute tick marks every 100 ticks on the x-axis
    const firstMark = Math.ceil(minTick / 100) * 100;
    const tickMarks: number[] = [];
    for (let t = firstMark; t <= maxTick; t += 100) {
        tickMarks.push(t);
    }

    const svgHeight = sortedNorms.length * 32 + 60;

    return (
        <div className="steward-card">
            {/* Card header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                        Culture
                    </div>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Norm Timeline
                    </h2>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        Norms are Grid-wide; per-Nous filter does not apply.
                    </div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                    {norms.length} norms
                </span>
            </div>

            {/* SVG body */}
            <div style={{ padding: '20px 0 0 0', overflowX: 'auto', minHeight: 320, maxHeight: 480 }}>
                <svg
                    role="img"
                    aria-label={`Norm timeline visualization. ${norms.length} norms.`}
                    viewBox={`0 0 800 ${svgHeight}`}
                    width="100%"
                    style={{ background: 'var(--parchment)', display: 'block' }}
                >
                    {/* X-axis line */}
                    <line x1={80} y1={20} x2={800} y2={20} stroke="var(--rule)" strokeWidth={1} />

                    {/* Tick marks */}
                    {tickMarks.map(t => (
                        <text
                            key={`tick-${t}`}
                            x={scaleX(t, minTick, maxTick)}
                            y={14}
                            fontSize={9}
                            fontFamily="var(--mono)"
                            fill="var(--muted)"
                            textAnchor="middle"
                        >
                            {t}
                        </text>
                    ))}

                    {/* Norm rows */}
                    {sortedNorms.map((norm, i) => {
                        const color = normColor(norm.convergence_type);
                        const cx = scaleX(norm.crystallized_tick, minTick, maxTick);
                        const rangeStart = scaleX(norm.evidence_tick_range[0], minTick, maxTick);
                        const rangeEnd = scaleX(norm.evidence_tick_range[1], minTick, maxTick);
                        const rangeWidth = Math.max(rangeEnd - rangeStart, 4);

                        return (
                            <g key={norm.norm_id} transform={`translate(0, ${i * 32 + 40})`}>
                                {/* Fingerprint label */}
                                <text
                                    x={72}
                                    y={14}
                                    fontSize={10}
                                    fontFamily="var(--mono)"
                                    fill="var(--ink)"
                                    textAnchor="end"
                                >
                                    {norm.fingerprint}
                                </text>

                                {/* Evidence range rect (lighter) */}
                                <rect
                                    x={rangeStart}
                                    y={4}
                                    width={rangeWidth}
                                    height={16}
                                    rx={3}
                                    fill={color}
                                    opacity={0.25}
                                />

                                {/* Crystallization circle */}
                                <circle
                                    cx={cx}
                                    cy={14}
                                    r={5}
                                    fill={color}
                                    stroke="var(--ink)"
                                    strokeWidth={1}
                                />

                                {/* Participant count label */}
                                <text
                                    x={cx + 12}
                                    y={18}
                                    fontSize={9}
                                    fontFamily="var(--mono)"
                                    fill="var(--muted)"
                                >
                                    N={norm.participating_count}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Footer legend */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--rule)', marginTop: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} style={{ display: 'block' }}>
                        <circle cx={6} cy={6} r={5} fill={NORM_COLORS.emergent} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Emergent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} style={{ display: 'block' }}>
                        <circle cx={6} cy={6} r={5} fill={NORM_COLORS.coincidental} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Coincidental</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={24} height={12} style={{ display: 'block' }}>
                        <rect x={0} y={3} width={24} height={6} rx={2} fill={NORM_COLORS.emergent} opacity={0.25} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Evidence range</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} style={{ display: 'block' }}>
                        <circle cx={6} cy={6} r={5} fill={NORM_COLORS.emergent} stroke="var(--ink)" strokeWidth={1} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Crystallization</span>
                </div>
            </div>
        </div>
    );
}
