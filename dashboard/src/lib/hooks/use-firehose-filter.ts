'use client';
/**
 * useFirehoseFilter — thin wrapper over Next.js useSearchParams + useRouter.
 *
 * Parses `firehose_filter=<key>:<value>`. Phase 7 supports only key='dialogue_id'
 * with value matching DIALOGUE_ID_RE (16-hex, lowercase). Unknown keys or
 * malformed values resolve to `filter: null` — the chip does not mount and
 * the firehose renders unfiltered. Mirrors the producer-boundary regex
 * discipline from Plan 03's grid/src/audit/append-telos-refined.ts.
 *
 * Keep DIALOGUE_ID_RE in sync with:
 *   - grid/src/audit/append-telos-refined.ts (producer boundary)
 *   - dashboard/src/lib/hooks/use-refined-telos-history.ts (sibling consumer)
 *
 * 07-UI-SPEC §Interaction Contract — badge click URL contract + regex guard.
 * 07-CONTEXT.md D-29 (URL shape), D-31 (regex symmetry with producer side).
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

export interface FirehoseFilter {
    readonly key: 'dialogue_id';
    readonly value: string;
}

export interface UseFirehoseFilterReturn {
    readonly filter: FirehoseFilter | null;
    setFilter(next: FirehoseFilter): void;
    clear(): void;
}

export function useFirehoseFilter(): UseFirehoseFilterReturn {
    const router = useRouter();
    const searchParams = useSearchParams();
    const raw = searchParams.get('firehose_filter');

    const filter = useMemo<FirehoseFilter | null>(() => {
        if (!raw) return null;
        const colonIdx = raw.indexOf(':');
        if (colonIdx <= 0) return null;
        const key = raw.slice(0, colonIdx);
        const value = raw.slice(colonIdx + 1);
        if (key !== 'dialogue_id') return null;
        if (!DIALOGUE_ID_RE.test(value)) return null;
        return { key, value };
    }, [raw]);

    const setFilter = useCallback(
        (next: FirehoseFilter): void => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('firehose_filter', `${next.key}:${next.value}`);
            router.push(`?${params.toString()}`);
        },
        [router, searchParams],
    );

    const clear = useCallback((): void => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('firehose_filter');
        const qs = params.toString();
        router.push(qs ? `?${qs}` : '?');
    }, [router, searchParams]);

    return { filter, setFilter, clear };
}
