/**
 * Grid main — creates and runs the full Grid application.
 *
 * Exported as `createGridApp` for testability.
 * The thin `entrypoint.ts` calls `startGrid()` with env-based config.
 */

import { GenesisLauncher } from './genesis/launcher.js';
import { GENESIS_CONFIG } from './genesis/presets.js';
import { buildServer } from './api/server.js';
import {
    DatabaseConnection,
    MigrationRunner,
    GridStore,
    snapshotGrid,
    restoreGrid,
    MIGRATIONS,
} from './db/index.js';
import type { GenesisConfig } from './genesis/types.js';
import type { FastifyInstance } from 'fastify';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GridAppConfig {
    genesisConfig: GenesisConfig;
    port: number;
    /** MySQL connection options. Optional — if absent, no DB persistence. */
    db?: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
}

export interface GridApp {
    launcher: GenesisLauncher;
    server: FastifyInstance;
    start(): Promise<void>;
    stop(): Promise<void>;
}

// ── Seed Nous for first-boot (not in GENESIS_CONFIG to keep config clean) ────

const SEED_NOUS = [
    { name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk-sophia', region: 'agora' },
    { name: 'Hermes', did: 'did:key:hermes', publicKey: 'pk-hermes', region: 'market' },
    { name: 'Themis', did: 'did:key:themis', publicKey: 'pk-themis', region: 'council' },
] as const;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a fully configured Grid application.
 *
 * This function:
 *   1. Connects to MySQL (if db config provided) and runs migrations
 *   2. Bootstraps Grid infrastructure (regions, laws)
 *   3. Restores Nous from DB snapshot, or seeds fresh Nous on first boot
 *   4. Builds the Fastify API server
 *
 * Does NOT start the clock or listen for HTTP — call `app.start()` for that.
 */
export async function createGridApp(config: GridAppConfig): Promise<GridApp> {
    const launcher = new GenesisLauncher(config.genesisConfig);

    let store: GridStore | undefined;

    // Connect to DB + run migrations if configured
    if (config.db) {
        const conn = DatabaseConnection.fromConfig(config.db);
        const runner = new MigrationRunner(conn);
        await runner.run(MIGRATIONS);
        store = new GridStore(conn, config.genesisConfig.gridName);
    }

    // Bootstrap infra (regions, connections, laws) — skip Nous for now
    launcher.bootstrap({ skipSeedNous: true });

    // Restore Nous from DB if available, otherwise seed fresh
    let restored = false;
    if (store) {
        restored = await restoreGrid(config.genesisConfig.gridName, launcher, store);
    }

    if (!restored) {
        // First boot — spawn seed Nous whose regions exist in this Grid's config
        const availableRegions = new Set(config.genesisConfig.regions.map(r => r.id));
        for (const seed of SEED_NOUS) {
            if (availableRegions.has(seed.region)) {
                launcher.spawnNous(seed.name, seed.did, seed.publicKey, seed.region);
            }
        }
        // Persist initial state if DB available
        if (store) {
            await snapshotGrid(config.genesisConfig.gridName, launcher, store);
        }
    }

    const server = buildServer({
        clock: launcher.clock,
        space: launcher.space,
        logos: launcher.logos,
        audit: launcher.audit,
        gridName: launcher.gridName,
    });

    return {
        launcher,
        server,

        async start(): Promise<void> {
            launcher.start();
            await server.listen({ port: config.port, host: '0.0.0.0' });
            console.log(`[Grid] ${launcher.gridName} started on port ${config.port}`);
            console.log(`[Grid] Nous: ${launcher.registry.count} | Regions: ${launcher.space.allRegions().length}`);
        },

        async stop(): Promise<void> {
            // Snapshot before shutdown
            if (store) {
                await snapshotGrid(config.genesisConfig.gridName, launcher, store).catch(
                    err => console.warn('[Grid] Snapshot failed on shutdown:', err),
                );
            }
            launcher.stop();
            await server.close();
            console.log(`[Grid] ${launcher.gridName} stopped`);
        },
    };
}

// ── Environment-based config factory ─────────────────────────────────────────

/** Build GridAppConfig from environment variables. */
export function configFromEnv(): GridAppConfig {
    const genesisConfig = {
        ...GENESIS_CONFIG,
        gridName: process.env.GRID_NAME ?? GENESIS_CONFIG.gridName,
        gridDomain: process.env.GRID_DOMAIN ?? GENESIS_CONFIG.gridDomain,
        tickRateMs: process.env.GRID_TICK_RATE_MS
            ? parseInt(process.env.GRID_TICK_RATE_MS, 10)
            : GENESIS_CONFIG.tickRateMs,
    };

    const port = process.env.GRID_PORT ? parseInt(process.env.GRID_PORT, 10) : 8080;

    // Only connect to DB if MYSQL_HOST is set
    const db = process.env.MYSQL_HOST
        ? {
              host: process.env.MYSQL_HOST,
              port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
              database: process.env.MYSQL_DATABASE ?? 'noesis_grid',
              user: process.env.MYSQL_USER ?? 'noesis',
              password: process.env.MYSQL_PASSWORD ?? '',
          }
        : undefined;

    return { genesisConfig, port, db };
}

// ── Top-level start function ─────────────────────────────────────────────────

/** Start the Grid from environment config. Called by entrypoint.ts. */
export async function startGrid(): Promise<void> {
    const config = configFromEnv();
    const app = await createGridApp(config);

    // Graceful shutdown on SIGTERM / SIGINT
    const shutdown = async (signal: string) => {
        console.log(`[Grid] Received ${signal} — shutting down…`);
        await app.stop();
        process.exit(0);
    };

    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT', () => void shutdown('SIGINT'));

    await app.start();
}
