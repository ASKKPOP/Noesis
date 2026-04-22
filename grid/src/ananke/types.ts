/**
 * Closed enums + payload contract for the Ananke drive-crossed audit event.
 * Phase 10a — DRIVE-03, DRIVE-05.
 *
 * Mirrors brain/src/noesis_brain/ananke/types.py. Drift is tested in
 * grid/test/ananke/types-drift.test.ts (Plan 10a-06).
 *
 * Contract-locked by 10a-CONTEXT.md D-10a-03:
 *   Closed 5-key payload `{did, tick, drive, level, direction}` enforced via
 *   `Object.keys(payload).sort()` strict equality (clone Phase 7 pattern).
 */

/**
 * Closed 5-member drive enum. Order matches REQUIREMENTS DRIVE-01 enumeration.
 * No numeric drive value is transmitted — only the closed-enum triple
 * {drive, level, direction} crosses the Brain↔Grid↔Dashboard wire (DRIVE-05).
 */
export const ANANKE_DRIVE_NAMES = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
] as const;
export type AnankeDriveName = typeof ANANKE_DRIVE_NAMES[number];

/**
 * Closed 3-member level enum. `med` is deliberately abbreviated (not `medium`)
 * to match the payload enum across Brain↔Grid↔Dashboard. Do NOT relax.
 */
export const ANANKE_DRIVE_LEVELS = ['low', 'med', 'high'] as const;
export type AnankeDriveLevel = typeof ANANKE_DRIVE_LEVELS[number];

/**
 * Closed 2-member direction enum. Stable rows omit direction entirely (no row
 * emitted); there is no `stable` payload value. This is a deliberate
 * structural invariant — `stable` is a UI-side concept only.
 */
export const ANANKE_DIRECTIONS = ['rising', 'falling'] as const;
export type AnankeDirection = typeof ANANKE_DIRECTIONS[number];

/**
 * Closed 5-key payload for the Ananke drive-crossed audit event. Contract-locked by D-10a-03.
 *
 * Key-set strict equality is enforced at runtime by appendAnankeDriveCrossed;
 * the TypeScript type is advisory and does NOT guarantee shape at the wire.
 */
export interface AnankeDriveCrossedPayload {
    /** Actor DID — matches DID_RE (see append-drive-crossed.ts). */
    readonly did: string;
    /** Non-negative integer tick. */
    readonly tick: number;
    /** Drive whose pressure crossed the threshold. */
    readonly drive: AnankeDriveName;
    /** The NEW (post-crossing) level. */
    readonly level: AnankeDriveLevel;
    /** Direction of the crossing. */
    readonly direction: AnankeDirection;
}
