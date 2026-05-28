import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SdpInboxStore } from '../../src/p2p/sdp-inbox-store.js';
import type { InboxEntry } from '../../src/p2p/types.js';

function makeEntry(overrides: Partial<InboxEntry> = {}): InboxEntry {
    return {
        connectionId: '00000000-0000-0000-0000-000000000001',
        fromDid: 'did:civic:noesis:alice',
        encryptedBlob: 'encrypted-sdp-offer',
        expiresAt: Date.now() + 60_000,
        ...overrides,
    };
}

describe('SdpInboxStore (Phase 42 Plan 02)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('push() appends an InboxEntry under toDid key', () => {
        const store = new SdpInboxStore();
        store.push('did:civic:noesis:bob', makeEntry());
        // drain returns the entry (proving it was stored)
        const entries = store.drain('did:civic:noesis:bob');
        expect(entries.length).toBe(1);
    });

    it('drain(toDid) returns all non-expired entries AND clears the toDid bucket', () => {
        const store = new SdpInboxStore();
        store.push('did:civic:noesis:bob', makeEntry());
        const entries = store.drain('did:civic:noesis:bob');
        expect(entries.length).toBe(1);
        // After drain, bucket is cleared
        const entries2 = store.drain('did:civic:noesis:bob');
        expect(entries2.length).toBe(0);
    });

    it('drain() filters out entries past expiresAt (60s TTL)', () => {
        const store = new SdpInboxStore();
        store.push('did:civic:noesis:bob', makeEntry({ expiresAt: Date.now() - 1 }));
        const entries = store.drain('did:civic:noesis:bob');
        expect(entries.length).toBe(0);
    });

    it('drain() on unknown DID returns []', () => {
        const store = new SdpInboxStore();
        expect(store.drain('did:civic:noesis:nobody')).toEqual([]);
    });

    it('multiple pushes to same recipient preserve order', () => {
        const store = new SdpInboxStore();
        store.push('did:civic:noesis:bob', makeEntry({ encryptedBlob: 'first', connectionId: '00000000-0000-0000-0000-000000000001' }));
        store.push('did:civic:noesis:bob', makeEntry({ encryptedBlob: 'second', connectionId: '00000000-0000-0000-0000-000000000002' }));
        const entries = store.drain('did:civic:noesis:bob');
        expect(entries[0]!.encryptedBlob).toBe('first');
        expect(entries[1]!.encryptedBlob).toBe('second');
    });
});
