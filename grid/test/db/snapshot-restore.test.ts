/**
 * Sprint 12 — Snapshot & Restore
 *
 * Verifies the full crash-recovery cycle:
 *   1. Bootstrap a Grid and run some activity
 *   2. Snapshot state to InMemoryGridStore
 *   3. Create a fresh launcher and restore from store
 *   4. Verify restored state matches original
 */

import { describe, it, expect } from 'vitest';
import { GenesisLauncher, TEST_CONFIG } from '../../src/genesis/index.js';
import { InMemoryGridStore } from '../../src/db/stores/in-memory-store.js';
import { snapshotGrid, restoreGrid } from '../../src/db/grid-store.js';

const GRID = TEST_CONFIG.gridName;

describe('Sprint 12: Snapshot & Restore', () => {

    it('restoreGrid returns false when store is empty', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap({ skipSeedNous: true });

        const restored = await restoreGrid(GRID, launcher, store);
        expect(restored).toBe(false);
    });

    it('snapshotGrid saves registry records to store', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        await snapshotGrid(GRID, launcher, store);

        const records = await store.registry.loadAll(GRID);
        expect(records.length).toBe(launcher.registry.count);
        const dids = records.map(r => r.did).sort();
        expect(dids).toContain('did:key:sophia');
        expect(dids).toContain('did:key:hermes');
    });

    it('snapshotGrid saves audit entries to store', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        await snapshotGrid(GRID, launcher, store);

        const entries = await store.audit.loadAll(GRID);
        expect(entries.length).toBe(launcher.audit.length);
        expect(entries.length).toBeGreaterThan(0);
    });

    it('snapshotGrid saves spatial positions to store', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        await snapshotGrid(GRID, launcher, store);

        const positions = await store.space.loadPositions(GRID);
        expect(positions.length).toBe(launcher.space.nousCount);
        const dids = positions.map(p => p.nousDid).sort();
        expect(dids).toContain('did:key:sophia');
        expect(dids).toContain('did:key:hermes');
    });

    it('restoreGrid returns true when store has data', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();
        await snapshotGrid(GRID, launcher, store);

        const launcher2 = new GenesisLauncher(TEST_CONFIG);
        launcher2.bootstrap({ skipSeedNous: true });

        const result = await restoreGrid(GRID, launcher2, store);
        expect(result).toBe(true);
    });

    it('restored registry matches original', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        // Add a third Nous after bootstrap
        launcher.spawnNous('Themis', 'did:key:themis', 'pk-themis', 'alpha');

        await snapshotGrid(GRID, launcher, store);

        // Restore into a fresh launcher
        const launcher2 = new GenesisLauncher(TEST_CONFIG);
        launcher2.bootstrap({ skipSeedNous: true });
        await restoreGrid(GRID, launcher2, store);

        expect(launcher2.registry.count).toBe(3);
        expect(launcher2.registry.get('did:key:sophia')?.name).toBe('Sophia');
        expect(launcher2.registry.get('did:key:hermes')?.name).toBe('Hermes');
        expect(launcher2.registry.get('did:key:themis')?.name).toBe('Themis');
    });

    it('restored audit chain passes verification', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        // Some activity
        launcher.audit.append('nous.spoke', 'did:key:sophia', { text: 'Hello' });
        launcher.audit.append('nous.moved', 'did:key:hermes', { region: 'alpha' });

        await snapshotGrid(GRID, launcher, store);

        const launcher2 = new GenesisLauncher(TEST_CONFIG);
        launcher2.bootstrap({ skipSeedNous: true });
        await restoreGrid(GRID, launcher2, store);

        expect(launcher2.audit.length).toBe(launcher.audit.length);
        expect(launcher2.audit.verify().valid).toBe(true);
        expect(launcher2.audit.head).toBe(launcher.audit.head);
    });

    it('restored spatial positions match original', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        // Move Hermes to alpha
        launcher.space.moveNous('did:key:hermes', 'alpha');

        await snapshotGrid(GRID, launcher, store);

        const launcher2 = new GenesisLauncher(TEST_CONFIG);
        launcher2.bootstrap({ skipSeedNous: true });
        await restoreGrid(GRID, launcher2, store);

        expect(launcher2.space.getPosition('did:key:sophia')?.regionId).toBe('alpha');
        expect(launcher2.space.getPosition('did:key:hermes')?.regionId).toBe('alpha');
    });

    it('snapshot is idempotent — calling twice does not duplicate data', async () => {
        const store = new InMemoryGridStore();
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap();

        await snapshotGrid(GRID, launcher, store);
        await snapshotGrid(GRID, launcher, store);  // second snapshot

        const entries = await store.audit.loadAll(GRID);
        expect(entries.length).toBe(launcher.audit.length);  // no duplicates
    });

    it('bootstrap({ skipSeedNous }) sets up regions but not Nous', () => {
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap({ skipSeedNous: true });

        // Regions should be present
        expect(launcher.space.allRegions().length).toBe(TEST_CONFIG.regions.length);

        // No Nous spawned
        expect(launcher.registry.count).toBe(0);
        expect(launcher.audit.length).toBe(0);
    });
});
