import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresenceStore } from './presence-store';
import { makeAuditEntry, makeNousMovedEntry, resetFixtureIds } from '@/test/fixtures/ws-frames';

/**
 * PresenceStore — Plan 03-04 Task 3.
 *
 * Derived from 'nous.spawned' and 'nous.moved' events. Maintains two
 * synchronized maps: did→{regionId,name} and regionId→Set<did>. Idempotent
 * on replay (same entry.id applied twice is a no-op).
 */

beforeEach(() => {
    resetFixtureIds();
});

function spawnEntry(did: string, name: string, region: string, id?: number) {
    return makeAuditEntry({
        id,
        eventType: 'nous.spawned',
        actorDid: did,
        payload: { name, region, ndsAddress: 'nds://test' },
    });
}

describe('PresenceStore — nous.spawned', () => {
    it('places Nous in region and exposes regionOf / inRegion / nameOf', () => {
        const store = new PresenceStore();
        store.applyEvent(spawnEntry('did:nous:alice', 'Alice', 'agora'));
        const snap = store.getSnapshot();
        expect(snap.regionOf('did:nous:alice')).toBe('agora');
        expect(snap.inRegion('agora').has('did:nous:alice')).toBe(true);
        expect(snap.nameOf('did:nous:alice')).toBe('Alice');
    });
});

describe('PresenceStore — nous.moved', () => {
    it('updates both did→region and region→Set<did> maps atomically', () => {
        const store = new PresenceStore();
        store.applyEvent(spawnEntry('did:nous:alice', 'Alice', 'agora'));
        store.applyEvent(
            makeNousMovedEntry('did:nous:alice', 'Alice', 'agora', 'market'),
        );
        const snap = store.getSnapshot();
        expect(snap.regionOf('did:nous:alice')).toBe('market');
        expect(snap.inRegion('agora').has('did:nous:alice')).toBe(false);
        expect(snap.inRegion('market').has('did:nous:alice')).toBe(true);
    });

    it('is idempotent on replay — same event applied twice is a no-op', () => {
        const store = new PresenceStore();
        const spawn = spawnEntry('did:nous:alice', 'Alice', 'agora', 1);
        store.applyEvent(spawn);
        const move = makeAuditEntry({
            id: 2,
            eventType: 'nous.moved',
            actorDid: 'did:nous:alice',
            payload: { name: 'Alice', fromRegion: 'agora', toRegion: 'market', travelCost: 1, tick: 1 },
        });
        store.applyEvent(move);
        store.applyEvent(move); // replay same entry.id
        const snap = store.getSnapshot();
        expect(snap.regionOf('did:nous:alice')).toBe('market');
        expect(snap.inRegion('market').size).toBe(1);
        expect(snap.inRegion('agora').size).toBe(0);
    });

    it('authoritative toRegion wins even if fromRegion does not match actual current region', () => {
        const store = new PresenceStore();
        store.applyEvent(spawnEntry('did:nous:alice', 'Alice', 'agora'));
        // Claim fromRegion is 'library' (not true — Alice is in agora)
        store.applyEvent(
            makeAuditEntry({
                eventType: 'nous.moved',
                actorDid: 'did:nous:alice',
                payload: {
                    name: 'Alice',
                    fromRegion: 'library',
                    toRegion: 'market',
                    travelCost: 1,
                    tick: 1,
                },
            }),
        );
        const snap = store.getSnapshot();
        expect(snap.regionOf('did:nous:alice')).toBe('market');
        expect(snap.inRegion('agora').has('did:nous:alice')).toBe(false);
        expect(snap.inRegion('library').size).toBe(0);
    });
});

describe('PresenceStore — batch application', () => {
    it('processes applyEvents in order and emits exactly one notification', () => {
        const store = new PresenceStore();
        const listener = vi.fn();
        store.subscribe(listener);

        const spawn = spawnEntry('did:nous:alice', 'Alice', 'agora', 10);
        const move1 = makeAuditEntry({
            id: 11,
            eventType: 'nous.moved',
            actorDid: 'did:nous:alice',
            payload: { name: 'Alice', fromRegion: 'agora', toRegion: 'market', travelCost: 1, tick: 1 },
        });
        const move2 = makeAuditEntry({
            id: 12,
            eventType: 'nous.moved',
            actorDid: 'did:nous:alice',
            payload: { name: 'Alice', fromRegion: 'market', toRegion: 'library', travelCost: 1, tick: 2 },
        });

        store.applyEvents([spawn, move1, move2]);
        expect(listener).toHaveBeenCalledTimes(1);

        const snap = store.getSnapshot();
        expect(snap.regionOf('did:nous:alice')).toBe('library');
        expect(snap.inRegion('library').has('did:nous:alice')).toBe(true);
    });
});

describe('PresenceStore — non-relevant events', () => {
    it('silently ignores unknown eventType — no state change, no listener call', () => {
        const store = new PresenceStore();
        const listener = vi.fn();
        store.subscribe(listener);

        store.applyEvent(
            makeAuditEntry({ eventType: 'trade.proposed', actorDid: 'did:nous:alice' }),
        );
        expect(listener).not.toHaveBeenCalled();
    });

    it('silently ignores nous.moved with malformed payload (missing toRegion)', () => {
        const store = new PresenceStore();
        const listener = vi.fn();
        store.subscribe(listener);

        store.applyEvent(
            makeAuditEntry({
                eventType: 'nous.moved',
                actorDid: 'did:nous:alice',
                payload: {}, // malformed
            }),
        );
        expect(listener).not.toHaveBeenCalled();
        const snap = store.getSnapshot();
        expect(snap.regionOf('did:nous:alice')).toBeNull();
    });
});

describe('PresenceStore — snapshot stability', () => {
    it('returns the same reference when unchanged', () => {
        const store = new PresenceStore();
        store.applyEvent(spawnEntry('did:nous:alice', 'Alice', 'agora'));
        const s1 = store.getSnapshot();
        const s2 = store.getSnapshot();
        expect(s1).toBe(s2);
    });
});
