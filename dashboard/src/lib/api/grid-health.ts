/**
 * Grid Health — dashboard API client for the Grid's two public liveness reads.
 *
 *   - GET {NEXT_PUBLIC_GRID_ORIGIN}/health/detailed     → fetchGridHealth
 *   - GET {NEXT_PUBLIC_GRID_ORIGIN}/api/v1/grid/status  → fetchGridStatus
 *
 * PUBLIC reads — no auth headers, no credentials. Mirrors system-map.ts error
 * discipline: a discriminated-union error exposing only `kind`; AbortError is
 * re-thrown so callers can ignore it.
 *
 *   - 200                → { ok: true, data }
 *   - any non-2xx        → { ok: false, error: { kind: 'unavailable' } }
 *     (/health/detailed answers 503 `watchdog_not_ready` in the startup window)
 *   - fetch rejection    → { ok: false, error: { kind: 'network' } }
 */

const GRID_ORIGIN = (): string => process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';

export type GridHealthStatus = 'ok' | 'degraded' | 'critical';

/** The /health/detailed payload (OBS-06 contract, grid/src/diagnostics/health-watchdog.ts). */
export interface GridHealth {
    status: GridHealthStatus;
    reasons: string[];
    timestamp: number;
    audit: {
        in_memory_length: number | null;
        persisted_max_id: number | null;
        divergence: number | null;
        divergence_threshold: number;
        last_persist_attempt_at: number | null;
        last_persist_error: { code: string; at: number } | null;
    };
    firehose: {
        client_count: number;
        frames_sent_total: number;
        frames_dropped_total: number;
        last_frame_at: number | null;
        watermark_bytes: number;
    };
    clock: {
        tick: number;
        running: boolean;
        last_tick_at: number | null;
    };
}

/** The /api/v1/grid/status payload (grid/src/api/types.ts GridStatus). */
export interface GridStatus {
    name: string;
    tick: number;
    epoch: number;
    nousCount: number;
    regionCount: number;
    activeLaws: number;
    auditEntries: number;
    /** Milliseconds since the Grid process started. */
    uptime: number;
}

export type GridHealthErrorKind = 'unavailable' | 'network';

export interface GridHealthFetchError {
    readonly kind: GridHealthErrorKind;
}

export type GridHealthResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: GridHealthFetchError };

async function getJson<T>(path: string, signal?: AbortSignal): Promise<GridHealthResult<T>> {
    let resp: Response;
    try {
        resp = await fetch(`${GRID_ORIGIN()}${path}`, {
            method: 'GET',
            signal,
            headers: { accept: 'application/json' },
        });
    } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }

    if (!resp.ok) {
        return { ok: false, error: { kind: 'unavailable' } };
    }

    return { ok: true, data: (await resp.json()) as T };
}

/** fetchGridHealth — GET the live /health/detailed snapshot. Public. */
export function fetchGridHealth(signal?: AbortSignal): Promise<GridHealthResult<GridHealth>> {
    return getJson<GridHealth>('/health/detailed', signal);
}

/** fetchGridStatus — GET the live Grid status counts. Public. */
export function fetchGridStatus(signal?: AbortSignal): Promise<GridHealthResult<GridStatus>> {
    return getJson<GridStatus>('/api/v1/grid/status', signal);
}

/**
 * countByLifecyclePhase — tally a Nous roster by its `lifecyclePhase`, in
 * first-seen order. Phases are taken as the Grid reports them; none are assumed.
 */
export function countByLifecyclePhase(
    roster: readonly { lifecyclePhase: string }[],
): { phase: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const n of roster) {
        counts.set(n.lifecyclePhase, (counts.get(n.lifecyclePhase) ?? 0) + 1);
    }
    return [...counts].map(([phase, count]) => ({ phase, count }));
}
