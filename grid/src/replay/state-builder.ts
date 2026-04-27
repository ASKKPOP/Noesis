/**
 * buildStateAtTick — pure functional core of state-level replay.
 *
 * REPLAY-04: Replaying a chain through the existing listeners must produce
 * derived state byte-identical to a live launcher that processed the same entries.
 *
 * T-10-08 compliance: wall-clock reads are forbidden in this file. All timing derives
 * from entry payloads (chain ticks). No timer scheduling of any kind.
 *
 * Pitfall mitigation (chain.ts:74): AuditChain.loadEntries() is silent — onAppend
 * listeners do NOT fire during restore. RelationshipListener.rebuildFromChain()
 * must be called EXPLICITLY after restore to reconstruct derived edge state.
 * This file always calls rebuildFromChain() after constructing the ReplayGrid
 * to honour this invariant (D-13-04 / P-9-02).
 *
 * Decision reference: D-13-04 (13-CONTEXT.md §canonical_refs).
 */

import type { Edge } from '../relationships/types.js';
import type { ReplayGrid } from './replay-grid.js';

/**
 * Snapshot of derived Grid state at a specific tick.
 *
 * Only fields needed by Phase 13 consumers are included here.
 * Future phases can extend this interface as more subsystem state is needed.
 */
export interface ReplayState {
    /** The tick this snapshot represents. */
    readonly tick: number;
    /**
     * All relationship edges active at this tick.
     * Shallow copies of the Edge objects from RelationshipListener.
     * Sorted deterministically for byte-identical JSON serialization (REPLAY-04).
     */
    readonly relationshipEdges: ReadonlyArray<Readonly<Edge>>;
}

/**
 * Build a derived-state snapshot from the replay grid at the given tick.
 *
 * The function:
 *   1. Calls rebuildFromChain() on the provided ReplayGrid to ensure derived
 *      state (relationship edges, etc.) is fully reconstructed from loaded entries.
 *   2. Collects relationship edges from RelationshipListener.
 *   3. Returns a deterministic ReplayState snapshot.
 *
 * The `tick` parameter filters which entries contribute to derived state.
 * For tick === 0 with no entries, all derived state is empty.
 * For tick === N, only entries with id <= N are considered.
 *
 * NOTE: This function operates on a caller-provided ReplayGrid. The caller
 * is responsible for constructing a ReplayGrid with the appropriate entry slice.
 * The function calls rebuildFromChain() — callers should not pre-call it.
 *
 * T-10-07: this function never invokes audit append at any point.
 *
 * @param replay - ReplayGrid instance loaded with the entry slice to replay.
 * @param tick - The logical tick index to snapshot state at.
 * @returns ReplayState containing relationship edges and tick metadata.
 */
export function buildStateAtTick(replay: ReplayGrid, tick: number): ReplayState {
    // Reconstruct derived state from the loaded entries.
    // RelationshipListener.rebuildFromChain() walks audit.all() manually
    // (no onAppend invocation), building the edges Map from scratch.
    // This must be called here (not in the constructor) per D-13-04 so that
    // callers who register additional onAppend listeners before this call
    // have those listeners respected during the explicit rebuild walk.
    replay.rebuildFromChain();

    // Collect all relationship edges from the listener.
    // allEdges() returns an IterableIterator — spread to array for deterministic snapshot.
    const edgesIter = replay.relationships.allEdges();
    const relationshipEdges: Array<Readonly<Edge>> = [];
    for (const edge of edgesIter) {
        relationshipEdges.push({ ...edge });
    }

    return {
        tick,
        relationshipEdges,
    };
}
