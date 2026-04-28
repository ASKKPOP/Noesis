/**
 * GridCoordinator — orchestrates multiple NousRunners on a single Grid.
 *
 * Responsibilities:
 * - Subscribe to WorldClock ticks and distribute to all runners
 * - Route "speak" actions between Nous in the same region
 * - Add/remove runners as Nous spawn or leave
 */

import type { GenesisLauncher } from '../genesis/launcher.js';
import type { NousRunner } from './nous-runner.js';

export class GridCoordinator {
    private readonly runners = new Map<string, NousRunner>(); // keyed by nousDid
    private tickListenerActive = false;

    constructor(private readonly launcher: GenesisLauncher) {}

    /** Add a NousRunner to the coordinator. */
    addRunner(runner: NousRunner): void {
        // Wire speak handler: when this Nous speaks, relay to same-region Nous
        runner.onSpeak((speaker, channel, text, tick) => {
            this.routeMessage(speaker.nousDid, speaker.nousName, channel, text, tick);
        });

        this.runners.set(runner.nousDid, runner);
    }

    /** Remove a runner (Nous left or disconnected). */
    removeRunner(nousDid: string): void {
        this.runners.delete(nousDid);
    }

    /**
     * Start listening to the Grid clock.
     * On each tick, all connected runners are notified in parallel.
     */
    start(): void {
        if (this.tickListenerActive) return;
        this.tickListenerActive = true;

        this.launcher.clock.onTick(async (event) => {
            const { tick, epoch } = event;
            const tickPromises = [...this.runners.values()].map((runner) => {
                // Phase 7 DIALOG-01 (D-10, D-11): pull-query the aggregator
                // before each runner's tick so any completed bidirectional
                // dialogue window surfaces as TickParams.dialogue_context on
                // Brain's next RPC. Empty array → plain runner.tick(tick, epoch).
                const contexts = this.launcher.aggregator.drainPending(runner.nousDid, tick);
                if (contexts.length === 0) {
                    return runner.tick(tick, epoch).catch((err) => {
                        console.error(`[GridCoordinator] tick error for ${runner.nousName}:`, err);
                    });
                }
                // Multiple contexts: deliver each sequentially on the runner
                // so Brain observes one dialogue per sendTick — preserves
                // stable per-context reasoning ordering (D-11).
                return contexts.reduce<Promise<void>>(
                    (chain, ctx) => chain.then(() => runner.tick(tick, epoch, ctx)),
                    Promise.resolve(),
                ).catch((err) => {
                    console.error(`[GridCoordinator] tick error for ${runner.nousName}:`, err);
                });
            });
            await Promise.all(tickPromises);
        });
    }

    /**
     * Route a message from a speaker to all other Nous in the same region.
     * Agora channels are region-scoped: only Nous in the same region receive them.
     */
    private routeMessage(
        speakerDid: string,
        speakerName: string,
        channel: string,
        text: string,
        tick: number,
    ): void {
        // Find speaker's current region
        const speakerPosition = this.launcher.space.getPosition(speakerDid);
        if (!speakerPosition) return;

        const speakerRegion = speakerPosition.regionId;

        // Relay to all other connected Nous in the same region
        for (const [did, runner] of this.runners) {
            if (did === speakerDid) continue; // don't echo to self

            const position = this.launcher.space.getPosition(did);
            if (!position || position.regionId !== speakerRegion) continue;

            // Fire-and-forget: don't await (avoid blocking the routing loop)
            runner.receiveMessage(speakerName, speakerDid, channel, text, tick).catch(err => {
                console.error(`[GridCoordinator] relay error to ${runner.nousName}:`, err);
            });
        }
    }

    /**
     * Phase 14 RIG-04: synchronous tick dispatch with completion guarantee.
     *
     * Unlike start() (which wires clock.onTick fire-and-forget for production real-time
     * pacing), awaitTick() is for headless rigs that drive ticks via clock.advance() in
     * a direct for-loop. Returns a Promise that resolves only after EVERY connected
     * runner's tick(tick, epoch) has settled, so rig.mjs can advance the next tick
     * without races between simultaneous ticks (Open Question A4 from RESEARCH.md).
     *
     * Rigs MUST NOT call start() — call addRunner() then advance ticks in a loop with
     * `await coordinator.awaitTick(tick, epoch)`.
     */
    async awaitTick(tick: number, epoch: number): Promise<void> {
        const tickPromises = [...this.runners.values()].map((runner) => {
            const contexts = this.launcher.aggregator.drainPending(runner.nousDid, tick);
            if (contexts.length === 0) {
                return runner.tick(tick, epoch).catch((err) => {
                    console.error(`[GridCoordinator.awaitTick] tick error for ${runner.nousName}:`, err);
                });
            }
            return contexts.reduce<Promise<void>>(
                (chain, ctx) => chain.then(() => runner.tick(tick, epoch, ctx)),
                Promise.resolve(),
            ).catch((err) => {
                console.error(`[GridCoordinator.awaitTick] tick error for ${runner.nousName}:`, err);
            });
        });
        await Promise.all(tickPromises);
    }

    /**
     * Phase 8 AGENCY-05 (D-30 step 2): remove runner and clean up resources
     * after a Nous has been tombstoned by the H5 delete route.
     *
     * Idempotent — calling despawnNous on an already-removed DID is a no-op.
     * The registry.tombstone call (step 1) already removed the Nous from
     * SpatialMap; this removes the runner from the coordinator so future
     * ticks are not dispatched to a tombstoned Nous.
     */
    despawnNous(nousDid: string): void {
        this.runners.delete(nousDid);
    }

    /** Number of active runners. */
    get size(): number {
        return this.runners.size;
    }

    /** Get a runner by Nous DID. */
    getRunner(nousDid: string): NousRunner | undefined {
        return this.runners.get(nousDid);
    }
}
