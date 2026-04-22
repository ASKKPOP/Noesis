'use client';
/**
 * useTick — returns the current grid tick number, or 0 before the first
 * tick is observed. Derived from the HeartbeatStore in the nearest
 * <StoresProvider> context.
 *
 * Used by useRelationshipsH1/H2/useGraph hooks to build the 100-tick
 * batching window key (D-9-13, T-09-11 mitigation). The hook is
 * intentionally thin so tests can vi.mock('@/lib/stores/tick-store')
 * and control the returned tick value directly without needing a full
 * StoresProvider.
 *
 * Call sites MUST NOT couple this hook to wall-clock time — the tick
 * is the replay-rig's unit of time, not Date.now().
 */

import { useSyncExternalStore } from 'react';
import { useStores } from '@/app/grid/use-stores';

/**
 * Returns the current grid tick (0 before first observation).
 * Mocked in unit tests via vi.mock('@/lib/stores/tick-store').
 */
export function useTick(): number {
    const { heartbeat } = useStores();
    const snap = useSyncExternalStore(
        heartbeat.subscribe.bind(heartbeat),
        heartbeat.getSnapshot.bind(heartbeat),
        heartbeat.getSnapshot.bind(heartbeat),
    );
    return snap.lastTick ?? 0;
}
