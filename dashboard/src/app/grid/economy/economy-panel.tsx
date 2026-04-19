'use client';
/**
 * EconomyPanel — Tab-2 container that hydrates three sub-panels on mount
 * and invalidates roster + trades (NOT shops) on each new `trade.settled`
 * firehose event. Shops are launcher-registered and don't change on trade
 * settlement; re-fetching them on every settlement would be wasted bytes.
 *
 * Firehose dedup strategy: a `lastTradeId` ref tracks the last event id we
 * acted on. Each store-change effect scans the snapshot for the newest
 * `trade.settled` entry; if its id matches `lastTradeId`, we no-op. This
 * prevents a refetch storm when multiple subscribers replay the buffer
 * (T-04-27 mitigation).
 *
 * Per-section error isolation: the three fetches run in parallel but each
 * writes to its own Slot state. A roster failure does not blank trades
 * or shops — every section renders its own EmptyState copy.
 *
 * AbortController lifecycle: one controller per load pass (initial mount
 * + each trade.settled invalidation). Cleanup fires controller.abort() so
 * late-resolving promises cannot setState into an unmounted tree.
 *
 * Primitives: `@/components/primitives` (Plan 04-04).
 */

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import {
    fetchRoster,
    fetchTrades,
    fetchShops,
    type RosterResponse,
    type TradesResponse,
    type ShopsResponse,
} from '@/lib/api/economy';
import { EmptyState } from '@/components/primitives';
import { useStores } from '../use-stores';
import { BalancesTable } from './balances-table';
import { TradesTable } from './trades-table';
import { ShopsList } from './shops-list';

type Slot<T> =
    | { state: 'loading' }
    | { state: 'ready'; data: T }
    | { state: 'error' };

const LOADING: Slot<never> = { state: 'loading' };

function resolveOrigin(): string {
    const fromEnv = process.env.NEXT_PUBLIC_GRID_ORIGIN;
    return fromEnv && fromEnv.length > 0 ? fromEnv : 'http://localhost:8080';
}

export function EconomyPanel(): React.ReactElement {
    const stores = useStores();
    const origin = useMemo(resolveOrigin, []);
    const firehose = stores.firehose;
    const snapshot = useSyncExternalStore(
        firehose.subscribe.bind(firehose),
        firehose.getSnapshot.bind(firehose),
        firehose.getSnapshot.bind(firehose),
    );

    const [roster, setRoster] = useState<Slot<RosterResponse>>(LOADING);
    const [trades, setTrades] = useState<Slot<TradesResponse>>(LOADING);
    const [shops, setShops] = useState<Slot<ShopsResponse>>(LOADING);

    // Dedup anchor for trade.settled-driven invalidations.
    const lastTradeId = useRef<number | null>(null);

    // Initial mount: parallel fetch all three endpoints. Shops do NOT get
    // re-fetched on trade.settled — they're launcher-registered.
    useEffect(() => {
        const ac = new AbortController();
        void (async () => {
            const [r, t, s] = await Promise.all([
                fetchRoster(origin, ac.signal).catch(() => null),
                fetchTrades(origin, ac.signal).catch(() => null),
                fetchShops(origin, ac.signal).catch(() => null),
            ]);
            if (ac.signal.aborted) return;
            setRoster(
                r && r.ok
                    ? { state: 'ready', data: r.data }
                    : { state: 'error' },
            );
            setTrades(
                t && t.ok
                    ? { state: 'ready', data: t.data }
                    : { state: 'error' },
            );
            setShops(
                s && s.ok
                    ? { state: 'ready', data: s.data }
                    : { state: 'error' },
            );
        })();
        return () => ac.abort();
    }, [origin]);

    // Firehose-driven invalidation: on each store change, look for the
    // newest `trade.settled` entry. If its id differs from lastTradeId,
    // bump the ref and re-fetch roster + trades (NOT shops).
    useEffect(() => {
        const entries = snapshot.entries;
        // Scan from end (newest-first in the ring buffer's natural order).
        let latest: number | null = null;
        for (let i = entries.length - 1; i >= 0; i -= 1) {
            const e = entries[i]!;
            if (e.eventType === 'trade.settled' && typeof e.id === 'number') {
                latest = e.id;
                break;
            }
        }
        if (latest === null || latest === lastTradeId.current) return;
        lastTradeId.current = latest;

        const ac = new AbortController();
        void (async () => {
            const [r, t] = await Promise.all([
                fetchRoster(origin, ac.signal).catch(() => null),
                fetchTrades(origin, ac.signal).catch(() => null),
            ]);
            if (ac.signal.aborted) return;
            setRoster(
                r && r.ok
                    ? { state: 'ready', data: r.data }
                    : { state: 'error' },
            );
            setTrades(
                t && t.ok
                    ? { state: 'ready', data: t.data }
                    : { state: 'error' },
            );
        })();
        return () => ac.abort();
    }, [snapshot, origin]);

    const rosterEntries = roster.state === 'ready' ? roster.data.nous : [];

    return (
        <div
            data-testid="economy-panel"
            className="flex flex-col gap-3"
            aria-labelledby="economy-heading"
        >
            <h2
                id="economy-heading"
                className="text-sm font-semibold text-neutral-100"
            >
                Economy
            </h2>

            <section aria-label="Balances">
                {roster.state === 'loading' ? (
                    <div
                        data-testid="balances-loading"
                        className="text-xs text-neutral-500"
                    >
                        Loading roster…
                    </div>
                ) : roster.state === 'error' ? (
                    <EmptyState
                        title="Could not load roster."
                        description="Check the Grid is reachable at the configured origin."
                        testId="balances-error"
                    />
                ) : (
                    <BalancesTable roster={roster.data.nous} />
                )}
            </section>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <section aria-label="Shops">
                    {shops.state === 'loading' ? (
                        <div
                            data-testid="shops-loading"
                            className="text-xs text-neutral-500"
                        >
                            Loading shops…
                        </div>
                    ) : shops.state === 'error' ? (
                        <EmptyState
                            title="Could not load shops."
                            description="The launcher registry is unreachable."
                            testId="shops-error"
                        />
                    ) : (
                        <ShopsList
                            shops={shops.data.shops}
                            roster={rosterEntries}
                        />
                    )}
                </section>

                <section aria-label="Recent Trades">
                    {trades.state === 'loading' ? (
                        <div
                            data-testid="trades-loading"
                            className="text-xs text-neutral-500"
                        >
                            Loading trades…
                        </div>
                    ) : trades.state === 'error' ? (
                        <EmptyState
                            title="Could not load trades."
                            description="The Grid /economy/trades endpoint did not respond."
                            testId="trades-error"
                        />
                    ) : (
                        <TradesTable
                            trades={trades.data.trades}
                            roster={rosterEntries}
                        />
                    )}
                </section>
            </div>
        </div>
    );
}
