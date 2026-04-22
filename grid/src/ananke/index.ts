/**
 * Public module surface for Grid-side Ananke drive audit emission.
 * Phase 10a — DRIVE-03, DRIVE-05.
 *
 * Exports the sole producer function + closed-enum constants + payload type.
 * NO internal helpers leak.
 */

export { appendAnankeDriveCrossed, DID_RE } from './append-drive-crossed.js';
export {
    ANANKE_DIRECTIONS,
    ANANKE_DRIVE_LEVELS,
    ANANKE_DRIVE_NAMES,
} from './types.js';
export type {
    AnankeDirection,
    AnankeDriveCrossedPayload,
    AnankeDriveLevel,
    AnankeDriveName,
} from './types.js';
