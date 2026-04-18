'use client';
/**
 * Snapshot-focused hooks for the /grid render tree.
 *
 *   useFirehose()  → FirehoseSnapshot via useSyncExternalStore
 *   usePresence()  → PresenceSnapshot via useSyncExternalStore
 *   useHeartbeat() → DerivedHeartbeat refreshed on each internal 1s tick
 *
 * useSyncExternalStore is the canonical React 18+ binding for external
 * stores — it subscribes on mount, unsubscribes on unmount, and compares
 * snapshot refs with Object.is so our `Object.freeze` snapshots never cause
 * tearing or infinite re-renders.
 *
 * useHeartbeat is a special case: the "seconds since last event" display
 * depends on wall-clock time, not on ingest. We therefore pair the store
 * subscription with a local nowMs state advanced by a setInterval. React
 * coalesces the two updates naturally; the polling interval defaults to
 * 1000ms to match the UI-SPEC cadence.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FirehoseSnapshot } from '@/lib/stores/firehose-store';
import type { PresenceSnapshot } from '@/lib/stores/presence-store';
import type { DerivedHeartbeat } from '@/lib/stores/heartbeat-store';
import { useStores } from './use-stores';

export function useFirehose(): FirehoseSnapshot {
    const { firehose } = useStores();
    return useSyncExternalStore(
        firehose.subscribe.bind(firehose),
        firehose.getSnapshot.bind(firehose),
        firehose.getSnapshot.bind(firehose),
    );
}

export function usePresence(): PresenceSnapshot {
    const { presence } = useStores();
    return useSyncExternalStore(
        presence.subscribe.bind(presence),
        presence.getSnapshot.bind(presence),
        presence.getSnapshot.bind(presence),
    );
}

/**
 * Derived heartbeat view. The store itself is event-driven; this hook adds a
 * 1s (default) poll of Date.now() so the "N seconds ago" counter keeps
 * climbing between ingest frames.
 */
export function useHeartbeat(pollIntervalMs = 1000): DerivedHeartbeat {
    const { heartbeat } = useStores();

    // Re-render on ingest.
    useSyncExternalStore(
        heartbeat.subscribe.bind(heartbeat),
        heartbeat.getSnapshot.bind(heartbeat),
        heartbeat.getSnapshot.bind(heartbeat),
    );

    // Re-render once per pollIntervalMs so deriveStatus sees a fresh nowMs.
    const [nowMs, setNowMs] = useState<number>(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), pollIntervalMs);
        return () => clearInterval(id);
    }, [pollIntervalMs]);

    return heartbeat.deriveStatus(nowMs);
}
