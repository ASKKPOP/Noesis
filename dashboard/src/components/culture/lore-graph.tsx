'use client';
import React from 'react';
import { useLoreGraph } from '@/lib/hooks/use-culture';
import { EmptyState } from '@/components/primitives/empty-state';

const X_NOUS = 150;
const X_LORE = 850;
const NODE_RADIUS = 6;
const EDGE_STROKE_WIDTH = 1.5;
const NODE_NOUS_FILL = '#F59E0B';
const NODE_LORE_FILL = '#A78BFA';
const EDGE_STROKE = '#9CA3AF';
const MIN_HEIGHT = 200;
const PADDING_Y = 40;

function lastDIDSegment(did: string): string {
    return did.split(':').pop() ?? did;
}

function distributeY(index: number, count: number, height: number): number {
    if (count <= 1) return height / 2;
    return PADDING_Y + (index / (count - 1)) * (height - PADDING_Y * 2);
}

export function LoreGraph(): React.ReactElement | null {
    const { data, error, isLoading } = useLoreGraph();

    if (isLoading) {
        return <div role="status" className="text-xs text-neutral-400">Loading lore graph…</div>;
    }
    if (error) {
        return <div role="alert" className="text-xs text-rose-400">Lore graph could not be loaded.</div>;
    }
    if (!data) return null;

    const { loreEntries, loreCitations } = data;

    if (loreEntries.length === 0 && loreCitations.length === 0) {
        return (
            <EmptyState
                title="No lore yet."
                description="Lore entries appear here once Nous begin publishing observations and citing each other's work."
                testId="lore-graph-empty"
            />
        );
    }

    // Build unique Nous node IDs from contributor_dids, then add any citing_dids not already present
    const nousIds: string[] = [];
    for (const e of loreEntries) {
        if (!nousIds.includes(e.contributor_did)) nousIds.push(e.contributor_did);
    }
    for (const c of loreCitations) {
        if (!nousIds.includes(c.citing_did)) nousIds.push(c.citing_did);
    }

    // Build unique lore entry node IDs from content_hashes
    const loreIds: string[] = [];
    for (const e of loreEntries) {
        if (!loreIds.includes(e.content_hash)) loreIds.push(e.content_hash);
    }

    const dynamicHeight = Math.max(Math.max(nousIds.length, loreIds.length) * 60 + 60, MIN_HEIGHT);

    // Position maps
    const nousPositions = new Map(
        nousIds.map((id, i) => [id, { x: X_NOUS, y: distributeY(i, nousIds.length, dynamicHeight) }])
    );
    const lorePositions = new Map(
        loreIds.map((id, i) => [id, { x: X_LORE, y: distributeY(i, loreIds.length, dynamicHeight) }])
    );

    // citation_count lookup by content_hash
    const citationCountByHash = new Map(loreEntries.map(e => [e.content_hash, e.citation_count]));

    return (
        <>
            <svg
                viewBox={`0 0 1000 ${dynamicHeight}`}
                className="w-full h-auto max-w-[800px] mx-auto"
                role="img"
                aria-label="Bipartite lore graph showing Nous contributions and citations"
                data-testid="lore-graph-svg"
            >
                <text x={X_NOUS} y={20} fontSize="10" fill="#6B7280" textAnchor="middle">Nous</text>
                <text x={X_LORE} y={20} fontSize="10" fill="#6B7280" textAnchor="middle">Lore</text>

                {/* lore.contributed edges — solid */}
                <g className="contributed-edges">
                    {loreEntries.map((e, i) => {
                        const a = nousPositions.get(e.contributor_did);
                        const b = lorePositions.get(e.content_hash);
                        if (!a || !b) return null;
                        return (
                            <line key={`c-${i}`}
                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                stroke={EDGE_STROKE} strokeWidth={EDGE_STROKE_WIDTH}
                            >
                                <title>contributed at tick {e.tick}</title>
                            </line>
                        );
                    })}
                </g>

                {/* lore.cited edges — dashed */}
                <g className="cited-edges">
                    {loreCitations.map((c, i) => {
                        const a = nousPositions.get(c.citing_did);
                        const b = lorePositions.get(c.content_hash);
                        if (!a || !b) return null;
                        const cCount = citationCountByHash.get(c.content_hash) ?? 0;
                        return (
                            <line key={`l-${i}`}
                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                stroke={EDGE_STROKE} strokeWidth={EDGE_STROKE_WIDTH}
                                strokeDasharray="4 2"
                            >
                                <title>cited at tick {c.tick} — {cCount} total citations</title>
                            </line>
                        );
                    })}
                </g>

                {/* Nous nodes */}
                <g className="nous-nodes">
                    {nousIds.map(id => {
                        const pos = nousPositions.get(id)!;
                        return (
                            <g key={id}>
                                <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={NODE_NOUS_FILL} />
                                <title>{id}</title>
                                <text x={pos.x + 10} y={pos.y + 4} fontSize="10" fill="#A3A3A3" aria-hidden="true">
                                    {lastDIDSegment(id)}
                                </text>
                            </g>
                        );
                    })}
                </g>

                {/* Lore entry nodes */}
                <g className="lore-nodes">
                    {loreIds.map(hash => {
                        const pos = lorePositions.get(hash)!;
                        return (
                            <g key={hash}>
                                <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={NODE_LORE_FILL} />
                                <title>{hash}</title>
                                <text x={pos.x - 10} y={pos.y + 4} fontSize="10" fill="#A3A3A3"
                                      textAnchor="end" aria-hidden="true">
                                    {hash.slice(0, 6)}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            <ul className="mt-2 flex flex-col gap-1">
                <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <svg width="24" height="4" aria-hidden="true">
                        <line x1="0" y1="2" x2="24" y2="2" stroke="#9CA3AF" strokeWidth="1.5" />
                    </svg>
                    contributed
                </li>
                <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <svg width="24" height="4" aria-hidden="true">
                        <line x1="0" y1="2" x2="24" y2="2" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 2" />
                    </svg>
                    cited
                </li>
                <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#F59E0B]" aria-hidden="true" />
                    Nous
                </li>
                <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#A78BFA]" aria-hidden="true" />
                    Lore
                </li>
            </ul>
        </>
    );
}
