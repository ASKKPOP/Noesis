'use client';
/**
 * useRelationshipsH1 / useRelationshipsH2 / useGraph — SWR wrappers for the
 * tier-graded relationship endpoints (Phase 9, D-9-06, D-9-13).
 *
 * Batching key discipline (D-9-13, T-09-11 mitigation):
 *   The SWR key includes `Math.floor(currentTick / 100)` so that all renders
 *   within the same 100-tick window share one cache entry. At tick boundary
 *   (e.g., 999 → 1000), the window key increments from 9 → 10, triggering
 *   exactly one new fetch. This bounds the Inspector to ≤1 fetch per Nous
 *   per 100-tick window, preventing N+1 query storms (T-09-11 MEDIUM threat).
 *
 * T-09-20 mitigation: useRelationshipsH2 returns null SWR key when tier is
 *   'H1', preventing H1 operators from receiving H2 numeric data from the
 *   SWR cache even if a prior H2 elevation cached it.
 *
 * T-09-24 mitigation: fetchRelationshipsH2 requires explicit tier:'H2'
 *   argument; the hook-level guard `tier === 'H2' || tier === 'H5'` prevents
 *   an H1 caller from constructing the POST request at all.
 *
 * NEVER change BATCH_WINDOW_TICKS without a phase decision — it is load-bearing
 * for the D-9-13 perf budget (one fetch per Nous per 100 ticks).
 */

import useSWR from 'swr';
import { useTick } from '@/lib/stores/tick-store';
import {
    fetchRelationshipsH1,
    fetchRelationshipsH2,
    fetchGraph,
    type RelationshipsH1Response,
    type RelationshipsH2Response,
    type GraphResponse,
} from '@/lib/api/relationships';
import type { SWRResponse } from 'swr';

// D-9-13 — NEVER change without phase decision.
const BATCH_WINDOW_TICKS = 100;

// ---------------------------------------------------------------------------
// H1 hook — warmth-bucket-only view (all operators, default)
// ---------------------------------------------------------------------------

export function useRelationshipsH1(
    did: string | null,
): SWRResponse<RelationshipsH1Response, Error> {
    const currentTick = useTick();
    // D-9-13: Math.floor(currentTick / 100) — one fetch per Nous per 100-tick window
    const windowKey = Math.floor(currentTick / 100);
    return useSWR(
        did ? ['relationships-h1', did, windowKey] : null,
        () => fetchRelationshipsH1(did!),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}

// ---------------------------------------------------------------------------
// H2 hook — numeric valence/weight view (Reviewer + Steward)
// ---------------------------------------------------------------------------

export function useRelationshipsH2(
    did: string | null,
    tier: 'H1' | 'H2' | 'H5',
): SWRResponse<RelationshipsH2Response, Error> {
    const currentTick = useTick();
    // D-9-13: Math.floor(currentTick / 100) — one fetch per Nous per 100-tick window
    const windowKey = Math.floor(currentTick / 100);
    return useSWR(
        // T-09-20 + T-09-24: null key when tier === 'H1' → no fetch, no cache read
        did && (tier === 'H2' || tier === 'H5') ? ['relationships-h2', did, windowKey] : null,
        () => fetchRelationshipsH2(did!, 'H2'),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}

// ---------------------------------------------------------------------------
// Graph hook — full grid topology (H1 public, all operators)
// ---------------------------------------------------------------------------

export function useGraph(): SWRResponse<GraphResponse, Error> {
    const currentTick = useTick();
    // D-9-13: Math.floor(currentTick / 100) — one fetch per Nous per 100-tick window
    const windowKey = Math.floor(currentTick / 100);
    return useSWR(
        ['graph', windowKey],
        () => fetchGraph(),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}
