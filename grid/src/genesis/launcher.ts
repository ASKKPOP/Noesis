/**
 * Genesis Launcher — bootstraps a Grid world from configuration.
 *
 * Creates all subsystems, seeds initial state, starts the clock,
 * and provides a unified interface for the running Grid.
 */

import { WorldClock } from '../clock/ticker.js';
import { SpatialMap } from '../space/map.js';
import { LogosEngine } from '../logos/engine.js';
import { AuditChain } from '../audit/chain.js';
import { EconomyManager } from '../economy/config.js';
import { NousRegistry } from '../registry/registry.js';
import type { GenesisConfig, GridState } from './types.js';

export class GenesisLauncher {
    readonly clock: WorldClock;
    readonly space: SpatialMap;
    readonly logos: LogosEngine;
    readonly audit: AuditChain;
    readonly economy: EconomyManager;
    readonly registry: NousRegistry;
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

        // 6. Wire clock tick to registry updates + audit heartbeat.
        // The audit entry is emitted so the dashboard HeartbeatStore can compute
        // staleness without polling /api/v1/grid/clock. See 03-01-PLAN.md §Tick
        // audit emission. Registry touch runs first so tick audit reflects the
        // post-touch state.
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
        });
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
