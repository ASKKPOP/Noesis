'use client';
/**
 * ReplayStoresProvider — replay-scoped FirehoseStore + PresenceStore.
 *
 * Phase 13 (REPLAY-05 / D-13-03 / gap-closure 13-07).
 *
 * The /grid/replay subtree mounts the standard Firehose, Inspector, and RegionMap
 * components with replayMode={true}. Those components call useStores() (via
 * useFirehose() / usePresence()) — without this provider, they would read from
 * the LIVE stores mounted at /grid root, defeating the point of replay.
 *
 * This provider:
 *   1. Constructs new FirehoseStore() and new PresenceStore() ONCE per mount
 *      (useRef lazy-init so re-renders don't reseed and erase scrubber-derived
 *      deltas).
 *   2. Reads the outer stores via useStores() to inherit heartbeat + selection
 *      (we override only firehose + presence — the two stores whose data must
 *      be replay-scoped).
 *   3. Seeds firehose + presence ONCE from `entries` in a useEffect (no
 *      Date.now / setInterval — D-13-04 wall-clock gate).
 *   4. Mounts <StoresContext.Provider> with the merged value so the subtree
 *      sees a different `useStores()` value than the parent /grid tree.
 *
 * NOT included: Heartbeat polling component (would require Date.now — banned
 * in /grid/replay). The HeartbeatStore instance is passed through from the
 * outer context but no Heartbeat <component> mounts inside this subtree.
 */

import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { FirehoseStore } from '@/lib/stores/firehose-store';
import { PresenceStore } from '@/lib/stores/presence-store';
import { StoresContext, useStores } from '../use-stores';
import type { AuditEntry } from '@/lib/protocol/audit-types';

export interface ReplayStoresProviderProps {
    readonly entries: readonly AuditEntry[];
    readonly children: ReactNode;
}

export function ReplayStoresProvider({ entries, children }: ReplayStoresProviderProps): ReactNode {
    // Read the outer stores so we inherit heartbeat + selection. The parent
    // /grid tree's StoresProvider mounts higher up; useStores() throws if no
    // ancestor exists. ReplayClient is mounted under /grid/replay which
    // inherits /grid's StoresProvider, so this contract holds.
    const outer = useStores();

    // useRef lazy-init: store instances are mutable and have their own
    // subscriber protocol — React must not treat them as reactive.
    const firehoseRef = useRef<FirehoseStore | null>(null);
    const presenceRef = useRef<PresenceStore | null>(null);
    if (firehoseRef.current === null) firehoseRef.current = new FirehoseStore();
    if (presenceRef.current === null) presenceRef.current = new PresenceStore();
    const firehose = firehoseRef.current;
    const presence = presenceRef.current;

    // Seed ONCE on mount; reseed if entries identity changes (idempotent —
    // FirehoseStore.ingest dedupes by synthetic id; PresenceStore.applyEvents
    // is order-stable).
    useEffect(() => {
        firehose.ingest(entries);
        presence.applyEvents(entries);
    }, [entries, firehose, presence]);

    // Spread outer first, then override firehose + presence. heartbeat +
    // selection pass through unchanged.
    const value = { ...outer, firehose, presence };

    // createElement keeps this file JSX-free at the JSX boundary level so the
    // .tsx extension is for type imports, not for rendering JSX. Either form
    // (createElement OR JSX) is fine; createElement matches use-stores.ts style.
    return createElement(StoresContext.Provider, { value }, children);
}
