'use client';
/**
 * TelosSection — active goals list + Phase 7 panel-level refinement badge.
 *
 * Empty state copy comes verbatim from UI-SPEC §185:
 *   "No active goals. Telos is quiescent."
 * Non-empty renders an ordered <ul> where each <li> has the goal description
 * (Body text) and a priority Chip (e.g. "priority 0.80") for quick scanning.
 *
 * Phase 7 (Plan 07-04 Task 3) adds:
 *   - `did: string | null` prop plumbed from Inspector
 *   - <TelosRefinedBadge did={did} /> in the heading-row right
 *   - Badge is absent (no DOM) when refinedCount === 0 — D-27 / D-30
 *   - Empty goals + badge coexist: refinement history is independent of the
 *     current goal set (Brain could have refined goals back to empty)
 */

import { Chip, EmptyState } from '@/components/primitives';
import { TelosRefinedBadge } from '@/components/dialogue/telos-refined-badge';
import type { NousStateResponse } from '@/lib/api/introspect';

export interface TelosSectionProps {
    readonly telos: NousStateResponse['telos'];
    readonly did: string | null;
}

export function TelosSection({ telos, did }: TelosSectionProps): React.ReactElement {
    const goals = telos.active_goals;

    return (
        <section
            data-testid="section-telos"
            aria-labelledby="section-telos-title"
            className="mb-4"
        >
            <div className="mb-2 flex items-center justify-between">
                <h3
                    id="section-telos-title"
                    className="text-sm font-semibold text-neutral-100"
                >
                    Telos
                </h3>
                <TelosRefinedBadge did={did} />
            </div>
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
