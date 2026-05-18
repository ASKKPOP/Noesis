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
import { useContext } from 'react';
import { StoresContext } from '@/app/grid/use-stores';
import { HeartbeatStore } from '@/lib/stores/heartbeat-store';

// Fallback store used when no StoresProvider is present (SSR prerender path).
// Returns tick=0, subscribe is a no-op so React never re-renders from it.
const _fallback = new HeartbeatStore();

/**
 * Returns the current grid tick (0 before first observation, 0 during SSR).
 * Safe to call outside <StoresProvider> — falls back to tick=0 without throwing.
 * Mocked in unit tests via vi.mock('@/lib/stores/tick-store').
 */
export function useTick(): number {
    const ctx = useContext(StoresContext);
    const heartbeat = ctx?.heartbeat ?? _fallback;
    const snap = useSyncExternalStore(
        heartbeat.subscribe.bind(heartbeat),
        heartbeat.getSnapshot.bind(heartbeat),
        heartbeat.getSnapshot.bind(heartbeat),
    );
    return snap.lastTick ?? 0;
}
