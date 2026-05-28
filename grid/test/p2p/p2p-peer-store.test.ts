import { describe, it } from 'vitest';

describe('P2PPeerStore (Phase 42 Plan 04)', () => {
    it.skip('announce stores civic_did with current Date.now() and tick', () => {
        // const store = new P2PPeerStore();
        // store.announce('did:civic:noesis:abc', 1);
        // expect(store.entries.get('did:civic:noesis:abc')).toMatchObject({ tick: 1 });
    });

    it.skip('getStatus returns {status:"online", last_seen_at: ISO} when entry is fresh (<5min)', () => {
        // const store = new P2PPeerStore();
        // store.announce('did:civic:noesis:abc', 1);
        // const result = store.getStatus('did:civic:noesis:abc');
        // expect(result).toMatchObject({ status: 'online', last_seen_at: expect.any(String) });
    });

    it.skip('getStatus returns {status:"offline"} and deletes entry when older than 5min', () => {
        // const store = new P2PPeerStore();
        // store.announce('did:civic:noesis:abc', 1);
        // vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        // expect(store.getStatus('did:civic:noesis:abc')).toEqual({ status: 'offline' });
        // expect(store.entries.has('did:civic:noesis:abc')).toBe(false);
    });

    it.skip('getStatus returns {status:"offline"} when civic_did never announced', () => {
        // const store = new P2PPeerStore();
        // expect(store.getStatus('did:civic:noesis:unknown')).toEqual({ status: 'offline' });
    });

    it.skip('cleanup() removes all entries older than P2P_TTL_MS (5*60*1000)', () => {
        // const store = new P2PPeerStore();
        // store.announce('did:civic:noesis:abc', 1);
        // store.announce('did:civic:noesis:def', 2);
        // vi.advanceTimersByTime(P2P_TTL_MS + 1);
        // store.cleanup();
        // expect(store.entries.size).toBe(0);
    });

    it.skip('multiple announce() calls for same DID update lastSeenAt without duplicating entry', () => {
        // const store = new P2PPeerStore();
        // store.announce('did:civic:noesis:abc', 1);
        // store.announce('did:civic:noesis:abc', 2);
        // expect(store.entries.size).toBe(1);
        // expect(store.entries.get('did:civic:noesis:abc')!.tick).toBe(2);
    });
});
