'use client';
/**
 * StoresProvider / useStores — bind exactly ONE instance of each
 * framework-agnostic store (Plan 04) to the lifetime of a /grid render tree.
 *
 * Why a provider and not module-level singletons?
 *   - Module-level singletons would survive across Next.js client navigations
 *     and carry stale state when a user returns to /grid after a period away,
 *     which confuses the "fresh on reload" contract in the plan objective.
 *   - Provider-scoped singletons mean ONE WsClient + ONE triple of stores per
 *     page session; a hard refresh resets everything while a re-render
 *     preserves refs (useMemo keeps the triple stable for the life of the
 *     <StoresProvider> mount).
 *
 * Consumers (components landed in Task 2) never create stores themselves —
 * they all read via useStores() or the snapshot-focused hooks in ./hooks.
 *
 * Note: this module stays `.ts` (not `.tsx`) per the plan spec by using
 * `React.createElement` directly; that lets us keep the JSX boundary
 * localised to component files while the provider remains a pure module.
 */

import { createContext, createElement, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { FirehoseStore } from '@/lib/stores/firehose-store';
import { PresenceStore } from '@/lib/stores/presence-store';
import { HeartbeatStore } from '@/lib/stores/heartbeat-store';

export interface Stores {
    readonly firehose: FirehoseStore;
    readonly presence: PresenceStore;
    readonly heartbeat: HeartbeatStore;
}

const StoresContext = createContext<Stores | null>(null);

export function StoresProvider({ children }: { children: ReactNode }): ReactNode {
    // Empty dep array → the triple is frozen for this provider's lifetime.
    // React StrictMode will construct twice in dev, but the provider only
    // commits one of those trees so consumers see a stable triple.
    const stores = useMemo<Stores>(
        () => ({
            firehose: new FirehoseStore(),
            presence: new PresenceStore(),
            heartbeat: new HeartbeatStore(),
        }),
        [],
    );
    return createElement(StoresContext.Provider, { value: stores }, children);
}

export function useStores(): Stores {
    const ctx = useContext(StoresContext);
    if (ctx === null) {
        throw new Error('useStores must be called inside a <StoresProvider>');
    }
    return ctx;
}
