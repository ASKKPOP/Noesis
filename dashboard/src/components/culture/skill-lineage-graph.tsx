'use client';
/**
 * SkillLineageGraph — SVG directed graph of skill diffusion between Nous.
 *
 * D-9-08 pattern (clone of RelationshipGraph):
 *   - Server-computed {x, y} positions (zero client-side layout math)
 *   - Raw <svg> <circle> <line> <title> only — no external graph layout libraries
 *   - <title> on every node (<g>) and edge (<line>) for native browser hover
 *
 * Node types:
 *   nous  → fill: '#F59E0B' (amber — Nous identity, Phase 9 warm-amber)
 *   skill → fill: '#4ADE80' (green — skill propagation)
 *
 * Edge types:
 *   taught   → solid line (strokeDasharray undefined)
 *   inferred → dashed line (strokeDasharray="4 2")
 */

import React from 'react';
import { useSkillLineage } from '@/lib/hooks/use-culture';
import { EmptyState } from '@/components/primitives/empty-state';

// ---------------------------------------------------------------------------
// SVG layout constants (D-9-08 — raw SVG units, NOT Tailwind spacing)
// ---------------------------------------------------------------------------
const VIEWPORT = { width: 1000, height: 1000 } as const;
const NODE_RADIUS = 6;
const EDGE_STROKE_WIDTH = 1.5;
const NODE_NOUS_FILL = '#F59E0B';
const NODE_SKILL_FILL = '#4ADE80';
const EDGE_STROKE = '#9CA3AF';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillLineageGraph(): React.ReactElement | null {
    const { data, error, isLoading } = useSkillLineage();

    if (isLoading) {
        return (
            <div role="status" className="text-xs text-neutral-400">
                Loading skill lineage…
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="text-xs text-rose-400">
                Skill lineage could not be loaded.
            </div>
        );
    }

    if (!data) return null;

    if (data.nodes.length === 0) {
        return (
            <EmptyState
                title="No skill events yet."
                description="Skills appear here once Nous begin teaching and inferring from peers."
                testId="skill-lineage-empty"
            />
        );
    }

    // Build a lookup: id → node for edge endpoint resolution.
    const nodePos = new Map(data.nodes.map((n) => [n.id, n]));

    return (
        <>
            <svg
                viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
                className="w-full h-auto max-w-[800px] mx-auto"
                role="img"
                aria-label="Skill lineage tree showing how skills propagate between Nous"
                data-testid="skill-lineage-svg"
            >
                {/* Edges rendered first (below nodes) */}
                <g className="edges">
                    {data.edges.map((e, i) => {
                        const a = nodePos.get(e.source);
                        const b = nodePos.get(e.target);
                        // Defensive: skip edges whose endpoints are missing (D-9-09)
                        if (!a || !b) return null;
                        return (
                            <line
                                key={i}
                                x1={a.x}
                                y1={a.y}
                                x2={b.x}
                                y2={b.y}
                                stroke={EDGE_STROKE}
                                strokeWidth={EDGE_STROKE_WIDTH}
                                strokeDasharray={e.type === 'inferred' ? '4 2' : undefined}
                            >
                                <title>tick {e.tick}</title>
                            </line>
                        );
                    })}
                </g>
                {/* Nodes rendered second (above edges) */}
                <g className="nodes">
                    {data.nodes.map((n) => (
                        <g key={n.id}>
                            <circle
                                cx={n.x}
                                cy={n.y}
                                r={NODE_RADIUS}
                                fill={n.type === 'nous' ? NODE_NOUS_FILL : NODE_SKILL_FILL}
                            />
                            <title>{n.id}</title>
                            <text
                                x={n.x + 8}
                                y={n.y + 4}
                                fontSize="10"
                                fill="#A3A3A3"
                                aria-hidden="true"
                            >
                                {n.label}
                            </text>
                        </g>
                    ))}
                </g>
            </svg>

            {/* Legend */}
            <div className="mt-4 flex flex-col gap-1" data-testid="skill-lineage-legend">
                <h3 className="text-xs font-semibold text-neutral-100">Edge types</h3>
                <ul className="mt-1 flex flex-col gap-1">
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <svg width="24" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="24" y2="2" stroke="#9CA3AF" strokeWidth="1.5" />
                        </svg>
                        taught — direct peer-to-peer transmission
                    </li>
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <svg width="24" height="4" aria-hidden="true">
                            <line
                                x1="0"
                                y1="2"
                                x2="24"
                                y2="2"
                                stroke="#9CA3AF"
                                strokeWidth="1.5"
                                strokeDasharray="4 2"
                            />
                        </svg>
                        inferred — derived from observed behavior
                    </li>
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <span
                            aria-hidden="true"
                            className="inline-block h-2 w-2 rounded-full bg-[#F59E0B]"
                        />
                        Nous
                    </li>
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <span
                            aria-hidden="true"
                            className="inline-block h-2 w-2 rounded-full bg-[#4ADE80]"
                        />
                        Skill hash
                    </li>
                </ul>
            </div>
        </>
    );
}
