/**
 * Sprint 13 — Server Startup
 *
 * Tests createGridApp() without a DB connection (in-memory mode):
 *   1. API server builds and responds to /health
 *   2. Grid status endpoint reflects correct state
 *   3. Seed Nous are spawned on first boot
 *   4. app.stop() halts the clock gracefully
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGridApp, type GridApp } from '../../src/main.js';
import { TEST_CONFIG } from '../../src/genesis/index.js';
import { Reviewer } from '../../src/review/index.js';
import type { GridAppConfig } from '../../src/main.js';

// No DB, no seed Nous in TEST_CONFIG (or we add our own)
const TEST_APP_CONFIG: GridAppConfig = {
    genesisConfig: {
        ...TEST_CONFIG,
        seedNous: [],        // start with no Nous; we control seeding
    },
    port: 0,                 // Fastify will pick a random available port
};

let app: GridApp | undefined;

// Phase 5: Reviewer singleton is process-global. Each test constructs a fresh
// Grid via createGridApp, which constructs a fresh Reviewer → reset first.
// The resetForTesting() symbol is deliberately not exported from the barrel
// (production code cannot reach it); Reviewer.resetForTesting lives on the class.
beforeEach(() => {
    Reviewer.resetForTesting();
});

afterEach(async () => {
    if (app) {
        await app.stop().catch(() => {/* ignore */});
        app = undefined;
    }
});

describe('Sprint 13: Server Startup', () => {

    it('createGridApp builds without DB config', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        expect(app).toBeDefined();
        expect(app.launcher).toBeDefined();
        expect(app.server).toBeDefined();
    });

    it('/health returns { status: "ok" }', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();

        const response = await app.server.inject({ method: 'GET', url: '/health' });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body) as { status: string; timestamp: number };
        expect(body.status).toBe('ok');
        expect(typeof body.timestamp).toBe('number');
    });

    it('/api/v1/grid/status reflects launcher state', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();

        const response = await app.server.inject({ method: 'GET', url: '/api/v1/grid/status' });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body) as {
            name: string; tick: number; regionCount: number; activeLaws: number;
        };
        expect(body.name).toBe(TEST_CONFIG.gridName);
        expect(typeof body.tick).toBe('number');
        expect(body.regionCount).toBe(TEST_CONFIG.regions.length);
    });

    it('/api/v1/grid/regions returns configured regions', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();

        const response = await app.server.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body) as { regions: { id: string }[] };
        expect(body.regions).toHaveLength(TEST_CONFIG.regions.length);
        const ids = body.regions.map(r => r.id).sort();
        expect(ids).toContain('alpha');
        expect(ids).toContain('beta');
    });

    it('clock is running after start()', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();

        expect(app.launcher.clock.running).toBe(true);
    });

    it('app.stop() halts the clock', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();
        await app.stop();

        expect(app.launcher.clock.running).toBe(false);
        app = undefined; // already stopped, skip afterEach cleanup
    });

    it('SEED_NOUS with matching regions are spawned on first boot', async () => {
        // createGridApp uses internal SEED_NOUS (agora, market, council).
        // TEST_CONFIG only has alpha/beta, so SEED_NOUS are filtered out.
        // To test first-boot spawning, use GENESIS_CONFIG (has agora/market/council).
        const { GENESIS_CONFIG } = await import('../../src/genesis/presets.js');
        const genesisAppConfig: GridAppConfig = {
            genesisConfig: GENESIS_CONFIG,
            port: 0,
        };
        const genesisApp = await createGridApp(genesisAppConfig);

        // All 3 SEED_NOUS (sophia/agora, hermes/market, themis/council) have
        // matching regions in GENESIS_CONFIG → all 3 spawned
        expect(genesisApp.launcher.registry.count).toBe(3);
        expect(genesisApp.launcher.registry.get('did:key:sophia')?.name).toBe('Sophia');
        expect(genesisApp.launcher.registry.get('did:key:hermes')?.name).toBe('Hermes');
        expect(genesisApp.launcher.registry.get('did:key:themis')?.name).toBe('Themis');

        await genesisApp.stop();
    });

    it('audit trail has entries after start', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();

        expect(app.launcher.audit.length).toBeGreaterThan(0);
    });

    it('/api/v1/audit/verify returns valid chain', async () => {
        app = await createGridApp(TEST_APP_CONFIG);
        await app.start();

        const response = await app.server.inject({ method: 'GET', url: '/api/v1/audit/verify' });
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body) as { valid: boolean };
        expect(body.valid).toBe(true);
    });
});
