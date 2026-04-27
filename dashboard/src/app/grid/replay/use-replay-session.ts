/**
 * useReplaySession — fetches an audit chain slice and exposes target-tick state.
 *
 * Phase 13 (REPLAY-05 / D-13-04 / D-13-05).
 *
 * Fetches /api/v1/grid/audit?from=startTick&to=endTick ONCE on mount.
 * Does NOT call Date.now / setInterval / setTimeout / Math.random
 * (CI gate: scripts/check-wallclock-forbidden.mjs enforces this — D-13-04).
 *
 * All timing derives from the rewound chain's tick, never from wall-clock.
 */

export interface AuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: unknown;
    prevHash: string;
    eventHash: string;
    createdAt: number;
}

export type ReplayState = {
    entries: AuditEntry[];
    targetTick: number;
};

export interface UseReplaySessionResult {
    entries: AuditEntry[];
    targetTick: number;
    setTargetTick: (t: number) => void;
    replayState: ReplayState | null;
    loading: boolean;
    error: string | null;
}

import { useState, useEffect, useCallback } from 'react';

export function useReplaySession(
    origin: string,
    startTick: number,
    endTick: number,
): UseReplaySessionResult {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [targetTick, setTargetTickState] = useState<number>(startTick);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch audit slice ONCE on mount — no auto-refresh (D-13-04: no auto-play).
    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const url = `${origin}/api/v1/grid/audit?from=${startTick}&to=${endTick}`;
                const res = await fetch(url, { signal: ac.signal, cache: 'no-store' });
                if (ac.signal.aborted) return;
                if (!res.ok) {
                    setError(`Audit fetch failed: HTTP ${res.status}`);
                    return;
                }
                const body = await res.json() as { entries?: AuditEntry[] };
                if (ac.signal.aborted) return;
                setEntries(Array.isArray(body.entries) ? body.entries : []);
            } catch (err) {
                if ((err as { name?: string }).name === 'AbortError') return;
                setError('Audit fetch failed: network error');
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [origin, startTick, endTick]);

    const setTargetTick = useCallback((t: number) => {
        // Clamp to [startTick, endTick]
        const clamped = Math.max(startTick, Math.min(endTick, t));
        setTargetTickState(clamped);
    }, [startTick, endTick]);

    const replayState: ReplayState | null = entries.length > 0
        ? { entries, targetTick }
        : null;

    return { entries, targetTick, setTargetTick, replayState, loading, error };
}
