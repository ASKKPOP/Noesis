/**
 * Phase 10b — Grid-side BiosRuntime stub.
 *
 * The authoritative BiosRuntime lives in the Brain subsystem
 * (brain/src/noesis_brain/bios/runtime.py). The Grid side does not
 * execute Bios math — that happens in the Brain and results flow to
 * the Grid via RPC actions (drive_crossed, bios_death).
 *
 * This stub satisfies the Grid test harness for the Chronos wire-listener
 * test (grid/test/regression/pause-resume-10b.test.ts) which needs to
 * instantiate a lightweight `{ seed, birth_tick }` object so
 * `wireChronosListener` can be called with a `{ bios }` config.
 *
 * Shape mirrors brain/src/noesis_brain/bios/runtime.py constructor
 * signature: `BiosRuntime({ seed, birth_tick })`.
 *
 * Wall-clock free per D-10b-09.
 */

export interface BiosRuntimeConfig {
    seed: number;
    birth_tick: number;
}

/**
 * Lightweight Grid-side BiosRuntime handle.
 *
 * Used as a marker object by `wireChronosListener` and test harnesses.
 * It does NOT perform Bios math (that is Brain-side). It exposes only
 * the constructor params needed by the Chronos listener config.
 */
export class BiosRuntime {
    readonly seed: number;
    readonly birth_tick: number;

    constructor(config: BiosRuntimeConfig) {
        this.seed = config.seed;
        this.birth_tick = config.birth_tick;
    }
}
