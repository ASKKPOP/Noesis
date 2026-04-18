'use client';
/**
 * EventTypeFilter — the chip row that mutates FirehoseStore.filter.
 *
 * Chips: one per ALL_CATEGORIES entry (trade/message/movement/law/lifecycle)
 * plus an 'All' reset chip. Clicking a category chip toggles its membership
 * in the filter set. Clicking 'All' clears the filter (null = show all).
 *
 * Accessibility:
 *   - <button> elements with aria-pressed to convey toggled state
 *   - role='group' wrapping container with aria-label
 *   - Focus ring provided by :focus-visible rule in globals.css
 *
 * Empty-set semantics: when the user deselects the last active category, we
 * reset the filter to null ('All' mode) rather than leaving an empty set
 * that would render no rows — matches the UI-SPEC principle that the 'All'
 * chip and "no category chip active" are visually equivalent.
 */

import { useStores } from '../use-stores';
import { useFirehose } from '../hooks';
import { ALL_CATEGORIES, type EventCategory } from '@/lib/stores/event-type';

/** Category → Tailwind class for the small color dot rendered inside each chip. */
const DOT: Record<EventCategory, string> = {
    trade: 'bg-amber-400',
    message: 'bg-violet-400',
    movement: 'bg-blue-400',
    law: 'bg-pink-400',
    lifecycle: 'bg-neutral-400',
    other: 'bg-neutral-700',
};

export function EventTypeFilter(): React.ReactElement {
    const { firehose } = useStores();
    const { filter } = useFirehose();

    const toggle = (cat: EventCategory): void => {
        if (filter === null) {
            firehose.setFilter(new Set<EventCategory>([cat]));
            return;
        }
        const next = new Set(filter);
        if (next.has(cat)) {
            next.delete(cat);
        } else {
            next.add(cat);
        }
        firehose.setFilter(next.size === 0 ? null : next);
    };

    const clear = (): void => firehose.setFilter(null);

    return (
        <div
            role="group"
            aria-label="Filter by event type"
            className="flex items-center gap-1 flex-wrap"
        >
            <button
                type="button"
                onClick={clear}
                aria-pressed={filter === null}
                className={
                    filter === null
                        ? 'text-[11px] px-2 py-0.5 rounded-sm bg-neutral-200 text-neutral-950 font-medium'
                        : 'text-[11px] px-2 py-0.5 rounded-sm bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }
            >
                All
            </button>
            {ALL_CATEGORIES.map((cat) => {
                const on = filter !== null && filter.has(cat);
                return (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => toggle(cat)}
                        aria-pressed={on}
                        data-category={cat}
                        className={
                            on
                                ? 'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm bg-neutral-200 text-neutral-950 font-medium'
                                : 'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }
                    >
                        <span
                            aria-hidden="true"
                            className={`w-1.5 h-1.5 rounded-full ${DOT[cat]}`}
                        />
                        {cat}
                    </button>
                );
            })}
        </div>
    );
}
