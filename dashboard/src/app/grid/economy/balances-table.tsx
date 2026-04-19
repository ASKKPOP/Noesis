'use client';
/**
 * BalancesTable — Economy panel's first sub-table. Pure presentational; the
 * owning EconomyPanel drives fetch + re-fetch, this component only renders.
 *
 * Columns: Name / Region / Ousia (tabular-nums, right-aligned) / Status chip.
 * Sort: by `ousia` desc (stable); rationale — ECON-01 UI scan value is "who
 * has the most Ousia" at a glance. Secondary columns are reference data.
 *
 * Interaction (NOUS-03 linkback): clicking the Name cell calls
 * `useSelection().select(did)`, which opens the Inspector drawer mounted
 * globally in <GridClient/>.
 *
 * Primitives come from `@/components/primitives` (Plan 04-04). The old
 * `@/app/grid/inspector/primitives` path is retired — do not re-introduce it.
 */

import { useMemo } from 'react';
import { useSelection } from '@/lib/hooks/use-selection';
import { Chip, EmptyState } from '@/components/primitives';
import type { NousRosterEntry } from '@/lib/api/economy';

export interface BalancesTableProps {
    readonly roster: readonly NousRosterEntry[];
}

export function BalancesTable({
    roster,
}: BalancesTableProps): React.ReactElement {
    const { select } = useSelection();
    const sorted = useMemo(
        () => [...roster].sort((a, b) => b.ousia - a.ousia),
        [roster],
    );

    if (sorted.length === 0) {
        return (
            <EmptyState
                title="Roster empty."
                description="Grid has not spawned any Nous yet."
                testId="balances-empty"
            />
        );
    }

    return (
        <table
            data-testid="balances-table"
            className="w-full text-sm text-neutral-200"
        >
            <thead>
                <tr className="text-left text-xs font-semibold text-neutral-400">
                    <th scope="col" className="py-1 pr-2">
                        Name
                    </th>
                    <th scope="col" className="py-1 px-2">
                        Region
                    </th>
                    <th scope="col" className="py-1 px-2 text-right">
                        Ousia
                    </th>
                    <th scope="col" className="py-1 pl-2">
                        Status
                    </th>
                </tr>
            </thead>
            <tbody>
                {sorted.map((n) => (
                    <tr
                        key={n.did}
                        data-testid={`balances-row-${n.did}`}
                        className="border-t border-neutral-800"
                    >
                        <td className="py-1 pr-2">
                            <button
                                type="button"
                                onClick={() => select(n.did)}
                                aria-label={`Open inspector for ${n.name}`}
                                className="text-left text-neutral-100 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                            >
                                {n.name}
                            </button>
                        </td>
                        <td className="py-1 px-2 text-neutral-400">
                            {n.region}
                        </td>
                        <td className="py-1 px-2 text-right tabular-nums">
                            {n.ousia.toLocaleString()}
                        </td>
                        <td className="py-1 pl-2">
                            <Chip
                                label={n.status}
                                testId={`balances-status-${n.did}`}
                            />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
