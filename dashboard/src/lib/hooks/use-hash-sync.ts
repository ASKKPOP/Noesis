'use client';
/**
 * useHashSync — two-way binding between `window.location.hash` (`#nous=<did>`)
 * and a SelectionStore.
 *
 * Lifecycle:
 *   1. On mount: parse the initial hash; if it's a valid DID, push it into the store.
 *   2. Subscribe to the store. On each change, compute the desired hash; if it
 *      differs from the current `window.location.hash`, call
 *      `replaceState` to write it. Record the value we wrote in a ref
 *      (`lastWritten`) so step 3 can skip its own echo.
 *   3. Listen for `hashchange` events. When one arrives, compare
 *      `window.location.hash` to `lastWritten`; if they match, bail (this is
 *      our own write bouncing back). Otherwise, parse and push to store.
 *
 * Invariants:
 *   - DoS-safe: `lastWritten` guard breaks the potential
 *     store→replaceState→hashchange→store loop (T-04-19 mitigation).
 *   - SSR-safe: every `window` / `history` touch is inside useEffect.
 *   - Security: the store itself applies DID_REGEX — invalid hashes normalise
 *     to null silently (T-04-17 mitigation).
 *   - No debouncing (user action is rare per CONTEXT D12).
 */

import { useEffect, useRef } from 'react';
import { SelectionStore, selectionStore } from '@/lib/stores/selection-store';

const NOUS_HASH_RE = /^#nous=(.+)$/;

function parseHash(hash: string): string | null {
    const m = NOUS_HASH_RE.exec(hash);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        // Malformed percent-encoding — treat as no selection rather than crash.
        return null;
    }
}

function buildHash(did: string | null): string {
    return did ? `#nous=${encodeURIComponent(did)}` : '';
}

export function useHashSync(store: SelectionStore = selectionStore): void {
    const lastWritten = useRef<string>('');

    useEffect(() => {
        // 1. Initial read — only push if the hash parses to a valid DID. The
        //    store itself re-validates via DID_REGEX, so attacker-controlled
        //    strings cannot sneak past here.
        const initial = parseHash(window.location.hash);
        if (initial !== null) store.selectNous(initial);

        // 2. Subscribe: store change → URL write.
        const unsubscribe = store.subscribe(() => {
            const next = buildHash(store.getSnapshot());
            if (window.location.hash === next) return;
            lastWritten.current = next;
            const url = `${window.location.pathname}${window.location.search}${next}`;
            window.history.replaceState(null, '', url);
        });

        // 3. External hashchange → store write (unless it's our own echo).
        const onHashChange = (): void => {
            if (window.location.hash === lastWritten.current) return;
            const did = parseHash(window.location.hash);
            // Pushing null when the hash is cleared is correct — the store
            // will no-op if selection was already null.
            store.selectNous(did);
        };
        window.addEventListener('hashchange', onHashChange);

        return () => {
            unsubscribe();
            window.removeEventListener('hashchange', onHashChange);
        };
    }, [store]);
}
