'use client';
/**
 * RelationshipGraph — client-only SVG rendering of the full grid relationship
 * topology. Consumes server-computed {x, y} positions from the graph endpoint
 * (D-9-08, D-9-09) — NO client-side layout computation, NO force simulation,
 * NO animation.
 *
 * Graph dependencies strictly prohibited (D-9-08): no force-directed layout
 * libs permitted. The render is O(nodes + edges) using React reconciliation only.
 *
 * Warmth colors (D-9-06, 09-RESEARCH.md §Graph Layout — load-bearing hex values):
 *   cold: #9ca3af  warm: #f59e0b  hot: #e11d48
 *
 * Performance (REL-04 p95 <100ms budget):
 *   Server provides {x, y} per node so the client does no layout work.
 *   For 10K edges, React reconciles keyed <line> elements; if the Wave 4
 *   perf bench exceeds budget, edges collapse to a single <path> per
 *   09-05-PLAN.md §Task 3 fallback note.
 */

import { useGraph } from '@/lib/hooks/use-relationships';

// ---------------------------------------------------------------------------
// Warmth color map — D-9-06 locked hex values (grep gate: #9ca3af #f59e0b #e11d48)
// ---------------------------------------------------------------------------
const WARMTH_COLOR: Record<'cold' | 'warm' | 'hot', string> = {
    cold: '#9ca3af',
    warm: '#f59e0b',
    hot:  '#e11d48',
} as const;

// ---------------------------------------------------------------------------
// SVG layout constants (D-9-08 — raw SVG units, NOT Tailwind spacing)
// ---------------------------------------------------------------------------
const VIEWPORT = { width: 1000, height: 1000 } as const;
const NODE_RADIUS = 6;
const EDGE_STROKE_WIDTH = 1.5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RelationshipGraph(): React.ReactElement | null {
    const { data, error, isLoading } = useGraph();

    if (isLoading) {
        return <div role="status">Loading graph…</div>;
    }

    if (error) {
        return <div role="alert">Graph could not be loaded.</div>;
    }

    if (!data) return null;

    // Build a lookup: did → {x, y} for edge endpoint resolution.
    const nodePos = new Map(data.nodes.map((n) => [n.did, n]));

    return (
        <svg
            viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
            className="w-full h-auto max-w-[800px] mx-auto"
            role="img"
            aria-label={`Relationship graph showing warm and hot partnerships between Nous`}
            data-testid="relationship-graph-svg"
        >
            {/* Edges rendered first (below nodes) */}
            <g className="edges">
                {data.edges.map((e, i) => {
                    const a = nodePos.get(e.source_did);
                    const b = nodePos.get(e.target_did);
                    // Defensive: skip edges whose endpoints are missing (D-9-09)
                    if (!a || !b) return null;
                    return (
                        <line
                            key={i}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke={WARMTH_COLOR[e.warmth_bucket]}
                            strokeWidth={EDGE_STROKE_WIDTH}
                            strokeOpacity={0.7}
                        />
                    );
                })}
            </g>
            {/* Nodes rendered second (above edges) */}
            <g className="nodes">
                {data.nodes.map((n) => (
                    <circle
                        key={n.did}
                        cx={n.x}
                        cy={n.y}
                        r={NODE_RADIUS}
                        fill="#333"
                        stroke="#0A0A0A"
                        strokeWidth={1}
                    />
                ))}
            </g>
        </svg>
    );
}
