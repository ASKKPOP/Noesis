'use client';

import { useEffect, useRef, useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// Mirrors grid/src/diagnostics/health-watchdog.ts HealthDetailedPayload (Phase 32 D-32-C3
// + Phase 34 D-34-B1 additive reasons field). `reasons` is typed as optional so this
// hook renders gracefully against either pre- or post-Plan-01 grid builds (parallel-wave
// dependency discipline — see 34-02-PLAN.md objective §"Wave note").
export interface HealthDetailedPayload {
    readonly status: 'ok' | 'degraded' | 'critical';
    readonly reasons?: readonly string[];
    readonly timestamp: number;
    readonly audit: {
        readonly in_memory_length: number | null;
        readonly persisted_max_id: number | null;
        readonly divergence: number | null;
        readonly divergence_threshold: number;
        readonly last_persist_attempt_at: number | null;
        readonly last_persist_error: { readonly code: string; readonly at: number } | null;
    };
    readonly firehose: {
        readonly client_count: number;
        readonly frames_sent_total: number;
        readonly frames_dropped_total: number;
        readonly last_frame_at: number | null;
        readonly watermark_bytes: number;
    };
    readonly clock: {
        readonly tick: number;
        readonly running: boolean;
        readonly last_tick_at: number | null;
    };
}

/**
 * Phase 34 D-34-A3: poll /health/detailed every 5s, compute frame-counter deltas
 * client-side from prev/current FirehoseStats, maintain a 12-entry ring of deltas.
 *
 * Cadence: 5s (REQ OBS-11/12 — DO NOT change).
 * Ring window: 12 entries × 5s = 1-minute history (REQ OBS-12 — DO NOT change).
 * Discipline: plain useState/useEffect/useRef — no SWR, no react-query (v2.1 invariant).
 * Unmount: AbortController cancels in-flight fetch; setInterval cleared (R-32-02 spirit).
 *
 * Error handling: 503 special-cased ('watchdog_not_ready' during narrow startup window).
 * Network failure → 'Health endpoint unavailable.'
 *
 * Returns:
 *   data:          latest payload, or null while loading / on persistent error.
 *   error:         null when healthy, string when most recent fetch failed.
 *   isLoading:     true until first fetch completes (success or failure).
 *   sentDeltas:    ring buffer of last 12 frames_sent deltas (newest = last entry).
 *   droppedDeltas: ring buffer of last 12 frames_dropped deltas (newest = last entry).
 */
export interface UseHealthDetailedResult {
    data: HealthDetailedPayload | null;
    error: string | null;
    isLoading: boolean;
    sentDeltas: number[];
    droppedDeltas: number[];
}

const RING_CAPACITY = 12;

export function useHealthDetailed(): UseHealthDetailedResult {
    const [data, setData] = useState<HealthDetailedPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [sentDeltas, setSentDeltas] = useState<number[]>([]);
    const [droppedDeltas, setDroppedDeltas] = useState<number[]>([]);

    // Hold the previous stats snapshot for delta computation across polls.
    const prevSentRef = useRef<number | null>(null);
    const prevDroppedRef = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function fetchHealth() {
            try {
                const res = await fetch(`${GRID_ORIGIN}/health/detailed`, { signal: controller.signal });
                if (cancelled) return;
                if (!res.ok) {
                    if (res.status === 503) {
                        setError('Health endpoint not ready.');
                    } else {
                        setError(`HTTP ${res.status}`);
                    }
                    setIsLoading(false);
                    return;
                }
                const payload = (await res.json()) as HealthDetailedPayload;
                if (cancelled) return;

                // Delta computation: clamp negative deltas to 0 on counter reset (e.g., Grid restart).
                const currentSent = payload.firehose.frames_sent_total;
                const currentDropped = payload.firehose.frames_dropped_total;
                if (prevSentRef.current !== null) {
                    const sentDelta = Math.max(0, currentSent - prevSentRef.current);
                    setSentDeltas((prev) => {
                        const next = [...prev, sentDelta];
                        return next.length > RING_CAPACITY ? next.slice(-RING_CAPACITY) : next;
                    });
                }
                if (prevDroppedRef.current !== null) {
                    const droppedDelta = Math.max(0, currentDropped - prevDroppedRef.current);
                    setDroppedDeltas((prev) => {
                        const next = [...prev, droppedDelta];
                        return next.length > RING_CAPACITY ? next.slice(-RING_CAPACITY) : next;
                    });
                }
                prevSentRef.current = currentSent;
                prevDroppedRef.current = currentDropped;

                setData(payload);
                setError(null);
                setIsLoading(false);
            } catch (err) {
                if (cancelled) return;
                // AbortError on unmount is expected — do not surface.
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('Health endpoint unavailable.');
                setIsLoading(false);
            }
        }

        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);

        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    return { data, error, isLoading, sentDeltas, droppedDeltas };
}
