/**
 * FirehoseStore — the rolling last-500 audit entry buffer for the dashboard
 * firehose panel. Implements the useSyncExternalStore contract
 * (subscribe/getSnapshot) so React components can subscribe without owning
 * any ingest logic.
 *
 * Invariants:
 *   - Capacity: at most 500 entries at any time (drop-oldest eviction).
 *   - Dedupe: an incoming entry with an id already present is discarded.
 *     Entries with id === undefined are assigned a monotonic synthetic id
 *     (negative integers, so they never collide with server ids which are
 *     positive) so the same object reference ingested twice is deduped.
 *   - Snapshot stability: getSnapshot returns the SAME object reference
 *     across consecutive calls when no ingest/setFilter/clear happened in
 *     between. This is required by useSyncExternalStore to avoid tearing.
 *   - Filter view: a Set<EventCategory> or null. null means show all; empty
 *     set means show none; otherwise show entries whose category is in the
 *     set. The filter does NOT mutate the ring buffer — only the derived
 *     filteredEntries array.
 *   - Framework-agnostic: NO React import. Store is pure TypeScript.
 */

import { categorizeEventType, type EventCategory } from './event-type';
import type { AuditEntry } from '@/lib/protocol/audit-types';

export interface FirehoseSnapshot {
    readonly entries: readonly AuditEntry[];
    readonly filteredEntries: readonly AuditEntry[];
    readonly filter: ReadonlySet<EventCategory> | null;
    readonly size: number;
}

export type FirehoseView = FirehoseSnapshot;

export class FirehoseStore {
    private static readonly CAPACITY = 500;

    private readonly entries: AuditEntry[] = [];
    /** Tracks ids already present in `entries` so O(1) dedupe beats O(n) scan. */
    private readonly seenIds = new Set<number>();
    /** null = show all; empty = show none; non-empty = show matching categories. */
    private filter: ReadonlySet<EventCategory> | null = null;
    private readonly listeners = new Set<() => void>();
    /** Cleared on any mutation; rebuilt lazily by getSnapshot. */
    private cachedSnapshot: FirehoseSnapshot | null = null;
    /**
     * Monotonically decreasing id counter for entries arriving without a
     * server-assigned id. Negative so it cannot collide with real server ids
     * (positive integers). We use a WeakMap keyed on the entry object so the
     * SAME reference ingested twice deduplicates to the same synthetic id.
     */
    private syntheticIdCounter = -1;
    private readonly syntheticIdForEntry = new WeakMap<AuditEntry, number>();

    ingest(incoming: readonly AuditEntry[]): void {
        if (incoming.length === 0) return;
        let mutated = false;

        for (const entry of incoming) {
            const id = this.effectiveId(entry);
            if (this.seenIds.has(id)) continue;
            this.seenIds.add(id);
            this.entries.push(entry);
            mutated = true;

            if (this.entries.length > FirehoseStore.CAPACITY) {
                const evicted = this.entries.shift()!;
                const evictedId = this.effectiveId(evicted);
                this.seenIds.delete(evictedId);
            }
        }

        if (mutated) this.invalidate();
    }

    setFilter(filter: ReadonlySet<EventCategory> | null): void {
        // Defensive copy so external mutation cannot rewrite the store filter.
        this.filter = filter === null ? null : new Set(filter);
        this.invalidate();
    }

    clear(): void {
        if (this.entries.length === 0) {
            // Still reset dedupe state to match documented contract; then skip notify.
            this.seenIds.clear();
            return;
        }
        this.entries.length = 0;
        this.seenIds.clear();
        this.invalidate();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return (): void => {
            this.listeners.delete(listener);
        };
    }

    getSnapshot(): FirehoseSnapshot {
        if (this.cachedSnapshot !== null) return this.cachedSnapshot;
        const entriesCopy = Object.freeze(this.entries.slice());
        const filtered = Object.freeze(this.computeFiltered(entriesCopy));
        const filterCopy = this.filter === null ? null : Object.freeze(new Set(this.filter));
        this.cachedSnapshot = Object.freeze({
            entries: entriesCopy,
            filteredEntries: filtered,
            filter: filterCopy,
            size: entriesCopy.length,
        });
        return this.cachedSnapshot;
    }

    private computeFiltered(entries: readonly AuditEntry[]): AuditEntry[] {
        if (this.filter === null) return entries.slice();
        if (this.filter.size === 0) return [];
        const f = this.filter;
        return entries.filter((e) => f.has(categorizeEventType(e.eventType)));
    }

    private invalidate(): void {
        this.cachedSnapshot = null;
        for (const listener of this.listeners) {
            listener();
        }
    }

    private effectiveId(entry: AuditEntry): number {
        if (typeof entry.id === 'number') return entry.id;
        const existing = this.syntheticIdForEntry.get(entry);
        if (existing !== undefined) return existing;
        const synthetic = this.syntheticIdCounter;
        this.syntheticIdCounter -= 1;
        this.syntheticIdForEntry.set(entry, synthetic);
        return synthetic;
    }
}
