'use client';
/**
 * RegionMap — the SVG topology panel for /grid (Plan 03-06 Task 1).
 *
 * Responsibilities:
 *   1. Render one <g data-testid="region-node"> per Region (Plan-03 mirror of
 *      grid/src/space/types.ts). Each region is a <circle> + <text> name label.
 *   2. Render one <line data-edge> per RegionConnection where both endpoints
 *      exist in the regions set. Unknown-id connections are silently skipped.
 *   3. Render one <g data-testid="nous-marker" data-nous-did=...> per Nous
 *      currently tracked by PresenceStore. Markers translate to their region
 *      center via inline `style.transform` so CSS `transition: transform 150ms
 *      ease-out` animates the move when nous.moved arrives (MAP-03 / SC-5).
 *
 * Layout policy (resolves 03-RESEARCH Open Question Q1b):
 *   The authoritative Region shape has NO x/y — coordinates are derived
 *   client-side from a deterministic FNV-1a 32-bit hash of region.id. This
 *   keeps the Grid's spatial model free of presentation concerns while letting
 *   Playwright assert exact pixel positions by importing `computeRegionLayout`.
 *
 * Accessibility:
 *   - role="img" + aria-label="Region map" exposes the panel as a named image
 *     to screen readers.
 *   - An sr-only <text> "No regions loaded" is rendered when the regions
 *     array is empty (SC-4 empty-state copywriting contract).
 *
 * Security (threat register T-03-20):
 *   Region and Nous names are rendered as TEXT NODES — never dangerouslySet or
 *   parsed as HTML. Untrusted payload from the Grid cannot execute script.
 */

import { memo, useMemo } from 'react';
import type { Region, RegionConnection } from '@/lib/protocol/region-types';
import { useSelection } from '@/lib/hooks/use-selection';
import { usePresence } from '../hooks';
import {
    VIEWPORT_W,
    VIEWPORT_H,
    REGION_R,
    MARKER_R,
    computeRegionLayout,
} from './region-layout';

// Re-export computeRegionLayout so existing imports from './region-map'
// (unit tests, other components) keep working without change.
export { computeRegionLayout };

export interface RegionMapProps {
    readonly regions: readonly Region[];
    readonly connections: readonly RegionConnection[];
    /** Phase 13 (REPLAY-05): when true, reads from replay store instead of live store. */
    readonly replayMode?: boolean;
}

export const RegionMap = memo(function RegionMap({
    regions,
    connections,
    replayMode: _replayMode = false,
}: RegionMapProps) {
    const presence = usePresence();
    const { select } = useSelection();

    const layout = useMemo(() => computeRegionLayout(regions), [regions]);

    const project = (regionId: string): { cx: number; cy: number } | null => {
        const pos = layout.get(regionId);
        if (!pos) return null;
        return { cx: pos.x * VIEWPORT_W, cy: pos.y * VIEWPORT_H };
    };

    // Edges rendered under regions. Drop edges referencing unknown ids.
    const edges = useMemo(() => {
        return connections
            .map((c) => {
                const a = project(c.fromRegion);
                const b = project(c.toRegion);
                if (!a || !b) return null;
                return {
                    key: `${c.fromRegion}→${c.toRegion}`,
                    x1: a.cx,
                    y1: a.cy,
                    x2: b.cx,
                    y2: b.cy,
                };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connections, layout]);

    return (
        <svg
            viewBox={`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`}
            role="img"
            aria-label="Region map"
            className="w-full h-full bg-neutral-900 border border-neutral-800 rounded-md"
        >
            {regions.length === 0 && (
                <text
                    x={VIEWPORT_W / 2}
                    y={VIEWPORT_H / 2}
                    textAnchor="middle"
                    className="sr-only"
                >
                    No regions loaded
                </text>
            )}

            {/* Edges first — under region circles. */}
            <g data-layer="edges">
                {edges.map((e) => (
                    <line
                        key={e.key}
                        data-edge={e.key}
                        x1={e.x1}
                        y1={e.y1}
                        x2={e.x2}
                        y2={e.y2}
                        stroke="#404040"
                        strokeWidth={1}
                    />
                ))}
            </g>

            {/* Region nodes — circle + name text. */}
            <g data-layer="regions">
                {regions.map((r) => {
                    const pos = project(r.id);
                    if (!pos) return null;
                    return (
                        <g
                            key={r.id}
                            data-testid="region-node"
                            data-region-id={r.id}
                        >
                            <circle
                                cx={pos.cx}
                                cy={pos.cy}
                                r={REGION_R}
                                fill="#171717"
                                stroke="#525252"
                                strokeWidth={1.5}
                            />
                            <text
                                x={pos.cx}
                                y={pos.cy + REGION_R + 14}
                                textAnchor="middle"
                                fill="#a3a3a3"
                                fontSize={11}
                                fontFamily="Inter, system-ui, sans-serif"
                            >
                                {r.name}
                            </text>
                        </g>
                    );
                })}
            </g>

            {/* Nous markers — keyed by DID so React preserves the same DOM
                 node on region changes; CSS transition animates the move. */}
            <g data-layer="markers">
                {Array.from(presence.allNous.entries()).map(([did, info]) => {
                    const pos = project(info.regionId);
                    if (!pos) return null;
                    return (
                        <g
                            key={did}
                            data-testid="nous-marker"
                            data-nous-did={did}
                            role="button"
                            tabIndex={0}
                            aria-label={`Inspect ${info.name}`}
                            onClick={() => select(did)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    select(did);
                                }
                            }}
                            style={{
                                transform: `translate(${pos.cx}px, ${pos.cy}px)`,
                                transition: 'transform 150ms ease-out',
                                cursor: 'pointer',
                            }}
                        >
                            <circle r={MARKER_R} fill="#10b981" />
                            <title>{info.name}</title>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
});
