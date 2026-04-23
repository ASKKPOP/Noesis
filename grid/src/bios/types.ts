/**
 * Bios event payload types — Phase 10b BIOS-02, BIOS-03, BIOS-04.
 *
 * Closed-tuple — exact keys only, sorted equality. Snake_case on the wire
 * per D-10b-01 (interop with Brain-side Python which serializes snake_case).
 *
 * Per CONTEXT.md D-10b-03 / D-10b-04:
 *   - birth payload: {did, psyche_hash, tick}                 — 3 keys
 *   - death payload: {cause, did, final_state_hash, tick}     — 4 keys
 *   - cause ∈ {starvation, operator_h5, replay_boundary}      — 3 closed enum
 *
 * NOTE: Event-name string literals MUST NOT appear in this file —
 * the producer-boundary invariant test (test/bios/bios-producer-boundary.test.ts)
 * scans all .ts files in grid/src/ and rejects any non-allowlist non-emitter
 * occurrence of those literals.
 */

/** Bios birth payload — 3-key closed tuple. */
export interface BiosBirthPayload {
    readonly did: string;
    readonly psyche_hash: string;
    readonly tick: number;
}

/** Locked alphabetical key tuple for sort-equality check. */
export const BIOS_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;

/** Closed enum for bios-death cause — exactly 3 members. */
export const CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary'] as const;
export type BiosDeathCause = typeof CAUSE_VALUES[number];

/** Bios death payload — 4-key closed tuple. */
export interface BiosDeathPayload {
    readonly cause: BiosDeathCause;
    readonly did: string;
    readonly final_state_hash: string;
    readonly tick: number;
}

/** Locked alphabetical key tuple for sort-equality check. */
export const BIOS_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;

/**
 * Type-narrowing literal-guard for the death-cause enum. Throws on any value
 * outside CAUSE_VALUES. Error message intentionally uses the substring
 * "invalid cause" to match the test regex /unknown cause|invalid cause/.
 */
export function assertCause(c: string): asserts c is BiosDeathCause {
    if (!(CAUSE_VALUES as readonly string[]).includes(c)) {
        throw new TypeError(`invalid cause: ${JSON.stringify(c)}`);
    }
}
