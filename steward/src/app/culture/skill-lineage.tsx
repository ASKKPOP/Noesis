'use client';

interface LineageNode {
    id: string;
    label: string;
    type: 'nous' | 'skill';
    x: number;
    y: number;
}

interface LineageEdge {
    source: string;
    target: string;
    tick: number;
    type: 'taught' | 'inferred';
}

interface Props {
    nodes: LineageNode[];
    edges: LineageEdge[];
    filter: string | null;
}

const NOUS_COLOR    = '#3a7a5a';
const SKILL_COLOR   = '#7a6a2e';
const TAUGHT_STROKE = '#3a7a5a';
const INF_STROKE    = '#7a6a2e';

function truncateLabel(label: string): string {
    if (label.length <= 16) return label;
    return label.slice(0, 16) + '…';
}

export function SkillLineage({ nodes, edges, filter }: Props) {
    if (nodes.length === 0) {
        return (
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                            Culture
                        </div>
                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                            Skill Lineage
                        </h2>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                        0 nodes
                    </span>
                </div>
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    No skill lineage recorded yet.
                </div>
            </div>
        );
    }

    const nodeMap = new Map<string, LineageNode>(nodes.map(n => [n.id, n]));

    // Filter logic: highlight filter node and its incident edges; dim others
    const incidentEdgeIndices = filter
        ? new Set(edges.reduce<number[]>((acc, edge, i) => {
              if (edge.source === filter || edge.target === filter) acc.push(i);
              return acc;
          }, []))
        : null;

    const isNodeFiltered = (n: LineageNode): boolean => {
        if (!filter) return true;
        if (n.id === filter) return true;
        // Also highlight direct neighbors
        return edges.some(e => (e.source === filter && e.target === n.id) || (e.target === filter && e.source === n.id));
    };

    const isEdgeFiltered = (i: number): boolean => {
        if (!filter || incidentEdgeIndices === null) return true;
        return incidentEdgeIndices.has(i);
    };

    const maxX = Math.max(...nodes.map(n => n.x), 400) + 40;
    const maxY = Math.max(...nodes.map(n => n.y), 300) + 40;

    const filteredNodeExists = filter ? nodes.some(n => n.id === filter) : true;

    return (
        <div className="steward-card">
            {/* Card header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                        Culture
                    </div>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Skill Lineage
                    </h2>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                    {nodes.length} nodes
                </span>
            </div>

            {/* SVG body */}
            <div style={{ padding: '20px 0 0 0', overflowX: 'auto', minHeight: 320, maxHeight: 480 }}>
                <svg
                    role="img"
                    aria-label={`Skill lineage visualization. ${nodes.length} nodes.`}
                    viewBox={`0 0 ${maxX} ${maxY}`}
                    width="100%"
                    style={{ background: 'var(--parchment)', display: 'block' }}
                >
                    {/* Edges first — render under nodes */}
                    {edges.map((edge, i) => {
                        const src = nodeMap.get(edge.source);
                        const tgt = nodeMap.get(edge.target);
                        if (!src || !tgt) return null;
                        const filtered = isEdgeFiltered(i);
                        return (
                            <line
                                key={`edge-${i}`}
                                x1={src.x}
                                y1={src.y}
                                x2={tgt.x}
                                y2={tgt.y}
                                stroke={edge.type === 'taught' ? TAUGHT_STROKE : INF_STROKE}
                                strokeWidth="1.5"
                                strokeDasharray={edge.type === 'inferred' ? '4 3' : undefined}
                                opacity={filtered ? 0.9 : 0.25}
                            />
                        );
                    })}

                    {/* Nous nodes: circles */}
                    {nodes.filter(n => n.type === 'nous').map(n => {
                        const filtered = isNodeFiltered(n);
                        const isSelected = filter && n.id === filter;
                        return (
                            <circle
                                key={`nous-${n.id}`}
                                cx={n.x}
                                cy={n.y}
                                r={8}
                                fill={NOUS_COLOR}
                                stroke={isSelected ? 'var(--terracotta)' : 'var(--ink)'}
                                strokeWidth={isSelected ? 2 : 1}
                                opacity={filtered ? 1.0 : 0.3}
                            />
                        );
                    })}

                    {/* Skill nodes: rects */}
                    {nodes.filter(n => n.type === 'skill').map(n => {
                        const filtered = isNodeFiltered(n);
                        return (
                            <rect
                                key={`skill-${n.id}`}
                                x={n.x - 6}
                                y={n.y - 6}
                                width={12}
                                height={12}
                                fill={SKILL_COLOR}
                                stroke="var(--ink)"
                                strokeWidth={1}
                                opacity={filtered ? 1.0 : 0.3}
                            />
                        );
                    })}

                    {/* Node labels */}
                    {nodes.map(n => (
                        <text
                            key={`label-${n.id}`}
                            x={n.x + 12}
                            y={n.y + 4}
                            fontSize={10}
                            fontFamily="var(--mono)"
                            fill="var(--ink)"
                            opacity={isNodeFiltered(n) ? 1.0 : 0.3}
                        >
                            {truncateLabel(n.label)}
                        </text>
                    ))}
                </svg>

                {/* Filter empty state */}
                {filter && !filteredNodeExists && (
                    <div style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                        Selected Nous has no skills in lineage.
                    </div>
                )}
            </div>

            {/* Footer legend */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--rule)', marginTop: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} style={{ display: 'block' }}>
                        <circle cx={6} cy={6} r={5} fill={NOUS_COLOR} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Nous</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} style={{ display: 'block' }}>
                        <rect x={1} y={1} width={10} height={10} fill={SKILL_COLOR} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Skill</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={24} height={12} style={{ display: 'block' }}>
                        <line x1={0} y1={6} x2={24} y2={6} stroke={TAUGHT_STROKE} strokeWidth={1.5} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Taught</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={24} height={12} style={{ display: 'block' }}>
                        <line x1={0} y1={6} x2={24} y2={6} stroke={INF_STROKE} strokeWidth={1.5} strokeDasharray="4 3" />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Inferred</span>
                </div>
            </div>
        </div>
    );
}
