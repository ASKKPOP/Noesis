'use client';
/**
 * FirehoseFilterChip — active-filter indicator above the firehose event list.
 *
 * Mounts iff useFirehoseFilter().filter is non-null (currently only when
 * `firehose_filter=dialogue_id:<16-hex>` is set and passes the regex gate).
 * Screen readers are notified via role="status" aria-live="polite" when the
 * chip mounts.
 *
 * Layout: [dialogue_id: <mono-value>] [×]
 * 07-UI-SPEC §Copywriting, §Color (border + mono value in indigo-400
 * #818CF8 on secondary #17181C background).
 */
import { useFirehoseFilter } from '@/lib/hooks/use-firehose-filter';

export function FirehoseFilterChip(): React.ReactElement | null {
    const { filter, clear } = useFirehoseFilter();
    if (filter === null) return null;
    return (
        <div
            data-testid="firehose-filter-chip"
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-full border border-[#818CF8] bg-[#17181C] px-3 py-1 mb-4"
        >
            <span className="text-[14px] text-neutral-200">dialogue_id: </span>
            <span className="font-mono text-[12px] text-[#818CF8]">{filter.value}</span>
            <button
                type="button"
                data-testid="firehose-filter-clear"
                aria-label="Clear dialogue filter. Show all firehose events."
                onClick={clear}
                className="flex h-4 w-4 items-center justify-center rounded text-[14px] leading-none hover:bg-[#23252B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
                ×
            </button>
        </div>
    );
}
