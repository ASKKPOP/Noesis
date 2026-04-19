import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHashSync } from './use-hash-sync';
import { SelectionStore } from '@/lib/stores/selection-store';

/**
 * Plan 04-04 Task 2 — useHashSync tests.
 *
 * Contract:
 *   - On mount, parse `window.location.hash`; valid `#nous=<did>` → push to store.
 *   - On store change, replace the URL hash via history.replaceState (no
 *     history stack entry per trade-off T-04-18).
 *   - On external hashchange, parse again and push to store — unless the hash
 *     we just wrote matches `lastWritten`, in which case skip (loop breaker,
 *     T-04-19 mitigation).
 *   - Invalid hashes are treated as null silently — no throw, no UI error.
 *   - SSR-safe: no window access at module scope; all in useEffect.
 */

function setHash(hash: string): void {
    // jsdom allows direct assignment to window.location.hash. We avoid
    // location.assign here because it would push a history entry, which
    // would break subsequent tests that assume a clean slate.
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
}

beforeEach(() => {
    // Reset URL to a clean slate before each test.
    window.history.replaceState(null, '', '/');
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useHashSync', () => {
    it('reads an initial #nous=<did> hash and pushes a valid DID into the store', () => {
        setHash('#nous=did:noesis:sophia');
        const store = new SelectionStore();
        renderHook(() => useHashSync(store));
        expect(store.getSnapshot()).toBe('did:noesis:sophia');
    });

    it('writes the URL hash via history.replaceState when the store selection changes', () => {
        const store = new SelectionStore();
        const spy = vi.spyOn(window.history, 'replaceState');
        renderHook(() => useHashSync(store));

        act(() => {
            store.selectNous('did:noesis:hermes');
        });

        expect(spy).toHaveBeenCalled();
        // Verify the actual URL hash after the last replaceState call
        expect(window.location.hash).toBe('#nous=did%3Anoesis%3Ahermes');
    });

    it('reacts to external hashchange events and pushes the new DID into the store', () => {
        const store = new SelectionStore();
        renderHook(() => useHashSync(store));

        act(() => {
            setHash('#nous=did:noesis:themis');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });

        expect(store.getSnapshot()).toBe('did:noesis:themis');
    });

    it('does NOT recursively re-call selectNous when the store-driven URL write fires its own hashchange (loop breaker)', () => {
        const store = new SelectionStore();
        const listenerFires = vi.fn();
        store.subscribe(listenerFires);

        renderHook(() => useHashSync(store));

        act(() => {
            store.selectNous('did:noesis:sophia');
            // Simulate the browser firing hashchange as a result of our own
            // replaceState (jsdom does NOT fire it automatically; we dispatch
            // manually to exercise the loop-breaker path).
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });

        // Exactly ONE listener fire: the explicit selectNous. The hashchange
        // handler compared window.location.hash to lastWritten and bailed.
        expect(listenerFires).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toBe('did:noesis:sophia');
    });

    it('treats an invalid #nous=<junk> hash on mount as no-op (store stays null, no throw)', () => {
        setHash('#nous=<script>alert(1)</script>');
        const store = new SelectionStore();
        expect(() => renderHook(() => useHashSync(store))).not.toThrow();
        expect(store.getSnapshot()).toBeNull();
    });

    it('clears the URL hash when selection becomes null', () => {
        setHash('#nous=did:noesis:sophia');
        const store = new SelectionStore();
        renderHook(() => useHashSync(store));
        expect(window.location.hash).toBe('#nous=did:noesis:sophia');

        act(() => {
            store.clear();
        });

        expect(window.location.hash).toBe('');
    });
});
