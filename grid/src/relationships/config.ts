/**
 * Phase 9 Plan 01 — Relationship engine frozen configuration.
 *
 * DEFAULT_RELATIONSHIP_CONFIG is the canonical set of bump constants and
 * decay parameters. Frozen via Object.freeze at module load — no runtime
 * mutation permitted. Per-Grid overrides are allowed via GridConfig, but
 * must create a new frozen object; they cannot mutate this constant.
 *
 * Values per D-9-01 (τ), D-9-02 (bump table), D-9-03 (snapshot cadence),
 * D-9-06 (warmth thresholds), D-9-07 (top-N caps).
 *
 * Pattern cloned from grid/src/audit/broadcast-allowlist.ts Object.freeze usage.
 */

import type { RelationshipConfig } from './types.js';

/**
 * Default relationship engine configuration (frozen, runtime-immutable).
 *
 * tau: 1000 ticks — half-life ≈ 693 ticks; edges cool to < 0.05 weight
 *   after ~3000 ticks. Lazy-computed at read time (no per-tick sweep).
 *
 * Bump table follows D-9-02 closed mapping:
 *   nous.spoke (bidirectional)    +0.01 valence / +0.02 weight
 *   trade.settled                 +0.10 / +0.10
 *   trade.reviewed(rejected)      -0.10 / +0.05  (interaction still counts)
 *   telos.refined (pair match)    +0.05 / +0.05
 */
export const DEFAULT_RELATIONSHIP_CONFIG: RelationshipConfig = Object.freeze({
    tau: 1000,
    bumpSpokeValence: 0.01,
    bumpSpokeWeight: 0.02,
    bumpTradeSettledValence: 0.10,
    bumpTradeSettledWeight: 0.10,
    bumpTradeRejectedValence: -0.10,
    bumpTradeRejectedWeight: 0.05,
    bumpTelosRefinedValence: 0.05,
    bumpTelosRefinedWeight: 0.05,
    warmthColdMax: 0.20,
    warmthWarmMax: 0.60,
    snapshotCadenceTicks: 100,
    topNDefault: 5,
    topNMax: 20,
} as const);
