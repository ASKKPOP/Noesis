/**
 * Phase 7 Plan 01 — dialogue_id computation (D-03, D-06).
 *
 * Pure function: no I/O, no Date.now, no randomness. Order-independent over
 * the `dids` array (sorted internally). Input domain fully determines output.
 *
 * dialogue_id = sha256(sortedDids.join('|') + '|' + channel + '|' + windowStartTick).slice(0, 16)
 *
 * The 16-hex form (64 bits) is collision-resistant enough for per-run
 * dialogue identity; full 64-hex is reserved for audit.* event_hash fields.
 *
 * Pattern mirrors `grid/src/api/operator/telos-force.ts` HEX64_RE runtime guard.
 */

import { createHash } from 'node:crypto';

export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

/**
 * Compute a deterministic 16-hex dialogue_id from the triple
 * (sortedDids, channel, windowStartTick).
 *
 * @param dids              Two or more participant did:noesis:* identifiers;
 *                          order does not matter (internally sorted).
 * @param channel           Channel identifier (D-05 gates per-channel aggregation).
 * @param windowStartTick   First tick of the sliding window this dialogue covers.
 * @returns 16-hex lowercase string matching DIALOGUE_ID_RE.
 */
export function computeDialogueId(
    dids: readonly string[],
    channel: string,
    windowStartTick: number,
): string {
    const sorted = [...dids].sort();
    const input = `${sorted.join('|')}|${channel}|${windowStartTick}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
