/**
 * fetchNousState — typed REST wrapper around the Grid's
 * `GET /api/v1/nous/:did/state` proxy (shipped by Plan 04-03).
 *
 * Contract (W2 cross-plan lock from Plan 04-03):
 *   - `memory_highlights[].timestamp` is an **Unix timestamp in integer
 *     SECONDS** (not milliseconds). Consumers MUST multiply by 1000 before
 *     passing to the `Date` constructor. The MemorySection in Plan 04-05
 *     and the TradesTable in Plan 04-06 share this contract.
 *
 * Error model:
 *   - 400 → invalid_did (malformed DID)
 *   - 404 → unknown_nous (not in roster)
 *   - 503 → brain_unavailable (brain container offline / refused connection)
 *   - any other non-2xx or fetch rejection → network
 *   - AbortError is re-thrown so the caller can distinguish "stale request
 *     was cancelled" from "request failed"; the useEffect caller guards with
 *     `signal.aborted` before committing state.
 */

export type NousStateResponse = {
    did: string;
    name: string;
    archetype: string;
    location: string;
    grid_name: string;
    mood: string;
    emotions: Record<string, number>;
    active_goals: string[];
    psyche: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
    thymos: { mood: string; emotions: Record<string, number> };
    telos: { active_goals: Array<{ id: string; description: string; priority: number }> };
    memory_highlights: Array<{ timestamp: number; kind: string; summary: string }>;
    // Phase 8 (D-27): additive — existing consumers unaffected; Inspector uses
    // status to render State A (active) vs State B (deleted — tombstoned caption).
    status?: 'active' | 'deleted';
    deleted_at_tick?: number;
};

export type FetchError = {
    kind: 'invalid_did' | 'unknown_nous' | 'brain_unavailable' | 'network' | 'nous_deleted';
};

export type FetchResult =
    | { ok: true; data: NousStateResponse }
    | { ok: false; error: FetchError };

const STATUS_TO_KIND: Record<number, FetchError['kind']> = {
    400: 'invalid_did',
    404: 'unknown_nous',
    410: 'nous_deleted',
    503: 'brain_unavailable',
};

export async function fetchNousState(
    did: string,
    origin: string,
    signal?: AbortSignal,
): Promise<FetchResult> {
    let resp: Response;
    try {
        resp = await fetch(`${origin}/api/v1/nous/${encodeURIComponent(did)}/state`, {
            signal,
            headers: { accept: 'application/json' },
        });
    } catch (err) {
        // Abort is a distinct signal — callers inspect signal.aborted to
        // discard stale responses; we re-throw so they can.
        if ((err as { name?: string }).name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }

    if (!resp.ok) {
        const kind = STATUS_TO_KIND[resp.status] ?? 'network';
        return { ok: false, error: { kind } };
    }

    const data = (await resp.json()) as NousStateResponse;
    return { ok: true, data };
}
