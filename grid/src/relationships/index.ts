/**
 * Phase 9 Plan 01 — Relationship subsystem barrel export.
 *
 * Consumers: grid/src/relationships/** internal, future Wave 1 listener/storage.
 * Pattern mirrors grid/src/dialogue/index.ts (NodeNext .js extension convention).
 *
 * Re-exports include: WarmthBucket, Edge, RelationshipConfig, SpokeObservation,
 * DEFAULT_RELATIONSHIP_CONFIG, canonicalEdge, edgeHash, decayedWeight,
 * warmthBucket, sortedPairKey.
 */

export type { WarmthBucket, Edge, RelationshipConfig, SpokeObservation } from './types.js';
export { DEFAULT_RELATIONSHIP_CONFIG } from './config.js';
export { canonicalEdge, edgeHash, decayedWeight, warmthBucket, sortedPairKey } from './canonical.js';
export { RelationshipListener } from './listener.js';
