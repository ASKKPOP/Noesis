'use client';
/**
 * useSelection — thin useSyncExternalStore wrapper over SelectionStore.
 *
 * Returns `{ selectedDid, select, clear }` where:
 *   - selectedDid: the current `string | null` snapshot
 *   - select(did): forwards to `store.selectNous(did)`; invalid DIDs
 *     fall through to null inside the store (never throws)
 *   - clear(): sugar for `select(null)`
 *
 * The hook accepts an optional custom store for tests and parallel trees;
 * the default is the module-level `selectionStore` singleton.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { SelectionStore, selectionStore } from '@/lib/stores/selection-store';

export interface UseSelectionResult {
    readonly selectedDid: string | null;
    readonly select: (did: string | null) => void;
    readonly clear: () => void;
}

export function useSelection(store: SelectionStore = selectionStore): UseSelectionResult {
    const selectedDid = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getSnapshot,
    );
    const select = useCallback((did: string | null) => store.selectNous(did), [store]);
    const clear = useCallback(() => store.clear(), [store]);
    return { selectedDid, select, clear };
}
