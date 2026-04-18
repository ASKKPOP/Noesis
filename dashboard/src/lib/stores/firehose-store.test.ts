import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirehoseStore } from './firehose-store';
import { makeAuditEntry, resetFixtureIds } from '@/test/fixtures/ws-frames';
import type { AuditEntry } from '@/lib/protocol/audit-types';

/**
 * FirehoseStore — Plan 03-04 Task 2.
 *
 * Covers the useSyncExternalStore-shaped contract (subscribe/getSnapshot),
 * the 500-entry ring buffer with drop-oldest eviction, id-based dedupe,
 * referential stability of snapshots, and the filter-view projection.
 */

beforeEach(() => {
    resetFixtureIds();
});

function makeEntries(n: number, start = 1, eventType = 'tick'): AuditEntry[] {
    const out: AuditEntry[] = [];
    for (let i = 0; i < n; i++) {
        out.push(makeAuditEntry({ id: start + i, eventType }));
    }
    return out;
}

describe('FirehoseStore — ingest and ordering', () => {
    it('appends entries in arrival order', () => {
        const store = new FirehoseStore();
        store.ingest(makeEntries(3));
        const snap = store.getSnapshot();
        expect(snap.entries).toHaveLength(3);
        expect(snap.entries.map((e) => e.id)).toEqual([1, 2, 3]);
    });

    it('caps at 500 entries with drop-oldest semantics', () => {
        const store = new FirehoseStore();
        // Ingest in two batches to exercise the shift-on-overflow path
        store.ingest(makeEntries(300, 1));
        store.ingest(makeEntries(300, 301));
        const snap = store.getSnapshot();
        expect(snap.entries).toHaveLength(500);
        expect(snap.entries[0]!.id).toBe(101);
        expect(snap.entries[499]!.id).toBe(600);
    });

    it('dedupes by id — duplicates are ignored and order is preserved', () => {
        const store = new FirehoseStore();
        const e1 = makeAuditEntry({ id: 1 });
        const e2 = makeAuditEntry({ id: 2 });
        const e1Dup = makeAuditEntry({ id: 1 });
        const e3 = makeAuditEntry({ id: 3 });
        store.ingest([e1, e2, e1Dup, e3]);
        const snap = store.getSnapshot();
        expect(snap.entries).toHaveLength(3);
        expect(snap.entries.map((e) => e.id)).toEqual([1, 2, 3]);
    });

    it('assigns a stable synthetic id when entry.id is undefined', () => {
        const store = new FirehoseStore();
        // Strip the id that the fixture helper always assigns, so the store
        // must mint a synthetic id for each entry.
        const anon1: AuditEntry = { ...makeAuditEntry(), id: undefined };
        const anon2: AuditEntry = { ...makeAuditEntry(), id: undefined };
        // Delete id outright so TS-level `id?: number` actually resolves to
        // undefined (object spread with id:undefined is equivalent here).
        store.ingest([anon1, anon2]);
        store.ingest([anon1]); // same reference — must not double-count
        const snap = store.getSnapshot();
        expect(snap.entries).toHaveLength(2);
    });
});

describe('FirehoseStore — snapshot stability', () => {
    it('returns the same reference when nothing changed', () => {
        const store = new FirehoseStore();
        store.ingest(makeEntries(1));
        const s1 = store.getSnapshot();
        const s2 = store.getSnapshot();
        expect(s1).toBe(s2);
    });

    it('returns a new reference after any mutation', () => {
        const store = new FirehoseStore();
        store.ingest(makeEntries(1));
        const s1 = store.getSnapshot();
        store.ingest(makeEntries(1, 2));
        const s2 = store.getSnapshot();
        expect(s1).not.toBe(s2);
    });
});

describe('FirehoseStore — subscribe / unsubscribe', () => {
    it('notifies subscribers only on ingest, not on getSnapshot', () => {
        const store = new FirehoseStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        store.getSnapshot();
        store.getSnapshot();
        expect(listener).not.toHaveBeenCalled();

        store.ingest(makeEntries(1));
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        store.ingest(makeEntries(1, 2));
        expect(listener).toHaveBeenCalledTimes(1); // still 1, unsubscribed
    });
});

describe('FirehoseStore — filter view', () => {
    function seedMixed(store: FirehoseStore): void {
        store.ingest([
            makeAuditEntry({ id: 1, eventType: 'trade.proposed' }),
            makeAuditEntry({ id: 2, eventType: 'trade.settled' }),
            makeAuditEntry({ id: 3, eventType: 'nous.spoke' }),
            makeAuditEntry({ id: 4, eventType: 'nous.moved' }),
            makeAuditEntry({ id: 5, eventType: 'law.triggered' }),
            makeAuditEntry({ id: 6, eventType: 'tick' }),
            makeAuditEntry({ id: 7, eventType: 'nous.spawned' }),
            makeAuditEntry({ id: 8, eventType: 'nous.direct_message' }),
            makeAuditEntry({ id: 9, eventType: 'grid.started' }),
            makeAuditEntry({ id: 10, eventType: 'something.other' }),
        ]);
    }

    it('setFilter mutates filter and emits a snapshot change', () => {
        const store = new FirehoseStore();
        seedMixed(store);
        const listener = vi.fn();
        store.subscribe(listener);

        store.setFilter(new Set(['trade']));
        const snap = store.getSnapshot();
        expect([...(snap.filter ?? [])]).toEqual(['trade']);
        expect(snap.filteredEntries.map((e) => e.id)).toEqual([1, 2]);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('filter === null means show all', () => {
        const store = new FirehoseStore();
        seedMixed(store);
        store.setFilter(null);
        const snap = store.getSnapshot();
        expect(snap.filteredEntries).toHaveLength(10);
        expect(snap.filter).toBeNull();
    });

    it('filter === empty set means show none', () => {
        const store = new FirehoseStore();
        seedMixed(store);
        store.setFilter(new Set());
        const snap = store.getSnapshot();
        expect(snap.filteredEntries).toHaveLength(0);
    });

    it('multi-category filter combines matching categories', () => {
        const store = new FirehoseStore();
        seedMixed(store);
        store.setFilter(new Set(['message', 'movement']));
        const snap = store.getSnapshot();
        // message: id 3 (nous.spoke), id 8 (nous.direct_message); movement: id 4 (nous.moved)
        expect(snap.filteredEntries.map((e) => e.id).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([3, 4, 8]);
    });
});

describe('FirehoseStore — clear()', () => {
    it('empties the ring buffer and notifies subscribers', () => {
        const store = new FirehoseStore();
        store.ingest(makeEntries(10));
        const listener = vi.fn();
        store.subscribe(listener);
        store.clear();
        const snap = store.getSnapshot();
        expect(snap.entries).toHaveLength(0);
        expect(snap.size).toBe(0);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('allows re-ingesting previously-seen ids after clear (dedupe set is reset)', () => {
        const store = new FirehoseStore();
        store.ingest([makeAuditEntry({ id: 1 })]);
        store.clear();
        store.ingest([makeAuditEntry({ id: 1 })]);
        expect(store.getSnapshot().entries).toHaveLength(1);
    });
});
