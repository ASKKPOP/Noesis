/**
 * Phase 9 Plan 01 — Canonical edge serialization + pure helper functions.
 *
 * All exports are pure functions: no I/O, no wall-clock access, no randomness,
 * no timers — deterministic from inputs alone (D-9-12 wall-clock ban).
 *
 * Reference implementation: RESEARCH.md §Canonical edge + hash lines 828–866.
 * Copied verbatim per plan instruction (no re-derivation).
 *
 * D-9-10: canonicalEdge locks 6-key order + toFixed(3) for float precision.
 * D-9-11: sortedPairKey throws on self-loops (listener catches, drops silently).
 */

import { createHash } from 'node:crypto';
import type { Edge, RelationshipConfig, WarmthBucket } from './types.js';

export function canonicalEdge(edge: Edge): string {
    return JSON.stringify({
        did_a: edge.did_a,
        did_b: edge.did_b,
        valence: edge.valence.toFixed(3),
        weight: edge.weight.toFixed(3),
        recency_tick: edge.recency_tick,
        last_event_hash: edge.last_event_hash,
    });
}

export function edgeHash(edge: Edge): string {
    return createHash('sha256').update(canonicalEdge(edge)).digest('hex');
}

export function decayedWeight(edge: Edge, currentTick: number, tau: number): number {
    if (currentTick <= edge.recency_tick) return edge.weight;  // guard against paused-tick
    const delta = currentTick - edge.recency_tick;
    return edge.weight * Math.exp(-delta / tau);
}

export function warmthBucket(weight: number, config: RelationshipConfig): WarmthBucket {
    if (weight < config.warmthColdMax) return 'cold';
    if (weight < config.warmthWarmMax) return 'warm';
    return 'hot';
}

export function sortedPairKey(didA: string, didB: string): string {
    if (didA === didB) throw new Error('self-loop rejected');  // D-9-11
    return didA < didB ? `${didA}|${didB}` : `${didB}|${didA}`;
}
