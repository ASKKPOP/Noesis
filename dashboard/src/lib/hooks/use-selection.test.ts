import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSelection } from './use-selection';
import { SelectionStore } from '@/lib/stores/selection-store';

/**
 * Plan 04-04 Task 1 — useSelection hook tests.
 *
 * The hook is a thin useSyncExternalStore wrapper. Tests confirm it re-renders
 * on store changes, exposes a clear() helper that nulls selection, and
 * coerces invalid DIDs to null.
 */

describe('useSelection', () => {
    it('returns null initially and updates when the underlying store changes', () => {
        const store = new SelectionStore();
        const { result } = renderHook(() => useSelection(store));
        expect(result.current.selectedDid).toBeNull();

        act(() => {
            result.current.select('did:noesis:sophia');
        });
        expect(result.current.selectedDid).toBe('did:noesis:sophia');
    });

    it('clear() returns the store to null', () => {
        const store = new SelectionStore();
        const { result } = renderHook(() => useSelection(store));
        act(() => {
            result.current.select('did:noesis:hermes');
        });
        expect(result.current.selectedDid).toBe('did:noesis:hermes');

        act(() => {
            result.current.clear();
        });
        expect(result.current.selectedDid).toBeNull();
    });

    it('select() with an invalid DID falls through to null', () => {
        const store = new SelectionStore();
        const { result } = renderHook(() => useSelection(store));
        act(() => {
            result.current.select('not-a-did');
        });
        expect(result.current.selectedDid).toBeNull();
    });
});
