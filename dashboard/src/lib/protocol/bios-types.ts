/**
 * SYNC: mirrors brain/src/noesis_brain/bios/config.py (NEED_BASELINES)
 * SYNC: mirrors grid/src/bios/types.ts (BiosBirthPayload, BiosDeathPayload)
 *
 * Drift is detected by dashboard/test/lib/bios-types.drift.test.ts,
 * which reads the Python source and fails if the enum or baseline values
 * diverge.
 *
 * Two-source copy intentional — dashboard is a Next.js app with no
 * workspace dep on grid/ or brain/; a divergent copy surfaces in grep the
 * moment upstream shapes change.
 *
 * PRIVACY — BIOS render surface:
 *   Baseline floats (energy=0.3, sustenance=0.3) NEVER enter this file or
 *   any downstream dashboard module. Only the bucketed enum is mirrored. The
 *   drift-detector test parses the Brain floats at test time and compares the
 *   bucketed result — it does not import them into the build.
 *
 * WIRE FORMAT: Keys are snake_case per D-10b-01 (interop with Brain-side
 * Python which serializes snake_case). The drift test compares shape
 * byte-equivalently; any camelCase leak fails the test.
 */

// ---------------------------------------------------------------------------
// Need name, level, direction
// ---------------------------------------------------------------------------

export const NEED_ORDER = ['energy', 'sustenance'] as const;
export type NeedName = (typeof NEED_ORDER)[number];

export const NEED_LEVELS = ['low', 'med', 'high'] as const;
export type NeedLevel = (typeof NEED_LEVELS)[number];

export const NEED_DIRECTIONS = ['rising', 'falling'] as const;
export type NeedDirection = (typeof NEED_DIRECTIONS)[number] | null;

// ---------------------------------------------------------------------------
// Visual constants (UI-SPEC §Glyph Matrix — LOCKED per D-10b decision)
// ---------------------------------------------------------------------------

/** Glyph per need — U+26A1 lightning bolt for energy, U+2B21 white hexagon for sustenance. */
export const NEED_GLYPH: Record<NeedName, string> = {
    energy: '\u26A1',
    sustenance: '\u2B21',
};

// ---------------------------------------------------------------------------
// Baseline levels (bucketed mirror of Brain NEED_BASELINES)
// ---------------------------------------------------------------------------

/**
 * Mirrors Brain's NEED_BASELINES float → bucket() result from LOW.
 * Both baselines are 0.3 (below THRESHOLD_LOW=0.33) → 'low'.
 * See drift detector for the bucket derivation.
 */
export const NEED_BASELINE_LEVEL: Record<NeedName, NeedLevel> = {
    energy: 'low',
    sustenance: 'low',
};

// ---------------------------------------------------------------------------
// Drive-to-need elevator mapping (D-10b-02 FROZEN)
// ---------------------------------------------------------------------------

/**
 * Maps the two Bios-relevant drives to their corresponding need names.
 * Only hunger → energy and safety → sustenance are valid; all other drives
 * are ignored by the Bios surface.
 */
export const NEED_TO_DRIVE: Record<NeedName, string> = {
    energy: 'hunger',
    sustenance: 'safety',
};

// ---------------------------------------------------------------------------
// Level entry (used by hook + component)
// ---------------------------------------------------------------------------

export interface BiosLevelEntry {
    readonly level: NeedLevel;
    readonly direction: NeedDirection;
}

// ---------------------------------------------------------------------------
// Wire payload types — byte-equivalent mirror of grid/src/bios/types.ts
// Keys are snake_case per D-10b-01. The drift test enforces parity.
// ---------------------------------------------------------------------------

/** Bios birth payload — 3-key closed tuple. */
export interface BiosBirthPayload {
    readonly did: string;
    readonly psyche_hash: string;   // snake_case per D-10b-01 (mirrors grid source)
    readonly tick: number;
}

/** Locked alphabetical key tuple for sort-equality check. */
export const BIOS_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;

/** Closed enum for bios-death cause — exactly 3 members. */
export const CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary'] as const;
export type Cause = typeof CAUSE_VALUES[number];

/** Bios death payload — 4-key closed tuple. */
export interface BiosDeathPayload {
    readonly cause: Cause;
    readonly did: string;
    readonly final_state_hash: string;   // snake_case per D-10b-01 (mirrors grid source)
    readonly tick: number;
}

/** Locked alphabetical key tuple for sort-equality check. */
export const BIOS_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;

/**
 * Type-narrowing literal-guard for the death-cause enum. Throws on any value
 * outside CAUSE_VALUES. Error message intentionally uses the substring
 * "invalid cause" to match the test regex /unknown cause|invalid cause/.
 */
export function assertCause(c: string): asserts c is Cause {
    if (!(CAUSE_VALUES as readonly string[]).includes(c)) {
        throw new TypeError(`invalid cause: ${JSON.stringify(c)}`);
    }
}
