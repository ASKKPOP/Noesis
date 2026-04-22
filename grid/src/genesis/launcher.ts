/**
 * Genesis Launcher — bootstraps a Grid world from configuration.
 *
 * Creates all subsystems, seeds initial state, starts the clock,
 * and provides a unified interface for the running Grid.
 */

import type { Pool } from 'mysql2/promise';
import { WorldClock } from '../clock/ticker.js';
import { SpatialMap } from '../space/map.js';
import { LogosEngine } from '../logos/engine.js';
import { AuditChain } from '../audit/chain.js';
import { EconomyManager } from '../economy/config.js';
import { ShopRegistry } from '../economy/shop-registry.js';
import { NousRegistry } from '../registry/registry.js';
import { DialogueAggregator } from '../dialogue/index.js';
import { RelationshipListener, RelationshipStorage, DEFAULT_RELATIONSHIP_CONFIG } from '../relationships/index.js';
import { GENESIS_SHOPS } from './presets.js';
import type { GenesisConfig, GridState } from './types.js';

export class GenesisLauncher {
    readonly clock: WorldClock;
    readonly space: SpatialMap;
    readonly logos: LogosEngine;
    readonly audit: AuditChain;
    readonly economy: EconomyManager;
    readonly registry: NousRegistry;
    readonly shops: ShopRegistry;
    /**
     * Phase 7 DIALOG-01: per-grid dialogue aggregator. Registers an
     * onAppend listener on the AuditChain at construction time and surfaces
     * completed bidirectional dialogue windows to GridCoordinator via
     * pull-query (drainPending). Pause-drained on clock pause to prevent
     * windows from spanning pause boundaries (D-04).
     */
    readonly aggregator: DialogueAggregator;
    /**
     * Phase 9 REL-01 (D-9-04): relationship listener — pure observer, sole
     * writer of the in-memory edges Map. Constructed AFTER the aggregator so
     * its onAppend listener is registered second (D-9-04 order preserved).
     * Not reset on pause — relationship warmth is time-integrated state that
     * survives pauses; recency_tick anchors decay relative to the next resume.
     */
    readonly relationships: RelationshipListener;
    /**
     * Snapshot writer for the derived `relationships` MySQL table. Null until
     * attachRelationshipStorage(pool) is called by main.ts after MySQL migrations
     * complete. The tick-driven snapshot branch in bootstrap() is a no-op until
     * storage is attached (recoverable via rebuildFromChain on next boot).
     *
     * Not readonly — HI-01 gap closure (09-VERIFICATION.md). The field must be
     * assignable post-construction so the single production pool owner (main.ts
     * DatabaseConnection) can inject after MigrationRunner.run(MIGRATIONS).
     */
    private relationshipStorage: RelationshipStorage | null;
    readonly gridName: string;
    readonly gridDomain: string;

    private startedAt = 0;

    constructor(private readonly config: GenesisConfig) {
        this.gridName = config.gridName;
        this.gridDomain = config.gridDomain;

        this.clock = new WorldClock({
            tickRateMs: config.tickRateMs,
            ticksPerEpoch: config.ticksPerEpoch,
        });
        this.space = new SpatialMap();
        this.logos = new LogosEngine();
        this.audit = new AuditChain();
        this.economy = new EconomyManager(config.economy);
        this.registry = new NousRegistry();
        this.shops = new ShopRegistry();

        // Phase 7 DIALOG-01 (D-25): default windowTicks=5, minExchanges=2.
        // The aggregator MUST be constructed AFTER `this.audit` so its onAppend
        // listener is wired to the same AuditChain instance the Grid uses.
        const dialogueCfg = config.dialogue ?? { windowTicks: 5, minExchanges: 2 };
        this.aggregator = new DialogueAggregator(this.audit, dialogueCfg);

        // Phase 9 REL-01 (D-9-04): RelationshipListener is constructed AFTER the
        // aggregator so its onAppend listener is wired to the same AuditChain instance,
        // matching the order the Phase 7 zero-diff regression tests validate.
        // See 09-CONTEXT.md D-9-04.
        const relationshipCfg = config.relationship ?? DEFAULT_RELATIONSHIP_CONFIG;
        this.relationships = new RelationshipListener(this.audit, relationshipCfg);

        // Storage is optional — if no mysql2 pool is present (unit-test launcher),
        // snapshot scheduling is a no-op. The audit chain remains the source of truth;
        // losing snapshot cadence only loses the fast-boot path.
        // GenesisLauncher has no pool field (pool lives in GridStore / db layer).
        // We set this to null here; production wiring via GridStore injects storage
        // after construction if needed. Tests that don't need MySQL snapshots pass null.
        this.relationshipStorage = null;
    }

    /**
     * Attach a MySQL pool for the derived `relationships` table snapshot path.
     *
     * Must be called exactly once, AFTER construction but BEFORE start().
     * Idempotent: calling twice with the same pool is a no-op; calling with a
     * different pool throws (prevents accidental pool-switch mid-run).
     *
     * Called by main.ts after MigrationRunner.run(MIGRATIONS) so the schema
     * for `sql/009_relationships.sql` is in place before the first snapshot.
     *
     * Closes HI-01 (09-VERIFICATION.md): makes REL-02 MySQL materialization
     * path reachable in production. Without this call the snapshot branch in
     * bootstrap() is dead; audit-chain rebuild remains source of truth.
     */
    attachRelationshipStorage(pool: Pool): void {
        if (this.relationshipStorage !== null) {
            // Idempotent-by-reference: same pool is fine, different pool is a bug.
            // We compare the wrapped pool via a stored reference, exposed as getter.
            if (this.relationshipStorage.pool === pool) {
                return;
            }
            throw new Error(
                'GenesisLauncher.attachRelationshipStorage called twice with different pools',
            );
        }
        this.relationshipStorage = new RelationshipStorage(pool);
    }

    /**
     * Bootstrap the Grid — seed regions, laws, Nous, then wire the clock.
     *
     * Options:
     *   skipSeedNous — skip spawning the config's seed Nous and the genesis audit entry.
     *                  Use this when restoring from a GridStore snapshot so that
     *                  DB-persisted Nous are loaded instead of re-spawned from config.
     */
    bootstrap(opts: { skipSeedNous?: boolean } = {}): void {
        // 1. Seed regions
        for (const region of this.config.regions) {
            this.space.addRegion(region);
        }

        // 2. Seed connections
        for (const conn of this.config.connections) {
            this.space.addConnection(conn);
        }

        // 3. Enact founding laws
        for (const law of this.config.laws) {
            this.logos.addLaw(law);
        }

        if (!opts.skipSeedNous) {
            // 4. Spawn seed Nous
            const tick = this.clock.currentTick;
            for (const seed of this.config.seedNous) {
                const record = this.registry.spawn(
                    {
                        name: seed.name,
                        did: seed.did,
                        publicKey: seed.publicKey,
                        region: seed.region,
                        humanOwner: seed.humanOwner,
                        personality: seed.personality,
                    },
                    this.gridDomain,
                    tick,
                    this.economy.initialSupply,
                );

                // Place in spatial map
                this.space.placeNous(record.did, record.region);

                // Audit the spawn
                this.audit.append('nous.spawned', record.did, {
                    name: record.name,
                    region: record.region,
                    ndsAddress: record.ndsAddress,
                });
            }

            // 5. Record genesis event
            this.audit.append('grid.genesis', 'system', {
                gridName: this.gridName,
                gridDomain: this.gridDomain,
                regions: this.config.regions.length,
                laws: this.config.laws.length,
                seedNous: this.config.seedNous.length,
            });
        }

        // 5b. Register preset shops whose owner exists in the registry.
        // Shops for unknown owners are skipped with a warn so demo data
        // tolerates renamed/removed seed Nous (D7 — pure memory).
        for (const shop of GENESIS_SHOPS) {
            if (this.registry.get(shop.ownerDid)) {
                this.shops.register(shop);
            } else {
                console.warn(`[genesis] skipping shop for unknown owner: ${shop.ownerDid}`);
            }
        }

        // 6. Wire clock tick to registry updates + audit heartbeat.
        // The audit entry is emitted so the dashboard HeartbeatStore can compute
        // staleness without polling /api/v1/grid/clock. See 03-01-PLAN.md §Tick
        // audit emission. Registry touch runs first so tick audit reflects the
        // post-touch state.
        const relationshipCfgForTick = this.config.relationship ?? DEFAULT_RELATIONSHIP_CONFIG;
        this.clock.onTick(event => {
            for (const record of this.registry.active()) {
                this.registry.touch(record.did, event.tick);
            }
            this.audit.append('tick', 'system', {
                tick: event.tick,
                epoch: event.epoch,
                tickRateMs: this.clock.state.tickRateMs,
                timestamp: event.timestamp,
            });

            // D-9-03: Snapshot every N ticks (default 100). Fire-and-forget per OQ-2 —
            // tick is never blocked on MySQL I/O. Missed snapshots are losslessly
            // recoverable via rebuildFromChain() on restart.
            if (
                this.relationshipStorage &&
                event.tick > 0 &&
                event.tick % relationshipCfgForTick.snapshotCadenceTicks === 0
            ) {
                this.relationshipStorage.scheduleSnapshot(this.relationships.allEdges(), event.tick);
            }
        });

        // P-9-02: AuditChain.loadEntries() does NOT fire onAppend. Manual replay is
        // required to reconstruct the derived view. Must run BEFORE the clock starts —
        // otherwise new entries could be double-processed (once by rebuild, once by the
        // live onAppend). Called here (end of bootstrap) so the chain is fully populated.
        this.relationships.rebuildFromChain();
    }

    /** Start the Grid clock. */
    start(): void {
        this.startedAt = Date.now();
        this.clock.start();
        this.audit.append('grid.started', 'system', { tick: this.clock.currentTick });
    }

    /** Stop the Grid clock. */
    stop(): void {
        this.audit.append('grid.stopped', 'system', { tick: this.clock.currentTick });
        this.clock.stop();
    }

    /**
     * Phase 7 DIALOG-01 (D-04): drop all buffered dialogue state. Called by
     * the operator clock-pause HTTP handler AFTER WorldClock.pause() so a
     * dialogue window cannot bridge a pause boundary. Idempotent — calling
     * when the aggregator is already empty is a no-op.
     *
     * Kept as a dedicated method on the launcher (not a direct
     * aggregator.reset() call from the HTTP handler) so the producer
     * boundary is testable and discoverable from one place.
     */
    drainDialogueOnPause(): void {
        this.aggregator.reset();
        // NOTE: No reset of this.relationships on pause. Dialogue windows are
        // pause-bounded (D-04 Phase 7); relationship warmth is time-integrated
        // state that survives pauses. recency_tick on each edge correctly anchors
        // decay relative to the next resume tick.
    }

    /** Get current Grid state. */
    get state(): GridState {
        const clockState = this.clock.state;
        return {
            gridName: this.gridName,
            gridDomain: this.gridDomain,
            tick: clockState.tick,
            epoch: clockState.epoch,
            nousCount: this.registry.count,
            regionCount: this.space.allRegions().length,
            activeLaws: this.logos.activeLaws().length,
            auditEntries: this.audit.length,
            running: this.clock.running,
            startedAt: this.startedAt,
        };
    }

    /** Spawn a new Nous into a running Grid. */
    spawnNous(
        name: string, did: string, publicKey: string, region: string, humanOwner?: string,
    ): void {
        const tick = this.clock.currentTick;
        const record = this.registry.spawn(
            { name, did, publicKey, region, humanOwner },
            this.gridDomain,
            tick,
            this.economy.initialSupply,
        );

        this.space.placeNous(record.did, record.region);
        this.audit.append('nous.spawned', record.did, {
            name, region, ndsAddress: record.ndsAddress,
        });
    }
}
