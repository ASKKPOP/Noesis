/**
 * SYNC: mirrors brain/src/noesis_brain/ananke/types.py
 * SYNC: mirrors brain/src/noesis_brain/ananke/config.py (DRIVE_BASELINES)
 * SYNC: mirrors grid/src/ananke/types.ts
 *
 * Drift is detected by dashboard/test/lib/ananke-types.drift.test.ts,
 * which reads the Python source and fails if the enum or baseline values
 * diverge.
 *
 * Two-source copy intentional — dashboard is a Next.js app with no
 * workspace dep on grid/ or brain/; a divergent copy surfaces in grep the
 * moment upstream shapes change.
 *
 * PRIVACY — DRIVE-05 render surface:
 *   Baseline floats (hunger=0.3, curiosity=0.5, safety=0.2, boredom=0.4,
 *   loneliness=0.4) NEVER enter this file or any downstream dashboard
 *   module. Only the bucketed enum is mirrored. The drift-detector test
 *   parses the Brain floats at test time and compares the bucketed
 *   result — it does not import them into the build.
 */

export const DRIVE_ORDER = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
] as const;
export type DriveName = (typeof DRIVE_ORDER)[number];

export const DRIVE_LEVELS = ['low', 'med', 'high'] as const;
export type DriveLevel = (typeof DRIVE_LEVELS)[number];

export const DRIVE_DIRECTIONS = ['rising', 'falling'] as const;
export type DriveDirection = (typeof DRIVE_DIRECTIONS)[number];

/**
 * Mirrors Brain's DRIVE_BASELINES float → bucket() result from LOW.
 * See drift detector for the bucket-from-LOW derivation.
 */
export const DRIVE_BASELINE_LEVEL: Record<DriveName, DriveLevel> = {
    hunger: 'low',
    curiosity: 'med',
    safety: 'low',
    boredom: 'med',
    loneliness: 'med',
};

export interface AnankeLevelEntry {
    readonly level: DriveLevel;
    readonly direction: DriveDirection | null;
}

/**
 * Closed-tuple payload shape mirrored from grid/src/ananke/types.ts
 * (AnankeDriveCrossedPayload). Dashboard receives this as an audit-entry
 * payload via the broadcast stream; it is NEVER used to issue an HTTP or
 * RPC call.
 */
export interface AnankeDriveCrossedPayload {
    readonly did: string;
    readonly tick: number;
    readonly drive: DriveName;
    readonly level: DriveLevel;
    readonly direction: DriveDirection;
}
