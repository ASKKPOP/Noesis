'use client';
/**
 * Firehose — the scrolling audit-entry panel.
 *
 * Subscribes to FirehoseStore via useFirehose(). Renders AT MOST 100 rows
 * (DOM cap per 03-UI-SPEC §Firehose / threat model T-03-16) even though the
 * underlying ring buffer holds 500. Order: newest first (most recent at the
 * top of the list).
 *
 * Composition: this component owns the panel frame + header + empty state;
 * the filter chips and individual rows are subcomponents so the render graph
 * stays flat and each piece is independently testable.
 *
 * Filter empty state: when a filter is active but 0 rows match, we render a
 * distinct empty-state message (per UI-SPEC copywriting contract) rather than
 * showing "Waiting for events" which would be misleading.
 *
 * Phase 7 (Plan 07-04 Task 3):
 *   - Subscribes additionally to useFirehoseFilter() for URL-param-driven
 *     dialogue_id filtering. When filter active, FirehoseFilterChip mounts
 *     above the list and each row receives `dialogueFilter` for dim-not-hide
 *     styling (AC-4-3-3). When filter is null → zero-diff (AC-4-3-4).
 *   - Empty-match heading (all visible rows non-matching + filter active):
 *     "No matching events for dialogue_id ${value}. Press × to clear."
 */

import { useFirehose } from '../hooks';
import { useFirehoseFilter } from '@/lib/hooks/use-firehose-filter';
import { FirehoseRow } from './firehose-row';
import { EventTypeFilter } from './event-type-filter';
import { FirehoseFilterChip } from './firehose-filter-chip';
import type { AuditEntry } from '@/lib/protocol/audit-types';

/** Maximum number of DOM rows. The ring buffer keeps 500; we render 100. */
const DOM_CAP = 100;

/**
 * Row matches dialogue_id filter iff it's a telos.refined event whose
 * triggered_by_dialogue_id equals the filter value. Mirrored in FirehoseRow
 * so the dim class is applied consistently — keep predicates aligned.
 */
function rowMatchesDialogueFilter(
    entry: AuditEntry,
    filter: { key: 'dialogue_id'; value: string } | null,
): boolean {
    if (filter === null) return true;
    if (entry.eventType !== 'telos.refined') return false;
    const p = entry.payload;
    if (typeof p !== 'object' || p === null) return false;
    return (
        (p as { triggered_by_dialogue_id?: string }).triggered_by_dialogue_id ===
        filter.value
    );
}

export interface FirehoseProps {
    /** Phase 13 (REPLAY-05): when true, reads from replay store instead of live store. */
    replayMode?: boolean;
}

export function Firehose({ replayMode: _replayMode = false }: FirehoseProps = {}): React.ReactElement {
    const snap = useFirehose();
    const { filter: dialogueFilter } = useFirehoseFilter();
    // filteredEntries is oldest-first inside the store. Newest-first in the
    // UI matches scrolling-log convention (top = most recent). slice(-100)
    // keeps only the tail (most recent 100), then reverse() flips order.
    const tail = snap.filteredEntries.slice(-DOM_CAP);
    const visible = tail.slice().reverse();

    const totalInStore = snap.entries.length;
    const filterActive = snap.filter !== null;

    // Phase 7: compute whether ANY visible row matches the dialogue_id filter.
    // When a filter is active but no row matches, we render an override
    // heading rather than a list of 100% dimmed rows (which would be
    // technically correct but UX-hostile).
    const hasDialogueMatch =
        dialogueFilter === null ||
        visible.some((e) => rowMatchesDialogueFilter(e, dialogueFilter));

    const showEmptyMatchHeading =
        dialogueFilter !== null && visible.length > 0 && !hasDialogueMatch;

    return (
        <section
            aria-label="Event firehose"
            className="flex flex-col min-h-0 border border-neutral-800 rounded-md bg-[#17181C]"
        >
            <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-neutral-800">
                <h2 className="font-semibold text-sm text-neutral-200">Firehose</h2>
                <EventTypeFilter />
            </header>
            {/* Phase 7: dialogue_id filter chip mounts iff filter non-null (self-conditional). */}
            <FirehoseFilterChip />
            {showEmptyMatchHeading ? (
                <div className="flex-1 flex items-center justify-center p-6 text-neutral-500 text-sm text-center">
                    <div>
                        <div className="font-medium text-neutral-300">
                            No matching events for dialogue_id {dialogueFilter.value}. Press × to clear.
                        </div>
                    </div>
                </div>
            ) : visible.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-6 text-neutral-500 text-sm text-center">
                    {filterActive && totalInStore > 0 ? (
                        <div>
                            <div className="font-medium text-neutral-300">No events match</div>
                            <div className="mt-1 text-xs">
                                No events in the last 500 match the active filter.
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="font-medium text-neutral-300">Waiting for events…</div>
                            <div className="mt-1 text-xs">
                                Grid is connected but no allowlisted events have arrived yet.
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <ul
                    role="list"
                    className="flex-1 overflow-y-auto"
                    data-testid="firehose-list"
                    data-rendered-count={visible.length}
                >
                    {visible.map((entry) => (
                        <FirehoseRow
                            key={typeof entry.id === 'number' ? `id:${entry.id}` : `h:${entry.eventHash}`}
                            entry={entry}
                            dialogueFilter={dialogueFilter}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
