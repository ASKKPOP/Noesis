/**
 * Grid main — creates and runs the full Grid application.
 *
 * Exported as `createGridApp` for testability.
 * The thin `entrypoint.ts` calls `startGrid()` with env-based config.
 */

import { GenesisLauncher } from './genesis/launcher.js';
import { GENESIS_CONFIG } from './genesis/presets.js';
import { buildServer } from './api/server.js';
import { HumanRegistry } from './human/index.js';
import { Reviewer } from './review/index.js';
import { GridCoordinator } from './integration/grid-coordinator.js';
import { NousRunner } from './integration/nous-runner.js';
import type { IBrainBridge } from './integration/types.js';
import { LoreStorage } from './lore/LoreStorage.js';
import {
    AuditStore,
    DatabaseConnection,
    MigrationRunner,
    GridStore,
    PersistentAuditChain,
    snapshotGrid,
    restoreGrid,
    MIGRATIONS,
} from './db/index.js';
import { AuditReconcile } from './db/audit-reconcile.js';
import { CivicDidStore, BusinessDidStore } from './civic-registry/index.js';
import { BrainTokenStore } from './db/stores/brain-token-store.js';
import { PresenceStore } from './civic-presence/presence-store.js';
import { MessageQueueStore } from './civic-presence/message-queue-store.js';
import { GraceTimerRegistry } from './civic-presence/grace-timer-registry.js';
import { PresenceService } from './civic-presence/presence-service.js';
import { ParcelRegistry } from './civic/parcel-registry.js';
import { ParcelStore } from './civic/parcel-store.js';
import { GroupStore } from './economy/group-store.js';
import { GridRegistry } from './registry/grid-registry.js';
import { getEnvironment } from './registry/grid-environments.js';
import { gridRecordFromConfig } from './registry/grid-record-from-config.js';
import { gravityPrice, recordPolisOverride } from './civic/founding-law.js';
import { TREASURY_DID } from './api/routes/registry.js';
import type { GenesisConfig } from './genesis/types.js';
import type { FastifyInstance } from 'fastify';
import type { SpawnNousDeps } from './api/operator/spawn-system-nous.js';

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
    { name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk-sophia', region: 'agora' },
    { name: 'Hermes', did: 'did:noesis:hermes', publicKey: 'pk-hermes', region: 'market' },
    { name: 'Themis', did: 'did:noesis:themis', publicKey: 'pk-themis', region: 'council' },
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
    let store: GridStore | undefined;
    let dbConn: DatabaseConnection | undefined;
    let chain: PersistentAuditChain | undefined;
    let auditReconcile: AuditReconcile | undefined;

    // Connect to DB + run migrations if configured.
    // Phase 31 OBS-01 (D-31-A1): construct PersistentAuditChain BEFORE the
    // GenesisLauncher so listeners constructed inside the launcher constructor
    // (DialogueAggregator, RelationshipListener, NormDetector, GovernanceEngine)
    // bind to the persistent chain — see CONTEXT.md D-31-A1.
    if (config.db) {
        dbConn = new DatabaseConnection(config.db);
        const runner = new MigrationRunner(dbConn);
        await runner.run();
        store = new GridStore(dbConn);
        const auditStore = new AuditStore(dbConn);
        chain = new PersistentAuditChain(auditStore, config.genesisConfig.gridName);

        // Phase 31 OBS-02 (D-31-C3): tick-cadenced reconcile loop. Wired into the
        // launcher's clock.onTick block via deps.auditReconcile. Cadence = every 60 ticks.
        auditReconcile = new AuditReconcile(
            chain,
            auditStore,
            dbConn,
            config.genesisConfig.gridName,
        );
    }

    const launcher = new GenesisLauncher(
        config.genesisConfig,
        chain ? { audit: chain, auditReconcile } : undefined,
    );

    // Bootstrap infra (regions, connections, laws) — skip Nous for now
    launcher.bootstrap({ skipSeedNous: true });

    // D-03: SpawnNousDeps — wraps launcher.spawnNous for spawn-system-nous route.
    const spawnNousDeps = {
        spawnNous: (name: string, did: string, publicKey: string, region: string) =>
            launcher.spawnNous(name, did, publicKey, region),
    };

    // HI-01 closure (09-VERIFICATION.md): wire the derived `relationships`
    // MySQL snapshot path. MUST run AFTER MigrationRunner so
    // sql/009_relationships.sql is applied before the first snapshot fires,
    // and AFTER launcher.bootstrap() so the tick listener is already
    // registered (attach is an assignment; the listener sees non-null on
    // the next tick that matches snapshotCadenceTicks).
    if (dbConn) {
        launcher.attachRelationshipStorage(dbConn.getPool());
        // Governance → RFP bridge: late-wire the MySQL pool + audit chain so enacted
        // `procurement` bills can call ProcurementStore.issueNotice fire-and-forget.
        // Mirrors attachRingExpansion (same late-wire-after-pool pattern). Absent in
        // DB-less contexts; the bridge is a no-op until pool is available (VOTE-05 safe).
        launcher.governance.attachProcurementBridge({ pool: dbConn.getPool(), audit: chain ?? undefined });
    }

    // Phase 5 (REV-03, D-06, D-07): Construct the ReviewerNous singleton once per Grid.
    // MUST run AFTER launcher.bootstrap() — Reviewer depends on launcher.audit + launcher.registry
    // being initialized. Second construction throws (D-07 singleton enforcement via static flag).
    // Any future code path that instantiates NousRunner instances must pass this reviewer in via
    // NousRunnerConfig.reviewer. The getRunner() stub below currently returns undefined — when
    // runners land in main.ts (sub-plan future), inject `reviewer` at each construction site.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const reviewer = new Reviewer(launcher.audit, launcher.registry);

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

    const humanRegistry = new HumanRegistry();

    const loreStorage = dbConn ? new LoreStorage(dbConn.getPool()) : undefined;

    // D-02: humanSanctionStore — DB pool wrapper for ban-human + freeze-wallet routes.
    // Must be conditioned on dbConn (test envs run without MySQL).
    // Pool is captured at IIFE construction time so future reassignment of dbConn
    // cannot cause a null dereference inside the closures.
    const humanSanctionStore = dbConn ? (() => {
        const pool = dbConn.getPool();
        return {
            async existsByDid(did: string): Promise<boolean> {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const [rows] = await pool.query('SELECT did FROM human_users WHERE did = ? LIMIT 1', [did]) as any;
                return (rows as Array<{ did: string }>).length > 0;
            },
            async setBanned(did: string): Promise<void> {
                await pool.query('UPDATE human_users SET banned = 1 WHERE did = ?', [did]);
            },
            async setFrozen(did: string): Promise<void> {
                await pool.query('UPDATE human_users SET frozen = 1 WHERE did = ?', [did]);
            },
            async getFlags(did: string): Promise<{ frozen: number; banned: number } | null> {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const [rows] = await pool.query('SELECT frozen, banned FROM human_users WHERE did = ? LIMIT 1', [did]) as any;
                return (rows as Array<{ frozen: number; banned: number }>)[0] ?? null;
            },
        };
    })() : undefined;

    // Phase 26 ONBOARD-04: humanPool — lightweight pool reference for onboarding_goal
    // queries on GET /me and PATCH /me. Follows the humanSanctionStore closure pattern.
    const humanPool = dbConn ? dbConn.getPool() : undefined;

    // Phase 41 — PresenceService wiring (SLEEP-01..05).
    // Only constructed when a DB connection is available (mirrors loreStorage / humanPool pattern).
    // civicDidStore / businessDidStore are hoisted to the outer scope so they can ALSO be
    // attached to GridServices below — the DID Registry routes (Phase 37) and the human
    // Civic-DID application route (civic.ts) read services.civicDidStore. Without this they
    // were constructed for PresenceService only and the registry/civic routes 503'd.
    let presenceService: PresenceService | undefined;
    let civicDidStore: CivicDidStore | undefined;
    let businessDidStore: BusinessDidStore | undefined;
    // Phase 38 WIRE-02: hoisted for the same reason as civicDidStore above — the
    // Brain bearer-token routes (brain-token.ts) and tryDid.ts's EdDSA JWT branch
    // read services.brainTokenStore. This was never constructed in production,
    // leaving POST /api/v1/brain/token/register permanently 503 (same "registry
    // not wired" bug class as R-H-01 / the civicDidStore fix above).
    let brainTokenStore: BrainTokenStore | undefined;
    // Phase 58 HOUSE-1 (R-58-05 / D-58-07): civic-land registry + write-through store,
    // hoisted so they can ALSO be attached to GridServices below (registry-not-wired
    // bug class — R-H-01). DB is source of truth; the registry is a read cache.
    let parcels: { registry: ParcelRegistry; store: ParcelStore } | undefined;
    let groupStore: GroupStore | undefined;  // hoisted for GridServices (spec §2 discovery)
    if (dbConn) {
        const presencePool = dbConn.getPool();
        const presenceStore = new PresenceStore(presencePool);
        const messageQueueStore = new MessageQueueStore(presencePool);
        const graceTimerRegistry = new GraceTimerRegistry();
        civicDidStore = new CivicDidStore(presencePool);
        businessDidStore = new BusinessDidStore(presencePool);
        brainTokenStore = new BrainTokenStore({ gridName: config.genesisConfig.gridName, pool: presencePool });
        // Phase 58 HOUSE-1: seed the Genesis Core (idempotent, no audit events) then
        // hydrate the read cache from the DB (source of truth) and emit the boot log.
        const parcelRegistry = new ParcelRegistry(config.genesisConfig.gridName);
        const parcelStore = new ParcelStore(presencePool, config.genesisConfig.gridName);
        await parcelStore.seedGenesisCore(parcelRegistry);
        const parcelCount = await parcelStore.hydrate(parcelRegistry);
        console.log(`[civic] parcels loaded: ${parcelCount}`);
        parcels = { registry: parcelRegistry, store: parcelStore };
        // Groups & Holdings · Phase 1 (D-GROUP-04): seed the five founding Businesses as
        // orbital anchors in the business sector (idempotent). Each freshly-inserted row
        // emits one group.founded onto the audit chain (founding at genesis tick 0).
        groupStore = new GroupStore(presencePool, config.genesisConfig.gridName);
        const groupsSeeded = await groupStore.seedGenesisGroups(chain!, 0);
        console.log(`[civic] groups seeded: ${groupsSeeded}`);
        // Phase 59 HOUSE-2 (D-59-06 / R-H-03): late-wire the upkeep scanner now that the
        // parcel registry/store exist. It rides the EXISTING clock.onTick block in the
        // launcher (no new subscription). The facade composes parcel-registry ladder +
        // store persist + Nous-registry balance/transfer; treasury = TREASURY_DID.
        launcher.attachUpkeepScanner({
            registry: {
                list: (filter) => parcelRegistry.list(filter),
                get: (did) => launcher.registry.get(did),
                transferOusia: (from, to, amount) => launcher.registry.transferOusia(from, to, amount),
                advanceCondition: (address) => parcelRegistry.advanceCondition(address),
                resetCondition: (address) => parcelRegistry.resetCondition(address),
                persistUpkeep: (parcel) => parcelStore.persistUpkeep(parcel),
                persistReclaim: (parcel) => parcelStore.persistReclaim(parcel),
            },
            audit: chain!,
            treasuryDid: TREASURY_DID,
        });
        // Phase 60 HOUSE-3 (D-60-08 / R-60-10): late-wire the ring-expansion TEMPLATE onto the
        // governance engine now that the parcel registry + founding-law read-through exist. The
        // template fires from the EXISTING gov.law_enacted dispatch (onTickClosed →
        // appendProposalTallied passed-branch) — NO new event / governance path / clock.onTick.
        // seedZone seeds the legislated frontier ring at its gravity price (residential band),
        // idempotently (alreadySeeded = ring already has parcels); amendConstant records a Polis
        // override via founding-law.recordPolisOverride. No audit emit (world-creation, R-31-01).
        launcher.governance.attachRingExpansion({
            seedZone: (ring) => {
                parcelRegistry.seedZone({
                    zoneId: 'residential',
                    count: 24,
                    priceBios: gravityPrice(ring),
                    ring,
                });
            },
            alreadySeeded: (ring) => parcelRegistry.list().some(p => p.ring === ring),
            amendConstant: (key, value) => recordPolisOverride(key, value),
        });
        presenceService = new PresenceService({
            gridName: config.genesisConfig.gridName,
            presenceStore,
            messageQueueStore,
            graceTimerRegistry,
            civicDidStore,
            businessDidStore,
            audit: chain!,
            currentTick: () => launcher.clock.currentTick,
        });
        launcher.attachPresenceService(presenceService);
    }

    // Phase 28 SPAWN-01: EVM RPC client for payment confirmation.
    // Only wired when GRID_EVM_RPC_URL is present — tests and DB-less envs omit it.
    // Uses raw JSON-RPC (eth_getTransactionReceipt + eth_getTransactionByHash) so that
    // no extra npm dependency is needed inside the grid container.
    const evmRpcUrl = process.env.GRID_EVM_RPC_URL;
    const evmConfirmTx = evmRpcUrl
        ? async (txHash: string): Promise<{ confirmed: boolean; from?: string }> => {
              try {
                  // eth_getTransactionReceipt — null when tx is pending/unknown
                  const receiptRes = await fetch(evmRpcUrl, {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
                  });
                  const receiptJson = await receiptRes.json() as { result: { status: string; from?: string } | null };
                  if (!receiptJson.result || receiptJson.result.status !== '0x1') {
                      return { confirmed: false };
                  }
                  return { confirmed: true, from: receiptJson.result.from };
              } catch {
                  return { confirmed: false };
              }
          }
        : undefined;

    // Multi-Grid framework (spec §2): the Portal's registry of active Grids. Each
    // Grid self-registers from its own config (H1) — Genesis on Earth-orbit, or a
    // Moon Grid (GRID_NAME=moon GRID_ENV=Moon) with Moon Polis + Moon physics.
    // Cross-grid federation/membership remain v3.1+.
    const gridRegistry = new GridRegistry();
    gridRegistry.register(gridRecordFromConfig(config.genesisConfig));

    // Phase 38 WIRE-01/02 (Brain→Grid write-back): wire a GridCoordinator so an
    // external Brain (over HTTPS) can dispatch a Civic-DID holder's actions to
    // its NousRunner: /api/v1/brain/actions → coordinator.getRunnerByCivicDid →
    // runner.executeActions → sole-producer audit events. On Civic-DID issuance
    // the registry route calls coordinator.registerCivicDid (binding, this plan).
    //
    // Seeded Nous get HEADLESS runners: a disconnected stub bridge makes on_tick
    // early-return (bridge.connected === false), so they NEVER double-tick the
    // launcher's in-process simulation — they exist only to (a) be bound to a
    // Civic-DID on issuance and (b) dispatch external actions to the audit chain.
    // The coordinator is not clock-subscribed (no startListening) — passive.
    const coordinator = new GridCoordinator(launcher);
    {
        // Disconnected stub: connected=false short-circuits every pull-model call
        // (on_tick/on_message early-return), so these methods are never invoked.
        // They exist only to satisfy IBrainBridge; the runner serves external
        // action dispatch (executeActions) which does not touch the bridge.
        const stubBridge: IBrainBridge = {
            connected: false,
            sendTick: async () => [],
            sendMessage: async () => [],
            sendEvent: () => {},
            getState: async () => ({}),
            queryMemory: async () => ({ entries: [] }),
            forceTelos: async () => ({ telos_hash_before: '', telos_hash_after: '' }),
        };
        const availableRegions = new Set(config.genesisConfig.regions.map((r) => r.id));
        for (const seed of SEED_NOUS) {
            if (!availableRegions.has(seed.region)) continue;
            coordinator.addRunner(new NousRunner({
                nousDid: seed.did,
                nousName: seed.name,
                bridge: stubBridge,
                space: launcher.space,
                audit: chain ?? launcher.audit,   // persist to MySQL when wired
                registry: launcher.registry,
                economy: launcher.economy,
                reviewer,
                groupStore,
            }));
        }
    }

    const server = buildServer({
        clock: launcher.clock,
        space: launcher.space,
        logos: launcher.logos,
        audit: launcher.audit,
        gridName: launcher.gridName,
        registry: launcher.registry,
        shops: launcher.shops,
        groupStore,
        coordinator,   // Phase 38: external Brain action dispatch + WIRE-02 Civic-DID binding
        gridRegistry,
        relationships: launcher.relationships,
        humanRegistry,
        config: { relationship: config.genesisConfig.relationship },
        governance: {
            store: launcher.governanceStore,
            engine: launcher.governance,
        },
        ...(loreStorage ? { lore: { storage: loreStorage } } : {}),
        ...(humanSanctionStore ? { humanSanctionStore } : {}),
        ...(humanPool ? { humanPool } : {}),
        // Phase 28 SPAWN-01: EVM tx confirmation + launcher accessor for human-spawn routes.
        ...(evmConfirmTx ? { evmConfirmTx } : {}),
        // Phase 34-01.1 (post-UAT-blocker fix): expose the Phase 32 OBS-07 launcher
        // surface (healthWatchdog/auditReconcile/clock + attach*) so buildServerWithHub
        // can register /health/detailed in production. Previously only `spawnNous`
        // was passed, which silently failed the `services.launcher.attachHealthWatchdog`
        // typeof check at server.ts:597 — Phase 32's route never registered at runtime.
        launcher: {
            spawnNous: (name: string, did: string, pk: string, region: string, humanOwner?: string, personalitySeed?: string) =>
                launcher.spawnNous(name, did, pk, region, humanOwner, personalitySeed),
            get healthWatchdog() { return launcher.healthWatchdog; },
            get auditReconcile() { return launcher.auditReconcile; },
            get clock() { return { currentTick: launcher.clock.currentTick, running: launcher.clock.running }; },
            attachHealthWatchdog: (wd) => launcher.attachHealthWatchdog(wd),
            attachFirehoseHub: (hub) => launcher.attachFirehoseHub(hub),
        },
        // Phase 39 TENANT-01: MySQL pool for operator/me/* routes (wired here rather than Phase 39 to keep diff minimal).
        // Phase 41 SLEEP-01: PresenceService + currentTick for presence/inbox/message routes.
        ...(dbConn ? { pool: dbConn.getPool() } : {}),
        ...(presenceService ? { presenceService, currentTick: () => launcher.clock.currentTick } : {}),
        // DID Registry stores — read by registry routes (Phase 37) + human civic application (civic.ts).
        ...(civicDidStore ? { civicDidStore } : {}),
        ...(businessDidStore ? { businessDidStore } : {}),
        ...(brainTokenStore ? { brainTokenStore } : {}),
        // Phase 58 HOUSE-1 (R-58-05 / D-58-07): civic-land registry + store attached to
        // GridServices so civic-parcels routes (Wave 3) can read/persist parcels.
        ...(parcels ? { parcels } : {}),
        // Phase 42 P2P-01..05: P2P peer store + SDP inbox + TURN credentials.
        // launcher.p2pService is populated by launcher.start() and accessible here for GridServices wiring.
        // Wired unconditionally — P2PService is in-memory and requires no DB connection.
        ...(launcher.p2pService ? { p2pService: launcher.p2pService } : {}),
        // D-03: inject spawnNousDeps via _spawnNousDeps escape hatch (see spawn-system-nous.ts line 89).
        // Cast required because _spawnNousDeps is not on the public GridServices interface.
        ...({ _spawnNousDeps: spawnNousDeps } as unknown as { _spawnNousDeps: SpawnNousDeps }),
        // Plan 04-03: runner lookup for the inspector proxy. Runners are
        // constructed by a future sub-plan that wires GridCoordinator here;
        // until then the lookup always returns undefined → 404 unknown_nous.
        // That is the correct behaviour for a Grid with no brain bridges.
        // O1a NOTE: when NousRunner construction lands here, pass groupStore
        // into NousRunnerConfig so join_group/leave_group dispatch to the
        // sole-producer GroupStore. The groupStore instance is in scope above.
        getRunner: () => undefined,
        // Phase 7 DIALOG-01 (D-04): wire the launcher's dialogue aggregator
        // drain into the clock-pause HTTP handler so pause drops all
        // buffered dialogue state atomically with the pause operator event.
        drainDialogueOnPause: () => launcher.drainDialogueOnPause(),
    });

    return {
        launcher,
        server,

        async start(): Promise<void> {
            launcher.start();
            await server.listen({ port: config.port, host: '0.0.0.0' });
            console.log(`[Grid] ${launcher.gridName} started on port ${config.port}`);
            // Shops are constructed by the launcher from GENESIS_SHOPS but REST wiring
            // lands in Plan 04-03; log the count so operators can confirm seed shops
            // registered (or were skipped for missing owners) on boot.
            console.log(
                `[Grid] Nous: ${launcher.registry.count} | ` +
                `Regions: ${launcher.space.allRegions().length} | ` +
                `Shops: ${launcher.shops.count}`,
            );
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
        // H1: GRID_ENV selects the celestial body (Earth-orbit | Moon | Mars); an
        // unknown/absent value falls back to Earth-orbit via getEnvironment().
        environment: getEnvironment(process.env.GRID_ENV),
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
