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
            const tickPromises = [...this.runners.values()].map(runner =>
                runner.tick(tick, epoch).catch(err => {
                    console.error(`[GridCoordinator] tick error for ${runner.nousName}:`, err);
                })
            );
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

    /** Number of active runners. */
    get size(): number {
        return this.runners.size;
    }

    /** Get a runner by Nous DID. */
    getRunner(nousDid: string): NousRunner | undefined {
        return this.runners.get(nousDid);
    }
}
