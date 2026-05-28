import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { P2PPeerStore } from '../../src/p2p/p2p-peer-store.js';
import { P2P_PEER_TTL_MS } from '../../src/p2p/types.js';

describe('P2PPeerStore (Phase 42 Plan 02)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('announce stores civic_did with current Date.now() and tick', () => {
        const store = new P2PPeerStore();
        const before = Date.now();
        store.announce('did:civic:noesis:abc', 1);
        const status = store.getStatus('did:civic:noesis:abc');
        expect(status.status).toBe('online');
        expect(status.last_seen_at).toBeDefined();
        // Verify it's a valid ISO string
        expect(new Date(status.last_seen_at!).getTime()).toBeGreaterThanOrEqual(before);
    });

    it('getStatus returns {status:"online", last_seen_at: ISO} when entry is fresh (<5min)', () => {
        const store = new P2PPeerStore();
        store.announce('did:civic:noesis:abc', 1);
        const result = store.getStatus('did:civic:noesis:abc');
        expect(result).toMatchObject({ status: 'online', last_seen_at: expect.any(String) });
        // Verify ISO 8601 format
        expect(() => new Date(result.last_seen_at!)).not.toThrow();
    });

    it('getStatus returns {status:"offline"} and deletes entry when older than 5min', () => {
        const store = new P2PPeerStore();
        store.announce('did:civic:noesis:abc', 1);
        vi.advanceTimersByTime(P2P_PEER_TTL_MS + 1);
        expect(store.getStatus('did:civic:noesis:abc')).toEqual({ status: 'offline' });
        expect(store.size()).toBe(0);
    });

    it('getStatus returns {status:"offline"} when civic_did never announced', () => {
        const store = new P2PPeerStore();
        expect(store.getStatus('did:civic:noesis:unknown')).toEqual({ status: 'offline' });
    });

    it('cleanup() removes all entries older than P2P_PEER_TTL_MS (5*60*1000)', () => {
        const store = new P2PPeerStore();
        store.announce('did:civic:noesis:abc', 1);
        store.announce('did:civic:noesis:def', 2);
        vi.advanceTimersByTime(P2P_PEER_TTL_MS + 1);
        store.cleanup();
        expect(store.size()).toBe(0);
    });

    it('multiple announce() calls for same DID update lastSeenAt without duplicating entry', () => {
        const store = new P2PPeerStore();
        store.announce('did:civic:noesis:abc', 1);
        vi.advanceTimersByTime(1000);
        store.announce('did:civic:noesis:abc', 2);
        expect(store.size()).toBe(1);
        // Second announce updated the entry
        const status = store.getStatus('did:civic:noesis:abc');
        expect(status.status).toBe('online');
    });
});
