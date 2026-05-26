// D-V3-06 raw-SVG invariant: NO d3, NO react-flow, NO cytoscape, NO three.js. Server-computed coords; client renders inline SVG.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COPY } from '../../../lib/portal-copy.js';
import { useCivicMap } from '../../../lib/use-civic-map.js';
import type { Zone, NousMapEntry } from '../../../lib/use-civic-map.js';

interface CivicMapProps {
    /** Pre-fetched zones data (optional — for testing or SSR-passed data). */
    zones?: Zone[];
    /** Pre-fetched nous data (optional — for testing or SSR-passed data). */
    nous?: NousMapEntry[];
}

/**
 * CivicMap — raw-SVG 6-zone Civic Map with per-Nous avatars.
 *
 * D-V3-06: raw-SVG invariant — no graphing libs.
 * D-36-13: 5-second polling via useCivicMap() hook (plain setState/useEffect/AbortController).
 * Pitfall 3: avatar hover radius uses React state (NOT Tailwind hover:r-* classes — Tailwind 4
 * does not generate dynamic SVG r utilities natively).
 *
 * When `zones` and `nous` are passed as props (e.g. from tests), they override hook data.
 */
export default function CivicMap({ zones: propZones, nous: propNous }: CivicMapProps) {
    const { data, error, isLoading } = useCivicMap();
    const [hoveredNousId, setHoveredNousId] = useState<string | null>(null);
    const router = useRouter();

    // Use prop data if provided (test or SSR context), otherwise use polling hook data.
    const zones = propZones ?? data?.zones ?? [];
    const nous = propNous ?? data?.nous ?? [];

    // Error state (only shown when no prop data is available)
    if (!propZones && error) {
        return (
            <p className="text-sm font-mono text-[#9a9aa6]">{COPY.CIVIC_MAP_LOADING}</p>
        );
    }

    // Loading state (only shown when no prop data is available)
    if (!propZones && isLoading && !data) {
        return (
            <div className="text-sm text-[#9a9aa6]">Loading Civic Map…</div>
        );
    }

    return (
        <svg
            viewBox="0 0 800 600"
            role="img"
            aria-label="Civic Map of Genesis Grid — 6 zones with active Nous avatars"
            className="w-full max-w-[800px]"
        >
            {/* Zone polygons — rendered first, behind avatars */}
            {zones.map((zone) => (
                <g key={zone.id}>
                    <polygon
                        points={zone.polygon}
                        fill={zone.fillColor}
                        stroke={zone.strokeColor}
                        strokeWidth="1"
                        className="cursor-pointer"
                        style={{ transition: 'stroke 0.1s' }}
                        onClick={() => router.push(`/portal/civic-map/zone/${zone.id}`)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                router.push(`/portal/civic-map/zone/${zone.id}`);
                            }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Navigate to ${zone.label} zone`}
                    />
                    <text
                        x={zone.labelX}
                        y={zone.labelY}
                        fill="#e8e8ec"
                        fontSize="14"
                        fontFamily="Inter Tight, sans-serif"
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {zone.label}
                    </text>
                    <text
                        x={zone.labelX}
                        y={zone.labelY + 18}
                        fill="#6a6a76"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {zone.taxRate}%
                    </text>
                </g>
            ))}

            {/* Nous avatars — rendered above zones */}
            {nous.map((n) => (
                <g key={n.civic_did_hash}>
                    {/* 44×44 invisible hitbox for WCAG 2.5.5 pointer target minimum */}
                    <rect
                        x={n.x - 22}
                        y={n.y - 22}
                        width="44"
                        height="44"
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={() => router.push(`/portal/nous/${n.civic_did_hash}`)}
                        onMouseEnter={() => setHoveredNousId(n.civic_did_hash)}
                        onMouseLeave={() => setHoveredNousId(null)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                router.push(`/portal/nous/${n.civic_did_hash}`);
                            }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Nous ${n.display_name}, type ${n.type}, status ${n.status}`}
                    />
                    {/* Nous avatar circle — React-state radius (Pitfall 3: NOT Tailwind hover:r-8) */}
                    <circle
                        cx={n.x}
                        cy={n.y}
                        r={hoveredNousId === n.civic_did_hash ? 8 : 6}
                        fill={n.type === 'A' ? '#7c9eff' : '#c084fc'}
                        opacity={n.status === 'online' ? 1 : 0.4}
                        stroke="#0a0a0c"
                        strokeWidth="1"
                        style={{ pointerEvents: 'none' }}
                    />
                </g>
            ))}
        </svg>
    );
}
