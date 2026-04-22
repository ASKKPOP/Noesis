/**
 * Phase 9 Plan 01 — Relationship subsystem type definitions.
 *
 * All fields are readonly — Edge must be immutable after construction.
 * did_a < did_b lexicographically always (sorted by caller via sortedPairKey).
 *
 * RelationshipConfig holds all bump constants + decay parameters. Frozen
 * at runtime via DEFAULT_RELATIONSHIP_CONFIG in config.ts.
 *
 * WarmthBucket is the privacy-safe representation of relationship strength
 * surfaced at H1 tier (no raw floats).
 */

/** Three-tier warmth classification for H1-tier privacy surface (D-9-06). */
export type WarmthBucket = 'cold' | 'warm' | 'hot';

/**
 * Undirected relationship edge between two Nous.
 * did_a < did_b lexicographically always (enforced by sortedPairKey caller).
 * Valence ∈ [-1, +1]; weight ∈ [0, +1]; both clamped at producer boundary.
 */
export interface Edge {
    readonly did_a: string;             // lexicographically smaller DID
    readonly did_b: string;             // lexicographically larger DID
    valence: number;                    // [-1.000, +1.000] — sentiment score
    weight: number;                     // [0.000, +1.000] — engagement strength (pre-decay)
    recency_tick: number;               // tick of most recent mutation (for lazy-decay)
    last_event_hash: string;            // SHA-256 hex of audit entry that last mutated this edge
}

/**
 * Frozen configuration for the relationship engine.
 * 14 keys — all readonly; values per D-9-01/D-9-02/D-9-03/D-9-06/D-9-07.
 * See DEFAULT_RELATIONSHIP_CONFIG in config.ts for concrete values.
 */
export interface RelationshipConfig {
    readonly tau: number;                           // τ default 1000 ticks (D-9-01)
    readonly bumpSpokeValence: number;             // +0.01 per nous.spoke bidirectional (D-9-02)
    readonly bumpSpokeWeight: number;              // +0.02 per nous.spoke bidirectional
    readonly bumpTradeSettledValence: number;      // +0.10 per trade.settled
    readonly bumpTradeSettledWeight: number;       // +0.10 per trade.settled
    readonly bumpTradeRejectedValence: number;     // -0.10 per trade.reviewed(rejected)
    readonly bumpTradeRejectedWeight: number;      // +0.05 per trade.reviewed(rejected)
    readonly bumpTelosRefinedValence: number;      // +0.05 per telos.refined with matching pair
    readonly bumpTelosRefinedWeight: number;       // +0.05 per telos.refined with matching pair
    readonly warmthColdMax: number;                // 0.20 — upper bound for 'cold' bucket (D-9-06)
    readonly warmthWarmMax: number;                // 0.60 — upper bound for 'warm' bucket
    readonly snapshotCadenceTicks: number;         // 100 — MySQL snapshot interval (D-9-03)
    readonly topNDefault: number;                  // 5 — default top-N for Inspector (D-9-07)
    readonly topNMax: number;                      // 20 — server-side cap on top-N
}

/**
 * Normalized observation extracted from an AuditChain entry.
 * Produced by RelationshipListener.handleEntry() after decoding the audit payload.
 * Not exposed to Brain; only the derived edge state is surfaced via REST.
 */
export interface SpokeObservation {
    readonly did_a: string;             // lexicographically smaller DID (sorted by caller)
    readonly did_b: string;             // lexicographically larger DID
    readonly tick: number;              // audit entry tick
    readonly entryHash: string;         // SHA-256 hex event_hash of the audit entry
    readonly bumpKind: 'nous.spoke' | 'trade.settled' | 'trade.reviewed.rejected' | 'telos.refined';
}
