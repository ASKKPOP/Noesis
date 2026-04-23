/**
 * Sprint 12 — PersistentAuditChain
 *
 * Verifies that PersistentAuditChain:
 *   1. Mirrors every append to the IAuditStore (fire-and-forget)
 *   2. Behaves identically to AuditChain for reads and verify()
 *   3. Survives store failures gracefully
 */

import { describe, it, expect, vi } from 'vitest';
import { PersistentAuditChain } from '../../src/db/persistent-chain.js';
import { InMemoryGridStore } from '../../src/db/stores/in-memory-store.js';

const GRID = 'test-grid';

describe('Sprint 12: PersistentAuditChain', () => {

    it('append mirrors entry to the store', async () => {
        const store = new InMemoryGridStore();
        const chain = new PersistentAuditChain(store.audit, GRID);

        chain.append('nous.spoke', 'did:noesis:sophia', { text: 'Hello' });

        // Wait for the fire-and-forget promise to settle
        await new Promise(r => setTimeout(r, 10));

        const entries = await store.audit.loadAll(GRID);
        expect(entries).toHaveLength(1);
        expect(entries[0].eventType).toBe('nous.spoke');
    });

    it('all appended entries reach the store', async () => {
        const store = new InMemoryGridStore();
        const chain = new PersistentAuditChain(store.audit, GRID);

        for (let i = 0; i < 5; i++) {
            chain.append(`event.${i}`, 'did:noesis:actor', { i });
        }

        await new Promise(r => setTimeout(r, 20));

        const entries = await store.audit.loadAll(GRID);
        expect(entries).toHaveLength(5);
    });

    it('verify() passes after multiple appends', async () => {
        const store = new InMemoryGridStore();
        const chain = new PersistentAuditChain(store.audit, GRID);

        chain.append('a', 'did:noesis:x', {});
        chain.append('b', 'did:noesis:x', {});
        chain.append('c', 'did:noesis:x', {});

        expect(chain.verify().valid).toBe(true);
    });

    it('query() works correctly', () => {
        const store = new InMemoryGridStore();
        const chain = new PersistentAuditChain(store.audit, GRID);

        chain.append('nous.spoke', 'did:noesis:sophia', { text: 'Hi' });
        chain.append('nous.moved', 'did:noesis:sophia', { region: 'beta' });
        chain.append('nous.spoke', 'did:noesis:hermes', { text: 'Hey' });

        const spokes = chain.query({ eventType: 'nous.spoke' });
        expect(spokes).toHaveLength(2);
    });

    it('store failure does not break the chain', async () => {
        const store = new InMemoryGridStore();
        // Make the store reject
        vi.spyOn(store.audit, 'append').mockRejectedValue(new Error('DB down'));

        const chain = new PersistentAuditChain(store.audit, GRID);

        // Should not throw
        expect(() => chain.append('test.event', 'did:noesis:x', {})).not.toThrow();

        await new Promise(r => setTimeout(r, 20));

        // In-memory chain is unaffected
        expect(chain.length).toBe(1);
        expect(chain.verify().valid).toBe(true);
    });

    it('append returns the entry (same as base AuditChain)', () => {
        const store = new InMemoryGridStore();
        const chain = new PersistentAuditChain(store.audit, GRID);

        const entry = chain.append('grid.genesis', 'system', { gridName: 'test' });
        expect(entry.eventType).toBe('grid.genesis');
        expect(entry.id).toBe(1);
        expect(typeof entry.eventHash).toBe('string');
        expect(entry.eventHash).toHaveLength(64);
    });
});
