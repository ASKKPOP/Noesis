import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeartbeatStore } from './heartbeat-store';
import { makeAuditEntry, makeTickEntry, makeNousMovedEntry, resetFixtureIds } from '@/test/fixtures/ws-frames';

/**
 * HeartbeatStore — Plan 03-04 Task 4.
 *
 * Tracks lastTick / tickRateMs / lastEventAt and derives a live/stale status
 * when now - lastEventAt > 2 × tickRateMs.
 */

beforeEach(() => {
    resetFixtureIds();
});

describe('HeartbeatStore — initial state', () => {
    it('starts with nulls everywhere and status=unknown', () => {
        const store = new HeartbeatStore();
        const snap = store.getSnapshot();
        expect(snap.lastTick).toBeNull();
        expect(snap.tickRateMs).toBeNull();
        expect(snap.lastEventAt).toBeNull();
        const derived = store.deriveStatus(Date.now());
        expect(derived.status).toBe('unknown');
        expect(derived.secondsSinceLastEvent).toBeNull();
    });
});

describe('HeartbeatStore — tick ingest', () => {
    it('updates lastTick, tickRateMs, and lastEventAt from a tick entry', () => {
        const store = new HeartbeatStore();
        const tick = makeAuditEntry({
            id: 1,
            eventType: 'tick',
            actorDid: 'system',
            payload: { tick: 42, epoch: 0, tickRateMs: 30_000, timestamp: 1_000_000 },
            createdAt: 1_000_000,
        });
        store.ingest(tick);
        const snap = store.getSnapshot();
        expect(snap.lastTick).toBe(42);
        expect(snap.tickRateMs).toBe(30_000);
        expect(snap.lastEventAt).toBe(1_000_000);
    });

    it('updates tickRateMs when a subsequent tick arrives with new rate (server-authoritative)', () => {
        const store = new HeartbeatStore();
        store.ingest(
            makeAuditEntry({
                id: 10,
                eventType: 'tick',
                payload: { tick: 10, epoch: 0, tickRateMs: 30_000, timestamp: 1_000_000 },
                createdAt: 1_000_000,
            }),
        );
        store.ingest(
            makeAuditEntry({
                id: 11,
                eventType: 'tick',
                payload: { tick: 11, epoch: 0, tickRateMs: 1000, timestamp: 1_030_000 },
                createdAt: 1_030_000,
            }),
        );
        const snap = store.getSnapshot();
        expect(snap.tickRateMs).toBe(1000);
        expect(snap.lastTick).toBe(11);
    });

    it('drops stale replays — an older id does not regress lastTick or tickRateMs', () => {
        const store = new HeartbeatStore();
        store.ingest(
            makeAuditEntry({
                id: 10,
                eventType: 'tick',
                payload: { tick: 10, epoch: 0, tickRateMs: 30_000, timestamp: 1_000_000 },
                createdAt: 1_000_000,
            }),
        );
        store.ingest(
            makeAuditEntry({
                id: 8,
                eventType: 'tick',
                payload: { tick: 8, epoch: 0, tickRateMs: 1000, timestamp: 999_000 },
                createdAt: 999_000,
            }),
        );
        const snap = store.getSnapshot();
        expect(snap.lastTick).toBe(10);
        expect(snap.tickRateMs).toBe(30_000);
    });
});

describe('HeartbeatStore — non-tick ingest', () => {
    it('updates lastEventAt but not lastTick', () => {
        const store = new HeartbeatStore();
        store.ingest(makeTickEntry(42, 30_000));
        const beforeTick = store.getSnapshot().lastTick;
        store.ingest(
            makeAuditEntry({
                id: 999,
                eventType: 'nous.moved',
                payload: { name: 'Alice', fromRegion: 'agora', toRegion: 'market', travelCost: 1, tick: 42 },
                createdAt: 1_500_000,
            }),
        );
        const snap = store.getSnapshot();
        expect(snap.lastTick).toBe(beforeTick);
        expect(snap.lastEventAt).toBe(1_500_000);
    });
});

describe('HeartbeatStore — derived status', () => {
    it('is live when elapsed ≤ 2 × tickRateMs', () => {
        const store = new HeartbeatStore();
        store.ingest(
            makeAuditEntry({
                id: 1,
                eventType: 'tick',
                payload: { tick: 1, epoch: 0, tickRateMs: 1000, timestamp: 1_000_000 },
                createdAt: 1_000_000,
            }),
        );
        expect(store.deriveStatus(1_001_500).status).toBe('live');
    });

    it('is stale when elapsed > 2 × tickRateMs', () => {
        const store = new HeartbeatStore();
        store.ingest(
            makeAuditEntry({
                id: 1,
                eventType: 'tick',
                payload: { tick: 1, epoch: 0, tickRateMs: 1000, timestamp: 1_000_000 },
                createdAt: 1_000_000,
            }),
        );
        expect(store.deriveStatus(1_003_000).status).toBe('stale');
    });

    it('computes secondsSinceLastEvent as floor(elapsed / 1000)', () => {
        const store = new HeartbeatStore();
        store.ingest(
            makeAuditEntry({
                id: 1,
                eventType: 'tick',
                payload: { tick: 1, epoch: 0, tickRateMs: 1000, timestamp: 1_000_000 },
                createdAt: 1_000_000,
            }),
        );
        expect(store.deriveStatus(1_007_300).secondsSinceLastEvent).toBe(7);
    });

    it('is unknown when tickRateMs has never been observed (no tick event yet)', () => {
        const store = new HeartbeatStore();
        store.ingest(
            makeAuditEntry({
                id: 99,
                eventType: 'nous.moved',
                payload: { name: 'a', fromRegion: 'x', toRegion: 'y', travelCost: 1, tick: 0 },
                createdAt: 500,
            }),
        );
        expect(store.deriveStatus(1_000).status).toBe('unknown');
    });
});

describe('HeartbeatStore — subscribe semantics', () => {
    it('notifies once per actual state change — dedupes by id', () => {
        const store = new HeartbeatStore();
        const listener = vi.fn();
        store.subscribe(listener);

        const tick = makeAuditEntry({
            id: 1,
            eventType: 'tick',
            payload: { tick: 1, epoch: 0, tickRateMs: 1000, timestamp: 1_000_000 },
            createdAt: 1_000_000,
        });
        store.ingest(tick);
        store.ingest(tick); // same id — should be deduped
        expect(listener).toHaveBeenCalledTimes(1);

        // Fresh non-tick event advances lastEventAt
        store.ingest(makeNousMovedEntry('did:nous:alice', 'Alice', 'agora', 'market'));
        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe('HeartbeatStore — snapshot stability', () => {
    it('returns the same reference when unchanged', () => {
        const store = new HeartbeatStore();
        store.ingest(makeTickEntry(1, 1000));
        const s1 = store.getSnapshot();
        const s2 = store.getSnapshot();
        expect(s1).toBe(s2);
    });
});

describe('HeartbeatStore — batch ingest', () => {
    it('ingestBatch emits at most one listener notification per call', () => {
        const store = new HeartbeatStore();
        const listener = vi.fn();
        store.subscribe(listener);
        store.ingestBatch([
            makeAuditEntry({
                id: 1,
                eventType: 'tick',
                payload: { tick: 1, epoch: 0, tickRateMs: 1000, timestamp: 1000 },
                createdAt: 1000,
            }),
            makeAuditEntry({
                id: 2,
                eventType: 'tick',
                payload: { tick: 2, epoch: 0, tickRateMs: 1000, timestamp: 2000 },
                createdAt: 2000,
            }),
            makeAuditEntry({
                id: 3,
                eventType: 'tick',
                payload: { tick: 3, epoch: 0, tickRateMs: 1000, timestamp: 3000 },
                createdAt: 3000,
            }),
        ]);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot().lastTick).toBe(3);
    });
});
