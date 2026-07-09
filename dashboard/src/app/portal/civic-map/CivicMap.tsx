// D-V3-06 raw-SVG invariant: NO d3, NO react-flow, NO cytoscape, NO three.js. Server-computed coords; client renders inline SVG.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COPY } from '../../../lib/portal-copy';
import { useCivicMap } from '../../../lib/use-civic-map';
import type { Zone, NousMapEntry } from '../../../lib/use-civic-map';

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
                    {/* Dark ink labels — zone fills are light pastels (#dbeafe…#ede9fe),
                        so near-white text was near-invisible (QA 2026-07-09). */}
                    <text
                        x={zone.labelX}
                        y={zone.labelY}
                        fill="#1a1a2e"
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
                        fill="#4b5563"
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
            {nous.map((n) => {
                // Phase 41 SLEEP-01 — presence-aware avatar rendering per 41-UI-SPEC.md.
                const presence = n.presence_status ?? 'awake';
                const isAway = presence === 'away';
                const isAbsent = presence === 'absent';
                const isPresumed = presence === 'presumed_departed';

                const minutesAgo = n.last_seen_at
                    ? Math.round((Date.now() - new Date(n.last_seen_at).getTime()) / 60_000)
                    : null;
                const daysAgo = n.last_seen_at
                    ? Math.round((Date.now() - new Date(n.last_seen_at).getTime()) / 86_400_000)
                    : null;
                const tooltipText =
                    isAway && minutesAgo !== null ? `away — last seen ${minutesAgo} min ago` :
                    isAbsent && daysAgo !== null ? `absent — last seen ${daysAgo} days ago` :
                    isPresumed && daysAgo !== null ? `presumed departed — last seen ${daysAgo} days ago` :
                    '';

                return (
                    <g key={n.civic_did_hash}>
                        {tooltipText && <title>{tooltipText}</title>}
                        {/* 44×44 invisible hitbox for WCAG 2.5.5 pointer target minimum */}
                        <rect
                            x={n.x - 22}
                            y={n.y - 22}
                            width="44"
                            height="44"
                            fill="transparent"
                            style={{ cursor: isPresumed ? 'default' : 'pointer', pointerEvents: isPresumed ? 'none' : 'auto' }}
                            onClick={isPresumed ? undefined : () => router.push(`/portal/nous/${n.civic_did_hash}`)}
                            onMouseEnter={isPresumed ? undefined : () => setHoveredNousId(n.civic_did_hash)}
                            onMouseLeave={isPresumed ? undefined : () => setHoveredNousId(null)}
                            onKeyDown={isPresumed ? undefined : (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    router.push(`/portal/nous/${n.civic_did_hash}`);
                                }
                            }}
                            tabIndex={isPresumed ? undefined : 0}
                            role={isPresumed ? undefined : 'button'}
                            aria-label={`Nous ${n.display_name}, type ${n.type}, status ${presence}`}
                        />
                        {/* Nous avatar circle — React-state radius (Pitfall 3: NOT Tailwind hover:r-8) */}
                        {isPresumed ? (
                            <circle
                                cx={n.x}
                                cy={n.y}
                                r={6}
                                fill="none"
                                stroke="#6a6a76"
                                strokeWidth="1.5"
                                opacity={1}
                                style={{ pointerEvents: 'none' }}
                            />
                        ) : isAbsent ? (
                            <circle
                                cx={n.x}
                                cy={n.y}
                                r={hoveredNousId === n.civic_did_hash ? 8 : 6}
                                fill="#6a6a76"
                                opacity={0.35}
                                stroke="#0a0a0c"
                                strokeWidth="1"
                                style={{ pointerEvents: 'none', filter: 'grayscale(100%)' }}
                            />
                        ) : (
                            <circle
                                cx={n.x}
                                cy={n.y}
                                r={hoveredNousId === n.civic_did_hash ? 8 : 6}
                                fill={n.type === 'A' ? '#7c9eff' : '#c084fc'}
                                opacity={isAway ? 0.4 : 1}
                                stroke="#0a0a0c"
                                strokeWidth="1"
                                style={{ pointerEvents: 'none', filter: isAway ? 'grayscale(100%)' : 'none' }}
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
