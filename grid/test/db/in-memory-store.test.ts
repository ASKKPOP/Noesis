/**
 * Sprint 12 — InMemoryGridStore
 *
 * Tests the in-memory IGridStore implementation that stands in for MySQL
 * in all test and standalone scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryGridStore } from '../../src/db/stores/in-memory-store.js';
import type { AuditEntry } from '../../src/audit/types.js';
import type { NousRecord } from '../../src/registry/types.js';
import type { NousPosition } from '../../src/space/types.js';

// ── Fixtures ──────────────────────────────────────────────────

const GRID = 'test-grid';

function makeEntry(id: number, overrides: Partial<AuditEntry> = {}): AuditEntry {
    return {
        id,
        eventType: 'test.event',
        actorDid: 'did:noesis:actor',
        payload: { tick: id },
        prevHash: `prev-${id}`,
        eventHash: `hash-${id}`,
        createdAt: Date.now(),
        ...overrides,
    };
}

function makeRecord(did: string, overrides: Partial<NousRecord> = {}): NousRecord {
    return {
        did,
        name: did.replace('did:noesis:', ''),
        ndsAddress: `nous://${did}.test`,
        publicKey: 'pk-' + did,
        region: 'alpha',
        lifecyclePhase: 'spawning',
        reputation: 0,
        ousia: 1000,
        spawnedAtTick: 0,
        lastActiveTick: 0,
        status: 'active',
        ...overrides,
    };
}

function makePosition(nousDid: string, regionId = 'alpha'): NousPosition {
    return { nousDid, regionId, arrivedAt: Date.now() };
}

// ── Tests ─────────────────────────────────────────────────────

describe('Sprint 12: InMemoryGridStore', () => {
    let store: InMemoryGridStore;

    beforeEach(() => {
        store = new InMemoryGridStore();
    });

    // ── Audit store ───────────────────────────────────────────

    describe('audit store', () => {
        it('appends and loads entries', async () => {
            const e1 = makeEntry(1);
            const e2 = makeEntry(2);
            await store.audit.append(GRID, e1);
            await store.audit.append(GRID, e2);

            const loaded = await store.audit.loadAll(GRID);
            expect(loaded).toHaveLength(2);
            expect(loaded[0].id).toBe(1);
            expect(loaded[1].id).toBe(2);
        });

        it('returns empty array when grid has no entries', async () => {
            const loaded = await store.audit.loadAll('nonexistent');
            expect(loaded).toHaveLength(0);
        });

        it('append is idempotent (same id not duplicated)', async () => {
            const e = makeEntry(1);
            await store.audit.append(GRID, e);
            await store.audit.append(GRID, e);  // duplicate

            const loaded = await store.audit.loadAll(GRID);
            expect(loaded).toHaveLength(1);
        });

        it('entries are isolated by grid name', async () => {
            await store.audit.append(GRID, makeEntry(1));
            await store.audit.append('other-grid', makeEntry(1));

            expect(await store.audit.loadAll(GRID)).toHaveLength(1);
            expect(await store.audit.loadAll('other-grid')).toHaveLength(1);
        });

        it('returns copies (mutations do not affect store)', async () => {
            const entry = makeEntry(1);
            await store.audit.append(GRID, entry);

            const loaded = await store.audit.loadAll(GRID);
            loaded[0].eventType = 'mutated';

            const reloaded = await store.audit.loadAll(GRID);
            expect(reloaded[0].eventType).toBe('test.event');
        });
    });

    // ── Registry store ────────────────────────────────────────

    describe('registry store', () => {
        it('upserts and loads records', async () => {
            const r = makeRecord('did:noesis:sophia');
            await store.registry.upsert(GRID, r);

            const loaded = await store.registry.loadAll(GRID);
            expect(loaded).toHaveLength(1);
            expect(loaded[0].did).toBe('did:noesis:sophia');
        });

        it('upsert updates existing record', async () => {
            const r = makeRecord('did:noesis:sophia');
            await store.registry.upsert(GRID, r);

            const updated = { ...r, lastActiveTick: 99, ousia: 500 };
            await store.registry.upsert(GRID, updated);

            const loaded = await store.registry.loadAll(GRID);
            expect(loaded).toHaveLength(1);
            expect(loaded[0].lastActiveTick).toBe(99);
            expect(loaded[0].ousia).toBe(500);
        });

        it('returns empty array for unknown grid', async () => {
            expect(await store.registry.loadAll('ghost')).toHaveLength(0);
        });

        it('records are isolated by grid name', async () => {
            await store.registry.upsert(GRID, makeRecord('did:noesis:a'));
            await store.registry.upsert('grid-b', makeRecord('did:noesis:a'));

            expect(await store.registry.loadAll(GRID)).toHaveLength(1);
            expect(await store.registry.loadAll('grid-b')).toHaveLength(1);
        });
    });

    // ── Space store ───────────────────────────────────────────

    describe('space store', () => {
        it('upserts and loads positions', async () => {
            const pos = makePosition('did:noesis:sophia', 'alpha');
            await store.space.upsertPosition(GRID, pos);

            const loaded = await store.space.loadPositions(GRID);
            expect(loaded).toHaveLength(1);
            expect(loaded[0].nousDid).toBe('did:noesis:sophia');
            expect(loaded[0].regionId).toBe('alpha');
        });

        it('upsert updates existing position', async () => {
            await store.space.upsertPosition(GRID, makePosition('did:noesis:sophia', 'alpha'));
            await store.space.upsertPosition(GRID, makePosition('did:noesis:sophia', 'beta'));

            const loaded = await store.space.loadPositions(GRID);
            expect(loaded).toHaveLength(1);
            expect(loaded[0].regionId).toBe('beta');
        });

        it('returns empty array for unknown grid', async () => {
            expect(await store.space.loadPositions('ghost')).toHaveLength(0);
        });
    });

    // ── clear() ───────────────────────────────────────────────

    describe('clear()', () => {
        it('clears a specific grid only', async () => {
            await store.audit.append(GRID, makeEntry(1));
            await store.audit.append('other', makeEntry(1));

            store.clear(GRID);

            expect(await store.audit.loadAll(GRID)).toHaveLength(0);
            expect(await store.audit.loadAll('other')).toHaveLength(1);
        });

        it('clears all grids when called without argument', async () => {
            await store.audit.append(GRID, makeEntry(1));
            await store.audit.append('other', makeEntry(1));

            store.clear();

            expect(await store.audit.loadAll(GRID)).toHaveLength(0);
            expect(await store.audit.loadAll('other')).toHaveLength(0);
        });
    });

    // ── close() ───────────────────────────────────────────────

    it('close() resolves without error', async () => {
        await expect(store.close()).resolves.toBeUndefined();
    });
});
