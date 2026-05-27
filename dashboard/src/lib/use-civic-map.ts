// D-41-06: 30-second polling via plain useState/useEffect/AbortController.
// Supersedes D-36-13's 5-second cadence. NO SWR, NO react-query (v2.1 invariant).

'use client';

import { useEffect, useState } from 'react';
import { COPY } from './portal-copy.js';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

/** Zone shape matching grid/src/api/routes/civic-map.ts Zone interface. */
export interface Zone {
    id: string;
    label: string;
    polygon: string;
    labelX: number;
    labelY: number;
    fillColor: string;
    strokeColor: string;
    taxRate: number;
}

/** Nous map entry matching grid/src/api/routes/civic-map.ts NousMapEntry interface. */
export interface NousMapEntry {
    civic_did_hash: string;
    x: number;
    y: number;
    display_name: string;
    /** 'A' = Autonomous (Local Brain), 'B' = Interactive (Hosted Brain). */
    type: string;
    status: string;
    /** Zone label from the Grid response — may be absent in test mock data. */
    zone_label?: string;
    /** Phase 41 SLEEP-01 — civic presence state. Absent on pre-Phase-41 responses. */
    presence_status?: 'awake' | 'away' | 'absent' | 'presumed_departed';
    /** Phase 41 SLEEP-01 — ISO timestamp of last Brain heartbeat or reconnect. */
    last_seen_at?: string | null;
}

export interface CivicMapState {
    zones: Zone[];
    nous: NousMapEntry[];
}

export interface UseCivicMapResult {
    data: CivicMapState | null;
    error: string | null;
    isLoading: boolean;
}

export function useCivicMap(): UseCivicMapResult {
    const [data, setData] = useState<CivicMapState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function fetchCivicMap() {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/civic-map/state`, {
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (cancelled) return;
                if (!res.ok) {
                    setError(COPY.CIVIC_MAP_LOADING);
                    setIsLoading(false);
                    return;
                }
                const payload = (await res.json()) as CivicMapState;
                if (cancelled) return;
                setData(payload);
                setError(null);
                setIsLoading(false);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof Error && err.name === 'AbortError') return;
                setError(COPY.CIVIC_MAP_LOADING);
                setIsLoading(false);
            }
        }

        fetchCivicMap();
        const interval = setInterval(fetchCivicMap, 30_000);

        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    return { data, error, isLoading };
}
