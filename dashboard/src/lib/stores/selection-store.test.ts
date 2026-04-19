import { describe, it, expect, vi } from 'vitest';
import { SelectionStore, selectionStore, DID_REGEX } from './selection-store';

/**
 * Plan 04-04 Task 1 — SelectionStore tests.
 *
 * Contract (matches useSyncExternalStore):
 *   - subscribe(listener) adds to an internal Set and returns an unsubscribe fn
 *   - getSnapshot() returns the current `string | null` — stable reference when
 *     nothing has changed
 *   - selectNous(did) normalises via DID_REGEX; invalid input falls through to
 *     null (NEVER throws); same-value updates do NOT notify listeners
 *   - clear() is sugar for selectNous(null)
 */

describe('SelectionStore — subscribe/unsubscribe', () => {
    it('registers a listener and returns an unsubscribe function that removes it', () => {
        const store = new SelectionStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        store.selectNous('did:noesis:sophia');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        store.selectNous('did:noesis:hermes');
        expect(listener).toHaveBeenCalledTimes(1); // no more fires after unsubscribe
    });
});

describe('SelectionStore — null selection', () => {
    it('starts at null', () => {
        const store = new SelectionStore();
        expect(store.getSnapshot()).toBeNull();
    });

    it('selectNous(null) from the null state is a no-op (listener not called)', () => {
        const store = new SelectionStore();
        const listener = vi.fn();
        store.subscribe(listener);
        store.selectNous(null);
        expect(listener).not.toHaveBeenCalled();
        expect(store.getSnapshot()).toBeNull();
    });
});

describe('SelectionStore — valid DID selection', () => {
    it('stores a valid DID verbatim and notifies listeners', () => {
        const store = new SelectionStore();
        const listener = vi.fn();
        store.subscribe(listener);
        store.selectNous('did:noesis:sophia');
        expect(store.getSnapshot()).toBe('did:noesis:sophia');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('accepts DIDs with digits, underscores and hyphens', () => {
        const store = new SelectionStore();
        store.selectNous('did:noesis:nous_01-beta');
        expect(store.getSnapshot()).toBe('did:noesis:nous_01-beta');
    });

    it('accepts uppercase (DID_REGEX is case-insensitive)', () => {
        const store = new SelectionStore();
        store.selectNous('did:noesis:SOPHIA');
        expect(store.getSnapshot()).toBe('did:noesis:SOPHIA');
    });
});

describe('SelectionStore — invalid DID falls through to null', () => {
    it('does not throw on garbage input; treats it as null', () => {
        const store = new SelectionStore();
        expect(() => store.selectNous('garbage')).not.toThrow();
        expect(store.getSnapshot()).toBeNull();
    });

    it('rejects did: prefix with wrong method and stays null', () => {
        const store = new SelectionStore();
        store.selectNous('did:other:sophia');
        expect(store.getSnapshot()).toBeNull();
    });

    it('rejects XSS-looking strings and stays null', () => {
        const store = new SelectionStore();
        store.selectNous('<script>alert(1)</script>');
        expect(store.getSnapshot()).toBeNull();
    });

    it('clears a previously-selected DID when given invalid input', () => {
        const store = new SelectionStore();
        const listener = vi.fn();
        store.selectNous('did:noesis:sophia');
        store.subscribe(listener);
        store.selectNous('not-a-did');
        expect(store.getSnapshot()).toBeNull();
        expect(listener).toHaveBeenCalledTimes(1); // sophia → null is a real change
    });
});

describe('SelectionStore — no-op on same DID', () => {
    it('does not notify when selecting the same DID twice', () => {
        const store = new SelectionStore();
        store.selectNous('did:noesis:sophia');
        const listener = vi.fn();
        store.subscribe(listener);
        store.selectNous('did:noesis:sophia');
        expect(listener).not.toHaveBeenCalled();
    });

    it('getSnapshot returns a stable reference across no-op calls', () => {
        const store = new SelectionStore();
        store.selectNous('did:noesis:sophia');
        const s1 = store.getSnapshot();
        store.selectNous('did:noesis:sophia');
        const s2 = store.getSnapshot();
        expect(s1).toBe(s2);
    });
});

describe('SelectionStore — clear()', () => {
    it('is sugar for selectNous(null)', () => {
        const store = new SelectionStore();
        const listener = vi.fn();
        store.selectNous('did:noesis:sophia');
        store.subscribe(listener);
        store.clear();
        expect(store.getSnapshot()).toBeNull();
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('SelectionStore — singleton export', () => {
    it('exports a ready-to-use default selectionStore instance', () => {
        expect(selectionStore).toBeInstanceOf(SelectionStore);
    });
});

describe('DID_REGEX', () => {
    it('is case-insensitive and exported for consumers that need to lint hash values', () => {
        expect(DID_REGEX.test('did:noesis:sophia')).toBe(true);
        expect(DID_REGEX.test('DID:NOESIS:Sophia')).toBe(true);
        expect(DID_REGEX.test('garbage')).toBe(false);
        expect(DID_REGEX.test('')).toBe(false);
    });
});
