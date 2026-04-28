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
 *   2. Seeds both stores SYNCHRONOUSLY on first creation (during the render
 *      phase, not in useEffect) so the first render sees the replay data.
 *      Re-seeds when the entries reference changes (idempotent via dedup).
 *   3. Reads the outer stores via useStores() to inherit heartbeat + selection
 *      (we override only firehose + presence — the two stores whose data must
 *      be replay-scoped).
 *   4. Mounts <StoresContext.Provider> with the merged value so the subtree
 *      sees a different `useStores()` value than the parent /grid tree.
 *
 * Wall-clock gate (D-13-04): no setInterval / setTimeout / Date.now / Math.random.
 * Pure store manipulation in render is side-effect-free from React's perspective
 * because stores are mutable + have their own subscriber protocol outside React's
 * state model. Reads during render are idempotent (dedup in FirehoseStore).
 *
 * NOT included: Heartbeat polling component (would require Date.now — banned
 * in /grid/replay). The HeartbeatStore instance is passed through from the
 * outer context but no Heartbeat <component> mounts inside this subtree.
 */

import { createElement, useRef, type ReactNode } from 'react';
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
    // Track the last seeded entries reference to detect when re-seeding is needed.
    const seededEntriesRef = useRef<readonly AuditEntry[] | null>(null);

    if (firehoseRef.current === null) firehoseRef.current = new FirehoseStore();
    if (presenceRef.current === null) presenceRef.current = new PresenceStore();
    const firehose = firehoseRef.current;
    const presence = presenceRef.current;

    // Seed synchronously during render so the FIRST render sees replay data.
    // FirehoseStore.ingest dedupes by id — re-seeding with the same entries
    // is safe (no duplicates in the ring buffer). PresenceStore.applyEvents
    // tracks appliedIds — same safety guarantee.
    // We only re-seed when the entries reference changes, avoiding unnecessary work.
    if (seededEntriesRef.current !== entries) {
        firehose.ingest(entries);
        presence.applyEvents(entries);
        seededEntriesRef.current = entries;
    }

    // Spread outer first, then override firehose + presence. heartbeat +
    // selection pass through unchanged.
    const value = { ...outer, firehose, presence };

    // createElement keeps this file JSX-free at the JSX boundary level so the
    // .tsx extension is for type imports, not for rendering JSX. Either form
    // (createElement OR JSX) is fine; createElement matches use-stores.ts style.
    return createElement(StoresContext.Provider, { value }, children);
}
