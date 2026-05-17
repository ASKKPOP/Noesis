'use client';
import React from 'react';
import { useNorms } from '@/lib/hooks/use-culture';
import { EmptyState } from '@/components/primitives/empty-state';

const VIEWPORT_WIDTH = 1000;
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 20;
const LABEL_X = 10;
const TIMELINE_START_X = 200;
const TIMELINE_END_X = 950;
const NORM_EMERGENT_FILL = '#7DD3FC';
const NORM_COINCIDENTAL_FILL = '#9CA3AF';

export function NormTimeline(): React.ReactElement | null {
    const { data, error, isLoading } = useNorms();

    if (isLoading) {
        return <div role="status" className="text-xs text-neutral-400">Loading norm timeline…</div>;
    }
    if (error) {
        return <div role="alert" className="text-xs text-rose-400">Norm timeline could not be loaded.</div>;
    }
    if (!data) return null;

    const { norms } = data;

    if (norms.length === 0) {
        return (
            <EmptyState
                title="No norms yet."
                description="Norms appear here once Nous independently converge on matching behavioral rules."
                testId="norm-timeline-empty"
            />
        );
    }

    const durations = norms.map(n => n.evidence_tick_range[1] - n.evidence_tick_range[0]);
    const maxDuration = Math.max(...durations, 1);
    const dynamicHeight = Math.max(norms.length * ROW_HEIGHT + 60, 200);

    return (
        <>
            <svg
                viewBox={`0 0 ${VIEWPORT_WIDTH} ${dynamicHeight}`}
                className="w-full h-auto"
                role="img"
                aria-label="Norm adoption timeline showing candidate and crystallized norm events"
                data-testid="norm-timeline-svg"
            >
                <text x={TIMELINE_START_X} y={20} fontSize="9" fill="#6B7280" textAnchor="middle">0</text>
                <text x={TIMELINE_END_X} y={20} fontSize="9" fill="#6B7280" textAnchor="end">
                    +{maxDuration} ticks
                </text>

                {norms.map((norm, i) => {
                    const duration = norm.evidence_tick_range[1] - norm.evidence_tick_range[0];
                    const barWidth = (TIMELINE_END_X - TIMELINE_START_X) * (duration / maxDuration);
                    const rowY = i * ROW_HEIGHT + 30;
                    const fill = norm.convergence_type === 'emergent' ? NORM_EMERGENT_FILL : NORM_COINCIDENTAL_FILL;

                    return (
                        <g key={norm.norm_id}>
                            <text
                                x={LABEL_X} y={rowY + BAR_HEIGHT / 2}
                                fontSize="10" fill="#A3A3A3"
                                fontFamily="monospace" dominantBaseline="middle"
                            >
                                {norm.fingerprint}
                            </text>
                            <text
                                x={LABEL_X} y={rowY + BAR_HEIGHT / 2 + 12}
                                fontSize="9" fill="#6B7280"
                                dominantBaseline="middle"
                            >
                                {norm.participant_count} Nous · {norm.convergence_type}
                            </text>
                            <rect
                                x={TIMELINE_START_X}
                                y={rowY}
                                width={Math.max(barWidth, 2)}
                                height={BAR_HEIGHT}
                                fill={fill}
                                rx={3}
                            >
                                <title>{norm.fingerprint} — {norm.convergence_type} — {norm.participant_count} Nous — {duration} ticks</title>
                            </rect>
                            <text
                                x={TIMELINE_START_X + Math.max(barWidth, 2) + 4}
                                y={rowY + BAR_HEIGHT / 2}
                                fontSize="10" fill="#A3A3A3"
                                dominantBaseline="middle"
                            >
                                {duration} ticks
                            </text>
                        </g>
                    );
                })}
            </svg>
            <ul className="mt-2 flex flex-col gap-1">
                <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="inline-block h-2 w-2 rounded-sm bg-[#7DD3FC]" aria-hidden="true" />
                    emergent — independent convergence
                </li>
                <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="inline-block h-2 w-2 rounded-sm bg-[#9CA3AF]" aria-hidden="true" />
                    coincidental — shared LLM prior likely
                </li>
            </ul>
        </>
    );
}
