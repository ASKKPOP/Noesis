'use client';
/**
 * GridClient — the client-boundary shell for /grid.
 *
 * Responsibilities:
 *   1. Mount <StoresProvider> ONCE so every panel shares the same triple of
 *      stores (useSyncExternalStore contract; see use-stores.ts for rationale).
 *   2. Create ONE WsClient per page session and wire its 'event' and
 *      'dropped' handlers into the shared stores.
 *   3. On 'dropped' frames, invoke refillFromDropped to paginate the REST
 *      audit trail and batch-ingest the gap, then bump WsClient.lastSeenId
 *      so the server no longer replays events the client already has.
 *   4. Render the three Phase-3 panels (Heartbeat, Firehose, filter chips)
 *      alongside a placeholder for the Plan-6 region map.
 *
 * Lifecycle invariants:
 *   - useEffect([origin, stores]) owns the WsClient — cleanup runs on unmount
 *     and calls client.close() + abort.abort() so StrictMode's double-invoke
 *     in development does not leak a second socket (T-03-19 mitigation).
 *   - The AbortController cancels any in-flight refill fetch when the page
 *     unmounts, preventing late-resolving promises from writing to freed stores.
 *
 * Plan 06 swaps `regionMapPlaceholder` for <RegionMap regions=... connections=.../>.
 * No other wiring should change — all state arrives via useSyncExternalStore.
 */

import { useEffect, useRef } from 'react';
import { StoresProvider, useStores } from './use-stores';
import { WsClient } from '@/lib/transport/ws-client';
import { refillFromDropped } from '@/lib/transport/refill';
import { Firehose } from './components/firehose';
import { Heartbeat } from './components/heartbeat';
import type { Region, RegionConnection } from '@/lib/protocol/region-types';
import type { AuditEntry } from '@/lib/protocol/audit-types';

export interface GridClientProps {
    readonly origin: string;
    readonly initialRegions: {
        readonly regions: readonly Region[];
        readonly connections: readonly RegionConnection[];
    } | null;
    readonly initialError: string | null;
}

export function GridClient(props: GridClientProps): React.ReactElement {
    // StoresProvider must wrap everything that reads from the stores so the
    // useStores() hook in each panel resolves to the SAME triple of stores.
    return (
        <StoresProvider>
            <GridLayout {...props} />
        </StoresProvider>
    );
}

function GridLayout({ origin, initialRegions, initialError }: GridClientProps): React.ReactElement {
    const stores = useStores();
    const wsRef = useRef<WsClient | null>(null);

    useEffect(() => {
        // Derive WS URL by swapping the scheme on the (validated) origin.
        // The Grid exposes /ws/events per Plan 03-03.
        const wsUrl = origin.replace(/^http/, 'ws') + '/ws/events';
        const client = new WsClient({
            url: wsUrl,
            onError: (err) => {
                // Non-fatal — log for developer visibility. Reconnect loop
                // inside WsClient handles transient failures.
                // eslint-disable-next-line no-console
                console.error('[GridClient] WsClient error', err);
            },
        });
        wsRef.current = client;

        const abort = new AbortController();

        /** Batch-apply a set of entries to all three stores in one shot. */
        const ingestAll = (entries: readonly AuditEntry[]): void => {
            if (entries.length === 0) return;
            stores.firehose.ingest(entries);
            stores.presence.applyEvents(entries);
            stores.heartbeat.ingestBatch(entries);
        };

        const offEvent = client.on('event', (entry) => ingestAll([entry]));
        const offDropped = client.on('dropped', (frame) => {
            // Fire-and-forget: refillFromDropped resolves with the collected
            // entries; the onEntries callback inside has already ingested them.
            // We still await it here to bump lastSeenId atomically on success.
            void (async () => {
                try {
                    const entries = await refillFromDropped(
                        frame,
                        origin,
                        ingestAll,
                        abort.signal,
                    );
                    // Advance the WsClient resume pointer past the refilled range
                    // so the server does not replay entries we already have.
                    if (entries.length > 0) {
                        const last = entries[entries.length - 1];
                        if (typeof last.id === 'number') {
                            client.bumpLastSeenId(last.id);
                        }
                    } else if (frame.latestId > 0) {
                        // Empty refill (ring buffer trimmed past our window). Skip
                        // forward to latestId so we do not request the same gap
                        // on the next reconnect.
                        client.bumpLastSeenId(frame.latestId);
                    }
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('[GridClient] refill failed', err);
                }
            })();
        });

        client.connect();

        return () => {
            offEvent();
            offDropped();
            abort.abort();
            client.close();
            wsRef.current = null;
        };
    }, [origin, stores]);

    // Region map placeholder — Plan 06 replaces this block with a real
    // <RegionMap regions={...} connections={...}/> component reading presence
    // from the same PresenceStore that firehose already populates.
    const regionMapPlaceholder = (
        <section
            aria-label="Region map"
            data-testid="region-map-placeholder"
            className="flex items-center justify-center border border-neutral-800 rounded-md bg-[#17181C] text-neutral-600 text-sm min-h-[320px]"
        >
            <div className="text-center space-y-1">
                <div className="font-medium text-neutral-400">Region Map</div>
                <div className="text-xs">Coming in Plan 06</div>
                {initialRegions && (
                    <div className="text-[10px] text-neutral-600 font-mono">
                        {initialRegions.regions.length} regions · {initialRegions.connections.length} connections loaded
                    </div>
                )}
            </div>
        </section>
    );

    return (
        <main className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4 bg-[#0A0A0B]">
            <header className="col-span-full flex items-baseline gap-3 mb-1">
                <h1 className="text-[22px] font-semibold text-neutral-100 tracking-tight">
                    Noēsis
                </h1>
                <span className="font-mono text-sm text-neutral-500">/ grid</span>
            </header>
            {initialError && (
                <div
                    role="alert"
                    className="col-span-full text-sm text-amber-300 bg-neutral-900 border border-amber-900/60 rounded-md px-3 py-2"
                >
                    Initial regions fetch failed: {initialError}. Reconnect in progress…
                </div>
            )}
            <div className="flex flex-col gap-4 min-h-0">
                {regionMapPlaceholder}
                <div className="flex-1 min-h-[320px]">
                    <Firehose />
                </div>
            </div>
            <aside className="flex flex-col gap-4">
                <Heartbeat />
            </aside>
        </main>
    );
}
