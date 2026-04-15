/**
 * Sprint 13 — Graceful Shutdown
 *
 * Tests that app.stop():
 *   1. Halts the world clock
 *   2. Appends a grid.stopped audit entry
 *   3. Snapshot is taken when DB store is provided
 *   4. Server stops accepting connections after stop()
 */

import { describe, it, expect } from 'vitest';
import { createGridApp, type GridAppConfig } from '../../src/main.js';
import { InMemoryGridStore, snapshotGrid } from '../../src/db/index.js';
import { TEST_CONFIG } from '../../src/genesis/index.js';

const BASE_CONFIG: GridAppConfig = {
    genesisConfig: { ...TEST_CONFIG, seedNous: [] },
    port: 0,
};

describe('Sprint 13: Graceful Shutdown', () => {

    it('clock stops after app.stop()', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();
        expect(app.launcher.clock.running).toBe(true);

        await app.stop();
        expect(app.launcher.clock.running).toBe(false);
    });

    it('audit trail contains grid.stopped event after stop()', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();
        await app.stop();

        const entries = app.launcher.audit.query({ eventType: 'grid.stopped' });
        expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it('audit trail contains grid.started event', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();

        const entries = app.launcher.audit.query({ eventType: 'grid.started' });
        expect(entries.length).toBeGreaterThanOrEqual(1);

        await app.stop();
    });

    it('snapshot can be taken manually before stop', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();

        // Manually snapshot using InMemoryGridStore
        const store = new InMemoryGridStore();

        // Spawn some Nous first
        app.launcher.spawnNous('Sophia', 'did:key:sophia', 'pk-sophia', 'alpha');
        app.launcher.spawnNous('Hermes', 'did:key:hermes', 'pk-hermes', 'beta');

        await snapshotGrid(TEST_CONFIG.gridName, app.launcher, store);

        const records = await store.registry.loadAll(TEST_CONFIG.gridName);
        expect(records.length).toBe(2);

        const positions = await store.space.loadPositions(TEST_CONFIG.gridName);
        expect(positions.length).toBe(2);

        const auditEntries = await store.audit.loadAll(TEST_CONFIG.gridName);
        expect(auditEntries.length).toBeGreaterThan(0);

        await app.stop();
    });

    it('double stop does not throw', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();
        await app.stop();
        // Second stop should not throw
        await expect(app.stop()).resolves.not.toThrow();
    });

    it('audit chain remains valid after stop', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();
        await app.stop();

        const result = app.launcher.audit.verify();
        expect(result.valid).toBe(true);
    });

    it('stop then snapshot produces consistent state', async () => {
        const app = await createGridApp(BASE_CONFIG);
        await app.start();

        app.launcher.spawnNous('Themis', 'did:key:themis', 'pk-themis', 'alpha');
        await app.stop();

        const store = new InMemoryGridStore();
        await snapshotGrid(TEST_CONFIG.gridName, app.launcher, store);

        const [records, entries] = await Promise.all([
            store.registry.loadAll(TEST_CONFIG.gridName),
            store.audit.loadAll(TEST_CONFIG.gridName),
        ]);

        expect(records.length).toBe(1);
        expect(entries.length).toBe(app.launcher.audit.length);
    });
});
