/**
 * Phase 10b D-10b-11 — Chronos pure-observer listener for the Grid AuditChain.
 *
 * Chronos is a **read-side only** subsystem. It subscribes to the AuditChain
 * to observe `bios.birth` events and track per-Nous birth ticks (enabling
 * `epoch_since_spawn` computations in the Brain). It MUST NOT:
 *   - Append events to the chain (zero-diff invariant D-17 / c7c49f49...)
 *   - Read wall-clock (Date.now / performance.now — D-10b-09)
 *   - Modify any AuditEntry in place
 *
 * The sole side-effect is an in-memory birth-tick registry (birthTicks map)
 * that callers may query via getBirthTick(did). This is Brain-local state;
 * it never crosses the wire.
 *
 * Pattern source: DialogueAggregator (grid/src/dialogue/aggregator.ts) —
 * same AuditChain.onAppend listener discipline.
 *
 * Wall-clock free per D-10b-09.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';

/** Minimal BiosRuntime-ish handle that Chronos needs: just `birth_tick`. */
export interface ChronosConfig {
    /**
     * Optional BiosRuntime (or compatible object). When provided, the listener
     * registers its `birth_tick` on the first `bios.birth` event seen for each
     * DID. Currently unused in the pure-observer path (the listener derives
     * birth ticks from the chain itself), but the parameter is wired so the
     * stub test can pass a `BiosRuntime` without rejection.
     */
    bios?: { birth_tick: number } | null;
}

/** Unsubscribe callable returned by wireChronosListener. */
export type ChronosUnsubscribe = () => void;

/**
 * A stateful observer that tracks per-Nous birth ticks from the audit chain.
 * Constructed via `wireChronosListener` which returns the unsubscribe function.
 *
 * Pure observer contract:
 *   - Never calls audit.append / audit.loadEntries.
 *   - Never reads Date.now / performance.now.
 *   - No mutable writes to any AuditEntry.
 */
export class ChronosListener {
    /** Per-DID birth tick, populated on first `bios.birth` observation. */
    private readonly birthTicks = new Map<string, number>();

    /** Handle an incoming AuditEntry (called synchronously after each append). */
    onEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'bios.birth') return;

        const payload = entry.payload as Record<string, unknown>;
        const did = payload['did'];
        const tick = payload['tick'];

        if (typeof did !== 'string' || typeof tick !== 'number') return;

        // Memoize birth tick — first occurrence wins (idempotent).
        if (!this.birthTicks.has(did)) {
            this.birthTicks.set(did, tick);
        }
    }

    /**
     * Return the birth tick for `did`, or `undefined` if not yet observed.
     * Pure read — no side effects.
     */
    getBirthTick(did: string): number | undefined {
        return this.birthTicks.get(did);
    }

    /**
     * Compute epoch_since_spawn for a DID given the current system tick.
     * Returns `undefined` if no `bios.birth` has been seen for this DID.
     */
    epochSinceSpawn(did: string, currentTick: number): number | undefined {
        const birthTick = this.birthTicks.get(did);
        if (birthTick === undefined) return undefined;
        return currentTick - birthTick;
    }
}

/**
 * Wire a ChronosListener as a pure observer on the given AuditChain.
 *
 * Returns the ChronosListener instance (so callers can query birth ticks)
 * and an unsubscribe function (so tests can clean up).
 *
 * The `_config` parameter accepts a `{ bios }` shape for test-harness
 * compatibility; in the current implementation Chronos derives all state
 * from the chain directly and does not need a pre-constructed BiosRuntime.
 *
 * @example
 * ```ts
 * const { listener, unsubscribe } = wireChronosListener(audit, { bios });
 * // ... ticks ...
 * const age = listener.epochSinceSpawn(did, currentTick);
 * unsubscribe();
 * ```
 */
export function wireChronosListener(
    audit: AuditChain,
    _config: ChronosConfig = {},
): { listener: ChronosListener; unsubscribe: ChronosUnsubscribe } {
    const listener = new ChronosListener();
    const unsubscribe = audit.onAppend((entry) => listener.onEntry(entry));
    return { listener, unsubscribe };
}
