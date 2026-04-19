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
 *   4. Render the four Phase-3 panels (RegionMap, Firehose, Heartbeat,
 *      filter chips) — all subscribed to the shared stores.
 *
 * Lifecycle invariants:
 *   - useEffect([origin, stores]) owns the WsClient — cleanup runs on unmount
 *     and calls client.close() + abort.abort() so StrictMode's double-invoke
 *     in development does not leak a second socket (T-03-19 mitigation).
 *   - The AbortController cancels any in-flight refill fetch when the page
 *     unmounts, preventing late-resolving promises from writing to freed stores.
 *   - ingestAll wraps PresenceStore.applyEvents in flushSync so the region
 *     map marker commits in the same React cycle as the nous.moved frame
 *     arrives (SC-5 / MAP-03). Firehose + heartbeat updates stay batched.
 */

import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { StoresProvider, useStores } from './use-stores';
import { WsClient } from '@/lib/transport/ws-client';
import { refillFromDropped } from '@/lib/transport/refill';
import { Firehose } from './components/firehose';
import { Heartbeat } from './components/heartbeat';
import { RegionMap } from './components/region-map';
import { Inspector } from './components/inspector';
import { TabBar } from './components/tab-bar';
import { EconomyPanel } from './economy/economy-panel';
import { useHashSync } from '@/lib/hooks/use-hash-sync';
import type { Region, RegionConnection } from '@/lib/protocol/region-types';
import type { AuditEntry } from '@/lib/protocol/audit-types';

/**
 * HashSyncMount — mounts useHashSync() exactly once inside the client tree
 * so that `#nous=<did>` ↔ SelectionStore stays bound without every consumer
 * having to remember to call the hook. Returns null so it has no visual
 * footprint; placement is above the first panel but inside <StoresProvider/>
 * so the hook's default store (the singleton) matches the one threaded
 * through context.
 */
function HashSyncMount(): null {
    useHashSync();
    return null;
}

export interface GridClientProps {
    readonly origin: string;
    readonly initialRegions: {
        readonly regions: readonly Region[];
        readonly connections: readonly RegionConnection[];
    } | null;
    readonly initialError: string | null;
}

export function GridClient(props: GridClientProps): React.ReactElement {
    // StoresProvider threads firehose / presence / heartbeat / selection to
    // every consumer. Plan 04-04 extended `Stores` with `selection:
    // SelectionStore` (see use-stores.ts) — the singleton lives there; this
    // file only mounts <HashSyncMount/> once so `#nous=<did>` stays in sync.
    return (
        <StoresProvider>
            <HashSyncMount />
            <GridLayout {...props} />
            {/* Plan 04-05: Inspector mounts once at the client-tree root so any
                surface that selects a DID via SelectionStore can open it. The
                drawer self-positions (fixed right-0) and renders null when no
                DID is selected — zero cost when inactive. */}
            <Inspector />
        </StoresProvider>
    );
}

function GridLayout({ origin, initialRegions, initialError }: GridClientProps): React.ReactElement {
    const stores = useStores();
    const wsRef = useRef<WsClient | null>(null);
    // Plan 04-06: `?tab=economy` gates the Economy panel; anything else (or
    // absent) leaves the inherited Phase-3 firehose + map layout active.
    const searchParams = useSearchParams();
    const activeTab = searchParams.get('tab') === 'economy' ? 'economy' : 'firehose';

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
            // flushSync so the Nous marker position commits in the same render
            // cycle as the nous.moved frame arrives (SC-5 + MAP-03). React 19
            // batches by default across async boundaries; flushSync is the
            // explicit escape hatch for this synchronous-UX guarantee.
            // Firehose + heartbeat updates stay OUTSIDE the flushSync so React
            // can batch them normally — only presence needs one-render-cycle
            // consistency.
            flushSync(() => {
                stores.presence.applyEvents(entries);
            });
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

    // Plan 06: the Plan-05 placeholder is replaced by <RegionMap/>. The
    // component reads presence from the same PresenceStore that the firehose
    // already populates; no separate props plumbing is needed.
    //
    // Plan 04-06: TabBar sits under the page header and gates the primary
    // content area. The Firehose/Map layout and Economy panel mount/unmount
    // based on the `?tab=` querystring. The Heartbeat aside renders in both
    // tabs — it's a global signal, not tab-scoped.
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
                <TabBar />
                {activeTab === 'economy' ? (
                    <div className="flex-1 min-h-[320px]">
                        <EconomyPanel />
                    </div>
                ) : (
                    <>
                        <section
                            aria-label="Region map"
                            className="flex-1 min-h-[320px]"
                        >
                            <RegionMap
                                regions={initialRegions?.regions ?? []}
                                connections={initialRegions?.connections ?? []}
                            />
                        </section>
                        <div className="flex-1 min-h-[320px]">
                            <Firehose />
                        </div>
                    </>
                )}
            </div>
            <aside className="flex flex-col gap-4">
                <Heartbeat />
            </aside>
        </main>
    );
}
