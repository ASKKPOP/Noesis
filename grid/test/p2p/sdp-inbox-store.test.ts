import { describe, it } from 'vitest';

describe('SdpInboxStore (Phase 42 Plan 04)', () => {
    it.skip('push() appends an InboxEntry under toDid key', () => {
        // const store = new SdpInboxStore();
        // store.push('did:civic:noesis:bob', { fromDid: 'did:civic:noesis:alice', blob: 'sdp-offer', expiresAt: Date.now() + 60_000 });
        // expect(store.buckets.get('did:civic:noesis:bob')?.length).toBe(1);
    });

    it.skip('drain(toDid) returns all non-expired entries AND clears the toDid bucket', () => {
        // const store = new SdpInboxStore();
        // store.push('did:civic:noesis:bob', { fromDid: 'did:civic:noesis:alice', blob: 'sdp-offer', expiresAt: Date.now() + 60_000 });
        // const entries = store.drain('did:civic:noesis:bob');
        // expect(entries.length).toBe(1);
        // expect(store.buckets.has('did:civic:noesis:bob')).toBe(false);
    });

    it.skip('drain() filters out entries past expiresAt (60s TTL)', () => {
        // const store = new SdpInboxStore();
        // store.push('did:civic:noesis:bob', { fromDid: 'did:civic:noesis:alice', blob: 'sdp-offer', expiresAt: Date.now() - 1 });
        // const entries = store.drain('did:civic:noesis:bob');
        // expect(entries.length).toBe(0);
    });

    it.skip('drain() on unknown DID returns []', () => {
        // const store = new SdpInboxStore();
        // expect(store.drain('did:civic:noesis:nobody')).toEqual([]);
    });

    it.skip('multiple pushes to same recipient preserve order', () => {
        // const store = new SdpInboxStore();
        // store.push('did:civic:noesis:bob', { fromDid: 'did:civic:noesis:alice', blob: 'first', expiresAt: Date.now() + 60_000 });
        // store.push('did:civic:noesis:bob', { fromDid: 'did:civic:noesis:carol', blob: 'second', expiresAt: Date.now() + 60_000 });
        // const entries = store.drain('did:civic:noesis:bob');
        // expect(entries[0].blob).toBe('first');
        // expect(entries[1].blob).toBe('second');
    });
});
