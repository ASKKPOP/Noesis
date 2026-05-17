'use client';
/**
 * useSkillLineage / useNorms / useLoreGraph — SWR wrappers for culture
 * endpoints (Phase 21, D-21-03).
 *
 * Batching key discipline (D-9-13):
 *   The SWR key includes Math.floor(currentTick / 100) so all renders
 *   within the same 100-tick window share one cache entry.
 *   NEVER change BATCH_WINDOW_TICKS without a phase decision.
 *
 * useLoreGraph fetches /api/v1/grid/lore and /api/v1/audit/trail?type=lore.cited
 * in parallel (Pitfall 4 Option 1) and merges into LoreGraphData.
 */

import useSWR from 'swr';
import type { SWRResponse } from 'swr';
import { useTick } from '@/lib/stores/tick-store';
import {
    fetchSkillLineage,
    fetchNorms,
    fetchLoreEntries,
    fetchLoreCitations,
} from '@/lib/api/culture';
import type {
    SkillLineageResponse,
    NormsResponse,
    LoreGraphData,
} from '@/lib/api/culture';

// D-9-13 — NEVER change without phase decision.
const BATCH_WINDOW_TICKS = 100;

export function useSkillLineage(): SWRResponse<SkillLineageResponse, Error> {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / BATCH_WINDOW_TICKS);
    return useSWR(
        ['skill-lineage', windowKey],
        () => fetchSkillLineage(),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}

export function useNorms(): SWRResponse<NormsResponse, Error> {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / BATCH_WINDOW_TICKS);
    return useSWR(
        ['norms', windowKey],
        () => fetchNorms(),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}

export function useLoreGraph(): SWRResponse<LoreGraphData, Error> {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / BATCH_WINDOW_TICKS);
    return useSWR(
        ['lore-graph', windowKey],
        async () => {
            const [loreEntries, loreCitations] = await Promise.all([
                fetchLoreEntries(),
                fetchLoreCitations(),
            ]);
            return {
                loreEntries: loreEntries.entries,
                loreCitations: loreCitations.entries,
            };
        },
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}
