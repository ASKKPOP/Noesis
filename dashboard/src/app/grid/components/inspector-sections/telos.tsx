'use client';
/**
 * TelosSection — active goals list.
 *
 * Empty state copy comes verbatim from UI-SPEC §185:
 *   "No active goals. Telos is quiescent."
 * Non-empty renders an ordered <ul> where each <li> has the goal description
 * (Body text) and a priority Chip (e.g. "priority 0.80") for quick scanning.
 */

import { Chip, EmptyState } from '@/components/primitives';
import type { NousStateResponse } from '@/lib/api/introspect';

export interface TelosSectionProps {
    readonly telos: NousStateResponse['telos'];
}

export function TelosSection({ telos }: TelosSectionProps): React.ReactElement {
    const goals = telos.active_goals;

    return (
        <section
            data-testid="section-telos"
            aria-labelledby="section-telos-title"
            className="mb-4"
        >
            <h3
                id="section-telos-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Telos
            </h3>
            {goals.length === 0 ? (
                <EmptyState
                    title="No active goals. Telos is quiescent."
                    testId="empty-telos"
                />
            ) : (
                <ul className="flex flex-col gap-1">
                    {goals.map((goal) => (
                        <li
                            key={goal.id}
                            data-testid={`goal-${goal.id}`}
                            className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                        >
                            <span className="flex-1 text-xs text-neutral-200">
                                {goal.description}
                            </span>
                            <Chip
                                label={`priority ${goal.priority.toFixed(2)}`}
                                testId={`priority-${goal.id}`}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
