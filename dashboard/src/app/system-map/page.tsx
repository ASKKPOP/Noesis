'use client';

/**
 * /system-map — the live System Map. PUBLIC page (no operator/agency gate).
 *
 * Polls GET /api/v1/system/map every ~12s and hands the response to
 * SystemMapView, which renders the 3 cloned SVGs with every status colour, badge,
 * and metric BOUND to the live data. An AbortController is created per poll and
 * cleared on unmount; AbortErrors from in-flight polls are ignored.
 */

import { useEffect, useState } from 'react';
import {
    fetchSystemMap,
    type SystemMap,
    type SystemMapErrorKind,
} from '@/lib/api/system-map';
import SystemMapView from './SystemMapView';

const POLL_MS = 12_000;

export default function SystemMapPage() {
    const [data, setData] = useState<SystemMap | null>(null);
    const [error, setError] = useState<SystemMapErrorKind | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const poll = async (signal: AbortSignal) => {
            try {
                const res = await fetchSystemMap(signal);
                if (cancelled) return;
                if (res.ok) {
                    setData(res.data);
                    setError(undefined);
                } else {
                    setError(res.error.kind);
                }
            } catch (err) {
                if ((err as { name?: string })?.name === 'AbortError') return;
                if (!cancelled) setError('network');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        const first = new AbortController();
        void poll(first.signal);

        const id = setInterval(() => {
            const c = new AbortController();
            void poll(c.signal);
        }, POLL_MS);

        return () => {
            cancelled = true;
            first.abort();
            clearInterval(id);
        };
    }, []);

    return <SystemMapView data={data} error={error} loading={loading} />;
}
